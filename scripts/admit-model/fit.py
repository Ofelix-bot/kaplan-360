"""
全库拟合：每个项目的录取门槛参数（C 档等价 GPA 尺度）。
有案例的项目：观测值与模型预测按样本量收缩合并；无案例的项目：模型预测。
模型：加权岭回归，特征 = 院校 QS 排名 + 学科排名（QS/GRAS 取优）+ 学科 + 学位类型 + 国家
       + 要求文本（最低等级、IELTS、是否收任何背景）+ 名称特征（泛管理、环境/可持续、量化、实践/实习型）
       + 申请热度（指南者案例数）+ 院校随机效应（岭惩罚）。
"""
import json, re, math, collections, sys
import numpy as np

from common import RAW, WORK, SHIFT, load, save
P = load(RAW / "programmes.json")["programmes"]
INST = {i["id"]: i for i in load(RAW / "institutions.json")["institutions"]}
TG = {k: v for k, v in load(WORK / "targets.json")["programmes"].items() if v["n"]}
EV = load(RAW / "admission-evidence.json")["programmes"]
SR = load(WORK / "subject_rank.json")
CNT = {k: v["reports"] for k, v in load(WORK / "targets.json")["programmes"].items()}

# ---------- targets ----------
def target(v):
    bands = [g for g in v.get("gpaByTier") or [] if g["n"] >= 5]
    if bands:
        w = sum(g["n"] for g in bands)
        f = lambda k: sum((g[k] + SHIFT[g["tier"]]) * g["n"] for g in bands) / w
        return dict(p25=f("p25"), med=f("median"), p75=f("p75"), n=w)
    g = v.get("gpa")
    if not g or g["n"] < 5:
        return None
    mix = v["mix"]; tot = sum(mix.values())
    sh = sum(SHIFT[t] * c for t, c in mix.items()) / tot if tot else 0.15
    return dict(p25=g["p25"] + sh, med=g["median"] + sh, p75=g["p75"] + sh, n=g["n"])

# ---------- features ----------
NAMED = [(re.compile(r"\bfirst[- ]class\b|\b1st\b|\bH1\b", re.I), 70), (re.compile(r"high(?:er)? (?:2[:.]1|upper second)|strong 2[:.]1|good 2[:.]1", re.I), 65),
         (re.compile(r"\b2[:.]1\b|upper second|second class upper|\bH2A\b|2\(i\)", re.I), 60), (re.compile(r"\b2[:.]2\b|lower second|second class lower|\bH2B\b|2\(ii\)", re.I), 50),
         (re.compile(r"third|pass degree|ordinary degree", re.I), 40)]
def floor_level(t):
    if not t: return None
    found = [l for re_, l in NAMED if re_.search(t)]
    g = re.search(r"\b(?:GPA|grade point average)[^.\d]{0,40}?([0-4]\.\d{1,2})", t, re.I)
    if g:
        v = float(g.group(1)); found.append(70 if v >= 3.6 else 60 if v >= 3.0 else 50 if v >= 2.5 else 40)
    return min(found) if found else None

FLAGS = {
    "generic_mgmt": re.compile(r"^(?:msc |ma |mmgt |master of |m\.?sc\.? )?(?:in )?(?:international |global )?(?:business )?(?:management|business|business administration|management studies|international business|global management)(?: msc| ma)?$", re.I),
    "env_sustain": re.compile(r"environment|sustainab|climate|\besg\b|green|energy transition|circular econom", re.I),
    "quant": re.compile(r"financ|accounting|econom|analytics|data|quantitative|actuar|mathemat|statistic|fintech|computational", re.I),
    "practice": re.compile(r"advanced practice|placement|with industry|work experience|professional practice|internship", re.I),
    "conversion_words": re.compile(r"\bconversion\b|\bfor non|\bpre-?experience|\bintroduct", re.I),
}
DEG = {"MSc": "msc", "MS": "msc", "MA": "ma", "MBA": "mba", "LLM": "llm", "MFin": "msc", "MCom": "mcom", "MMgt": "mmgt", "MPH": "health", "MEd": "edu", "MPA": "mpa"}

def qs_value(i):
    q = (INST.get(i) or {}).get("qs") or {}
    return q.get("rankValue")

def subj_rank(p):
    d = SR.get(p["institutionId"], {})
    r = d.get(p["discipline"], {}).get("best")
    # 商科名称里带金融/会计/经济的，用对应学科排名
    nm = p["name"].lower()
    if p["discipline"] in ("business", "marketing") and re.search(r"financ|accounting", nm):
        r = d.get("accounting-finance", {}).get("best") or r
    if re.search(r"econom", nm):
        r = d.get("economics", {}).get("best") or r
    return r

disciplines = sorted({p["discipline"] for p in P if p["discipline"]})
countries = [c for c, n in collections.Counter((INST.get(p["institutionId"]) or {}).get("country") for p in P).most_common(12) if c]
degs = sorted(set(DEG.values()) | {"other"})
inst_ids = sorted({p["institutionId"] for p in P})
inst_ix = {i: k for k, i in enumerate(inst_ids)}

