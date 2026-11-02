"""UK ceilings from Freedom of Information offer rates (used by build_model.py).

The admits-only curve shows how GPA separates admitted students, but not how many applicants at that GPA a
programme turns away for lack of places. UK universities' FOI replies give that directly: offers / applications,
overall and for applicants of Chinese nationality, per programme (foi_programmes.json).

1. Target: the Chinese applicants' offer rate (the pool closest to the cases the curve is fitted on). Where a
   programme only has the all-applicant rate, it is converted with the university's own Chinese / all ratio (median
   over its programmes with both), else the overall median ratio, and given half weight.
2. A weighted ridge regression on the logit of that rate (programme K, elite flag, institution QS rank, discipline,
   a pooled institution effect) predicts it for UK programmes without FOI figures; programmes with figures are shrunk
   towards the prediction by their number of applications (n / (n + 60)). Cross-validated by held-out institution.
3. Ceiling: the chance of an applicant at the admitted median K is set to m x the programme's offer rate, where
   m = admit rate around the median / overall admit rate in the GradCafe admits-and-rejections data, so
   c = m * rate / sigmoid((K - theta) / s), kept between the rate itself and 0.95."""
import math, re, collections
import numpy as np

DISC_GROUPS = ["business", "accounting-finance", "ai-data", "it", "law-criminology", "education", "healthcare-nursing",
               "engineering", "communication", "psychology-counselling", "economics"]
logit = lambda p: math.log(p / (1 - p))
expit = lambda z: 1 / (1 + math.exp(-z))
sig = expit


def qs_rank(inst):
    try: return float((inst.get("qs") or {}).get("rankValue") or 0) or 1200.0
    except Exception: return 1200.0


def fit(progs, P, INST, FOI, CAL):
    byid = {p["id"]: p for p in P}
    uk = [pid for pid in progs if (INST.get(byid[pid]["institutionId"]) or {}).get("country") == "United Kingdom"]
    # ---- Chinese / all ratio per university ----
    ratios = collections.defaultdict(list)
    for pid, f in FOI.items():
        if f.get("offerRate") and f.get("cnOfferRate") and f["cnApplications"] >= 20:
            ratios[byid[pid]["institutionId"]].append(f["cnOfferRate"] / f["offerRate"])
    allr = [x for v in ratios.values() for x in v]
    g_ratio = float(np.median(allr)) if allr else 0.8
    u_ratio = {k: float(np.median(v)) for k, v in ratios.items() if len(v) >= 5}
    # ---- observations ----
    obs = {}
    for pid in uk:
        f = FOI.get(pid)
        if not f: continue
        if f.get("cnOfferRate") is not None:
            obs[pid] = (min(max(f["cnOfferRate"], 0.02), 0.98), f["cnApplications"], 1.0)
        elif f.get("offerRate") is not None:
            r = f["offerRate"] * u_ratio.get(byid[pid]["institutionId"], g_ratio)
            obs[pid] = (min(max(r, 0.02), 0.98), f["applications"], 0.5)
    insts = sorted({byid[p]["institutionId"] for p in uk})
    iidx = {k: i for i, k in enumerate(insts)}

    def feats(pid):
        p, e = byid[pid], progs[pid]
        x = [1.0, e["k"] - 3.6, 1.0 if e["cluster"] == "elite" else 0.0, math.log2(qs_rank(INST[p["institutionId"]]) / 100)]
        x += [1.0 if p.get("discipline") == d else 0.0 for d in DISC_GROUPS]
        return x
    nf = len(feats(uk[0]))

    def solve(ids):
        X = np.array([feats(p) + [0.0] * len(insts) for p in ids]); y = np.array([logit(obs[p][0]) for p in ids])
        for r, p in enumerate(ids): X[r, nf + iidx[byid[p]["institutionId"]]] = 1.0
        w = np.array([min(obs[p][1], 300) * obs[p][2] for p in ids])
        lam = np.r_[[1e-3], [1.0] * (nf - 1), [8.0] * len(insts)] * w.mean()
        A = X.T @ (X * w[:, None]) + np.diag(lam)
        return np.linalg.solve(A, X.T @ (w * y))

    ids = sorted(obs)
    # cross-validation by held-out institution (institution effect then 0)
    err, base = [], []
    ybar = np.average([logit(obs[p][0]) for p in ids], weights=[min(obs[p][1], 300) for p in ids])
    for inst in {byid[p]["institutionId"] for p in ids}:
        tr = [p for p in ids if byid[p]["institutionId"] != inst]; te = [p for p in ids if byid[p]["institutionId"] == inst]
        if len(tr) < 30: continue
        b = solve(tr)
        for p in te:
            pr = expit(float(np.dot(feats(p), b[:nf]))); err.append((pr - obs[p][0]) ** 2); base.append((expit(ybar) - obs[p][0]) ** 2)
    beta = solve(ids)
    cv = {"rmseRate": round(math.sqrt(np.mean(err)), 3) if err else None, "baselineRmse": round(math.sqrt(np.mean(base)), 3) if base else None, "programmes": len(ids)}

    # ---- m from GradCafe: admit rate around the median vs overall ----
    bands = CAL["admitRateByIqrFromMedian"]
    overall = sum(b["n"] * b["admitRate"] for b in bands.values()) / sum(b["n"] for b in bands.values())
    m = bands["-0.3..0.3"]["admitRate"] / overall

    out = {}
    for pid in uk:
        p, e = byid[pid], progs[pid]
        z = float(np.dot(feats(pid), beta[:nf])) + beta[nf + iidx[p["institutionId"]]]
        basis = "predicted"
        if pid in obs:
            r, n, wt = obs[pid]; a = n * wt / (n * wt + 60)
            z = a * logit(r) + (1 - a) * z; basis = "foi" if wt == 1.0 else "foi-all-applicants"
        rate = expit(z)
        at_k = sig((e["k"] - e["theta"]) / e["s"])
        c = min(0.95, max(rate, m * rate / at_k))
        out[pid] = {"rate": round(rate, 4), "c": round(c, 3), "basis": basis}
    coefs = dict(zip(["intercept", "K-3.6", "elite", "log2(QS/100)"] + DISC_GROUPS, [round(float(b), 3) for b in beta[:nf]]))
    meta = {"m": round(m, 3), "gradcafeOverall": round(overall, 3), "chineseToAllRatio": round(g_ratio, 3),
            "universityRatios": {k: round(v, 3) for k, v in u_ratio.items()}, "cv": cv, "coefficients": coefs,
            "observed": sum(1 for v in out.values() if v["basis"] != "predicted"), "programmes": len(out)}
    return out, meta
