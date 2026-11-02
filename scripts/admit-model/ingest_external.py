"""
Imports open admission-outcome datasets (academic, non-commercial use) into one record format and links each
record to a programme in data/raw/programmes.json where the match is certain.

Sources (clone each into data/sources/external/<folder>, depth 1):
  QuantPath   git clone --depth 1 https://github.com/MasterAgentAI/QuantPath            MasterAgentAI_QuantPath
              data CC BY-NC-SA 4.0 (attribution: MasterAgentAI/QuantPath); quant-finance master's (MFE/MFin)
  GradCafe A  git clone --depth 1 https://github.com/melina-hd/admission-prediction      melina-hd_admission-prediction
              GradCafe survey scrape (needs pyarrow for the .parquet); no licence stated
  GradCafe B  git clone --depth 1 https://github.com/zeynepozeren1/DSA210Project         zeynepozeren1_DSA210Project
              GradCafe CS master's scrape; no licence stated
  THU 飞跃    git clone --depth 1 -b gh-pages https://github.com/THU-feiyue/database     THU_db_pages
              MIT; Tsinghua applicants. Only programme, term, result and GPA are read (no names or contacts).

Kaplan 360++ uses these at the owner's direction for academic, non-commercial research (2026-11-01).
GradCafe-derived rows are de-duplicated against each other and against data/pipeline/gradcafe/results.json
on (institution, programme as written, decision, GPA, year).

Usage: python scripts/admit-model/ingest_external.py   [EXTERNAL_DIR=... to read the clones elsewhere]
Writes data/pipeline/admit-model/external-records.json
"""
import csv, html, json, os, re, sys, unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EXT = Path(os.environ.get("EXTERNAL_DIR", ROOT / "data" / "sources" / "external"))
OUT = ROOT / "data" / "pipeline" / "admit-model" / "external-records.json"
SINCE = 2022

P = json.load(open(ROOT / "data/raw/programmes.json", encoding="utf-8"))["programmes"]
INST = json.load(open(ROOT / "data/raw/institutions.json", encoding="utf-8"))["institutions"]
PM = json.load(open(ROOT / "data/pipeline/compass/programme-matches.json", encoding="utf-8"))
OWN_GC = json.load(open(ROOT / "data/pipeline/gradcafe/results.json", encoding="utf-8"))["results"]

def norm(s):
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\([^)]*\)", " ", s).replace("&", " and ")
    s = re.sub(r"\bthe\b", " ", s)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

inst_by_name = {}
for i in INST:
    names = [i.get("name"), i.get("qsName")] + ((i.get("kaggle") or {}).get("names") or [])
    for n in filter(None, names):
        inst_by_name.setdefault(norm(n), i["id"])
        inst_by_name.setdefault(norm(n).replace("university of ", ""), i["id"])
ALIAS = {"ucla": "university-of-california-los-angeles", "ucb": "university-of-california-berkeley", "uc berkeley": "university-of-california-berkeley",
         "ucsd": "university-of-california-san-diego", "uiuc": "university-of-illinois-at-urbana-champaign", "cmu": "carnegie-mellon-university",
         "gatech": "georgia-institute-of-technology", "georgia tech": "georgia-institute-of-technology", "upenn": "university-of-pennsylvania",
         "umich": "university-of-michigan-ann-arbor", "ut austin": "university-of-texas-at-austin", "nyu": "new-york-university",
         "umd": "university-of-maryland-college-park", "umn": "university-of-minnesota-twin-cities", "unc": "university-of-north-carolina-chapel-hill",
         "usc": "university-of-southern-california", "jhu": "johns-hopkins-university", "mit": "massachusetts-institute-of-technology",
         "ualberta": "university-of-alberta", "uw": "university-of-washington", "eth": "eth-zurich-swiss-federal-institute-of-technology",
         "ubc": "university-of-british-columbia", "uoft": "university-of-toronto", "hku": "university-of-hong-kong", "hkust": "hong-kong-university-of-science-and-technology",
         "cuhk": "chinese-university-of-hong-kong", "nus": "national-university-of-singapore", "ntu": "nanyang-technological-university-singapore",
         "lse": "london-school-of-economics-and-political-science", "ucl": "ucl", "imperial": "imperial-college-london", "ic": "imperial-college-london"}
inst_ids = {i["id"] for i in INST}
ALIAS = {k: v for k, v in ALIAS.items() if v in inst_ids}

def institution(name):
    n = norm(name)
    return ALIAS.get(n) or inst_by_name.get(n) or inst_by_name.get(n.replace("university of ", ""))

by_inst = defaultdict(list)
for p in P:
    by_inst[p["institutionId"]].append(p)
