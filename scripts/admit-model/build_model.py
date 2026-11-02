"""Combine observed and predicted programme parameters into data/raw/admit-model.json (last step of run.py)."""
import json, math, re, collections, datetime
import numpy as np

from common import RAW, WORK, SHIFT, load
P = load(RAW / "programmes.json")["programmes"]
AC = load(RAW / "admit-cases.json")["programmes"]
EV = load(RAW / "admission-evidence.json")["programmes"]
ST = load(WORK / "fit_state.json")
COEF = load(WORK / "fit_coef.json")
SR = load(WORK / "subject_rank.json")
DELTA = load(WORK / "delta_post.json")
CNT = {k: v["reports"] for k, v in load(WORK / "targets.json")["programmes"].items()}
pm, p25, iqr = (np.load(WORK / f"pred_{k}.npy") for k in ("med", "p25", "iqr"))

# ---- C-tier share of admits vs K (logistic, weighted) -> background factor for the top band ----
pts = []
for v in AC.values():
    mix = v["mix"]; tot = sum(mix.values())
    if tot < 10 or not v.get("gpa"): continue
    sh = sum(SHIFT[t] * c for t, c in mix.items()) / tot
    pts.append((v["gpa"]["median"] + sh, mix["C"] / tot, tot))
K = np.array([p[0] for p in pts]); S = np.clip(np.array([p[1] for p in pts]), 1e-3, 1 - 1e-3); Wt = np.array([p[2] for p in pts], float)
a, b = 0.0, 0.0
for _ in range(200):  # IRLS for share ~ sigmoid(a + b*(K-3.6))
    z = a + b * (K - 3.6); mu = 1 / (1 + np.exp(-z)); w = Wt * mu * (1 - mu)
    zz = z + (S - mu) / (mu * (1 - mu))
    Xd = np.c_[np.ones_like(K), K - 3.6]
    a, b = np.linalg.solve(Xd.T @ (Xd * w[:, None]), Xd.T @ (w * zz))
cshare = lambda k: 1 / (1 + math.exp(-(a + b * (k - 3.6))))
K_REF = 3.8  # below this the tier gap in admitted GPA stays ~0.2; above it the gap compresses under the 4.0 cap
bg_factor = lambda k: min(1.0, cshare(k) / cshare(K_REF))
print(f"C share curve: a={a:.2f} b={b:.2f}; share(3.4)={cshare(3.4):.2f} share(3.8)={cshare(3.8):.2f} share(4.0)={cshare(4.0):.2f}; factor(3.9)={bg_factor(3.9):.2f} factor(4.05)={bg_factor(4.05):.2f}")

# ---- ceiling for elite programmes: from official applications per place ----
# Offer-to-acceptance rate ("yield") from Oxford's and Cambridge's published taught-programme statistics
# (uk_official.py): the programme's own department or School where known, else the two universities pooled.
UKO = load(WORK / "uk_official.json")
YIELD = UKO["global"]["yieldPooled"]
ratios = [e["stats"]["applications"] / e["stats"]["places"] for e in EV.values() if e.get("stats") and e["stats"].get("places")]
offer = lambda r, y=YIELD: min(0.95, (1 / r) / y)
elite_ratios = [r for r in ratios if r >= 8]
C_ELITE_DEFAULT = float(np.median([min(0.9, 3 * offer(r)) for r in elite_ratios]))
print(f"elite programmes with stats: {len(elite_ratios)}; default ceiling {C_ELITE_DEFAULT:.2f}")

# ---- full-time MBA acceptance rates (school-reported to U.S. News; data/raw/mba-admit-rates.json) ----
# MBAs admit on experience and tests more than GPA, so the GPA curve saturates early: their ceiling is 2 x the
# acceptance rate (an applicant at the class median then sits near 1.3 x the rate), capped at 0.9.
MBA_TABLE = load(RAW / "mba-admit-rates.json")
MBA_RATE = {}
for _s in MBA_TABLE["schools"]:
    _ids = _s["programmeIds"]
    if isinstance(_ids, str):
        _re = re.compile("^" + re.escape(_ids).replace(r"\*", ".*") + "$")
        _ids = [p["id"] for p in P if _re.match(p["id"])]
    for _i in _ids: MBA_RATE[_i] = _s["acceptRate"]
MBA_CEILING_X = 2

