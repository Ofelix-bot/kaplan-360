"""How freely programmes admit applicants who only just meet their stated minimum, by country.
For programmes whose minimum is a 2:2 (floor 50), the share of admitted students whose own result is in the 2:2
band, divided by that band's share among all admitted students in the same country (指南者 admits; own GPA on the
UK bands of lib/gpa4.ts). 1 means the minimum is the real bar (formulaic entry); well below 1 means programmes
choose above it. Capped at 1. Countries with fewer than 5 such programmes get no factor.
Inputs: records.json, floors.json. Output: floor_band.json."""
import collections
from common import RAW, WORK, load, save

F = load(WORK / "floors.json"); R = load(WORK / "records.json")["records"]
P = {p["id"]: p for p in load(RAW / "programmes.json")["programmes"]}
C = {i["id"]: i.get("country") for i in load(RAW / "institutions.json")["institutions"]}
lvl = lambda g: 70 if g >= 3.7 else 60 if g >= 3.3 else 50 if g >= 2.7 else 40
pool, prog = collections.defaultdict(list), collections.defaultdict(list)
for pid, rs in R.items():
    if pid not in P: continue
    c = C.get(P[pid]["institutionId"])
    for r in rs:
        if r["result"] == "admit" and r.get("gpa") and r["source"] == "compass":
            pool[c].append(lvl(r["gpa"])); prog[pid].append(lvl(r["gpa"]))
out = {}
for c, levels in pool.items():
    base = collections.Counter(levels); N = sum(base.values())
    ps = [p for p in prog if p in F and F[p]["floor"] == 50 and C.get(P[p]["institutionId"]) == c and len(prog[p]) >= 5]
    a = collections.Counter(l for p in ps for l in prog[p]); n = sum(a.values())
    if len(ps) < 5 or not base[50]: continue
    ratio = (a[50] / n) / (base[50] / N)
    out[c] = {"factor": round(min(1.0, ratio), 3), "ratio": round(ratio, 3), "programmes": len(ps), "admits": n}
save(WORK / "floor_band.json", {"method": __doc__.strip(), "byCountry": out}, 1)
print(out)