STOP = set("msc ms ma master masters of in and the mphil meng mres programme program degree science arts".split())
EXPAND = {"cs": "computer science", "mscs": "computer science", "ee": "electrical engineering", "msee": "electrical engineering",
          "ece": "electrical and computer engineering", "msece": "electrical and computer engineering", "ds": "data science",
          "ba": "business analytics", "msba": "business analytics", "stat": "statistics", "stats": "statistics", "mism": "information systems management",
          "cse": "computer science and engineering", "biostat": "biostatistics", "matse": "materials science and engineering", "mfe": "financial engineering"}
def tokens(s):
    words = re.findall(r"[a-z]+", norm(s))
    out = []
    for w in words:
        out += EXPAND.get(w, w).split()
    return {w for w in out if w not in STOP}

def programme(inst_id, raw):
    if not inst_id:
        return None
    m = PM.get(f"{inst_id}|{raw}")
    if m and m.get("sure") and m.get("ids"):
        return m["ids"][0]
    t = tokens(raw)
    if not t:
        return None
    scored = sorted(((len(t & q) / len(t | q), p["id"]) for p in by_inst[inst_id] if (q := tokens(p["name"]))), reverse=True)
    if scored and scored[0][0] >= 0.99 and (len(scored) < 2 or scored[1][0] < 0.99):
        return scored[0][1]
    return None

def year_of(season):
    s = str(season or "")
    m = re.search(r"(20\d\d)", s)
    if m: return int(m.group(1))
    m = re.search(r"(?:^|[^0-9])(\d{2})(?:[^0-9]|$)", s)
    return 2000 + int(m.group(1)) if m else None

def gpa4(v, scale=4.0, country=None):
    try:
        v = float(v)
    except (TypeError, ValueError):
        return None
    if v != v: return None
    if scale in (4.0, None) and 0 < v <= 4.0: return round(v, 2)
    if scale == 4.3 and 0 < v <= 4.3: return round(min(v, 4.0), 2)
    if scale == 100 and country == "CN" and 60 <= v <= 100: return round(4 - 3 * (100 - v) ** 2 / 1600, 2)  # Peking University's rule
    return None

DEC = {"accepted": "admit", "admit": "admit", "chosen": "admit", "rejected": "reject", "reject": "reject", "wait listed": "waitlist", "waitlisted": "waitlist"}
records, seen, stats = [], set(), Counter()

def gc_key(inst_id, raw, decision, gpa, year):
    return (inst_id, norm(raw), decision, gpa, year)
for r in OWN_GC:  # what the pipeline already has
    seen.add(gc_key(r["institutionId"], r["programme"], DEC.get(r["decision"]), round(r["gpa"], 2) if r["gpa"] else None, year_of(r.get("season"))))

def add(source, licence, inst_name, raw, decision, gpa, year, status=None, tier=None, gradcafe=False, extra=None):
    decision = DEC.get(str(decision).strip().lower())
    if decision not in ("admit", "reject", "waitlist") or not year or year < SINCE:
        stats[f"{source}:skipped"] += 1; return
    inst_id = institution(inst_name)
    if gradcafe:
        k = gc_key(inst_id, raw, decision, gpa, year)
        if k in seen: stats[f"{source}:duplicate"] += 1; return
        seen.add(k)
    pid = programme(inst_id, raw)
    stats[f"{source}:{'linked' if pid else 'unlinked'}"] += 1
    records.append({"source": source, "licence": licence, "institutionId": inst_id, "programmeId": pid, "programme": raw,
                    "result": decision, "gpa": gpa, "year": year, "status": status, "tier": tier, **(extra or {})})

# QuantPath (quant finance master's): programme codes mapped by hand to the library's programmes.
QP_MAP = {"columbia-msfe": "columbia-university-financial-engineering-msfe", "cmu-mscf": "carnegie-mellon-university-master-of-science-in-computational-finance",
          "bu-msmf": "boston-university-ms-in-mathematical-finance-and-financial-technology", "mit-mfin": "massachusetts-institute-of-technology-mit-sloan-master-of-finance",
          "berkeley-mfe": "university-of-california-berkeley-master-of-financial-engineering-mfe", "gatech-qcf": "georgia-institute-of-technology-master-of-science-in-quantitative-and-computational-finance",
          "nyu-tandon-mfe": "new-york-university-financial-engineering-ms", "nyu-mfe": "new-york-university-financial-engineering-ms", "nyu-courant": "new-york-university-mathematics-in-finance-ms",
          "uiuc-msfe": "university-of-illinois-at-urbana-champaign-financial-engineering-ms", "ucla-mfe": "university-of-california-los-angeles-management-master-of-financial-engineering",
          "jhu-mfm": "johns-hopkins-university-financial-mathematics-master-of-science", "oxford-mcf": "university-of-oxford-msc-in-mathematical-and-computational-finance",
          "eth-qf": "eth-zurich-swiss-federal-institute-of-technology-master-quantitative-finance", "stonybrook-qf": "stony-brook-university-state-university-of-new-york-quantitative-finance-ms-and-phd"}