REQ_EXP = re.compile(r"(?:minimum|at least|min\.?)\s+(?:of\s+)?\w+\s*(?:\(\d+\)\s*)?(?:\+\s*)?years?'?\s+(?:of\s+)?(?:relevant\s+|full[- ]time\s+|professional\s+|post[- ]graduat\w+\s+|managerial\s+|work(?:ing)?\s+)*(?:work|professional|managerial|industry)?\s*experience", re.I)
PREF_EXP = re.compile(r"work(?:ing)? experience[^.]{0,60}(?:preferred|desirable|an advantage|advantageous|valued|strongly encouraged)|(?:preferred|desirable|an advantage)[^.]{0,40}work(?:ing)? experience", re.I)
def exp_class(p):
    t = " ".join([p.get("academicRequirement") or ""] + [e.get("quote", "") for e in p.get("evidence", []) if e.get("field") in ("academicRequirement", "background")])
    if p.get("degreeType") == "MBA" or re.search(r"\bMBA\b|Master of Business Administration|executive", p["name"], re.I): return "mba-exec"
    if REQ_EXP.search(t): return "required"
    if PREF_EXP.search(t): return "preferred"
    return "none"
INST = {i["id"]: i for i in load(RAW / "institutions.json")["institutions"]}
# GRE (verbal + quantitative): a bonus on the GPA scale, full where the programme requires the test, half where it is
# optional, recommended or only mentioned, none where it says the test is not required.
# IELTS (Kaplan 360++'s rule; within-programme data show no measurable IELTS effect): elite programmes take 0.1 off
# below 7.5 and add nothing above; other programmes add 0.05 at 1.5 or more above the lowest IELTS minimum any of the
# university's programmes asks for. Below a programme's own minimum the offer carries a language condition.
IELTS_RULE = {"elite": {"below": 7.5, "penalty": -0.1}, "taught": {"aboveBaseBy": 1.5, "bonus": 0.05, "base": "lowest IELTS minimum among the university's programmes"}}
_ielts_by_inst = {}
for _p in P:
    if _p.get("ieltsOverall"): _ielts_by_inst.setdefault(_p["institutionId"], []).append(_p["ieltsOverall"])
IELTS_BASE = {k: min(v) for k, v in _ielts_by_inst.items()}
GRE_WEIGHT = {"required": 1.0, "optional": 0.5, "recommended": 0.5, "mentioned": 0.5, "not-required": 0.0}
GRE_RULE = {"freeUpTo": 325, "perPointTo335": 0.01, "perPointAbove335": 0.013,
            "evidence": "GradCafe offers and rejections, same programme: +10 GRE points was worth +0.37 GPA in 2012-15 master's admissions (2,704 decisions, 107 programmes; international applicants +0.40) but only +0.13 in 2016-19 (264 decisions, 11 programmes). Since 2020 many programmes have made the GRE optional, and its weight is still falling; the rule is set below the older estimate for that reason."}
CAL = load(WORK / "curve_calibration.json")
FLOORS = load(WORK / "floors.json")
FB = load(WORK / "floor_band.json")["byCountry"]
POLICY = load(RAW / "policy-risks.json")["rules"]
TRIG = {
    "cems": re.compile(r"\bCEMS\b"),
    "double-degree": re.compile(r"double degree|dual degree|joint degree", re.I),
    "abroad-term": re.compile(r"semester abroad|term abroad|study abroad|exchange (?:semester|term|period)|year abroad|international (?:residency|immersion)|placement (?:abroad|overseas)", re.I),
}
STEM = {"ai-data", "it", "construction"}
def policy_risks(p):
    country = (INST.get(p["institutionId"]) or {}).get("country")
    text = json.dumps(p, ensure_ascii=False)
    tags = {k for k, r in TRIG.items() if r.search(text)}
    if country == "United Kingdom" and p["discipline"] in STEM: tags.add("atas-subject")
    if p["discipline"] in STEM: tags.add("stem")
    tags.add("institution:" + ("eth-zurich" if "eth-zurich" in p["institutionId"] else "epfl" if p["institutionId"] == "epfl" else p["institutionId"]))
    out = []
    for r in POLICY:
        if r["country"] != country: continue
        if any(t == "country" or t in tags for t in r["trigger"]):
            out.append({"id": r["id"], "level": "check" if r["id"] == "uk-atas" else r["level"]})
    return out