def feats(p):
    q = qs_value(p["institutionId"]); s = subj_rank(p)
    fl = floor_level(p.get("academicRequirement"))
    ielts = p.get("ieltsOverall")
    country = (INST.get(p["institutionId"]) or {}).get("country")
    ev = EV.get(p["id"]) or {}
    st = ev.get("stats")
    ratio = st["applications"] / st["places"] if st and st.get("places") else None
    x = {
        "log_qs": math.log(q) if q else math.log(1200), "qs_missing": 0 if q else 1,
        "log_subj": math.log(s) if s else 0.0, "subj_missing": 0 if s else 1,
        "floor_first": 1 if fl == 70 else 0, "floor_high21": 1 if fl == 65 else 0, "floor_21": 1 if fl == 60 else 0,
        "floor_22orless": 1 if fl is not None and fl <= 50 else 0, "floor_missing": 1 if fl is None else 0,
        "ielts": (ielts - 6.5) if ielts else 0.0, "ielts_missing": 0 if ielts else 1,
        "any_background": 1 if p.get("acceptsAnyBackground") else 0,
        "competitive_words": 1 if ev.get("competitive") else 0,
        "log_ratio": math.log(ratio) if ratio else 0.0, "ratio_missing": 0 if ratio else 1,
        "log_cases": math.log1p(CNT.get(p["id"], 0)),
        "gre_or_gmat_req": 1 if (p.get("gre") or p.get("gmat")) else 0,
        "duration_long": 1 if (p.get("durationMonths") or 12) >= 18 else 0,
    }
    for k, r_ in FLAGS.items():
        x[k] = 1 if r_.search(p["name"]) else 0
    for d in disciplines[1:]:
        x["disc:" + d] = 1 if p["discipline"] == d else 0
    dg = DEG.get(p.get("degreeType"), "other")
    for d in degs[1:]:
        x["deg:" + d] = 1 if dg == d else 0
    for c in countries[1:]:
        x["ctry:" + c] = 1 if country == c else 0
    return x

ids = [p["id"] for p in P]
F = [feats(p) for p in P]
names = list(F[0].keys())
X = np.array([[f[k] for k in names] for f in F], float)
Iix = np.array([inst_ix[p["institutionId"]] for p in P])
Y = {}; W = np.zeros(len(P)); obs = {}
for j, p in enumerate(P):
    t = TG.get(p["id"])
    if t:
        obs[j] = t; W[j] = t["n"] / (t["n"] + 10)
train = np.array(sorted(obs))
print("programmes", len(P), "with targets", len(train))

def design(rows):
    Z = np.zeros((len(rows), len(inst_ids)))
    Z[np.arange(len(rows)), Iix[rows]] = 1
    return np.hstack([np.ones((len(rows), 1)), X[rows], Z])

LAM_FIX, LAM_INST = 1.0, 4.0
pen = np.r_[0, np.full(len(names), LAM_FIX), np.full(len(inst_ids), LAM_INST)]
mu_X = X[train].mean(0); sd_X = X[train].std(0) + 1e-9

def fit_rows(rows, y, w):
    D = design(rows); D[:, 1:1 + len(names)] = (D[:, 1:1 + len(names)] - mu_X) / sd_X
    A = D.T @ (D * w[:, None]) + np.diag(pen)
    b = np.linalg.solve(A, D.T @ (w * y))
    return b

def predict(b, rows):
    D = design(rows); D[:, 1:1 + len(names)] = (D[:, 1:1 + len(names)] - mu_X) / sd_X
    return D @ b

out = {}
for tgt in ("med", "p25", "iqr"):
    rows = train if tgt == "med" else np.array([j for j in train if obs[j]["p25"] is not None])
    y = np.array([obs[j]["p75"] - obs[j]["p25"] if tgt == "iqr" else obs[j][tgt] for j in rows])
    w = W[rows]
    rng = np.random.default_rng(1); folds = rng.integers(0, 5, len(inst_ids))
    pred_cv = np.zeros(len(rows)); base_cv = np.zeros(len(rows))
    for f in range(5):
        te = folds[Iix[rows]] == f; tr = ~te
        b = fit_rows(rows[tr], y[tr], w[tr]); pred_cv[te] = predict(b, rows[te])
        base_cv[te] = np.average(y[tr], weights=w[tr])
    rmse = lambda e: float(np.sqrt(np.average(e ** 2, weights=w)))
    b = fit_rows(rows, y, w)
    out[tgt] = dict(b=b, rmse_cv=rmse(pred_cv - y), rmse_base=rmse(base_cv - y), y=y)
    print(f"{tgt}: CV RMSE (held-out schools) {rmse(pred_cv - y):.3f}  vs overall mean {rmse(base_cv - y):.3f}")

# standardized coefficient -> per-unit effect on K (median)
b = out["med"]["b"]
coef = {n: float(b[1 + i] / sd_X[i]) for i, n in enumerate(names)}
json.dump(dict(names=names, coef=coef, cv={k: (v["rmse_cv"], v["rmse_base"]) for k, v in out.items()}), open(WORK / "fit_coef.json", "w"), ensure_ascii=False, indent=1)
for n in sorted(coef, key=lambda n: -abs(coef[n] * sd_X[names.index(n)]))[:30]:
    print(f"  {n:24s} {coef[n]:+.3f} per unit   (×1sd {coef[n]*sd_X[names.index(n)]:+.3f})")

allrows = np.arange(len(P))
pred = {t: predict(out[t]["b"], allrows) for t in out}
np.save(WORK / "pred_med.npy", pred["med"]); np.save(WORK / "pred_p25.npy", pred["p25"]); np.save(WORK / "pred_iqr.npy", pred["iqr"])
json.dump({"ids": ids, "obs": {ids[j]: obs[j] for j in obs}, "sd": {t: out[t]["rmse_cv"] for t in out}}, open(WORK / "fit_state.json", "w"))
