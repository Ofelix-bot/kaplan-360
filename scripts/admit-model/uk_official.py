"""Offer and acceptance rates from UK universities' own published admissions statistics
(data/sources/uk-official/uk-official-stats.json: Oxford by department, Cambridge by School and citizenship).

Writes data/pipeline/admit-model/uk_official.json with
  global      the pooled offer-to-acceptance rate ("yield") that turns applications per place into an offer rate,
              and offer rates by applicant origin (China, Asia, UK, ...) relative to all applicants;
  programmes  for each Oxford or Cambridge programme in the library: its department or School, that unit's
              offer rate and yield over the published years.
build_model.py uses the programme's own yield (else the pooled one) when it converts applications per place into an
offer rate, and the unit's offer rate when the programme page gives no applications per place."""
import re
from common import RAW, WORK, SOURCES, load, save

S = load(SOURCES / "uk-official" / "uk-official-stats.json")
P = load(RAW / "programmes.json")["programmes"]


def pool(triples):
    a = sum(t[0] for t in triples); o = sum(t[1] for t in triples); x = sum(t[2] for t in triples)
    return {"applications": a, "offers": o, "acceptances": x,
            "offerRate": round(o / a, 4) if a else None, "yield": round(x / o, 4) if o else None}


# ---- units: Oxford departments and Cambridge Schools, pooled over the published years ----
units = {}
for year, rows in S["oxford"]["taughtByDepartment"].items():
    for r in rows:
        units.setdefault(("oxford", r["unit"]), []).append((r["applications"], r["offers"], r["acceptances"]))
for year, d in S["cambridge"]["nonDoctoralBySchool"].items():
    for name, t in d.items():
        units.setdefault(("cambridge", name), []).append(tuple(t))
for year, d in S["cambridge"]["doctoralBySchool"].items():
    for name, t in d.items():
        units.setdefault(("cambridge", name + " (doctoral)"), []).append(tuple(t))
UNITS = {k: pool(v) for k, v in units.items()}

# ---- which unit runs each library programme (by the course name; checked by hand against the course pages) ----
OX_RULES = [
    (r"law.and.finance|criminology|intellectual.property|law.governance", "Law"),
    (r"human.rights.law", "Oxford Lifelong Learning"),
    (r"film.aesthetics", "Medieval and Modern Languages"),
    (r"teacher.education|learning.and.teaching|educational.assessment|higher.education|digital.and.social|child.development|research.design|comparative.and.intern|applied.linguistics", "Education"),
    (r"autonomous.robotics", "Engineering Science"),
    (r"social.data.science", "Oxford Internet Institute"),
    (r"software", "Computer Science"),
    (r"advanced.computer.science", "Computer Science"),
    (r"economics.for.development", "International Development"),
    (r"public.health|global.health|health.service.improvement", "Population Health"),
    (r"evidence.based.health|digital.health|translational.health", "Primary Care"),
    (r"cognitive.behavioural", "Psychiatry"),
    (r"said.business|artificial.intelligence.for.busi", "Saïd Business School"),
    (r"computational.f|mathematical.modelling|foundations.of.c", "Mathematical Institute"),
]
CAM_RULES = [
    (r"phd", "Humanities and Social Sciences (doctoral)"),
    (r"law|education", "Humanities and Social Sciences"),
    (r"business|mba|accounting|finance", "Technology"),  # Judge Business School sits in the School of Technology
]

progs = {}
for p in P:
    inst = p["institutionId"]
    if inst not in ("university-of-oxford", "university-of-cambridge"):
        continue
    uni = "oxford" if inst.endswith("oxford") else "cambridge"
    key = re.sub(r"^university-of-(oxford|cambridge)-", "", p["id"])
    unit = next((u for pat, u in (OX_RULES if uni == "oxford" else CAM_RULES) if re.search(pat, key)), None)
    if not unit:
        print("unmapped", p["id"]); continue
    st = UNITS[(uni, unit)]
    progs[p["id"]] = {"university": uni, "unit": unit, "offerRate": st["offerRate"], "yield": st["yield"],
                      "applications": st["applications"], "offers": st["offers"], "acceptances": st["acceptances"]}

# ---- pooled yield and offer rates by origin ----
ox_tot = [tuple(v.values()) for v in S["oxford"]["taughtTotal"].values()]
cam_tot = [tuple(v) for v in S["cambridge"]["nonDoctoralTotal"].values()]
YIELD = pool(ox_tot + cam_tot)


def rel(group, total):
    g = pool(group); t = pool(total)
    return {"offerRate": g["offerRate"], "allApplicants": t["offerRate"], "ratio": round(g["offerRate"] / t["offerRate"], 3), "yield": g["yield"]}


cz = S["cambridge"]["nonDoctoralByCitizenship"]
origin = {
    "China (Cambridge citizenship)": rel([(v["China"]["applications"], v["China"]["offers"], v["China"]["admissions"]) for v in cz.values()], cam_tot),
    "Asia (Oxford domicile)": rel([tuple(v["Asia"]) for v in S["oxford"]["taughtByContinent"].values()], ox_tot),
    "Asia (Cambridge citizenship)": rel([tuple(v["Asia"]) for v in S["cambridge"]["nonDoctoralByContinent"].values()], cam_tot),
    "Non-EU (Oxford domicile)": rel([tuple(v["Non-EU"]) for v in S["oxford"]["taughtByDomicile"].values()], ox_tot),
    "UK (Oxford domicile)": rel([tuple(v["UK"]) for v in S["oxford"]["taughtByDomicile"].values()], ox_tot),
    "UK (Cambridge citizenship)": rel([(v["United Kingdom"]["applications"], v["United Kingdom"]["offers"], v["United Kingdom"]["admissions"]) for v in cz.values()], cam_tot),
    "Hong Kong (Cambridge citizenship)": rel([(v["Hong Kong"]["applications"], v["Hong Kong"]["offers"], v["Hong Kong"]["admissions"]) for v in cz.values()], cam_tot),
}
sg = cz["2024-25"]["Singapore"]
origin["Singapore (Cambridge citizenship, 2024-25)"] = {
    "offerRateAtLeast": round(sg["offers"] / sg["applicationsAtMost"], 4),
    "allApplicants": round(cam_tot[0][1] / cam_tot[0][0], 4),
    "note": "Singapore is in the top ten for offers (114) but not for applications, so it had at most 369 applications (the tenth country's count).",
}

out = {
    "sources": S["sources"], "retrieved": S["retrieved"],
    "global": {"yieldPooled": YIELD["yield"], "pooled": YIELD, "byOrigin": origin},
    "units": {f"{u}: {n}": v for (u, n), v in UNITS.items()},
    "programmes": progs,
}
save(WORK / "uk_official.json", out, indent=1)
print(f"pooled yield {YIELD['yield']:.3f} (Oxford taught + Cambridge non-doctoral, 2 years); programmes mapped {len(progs)}")
for k, v in origin.items():
    print(" ", k, v)