pid_inst = {p["id"]: p["institutionId"] for p in P}
qp = EXT / "MasterAgentAI_QuantPath" / "data" / "admissions" / "collected_multidim.csv"
if qp.exists():
    for r in csv.DictReader(open(qp, encoding="utf-8")):
        pid = QP_MAP.get(r["program"])
        dec = DEC.get(r["result"]); yr = year_of(r["season"])
        if not pid or dec not in ("admit", "reject", "waitlist") or not yr or yr < SINCE:
            stats["quantpath:skipped"] += 1; continue
        scale = float(r["gpa_scale"]) if r["gpa_scale"] else 4.0
        g = gpa4(r["gpa"], scale, r["undergrad_country"] or None)
        gradcafe = r["source"] in ("gradcafe", "github-gc")
        key = gc_key(pid_inst[pid], r["program"], dec, g, yr)
        if gradcafe and key in seen: stats["quantpath:duplicate"] += 1; continue
        seen.add(key)
        tier = {"C9": "A", "985": "A", "211": "B"}.get(r["undergrad_tier"]) if r["undergrad_country"] == "CN" else None
        records.append({"source": "quantpath:" + r["source"], "licence": "CC BY-NC-SA 4.0 (MasterAgentAI/QuantPath)", "institutionId": pid_inst[pid],
                        "programmeId": pid, "programme": r["program"], "result": dec, "gpa": g, "year": yr, "status": r["nationality"] or None, "tier": tier,
                        "internships": int(float(r["intern_count"])) if r["intern_count"] else None, "research": r["has_research"] or None})
        stats["quantpath:linked"] += 1
else:
    print("missing", qp, file=sys.stderr)

# GradCafe A (melina-hd): parquet
pq = EXT / "melina-hd_admission-prediction" / "initial_run_cleaned.parquet"
if pq.exists():
    import pandas as pd
    d = pd.read_parquet(pq)
    d = d[d["cleaned_degree"] == "Masters"]
    for r in d.itertuples(index=False):
        add("gradcafe-melina", "none stated (GradCafe survey)", r.university, r.program if isinstance(r.program, str) else "", r.result, gpa4(r.GPA), year_of(r.season),
            status=r.status.lower() if isinstance(r.status, str) else None, gradcafe=True)
else:
    print("missing", pq, file=sys.stderr)

# GradCafe B (DSA210): CS master's
db = EXT / "zeynepozeren1_DSA210Project" / "GradCafe" / "Data Collection: Web Scraping" / "rejected_batchs" / "gradcafe_accepted_rejected_raw.csv"
if db.exists():
    for r in csv.DictReader(open(db, encoding="utf-8")):
        add("gradcafe-dsa210", "none stated (GradCafe survey)", r["university"], re.sub(r"\s*masters?$", "", r["program"], flags=re.I),
            r["decision"], gpa4(r["gpa_raw"]), year_of(r["term"]), status=(r["citizenship"] or "").lower() or None, gradcafe=True)
else:
    print("missing", db, file=sys.stderr)

# THU 飞跃 database (gh-pages): programme@school, term, result; GPA from the profile. Tsinghua = tier A.
thu = EXT / "THU_db_pages" / "applicant"
if thu.exists():
    for page in sorted(thu.glob("*/index.html")):
        t = page.read_text(encoding="utf-8")
        text = html.unescape(re.sub(r"<[^>]+>", " ", re.sub(r"<script.*?</script>|<style.*?</style>", "", t, flags=re.S)))
        gm = re.search(r"GPA\s*[：:]\s*([0-4]\.\d+)(?:\s*/\s*(4\.0|4\.3|4))?", text)
        g = gpa4(gm.group(1), float(gm.group(2) or 4.0)) if gm else None
        i = t.find("<table")
        for row in re.findall(r"<tr>(.*?)</tr>", t[i:t.find("</table>", i)], flags=re.S):
            cells = [html.unescape(re.sub(r"<[^>]+>", " ", c)).strip() for c in re.findall(r"<td>(.*?)</td>", row, flags=re.S)]
            if len(cells) < 3 or "Master" not in cells[0]: continue
            prog, _, school = cells[0].replace("Master", "").strip().partition("@")
            res = re.sub(r"[^A-Za-z ]", "", cells[2]).strip()
            add("thu-feiyue", "MIT (THU-feiyue/database)", school.strip(), prog.strip(), res, g, year_of(cells[1]), tier="A")
else:
    print("missing", thu, file=sys.stderr)

OUT.parent.mkdir(parents=True, exist_ok=True)
json.dump({"dataset": "Open admission-outcome datasets, linked to the programme library where certain",
           "use": "academic, non-commercial (owner's decision 2026-11-01)", "since": SINCE,
           "stats": dict(stats), "records": records}, open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
print(json.dumps(dict(sorted(stats.items())), ensure_ascii=False, indent=1))
print("records", len(records), "linked", sum(1 for r in records if r["programmeId"]))
