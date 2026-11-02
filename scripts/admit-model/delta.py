"""Private-school offset delta relative to the awarding university's tier, from Singapore private-school admits
against the same programmes' overall admits (C-tier-equivalent median and spread from targets.json).
Flat prior on [-0.40, +0.15]; Student-t(4) likelihood (robust to minimum-only admissions). Output: delta_post.json."""
import numpy as np
from common import RAW, WORK, SHIFT, load, save, ucd_to_four

T = {k: v for k, v in load(WORK / "targets.json")["programmes"].items() if v["n"] >= 5 and v.get("p25") is not None and v["med"] < 3.9}
obs = []
for r in load(WORK / "pei_matched.json"):  # confirmed Singapore study, non-Australian grading
    if r["credibility"] == "确认新加坡就读" and "AU" not in str(r["scale"]) and r["awarderTier"] and r["pid"] in T:
        obs.append(("pei-" + (r["school"] or "unknown"), r["pid"], r["gpa4"], r["awarderTier"]))
for c in load(RAW.parent / "pipeline" / "xdf" / "cases.json")["cases"]:  # Kaplan graduates (UCD degrees)
    if c["degree"].startswith("ucd-") and c.get("gpa") is not None:
        for a in c["applications"]:
            if a.get("result") == "admit" and a.get("programmeId") in T:
                obs.append(("kaplan-ucd", a["programmeId"], ucd_to_four(c["gpa"]), "A"))
grid = np.linspace(-0.4, 0.15, 1101); logL = np.zeros_like(grid)
for src, pid, g4, aw in obs:
    t = T[pid]; sd = np.sqrt((max(t["p75"] - t["p25"], 0.08) / 1.35) ** 2 + 0.05 ** 2)
    z = (t["med"] - g4 - SHIFT[aw] - grid) / sd
    logL += -2.5 * np.log1p(z * z / 4)
post = np.exp(logL - logL.max()); post /= post.sum()
mu = float((grid * post).sum()); sd = float(np.sqrt(((grid - mu) ** 2 * post).sum())); cdf = np.cumsum(post)
src = {}
for o in obs: src[o[0]] = src.get(o[0], 0) + 1
save(WORK / "delta_post.json", {"mu": mu, "sd": sd, "p10": float(grid[np.searchsorted(cdf, .1)]), "p90": float(grid[np.searchsorted(cdf, .9)]),
                               "n": len(obs), "sources": src, "prior": "flat on [-0.40, +0.15] relative to the awarding university tier; Student-t(4) likelihood"})
print(f"delta {mu:+.3f} ± {sd:.3f} from {len(obs)} admits {src}")
