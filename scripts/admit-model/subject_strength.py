"""The finder's subject strength and industry recognition per (institution, discipline), from the same sources as
subjects.py: QS World University Rankings by Subject 2026 (rank as published, a band past 50, and the Employer
reputation indicator) and ShanghaiRanking GRAS 2025 (rank, shown as its published band). Where a discipline draws on
several QS sheets, the best rank and the highest employer score are kept, each with the sheet it came from.
Output: data/raw/subject-strength.json (read by lib/data/results.ts)."""
import re
from common import RAW, WORK, load, save
from subject_sheets import QSF, SHEETS, byname as names, norm, workbook

# The workbook's sheet names are cut at 31 characters; the subjects as QS names them.
SUBJECT = {"Data Science and Artificial Int": "Data Science & Artificial Intelligence", "Computer Science & Information ": "Computer Science & Information Systems",
           "Statistics & Operational Resear": "Statistics & Operational Research", "Architecture _ Built Environmen": "Architecture & Built Environment",
           "Engineering - Civil & Structura": "Engineering - Civil & Structural", "Hospitality & Leisure Managemen": "Hospitality & Leisure Management"}
FINDER = [d for d in SHEETS if d != "economics"]

def lead(s):
    m = re.match(r"=?(\d+)", str(s or ""))
    return int(m.group(1)) if m else None

def gras_band(r):
    """GRAS publishes exact ranks to 50, then 51-75, 76-100, 101-150, 151-200, 201-300, 301-400, 401-500."""
    if r <= 50: return str(r)
    for a, b in [(51, 75), (76, 100), (101, 150), (151, 200), (201, 300), (301, 400), (401, 500)]:
        if r <= b: return f"{a}-{b}"
    return f"{r}+"

INSTS = load(WORK / "gras-institutions.json")
byname = names(INSTS)
gras = {}
for d, s in load(WORK / "gras_compact.json").items():
    for tok in s.split():
        i, r = tok.split(":")
        gras[(INSTS[int(i, 36)]["id"], d)] = int(r, 36)

wb = workbook()
qs, emp = {}, {}
for d in FINDER:
    for sh in SHEETS[d]:
        hdr = None
        for r in wb[sh].iter_rows(values_only=True):
            if hdr is None:
                hdr = list(r) if r and r[0] == "2026" else None
                continue
            iid = byname.get(norm(r[2])) if r[2] else None
            if not iid: continue
            k, subject = (iid, d), SUBJECT.get(sh, sh)
            v = lead(r[0])
            if v and (k not in qs or v < qs[k]["v"]):
                qs[k] = {"rank": str(r[0]).lstrip("="), "v": v, "subject": subject}
            e = r[hdr.index("EMPLOYER")]
            if isinstance(e, (int, float)) and (k not in emp or e > emp[k]["score"]):
                emp[k] = {"score": round(float(e), 1), "rank": str(r[hdr.index("EMPLOYER RANK")] or "").lstrip("=") or None, "subject": subject}

out = {}
for i in INSTS:
    for d in FINDER:
        k = (i["id"], d)
        cell = {}
        if k in qs: cell["qs"] = qs[k]
        if k in gras: cell["gras"] = {"rank": gras_band(gras[k]), "v": gras[k]}
        if k in emp: cell["employer"] = emp[k]
        if cell: out.setdefault(i["id"], {})[d] = cell

save(RAW / "subject-strength.json", {
    "sources": {"qs": {"title": "QS World University Rankings by Subject 2026", "file": QSF.name, "url": "https://www.topuniversities.com/subject-rankings"},
                "gras": {"title": "ShanghaiRanking Global Ranking of Academic Subjects 2025", "url": "https://www.shanghairanking.com/rankings/gras/2025"}},
    "institutions": out}, indent=None)
n = sum(len(v) for v in out.values())
print("institutions", len(out), "cells", n, "qs", sum(1 for v in out.values() for c in v.values() if "qs" in c),
      "gras", sum(1 for v in out.values() for c in v.values() if "gras" in c), "employer", sum(1 for v in out.values() for c in v.values() if "employer" in c))
