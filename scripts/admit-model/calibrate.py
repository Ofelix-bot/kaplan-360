"""Curve shape from reports that include rejections (GradCafe and the open datasets): within each programme,
P(admit) = c * sigmoid((gpa - median_admit - d*IQR) / (k*IQR)). Output: curve_calibration.json."""
import collections
import numpy as np
from common import WORK, PIPE, load, save

byp = collections.defaultdict(list)
for pid, rs in load(WORK / "records.json")["records"].items():
    for r in rs:
        if r["source"] in ("gradcafe", "feiyue") and r["result"] in ("admit", "reject") and r.get("gpa") and 2 <= r["gpa"] <= 4:
            byp[pid].append((r["gpa"], r["result"] == "admit"))
ext = WORK / "external-records.json"
if ext.exists():
    for r in load(ext)["records"]:
        if r["programmeId"] and r["result"] in ("admit", "reject") and r.get("gpa") and 2 <= r["gpa"] <= 4:
            byp[r["programmeId"]].append((r["gpa"], r["result"] == "admit"))
inst = {p["id"]: p["institutionId"] for p in load(PIPE.parent / "raw" / "programmes.json")["programmes"]}
country = {i["id"]: i.get("country") for i in load(PIPE.parent / "raw" / "institutions.json")["institutions"]}
Z, Y, C = [], [], collections.Counter()
for pid, v in byp.items():
    ad = [g for g, y in v if y]
    if len(v) < 8 or len(ad) < 4 or len(ad) == len(v):
        continue
    q25, med, q75 = np.percentile(ad, [25, 50, 75]); iqr = max(q75 - q25, 0.08)
    C[country.get(inst.get(pid))] += 1
    for g, y in v:
        Z.append((g - med) / iqr); Y.append(1 if y else 0)
Z, Y = np.array(Z), np.array(Y)

def fit(z, y, grid):
    best = None
    for c in grid[0]:
        for k in grid[1]:
            for d in grid[2]:
                p = np.clip(c / (1 + np.exp(-(z - d) / k)), 1e-4, 1 - 1e-4)
                ll = (y * np.log(p) + (1 - y) * np.log(1 - p)).sum()
                if best is None or ll > best[0]:
                    best = (ll, c, k, d)
    return best[1:]
c, k, d = fit(Z, Y, (np.linspace(0.5, 1, 26), np.linspace(0.2, 4, 39), np.linspace(-4, 1, 51)))
rng = np.random.default_rng(0); bs = []
for _ in range(60):
    i = rng.integers(0, len(Z), len(Z))
    bs.append(fit(Z[i], Y[i], (np.linspace(0.5, 1, 11), np.linspace(0.2, 4, 20), np.linspace(-4, 1, 26))))
bs = np.array(bs)
bands = {}
for lo, hi in [(-9, -1), (-1, -0.3), (-0.3, 0.3), (0.3, 9)]:
    m = (Z >= lo) & (Z < hi); bands[f"{lo}..{hi}"] = {"n": int(m.sum()), "admitRate": round(float(Y[m].mean()), 3) if m.sum() else None}
out = {"c": float(c), "k": float(k), "d": float(d), "rows": int(len(Z)), "programmes": int(sum(C.values())), "countries": dict(C),
       "boot": {"c": np.percentile(bs[:, 0], [10, 90]).tolist(), "k": np.percentile(bs[:, 1], [10, 90]).tolist(), "d": np.percentile(bs[:, 2], [10, 90]).tolist()},
       "admitRateByIqrFromMedian": bands}
save(WORK / "curve_calibration.json", out, 1)
print(f"rows {len(Z)} programmes {sum(C.values())} {dict(C)}  c={c:.2f} s={k:.2f}xIQR midpoint=median{d:+.2f}xIQR", bands)
