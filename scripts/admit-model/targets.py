"""Per-programme targets on the C-tier-equivalent scale from every linked admitted report (any count).
Inputs: records.json (admit-dump.ts) and external-records.json (ingest_external.py). Output: targets.json."""
import collections
import numpy as np
from common import WORK, SHIFT, load, save

recs = collections.defaultdict(list)
for pid, rs in load(WORK / "records.json")["records"].items():
    recs[pid] += [{"result": r["result"], "gpa": r.get("gpa"), "tier": r.get("tier"), "source": r["source"]} for r in rs]
ext = WORK / "external-records.json"
if ext.exists():
    for r in load(ext)["records"]:
        if r["programmeId"]:
            recs[r["programmeId"]].append({"result": r["result"], "gpa": r["gpa"], "tier": r.get("tier"), "source": r["source"]})

out = {}
for pid, rs in recs.items():
    ad = [r for r in rs if r["result"] == "admit"]
    v = sorted(r["gpa"] + SHIFT[r["tier"]] for r in ad if r.get("gpa") is not None and r.get("tier"))
    reports = len(rs)
    if not v:
        out[pid] = {"n": 0, "reports": reports}
        continue
    a = np.array(v); n = len(a)
    out[pid] = {"n": n, "reports": reports, "med": float(np.median(a)),
                "p25": float(np.percentile(a, 25)) if n >= 5 else None, "p75": float(np.percentile(a, 75)) if n >= 5 else None,
                "admits": len(ad), "rejects": sum(1 for r in rs if r["result"] == "reject")}
save(WORK / "targets.json", {"programmes": out})
print("programmes with reports", len(out), "with GPA targets", sum(1 for t in out.values() if t["n"]))