NEW = re.compile(r"\b(new (?:for|in) 20\d\d|newly (?:launched|introduced)|launch(?:ed|ing)? in 202\d|first (?:intake|cohort)|new programme|new course)", re.I)
sd_pred = ST["sd"]
progs = {}
basis_count = collections.Counter()
for j, p in enumerate(P):
    pid = p["id"]
    o = ST["obs"].get(pid)
    pred = dict(med=float(pm[j]), p25=float(p25[j]), iqr=float(max(iqr[j], 0.08)))
    if o:
        n = o["n"]; has_q = o.get("p25") is not None
        spread = (max(o["p75"] - o["p25"], 0.08) if has_q else pred["iqr"]) / 1.35
        se_obs = spread * 1.25 / math.sqrt(n)
        def mix(k, ov, sp):
            w1, w2 = 1 / se_obs ** 2, 1 / sp ** 2
            return (w1 * ov + w2 * pred[k]) / (w1 + w2), (w1 + w2) ** -0.5
        med, med_se = mix("med", o["med"], sd_pred["med"])
        if has_q:
            th, th_se = mix("p25", o["p25"], sd_pred["p25"])
            iq, _ = mix("iqr", o["p75"] - o["p25"], sd_pred["iqr"])
        else:  # 1-4 reports: shift the predicted curve by the observed median's pull
            th, th_se = pred["p25"] + (med - pred["med"]), sd_pred["p25"]
            iq = pred["iqr"]
        basis = "observed" if n >= 20 else "blended"
    else:
        n = 0; med, th, iq = pred["med"], pred["p25"], pred["iqr"]
        med_se, th_se = sd_pred["med"], sd_pred["p25"]; basis = "predicted"
    th = min(th, med)  # p25 never above the median
    adm_p25 = th  # the admitted 25th percentile (the US and Canada curve moves its midpoint below)
    ev = EV.get(pid) or {}
    st = ev.get("stats"); ratio = st["applications"] / st["places"] if st and st.get("places") else None
    uo = UKO["programmes"].get(pid)
    if ratio:  # the course's own applications per place, turned into offers with its unit's (or the pooled) yield
        off = offer(ratio, (uo or {}).get("yield") or YIELD); off_src = "places-per-application"
    elif uo:  # no course figures: the department's or School's published offer rate
        off = uo["offerRate"]; off_src = "unit-offer-rate"
    elif pid in MBA_RATE:  # full-time MBA: the school's reported acceptance rate
        off = MBA_RATE[pid]; off_src = "mba-acceptance-rate"
    else:
        off = None; off_src = None
    elite = med >= 3.9 or (ratio is not None and ratio >= 8) or (ratio is None and off is not None and off <= 1 / (8 * YIELD))
    mba = exp_class(p) == "mba-exec"
    # never below the programme's own offer rate (a few courses have about as many places as applications)
    if mba and off_src == "mba-acceptance-rate": c = max(off, min(0.9, MBA_CEILING_X * off))
    else: c = (max(off, min(0.9, 3 * off)) if off else C_ELITE_DEFAULT) if elite else max(0.8, off or 0)
    country = (INST.get(p["institutionId"]) or {}).get("country")
    if country in ("United States", "Canada"):
        # GradCafe admits and rejections (35 programmes): s = k x IQR, midpoint = median + d x IQR
        s_ = min(max(CAL["k"] * iq, 0.06), 0.8); th = med + CAL["d"] * iq; shape = "calibrated-gradcafe"
        # the GradCafe ceiling was fitted on MS programmes (3 MBA rows), so MBAs keep their own
        if not elite and not mba: c = 0.9
    else:
        s_ = min(max(iq / 2.2, 0.06), 0.18); shape = "from-admits-only"
    is_new = bool(NEW.search(json.dumps(p, ensure_ascii=False))) or (n == 0 and CNT.get(pid, 0) == 0)
    sr = SR.get(p["institutionId"], {}).get(p["discipline"], {})
    basis_count[basis] += 1
    progs[pid] = {
        "k": round(med, 3), "kSe": round(med_se, 3),
        "theta": round(th, 3), "thetaSe": round(th_se, 3),
        "s": round(s_, 3),
        # the admitted spread behind the curve, for drawing a programme's admitted GPA where none is reported
        "p25": round(adm_p25, 3), "iqr": round(iq, 3),
        "c": round(c, 3), "cluster": "elite" if elite else "taught",
        "curveShape": shape,
        "bgFactor": round(bg_factor(med), 3),
        "n": int(n), "basis": basis,
        "noCaseYet": is_new,
        "subjectRank": {"qs": sr.get("qs"), "gras": sr.get("gras")},
        "applicationsPerPlace": round(ratio, 1) if ratio else None,
        "offerRate": round(off, 3) if off else None,
        "offerRateFrom": off_src,
        "officialUnit": f"{uo['university'].title()}: {uo['unit']}" if uo else None,
        "experienceClass": exp_class(p),
        "greWeight": GRE_WEIGHT.get((p.get("gre") or {}).get("status"), 0.0),
        "gmatWeight": GRE_WEIGHT.get((p.get("gmat") or {}).get("status"), 0.0),
        "ieltsMin": p.get("ieltsOverall"), "ieltsBase": IELTS_BASE.get(p["institutionId"], p.get("ieltsOverall")),
        "floor": (FLOORS.get(pid) or {}).get("floor"),
        "mainRequirement": (FLOORS.get(pid) or {}).get("main"),
        "floorBandFactor": (FB.get(country) or {}).get("factor"),
        "policyRisks": policy_risks(p),
    }
