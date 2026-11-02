"""Best subject rank per (institution, discipline): QS World University Rankings by Subject 2026 (public results
workbook, data/sources/qs/) and ShanghaiRanking GRAS 2025 (gras_compact.json, fetched in a browser from
shanghairanking.com/api/pub/v1/gras; institution indexes refer to gras-institutions.json). Output: subject_rank.json."""
import re
from common import WORK, load, save
from subject_sheets import SHEETS, byname as names, norm, workbook

INSTS = load(WORK / "gras-institutions.json")
G = load(WORK / "gras_compact.json")
gras = {}
for d, s in G.items():
    for tok in s.split():
        i, r = tok.split(":")
        gras[(INSTS[int(i, 36)]["id"], d)] = int(r, 36)
wb = workbook()
byname = names(INSTS)
qs = {}
for d, sheets in SHEETS.items():
    for sh in sheets:
        hdr = None
        for r in wb[sh].iter_rows(values_only=True):
            if hdr is None:
                hdr = r if r and r[0] == "2026" else None
                continue
            m = re.match(r"=?(\d+)", str(r[0] or "")); iid = byname.get(norm(r[2])) if r[2] else None
            if m and iid:
                k = (iid, d); qs[k] = min(qs.get(k, 9999), int(m.group(1)))
out = {}
for i in INSTS:
    for d in SHEETS:
        q, g = qs.get((i["id"], d)), gras.get((i["id"], d))
        if q or g:
            out.setdefault(i["id"], {})[d] = {"qs": q, "gras": g, "best": min(x for x in (q, g) if x)}
save(WORK / "subject_rank.json", out)
print("institutions with a subject rank", len(out))
