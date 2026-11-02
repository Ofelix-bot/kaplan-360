"""Match FOI programme rows (foi_rows.json, from foi_parse.py) to library programmes and pool recent years.

Names are compared after removing the award (MSc, MA, Master of Science in, ...), the mode (full / part time,
FT / PT) and punctuation; a match needs the same institution, a compatible award and a name similarity of at least
0.85 (two-way word overlap). Full- and part-time rows of the same course are added together.
For each matched programme the three most recent entry years from 2019 on are pooled:
  offerRate   = offers / applications, all applicants (needs 20+ applications)
  cnOfferRate = the same for applicants of Chinese nationality (needs 10+ applications)
Writes data/pipeline/admit-model/foi_programmes.json."""
import json, re, collections, difflib, functools
from common import RAW, WORK, load, save

ROWS = load(WORK / "foi_rows.json")["rows"]
P = load(RAW / "programmes.json")["programmes"]
INST = {i["id"]: i for i in load(RAW / "institutions.json")["institutions"]}

UNI = {  # FOI authority name -> library institution id, where the names differ
    "University College London": "ucl", "University of Durham": "durham-university", "Kingston University": "kingston-university-london",
    "School of Oriental and African Studies": "soas-university-of-london", "Cardiff Metropolitan University": None,
    "Guildhall School of Music and Drama": None, "London School of Economics": "london-school-of-economics-and-political-science",
}
uk = {i["name"]: k for k, i in INST.items() if i.get("country") == "United Kingdom"}


def inst_of(name):
    if name in UNI: return UNI[name]
    m = difflib.get_close_matches(name, list(uk), n=1, cutoff=0.8)
    return uk[m[0]] if m else None


AWARDS = [  # (pattern, canonical award)
    (r"master of business administration|\bmba\b", "mba"), (r"master of laws|\bllm\b", "llm"),
    (r"master of research|\bmres\b", "mres"), (r"master of philosophy|\bmphil\b", "mphil"),
    (r"master of public health|\bmph\b", "mph"), (r"master of public (policy|administration)|\bmpa\b|\bmpp\b", "mpa"),
    (r"master of fine art|\bmfa\b", "mfa"), (r"master of architecture|\bmarch\b", "march"), (r"master of education|\bmed\b|\bmeded\b", "med"),
    (r"master of engineering|\bmeng\b", "meng"), (r"master of finance|\bmfin\b", "msc"), (r"master of accounting|\bmacc\b", "msc"),
    (r"master of science|\bm\.?sc\b|\bmsc\b", "msc"), (r"master of arts|\bm\.?a\.?\b", "ma"), (r"master of letters|\bmlitt\b", "ma"),
    (r"postgraduate diploma|\bpg ?dip\b|\bpgdip\b|\bdiploma\b", "pgdip"), (r"postgraduate certificate|\bpg ?cert\b|\bpgcert\b|\bcertificate\b", "pgcert"),
    (r"doctor|\bphd\b|\bdphil\b|\bengd\b|\bdclin", "doctoral"), (r"bachelor|\bb\.?sc\b|\bba\b|\bbeng\b|\bmbbs\b", "ug"),
]
MODE = re.compile(r"\b(full|part)[- ]?time\b|\(?\b(ft|pt|fte|f/t|p/t)\b\)?|\bonline\b|\bdistance learning\b|\bblended\b|\b(sept|september|january|jan) (start|intake|entry)\b|\b\d{4}\b", re.I)
STOP = {"in", "of", "and", "the", "with", "for", "a", "an", "to", "&", "studies", "programme", "course", "degree", "advanced"}


def award(name):
    s = name.lower()
    for pat, a in AWARDS:
        if re.search(pat, s): return a
    return None


def norm(name):
    s = name.lower().replace("&", " and ")
    for pat, _ in AWARDS: s = re.sub(pat, " ", s)
    s = MODE.sub(" ", s)
    s = re.sub(r"\b(mst|msc|ma|llm|mres|mba|pgdip|pgcert)\b", " ", s)
    s = re.sub(r"\b\d+\s*(years?|yrs?|months?)\b|\b(one|two) years?\b", " ", s)  # durations ('- 1 Year')
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    return " ".join(t for t in s.split() if t not in STOP and not re.search(r"\d", t))  # drop course codes


@functools.lru_cache(maxsize=None)
def same(x, y):
    return x == y or (len(x) > 3 and len(y) > 3 and abs(len(x) - len(y)) <= 2 and difflib.SequenceMatcher(None, x, y).ratio() >= 0.85)