# ---- UK: ceilings from FOI offer rates (foi_ceiling.py) ----
FOI_PATH = WORK / "foi_programmes.json"
FOI_META = None
if FOI_PATH.exists():
    import foi_ceiling
    FOI = load(FOI_PATH)["programmes"]
    uk_c, FOI_META = foi_ceiling.fit(progs, P, INST, FOI, CAL)
    for pid, v in uk_c.items():
        progs[pid]["c"] = max(v["c"], progs[pid]["offerRate"] or 0)  # never below the official offer rate
        progs[pid]["ukOfferRate"] = v["rate"]; progs[pid]["ukOfferRateBasis"] = v["basis"]
        f = FOI.get(pid)
        if f: progs[pid]["foi"] = {k: f[k] for k in ("applications", "offers", "offerRate", "cnApplications", "cnOffers", "cnOfferRate", "years")}
    print(f"UK ceilings from FOI: {FOI_META['observed']} observed of {FOI_META['programmes']}; m={FOI_META['m']}; cv {FOI_META['cv']}")
print(basis_count, "elite", sum(1 for v in progs.values() if v["cluster"] == "elite"))

out = {
    "dataset": "Admission model parameters per programme (C-tier-equivalent GPA, 4-point scale)",
    "builtAt": datetime.date.today().isoformat(),
    "method": [
        "Scale: every admitted student's GPA is put on one scale by adding the first-degree tier offset (A +0.21, B +0.10, C 0), measured as the gap between tiers' admitted medians on the same programme (84 and 156 programmes).",
        "Observed programmes (5+ reported admits): K = admitted median and theta = 25th percentile on that scale, shrunk towards the model prediction by sample size.",
        "Programmes without reports: K, theta and spread predicted by a weighted ridge regression on the observed ones, with the institution's QS rank, the subject's best QS 2026 / ShanghaiRanking GRAS 2025 rank, discipline, degree type, country, the stated minimum class, IELTS, any-background entry, name features (generic management, environment/sustainability, quantitative), competitive wording, applications per place, and a partially pooled institution effect. Cross-validated on held-out institutions.",
        "Elite: K >= 3.9 (where C-tier admits fall to about 5%) or 8+ official applications per place. Ceiling c: 0.8 for taught programmes; for elite ones 3 x the offer rate, capped at 0.9; never below the programme's own offer rate. The offer rate is places / applications / yield, with yield (offers that become enrolments) taken from Oxford's and Cambridge's published statistics for the programme's own department or School, else the two universities pooled (0.595 over two years); where the page gives no applications per place, the department's or School's published offer rate. A unit offer rate at or below 1 / (8 x yield) also marks a programme elite.",
        "MBA: full-time MBAs with a school-reported acceptance rate (U.S. News data via Poets&Quants, data/raw/mba-admit-rates.json) take it as their offer rate, are elite at or below 1 / (8 x yield), and have ceiling c = 2 x the acceptance rate, capped at 0.9; other MBAs in the United States and Canada keep 0.8 instead of the GradCafe ceiling, which was fitted on MS programmes. MBA and executive programmes scale the chance by the applicant's full-time work: x1 from 2 years, x0.5 at 1 year, x0.2 below 1 year (Kaplan 360++'s rule; class profiles average about 5 years).",
        "bgFactor: the C-tier share of admits at this K divided by its share at K = 3.8, fitted across programmes; applied to a C-tier or private-school applicant's chance. Below K = 3.8 it is 1 because the tier offset already accounts for the gap there; above it the 4.0 cap compresses the GPA gap and the background effect shows up as fewer C-tier admits instead.",
        "Private-school offset delta (relative to the awarding university's tier) is estimated from Singapore private-school students' reported admits against the same programmes' overall admits, with a flat prior and a robust likelihood.",
    ],
    "fit": {"cvRmse": COEF["cv"], "coefficients": {k: round(v, 4) for k, v in COEF["coef"].items()}},
    "global": {
        "tierShift": SHIFT,
        "privateDelta": {k: (round(v, 4) if isinstance(v, float) else v) for k, v in DELTA.items()},
        "cShareCurve": {"a": round(float(a), 4), "b": round(float(b), 4), "center": 3.6, "kRef": K_REF},
        "curveCalibration": {**CAL, "appliesTo": ["United States", "Canada"], "note": "GradCafe admits and rejections 2022+, 35 programmes; other countries keep the admits-only curve until rejection data exist"},
        "gre": GRE_RULE,
        "ielts": IELTS_RULE,
        "gmat": {"rule": "read as a GRE total and scored with the GRE rule, weighted by the programme's GMAT status", "focusToClassic": "GMAC concordance table (Aug 2024)", "classicToGre": "inverse of ETS GRE Comparison Tool regression GMAT = -2080.75 + 6.38 V + 10.62 Q, sections equal: GRE = (GMAT + 2080.75) / 8.5"},
        "experience": {"internDiscount": 0.45, "weights": {"mba-exec": 0.15, "required": 0.12, "preferred": 0.08, "none": 0.05}, "fitFile": "data/raw/experience-fit.json",
                       "mbaWorkGate": {"2+": 1, "1": 0.5, "0": 0.2, "note": "full-time work years; unanswered counts as 0"}},
        "mbaRates": {"source": MBA_TABLE["source"], "url": MBA_TABLE["url"], "checked": MBA_TABLE["checked"], "programmes": len(MBA_RATE), "ceilingX": MBA_CEILING_X},
        # A programme without reported admits drawn on the GPA scale admits report: its median and spread less the
        # tier shift its admits would carry on average (C share from cShareCurve at its K; A and B split as below).
        "fittedGpa": {"aShareOfAB": round(sum(v["mix"]["A"] for v in AC.values()) / max(1, sum(v["mix"]["A"] + v["mix"]["B"] for v in AC.values())), 3),
                      "medianRmse": round(float(COEF["cv"]["med"][0]), 3)},
        "eliteK": 3.9, "eliteRatio": 8, "ceilingTaught": 0.8, "ceilingEliteDefault": round(C_ELITE_DEFAULT, 3),
        "formula": "If the applicant's own class is below floor: not eligible (the programme's stated minimum, any route). Otherwise curve = c * sigmoid((gpa4 + tierShift[awarderTier] + delta + experienceBonus + max(greWeight * greBonus(GRE), gmatWeight * greBonus(GMAT as GRE)) + ieltsAdjustment - theta) / s), greBonus = 0.01 per GRE point from 325 to 335 plus 0.013 per point above 335, ieltsAdjustment = elite: -0.1 below IELTS 7.5, else 0; other programmes: +0.05 at 1.5 or more above ieltsBase; for an applicant at the floor band or above, P = max(curve, floorBandFactor * c * sigmoid((k - theta) / s)); between floor and mainRequirement the applicant is eligible only through the alternative route the page names. Multiply by bgFactor for a C-tier or private-school applicant, and on MBA and executive programmes by the work gate (experience.mbaWorkGate).",
        "floorBand": FB,
        "ukFoiCeiling": FOI_META,
        "ukOfficial": {"yieldPooled": YIELD, "byOrigin": UKO["global"]["byOrigin"], "sources": UKO["sources"],
                       "note": "Offer rates by applicant origin are recorded as a check on bgFactor, not multiplied into the ceiling: most of the China-versus-all gap comes from applicants' GPAs and first-degree institutions, which the curve already counts."},
    },
    "counts": dict(basis_count),
    "programmes": progs,
}
json.dump(out, open(RAW / "admit-model.json", "w", encoding="utf-8"), ensure_ascii=False)
print("written", len(progs))
