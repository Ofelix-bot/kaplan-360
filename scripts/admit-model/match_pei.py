"""Links the reviewed Singapore private-school cases (exports/pei-cases-*.xlsx, sheet 全部案例) to programmes.
Output: pei_matched.json (admits with a 4-point GPA and a sure programme match)."""
import re, collections
import openpyxl
from common import ROOT, RAW, PIPE, WORK, load, save

ids = {p["id"] for p in load(RAW / "programmes.json")["programmes"]}
pm = load(PIPE / "compass" / "programme-matches.json")
sch = load(PIPE / "compass" / "schools.json")
xlsx = sorted((ROOT / "exports").glob("pei-cases-*.xlsx"))[-1]
rows = list(openpyxl.load_workbook(xlsx, read_only=True)["全部案例"].iter_rows(values_only=True))
R = [dict(zip(rows[0], r)) for r in rows[1:]]
unis = collections.defaultdict(set)
for k, v in pm.items():
    if v["sure"] and v["ids"]:
        u, p = k.split("|", 1); unis[p].add(u)
slug = lambda s: re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
out = []
for r in R:
    if r["结果"] != "录取" or not isinstance(r["4 分制 GPA"], (int, float)):
        continue
    prog = r["目标项目"]; en = (sch.get(r["目标大学"]) or {}).get("english") or ""
    s = slug(en.replace("The ", "")) if en else ""
    cands = list(unis.get(prog, []))
    pick = [u for u in cands if s and (u.startswith(s[:15]) or s.startswith(u[:15]))] or (cands if len(cands) == 1 else [])
    found = [i for u in pick for i in pm[f"{u}|{prog}"]["ids"] if i in ids]
    if len(found) == 1:
        out.append({"pid": found[0], "credibility": r["可信度"], "school": r["私立院校"], "scale": r["成绩分制"],
                    "gpa4": r["4 分制 GPA"], "awarderTier": r["私立合作校档位"]})
save(WORK / "pei_matched.json", out)
print("matched admits", len(out), "from", xlsx.name)