@functools.lru_cache(maxsize=None)
def tsr(a, b):
    """Dice overlap of the two names' word sets, words counting as equal when nearly identical (typos, plurals):
    both names must be covered, so 'Risk Management' does not match 'Management'."""
    A, B = a.split(), b.split()
    if not A or not B: return 0.0
    if len(set(A) & set(B)) * 2 < 0.6 * (len(A) + len(B)): return 0.0  # cheap reject before fuzzy word comparison
    hit_a = sum(1 for x in A if any(same(x, y) for y in B)); hit_b = sum(1 for y in B if any(same(x, y) for x in A))
    return (hit_a + hit_b) / (len(A) + len(B))


LIB_AWARD = {"MSc": "msc", "MA": "ma", "LLM": "llm", "MBA": "mba", "MRes": "mres", "MPhil": "mphil", "MPH": "mph", "MEd": "med", "MFA": "mfa", "MEng": "meng", "MPA": "mpa", "MPP": "mpa", "MArch": "march"}
COMPAT = {("msc", "ma"), ("ma", "msc")}  # some universities award either for the same course; scored lower


# ---- group FOI rows by institution ----
by_inst = collections.defaultdict(list)
for r in ROWS:
    iid = inst_of(r["university"])
    if not iid: continue
    a = award(r["programme"])
    if a in ("doctoral", "ug"): continue
    r["_n"] = norm(r["programme"]); r["_a"] = a
    by_inst[iid].append(r)

# where most of a university's rows name the award, a row without one is usually a department or subject total
AWARDED = {k: sum(1 for r in v if r["_a"]) / len(v) >= 0.5 for k, v in by_inst.items()}


def compatible(pa, ra, inst):
    if ra is None: return not AWARDED[inst]
    if ra in ("pgdip", "pgcert"): return pa in ("pgdip", "pgcert")
    return pa is None or ra == pa or (pa, ra) in COMPAT


out = {}
for p in P:
    rows = by_inst.get(p["institutionId"])
    if not rows: continue
    pa = LIB_AWARD.get(p.get("degreeType")) or award(p["name"])
    pn = norm(p["name"])
    if not pn: continue
    best = collections.defaultdict(float); names = {}
    for r in rows:
        if not compatible(pa, r["_a"], p["institutionId"]): continue
        s = tsr(pn, r["_n"]) - (0.04 if (pa and r["_a"] and r["_a"] != pa) else 0)
        if s >= 0.85 and s > best[r["_n"]]: best[r["_n"]] = s
    if not best: continue
    top = max(best.values()); keep = {n for n, s in best.items() if s >= top - 1e-9}
    per_year = collections.defaultdict(lambda: collections.Counter())
    used = collections.defaultdict(set)
    for r in rows:
        if r["_n"] not in keep or not compatible(pa, r["_a"], p["institutionId"]): continue
        y = r["year"]
        if not y or y < 2019: continue
        names[r["programme"]] = 1
        for f in ("all_apps", "all_offers", "cn_apps", "cn_offers"):
            if r.get(f) is not None: per_year[y][f] += r[f]; used[y].add(f)
        per_year[y]["_suppressed"] += int(bool(r.get("smallSuppressed")))
    years = sorted((y for y in per_year if {"all_apps", "all_offers"} <= used[y]), reverse=True)[:3]
    if not years: continue
    A = sum(per_year[y]["all_apps"] for y in years); O = sum(per_year[y]["all_offers"] for y in years)
    cy = [y for y in years if {"cn_apps", "cn_offers"} <= used[y]]
    CA = sum(per_year[y]["cn_apps"] for y in cy); CO = sum(per_year[y]["cn_offers"] for y in cy)
    out[p["id"]] = {
        "foiNames": sorted(names)[:4], "score": round(top, 3), "years": years,
        "applications": A, "offers": O, "offerRate": round(O / A, 4) if A >= 20 and O <= A * 1.05 else None,
        "cnYears": cy, "cnApplications": CA, "cnOffers": CO,
        "cnOfferRate": round(CO / CA, 4) if CA >= 10 and CO <= CA * 1.05 else None,
        "university": rows[0]["university"],
    }

save(WORK / "foi_programmes.json", {"programmes": out}, indent=1)
cnt = collections.Counter(INST[P_id["institutionId"]]["name"] for P_id in P if P_id["id"] in out)
uk_total = sum(1 for p in P if INST.get(p["institutionId"], {}).get("country") == "United Kingdom")
print(f"matched {len(out)} of {uk_total} UK library programmes; with offer rate {sum(1 for v in out.values() if v['offerRate'] is not None)}, with Chinese offer rate {sum(1 for v in out.values() if v['cnOfferRate'] is not None)}")
print(cnt.most_common(30))
