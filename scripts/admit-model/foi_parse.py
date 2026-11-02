"""Programme-level applications and offers from UK universities' Freedom of Information replies
(data/sources/foi/: attachments of answered WhatDoTheyKnow requests, with foi__manifest.json saying which university
and request each file belongs to).

Every attachment is turned into a grid of cells (an xlsx sheet as it is; a PDF rebuilt from word positions, numbers
snapped to the columns they line up in) and read the same way:
  - a table starts at the header rows right above its first data row; the few short title rows above the header, the
    sheet name and section rows inside the table ('2020-21', 'Table 2: ... Chinese nationality ...') give the default
    year, nationality group and measure of the columns that do not name them;
  - a column counts applications or offers by its label; it is Chinese, not-Chinese, another group (India, Home, ...)
    or all applicants by its label, and only when no column of the table names a group does the sheet / title decide;
  - the year comes from the column label, a year column, a section row, the title / sheet name, and lastly from the
    request (title, then text);
  - the programme is the most name-like text column (many distinct, word-like values); code / mode / degree /
    level / nationality columns are recognised by label and values;
  - suppressed small counts ('<5', '≤5', '*', '5 or fewer', 'Withheld') stay null and set smallSuppressed.
Layouts the generic reader gets wrong have a rule in RULES (keyed by part of the file name), each saying why.
Rows of the same university, programme and year from several requests keep the most recent request's values;
disagreements over 10% between unrounded values are listed in `conflicts`.
Writes data/pipeline/admit-model/foi_rows.json; -v prints rows per file and a per-university summary.
FOI_CACHE=<dir> caches PDF word positions between runs (reading the big PDFs takes minutes)."""
import json, re, sys, os, pickle, warnings, collections, statistics
from pathlib import Path
from common import SOURCES, WORK, save

warnings.filterwarnings("ignore")
DEBUG = bool(os.environ.get("FOI_DEBUG"))
DIR = SOURCES / "foi"
MAN = json.load(open(DIR / "foi__manifest.json", encoding="utf-8"))["requests"]

# ---------------------------------------------------------------- vocabulary
APPS = re.compile(r"applic|\bapps?\b|\bappl(n|ns|s)?\b", re.I)  # not 'Applied'/'Applying'
OFFERS = re.compile(r"offer", re.I)
SKIP_METRIC = re.compile(r"accept|firm|enrol|regist|entrant|intake|interview|waiting|declin|withdr|reject|%|percent|\brate\b|ratio|"
                         r"conversion|\bufs?\b|^reg$|average|mean\b|median|gpa|grade|deposit|\bpaid\b|\bcas\b|unconditional firm", re.I)
CN = re.compile(r"chin(a|ese|ease)|\bprc\b|\bcn\b|mainland", re.I)
NC = re.compile(r"non[- ]?chin|not[- ]chin|outwith chin|other nationalit|excl\w* chin|rest of (the )?world|non[- ]?prc", re.I)
NC_LABEL = re.compile(NC.pattern + r"|^other$", re.I)  # a column 'Other' next to 'Chinese'
OTHER = re.compile(r"\binternational (appl|offer)|\bindia|south americ|peru|\bhome\b|overseas|\beu\b|\buk\b|domestic|taiwan|hong kong|macao|nigeria|"
                   r"pakistan|malaysia|turk|dutch|irish|international fee", re.I)
ALL = re.compile(r"\ball\b|total|overall|grand", re.I)
NAME_HDR = re.compile(r"programme|program|course|title|name|degree|plan|descr|subject", re.I)
UNIT_HDR = re.compile(r"department|faculty|school|division|college|\bdept\b|academic unit|institute", re.I)
CODE_HDR = re.compile(r"code|\bid\b|^prog$", re.I)
YEARCOL_HDR = re.compile(r"session|year|cycle|entry|term|intake|period", re.I)
MODE_HDR = re.compile(r"mode|attendance", re.I)
DEGREE_HDR = re.compile(r"qual|degree( type| code)?$|^degree|award", re.I)
LEVEL_HDR = re.compile(r"level|programme type|^type$|breakdown 1|career", re.I)
NAT_HDR = re.compile(r"nationality|domicile|country|fee status|home ?/ ?overseas", re.I)
TOTAL = re.compile(r"^\s*(grand\s+)?totals?\b|^all\s|^sum\b|^overall\b|\btotals?$", re.I)
MODE_VAL = re.compile(r"^(full[- ]?time|part[- ]?time|ft|pt|distance learning.*|online|blended|dl)$", re.I)
LEVEL_VAL = re.compile(r"^(pgt|pgr|ug|pg|postgraduate( taught| research)?|undergraduate|research|taught|pg ?taught|pg ?research)$", re.I)
CODE_VAL = re.compile(r"^(?=.*\d)[A-Z0-9][A-Z0-9\-/_.]{2,15}$|^[A-Z]{2,6}[-_][A-Z0-9_\-]{2,12}$")
LEAD_CODE = re.compile(r"^((?=[^ ]*\d)(?=[^ ]*[A-Z])[A-Z0-9][A-Z0-9\-‐/_.]{3,15})\s*(?:[:\-‐–]\s+|\s+)(\S.*)$")
MID_CODE = re.compile(r"^[A-Z][^\d]+?\s((?=\S*\d)[A-Z0-9]{3,6}[‐\-]\d{4})\s*[‐\-–]\s*(\S.*)$")
TRAIL_LEVEL = re.compile(r"\s+(Postgraduate|Undergraduate)(\s+(Taught|Research))?$")
DEGREE_TOKEN = re.compile(r"\b(MSc|MA|MBA|LLM|MRes|MPhil|PgDip|PgCert|PGDip|PGCert|MLitt|MEd|MPH|Master|Diploma|Certificate)\b")
BULLET = re.compile(r"^\s*[·•\-–*>]|^\s*notes?\b|^please\b|^\(?[ivx]+\)\s", re.I)
# taught postgraduate is kept; research degrees, professional doctorates and undergraduate rows are dropped by name
DOCTORAL = re.compile(r"\b(ph\.?d|d\.?phil|eng\.?d|ed\.?d|dclin\w*|dprof|dba|ddent|dedpsy|dpsych\w*|drph|dnursing|dmus|dlitt|dsc|dpa|md ?\(res\)|"
                      r"doctor\w*|research degree|visiting research|by research|by thesis|pgr|mphil ?/ ?phd|mphil ?\(res\)|"
                      r"msc ?\(res\)|ma ?\(res\)|research (masters?|student)|cpgs|mphil research|integrated phd)\b", re.I)
UNDERGRAD = re.compile(r"\b(BSc|BA|BEng|LLB|MEng|MSci|MChem|MPhys|MMath|MPharm|MBBS|MBChB|BDS|BMus|BVSc|BVetMed|BN|BMedSci|BScEcon|"
                       r"BArch|BAcc|MBiol|MGeog|MArts)\b|bachelor of (?!civil law|philosophy)|\bundergraduate\b|foundation year|"
                       r"integrated master|\bUG\b")


def years_in(text):
    """Entry years named in a label: '2023/24', '2023-24', '23/24', '2023/4', '202324', '2023 24', '2023' -> 2023."""
    out, s = [], str(text or "")
    for m in re.finditer(r"(?<![\d.])(20[12]\d)(?:(\d{2})|\s*[/\-–_]\s*(\d{1,4})|\s(\d{2}))?(?![\d.])|(?<![\d/.])([12]\d)\s*[/\-–_]\s*([12]\d)(?![\d/])", s):
        if m.group(1):
            y = int(m.group(1))
            if m.group(2) and int(m.group(2)) != (y + 1) % 100: continue          # 6 digits but not 202324-like
            if m.group(4) and int(m.group(4)) != (y + 1) % 100: continue          # '2019 20' only when consecutive
            if m.group(3) and re.match(r"\s*-\s*\d{2}\s*-", s[m.end(1):m.end(1) + 8]) and len(m.group(3)) == 2 and int(m.group(3)) <= 12: continue  # 2020-10-29 date
            out.append(y)
        else:
            a, b = int(m.group(5)), int(m.group(6))
            if b == a + 1: out.append(2000 + a)
    return out


def first_year(text):
    y = years_in(text)
    return y[0] if y else None


SUPP = re.compile(r"^\s*(<|≤|&lt;|<=|less than)\s*=?\s*\d+\s*$|^\*+$|or fewer|^\[?[xc]\]?$|suppress|withheld|redact|^fewer than", re.I)
BLANKISH = re.compile(r"^\s*(-|–|—|n/?a|:|\.\.|null|none|offer_only)?\s*$", re.I)  # Cambridge 'offer_only': no applications stage


def num(v):
    if v is None: return None
    if isinstance(v, bool): return None
    if isinstance(v, (int, float)): return int(round(v))
    s = str(v).strip().replace(",", "").replace(" ", "")
    if re.fullmatch(r"\d+(\.0+)?", s): return int(float(s))
    return None


def is_supp(v):
    return v is not None and bool(SUPP.search(str(v)))


def is_value(v):
    return num(v) is not None or is_supp(v)


def alpha(v):
    return bool(re.search(r"[A-Za-z]{3}", str(v or ""))) and not is_supp(v)


# ---------------------------------------------------------------- readers
def sheets_xlsx(p):
    import openpyxl
    wb = openpyxl.load_workbook(p, read_only=True, data_only=True)
    for ws in wb.worksheets:
        grid = []
        for row in ws.iter_rows(values_only=True):
            cells = []
            for c in row:
                if c is None: cells.append("")
                elif isinstance(c, float) and c.is_integer(): cells.append(str(int(c)))
                else: cells.append(str(c).strip())
            grid.append(cells)
        yield ws.title, grid


def pdf_pages(p):
    cache = os.environ.get("FOI_CACHE")
    if cache:
        c = Path(cache) / (p.name + ".pkl")
        if c.exists(): return pickle.load(open(c, "rb"))
    import pdfplumber
    pages = []
    with pdfplumber.open(p) as pdf:
        for pg in pdf.pages:
            ws = pg.extract_words(x_tolerance=1.5, y_tolerance=2)
            pages.append({"w": float(pg.width), "h": float(pg.height), "imgs": len(pg.images),
                          "words": [(w["text"], round(w["x0"], 1), round(w["x1"], 1), round(w["top"], 1), round(w["bottom"], 1)) for w in ws]})
    if cache: pickle.dump(pages, open(Path(cache) / (p.name + ".pkl"), "wb"))
    return pages


VALTOK = re.compile(r"^(\d{1,3}(,\d{3})+|\d+|[<≤]=?\d+|\*+|-|–|N/A|n/a|Withheld|offer_only)$")


def pdf_lines(words):
    """Words -> lines (same baseline within 2.5pt), each a list of (text, x0, x1) left to right, with its top."""
    lines = []
    for w in sorted(words, key=lambda w: (w[3], w[1])):
        if lines and abs(w[3] - lines[-1]["top"]) <= 2.5: lines[-1]["w"].append(w)
        else: lines.append({"top": w[3], "w": [w]})
    for ln in lines:
        ws = sorted(ln["w"], key=lambda w: w[1])
        merged = []  # '<' '5' -> '<5'; '5' 'or' 'fewer' -> '5 or fewer'
        for w in ws:
            t = w[0]
            if merged and (merged[-1][0] in ("<", "≤", "<=") and re.fullmatch(r"\d+", t)) or (merged and t in ("or",) and re.fullmatch(r"\d+", merged[-1][0])) \
                    or (merged and t == "fewer" and merged[-1][0].endswith(" or")):
                a = merged.pop(); merged.append((a[0] + ("" if a[0] in ("<", "≤", "<=") else " ") + t, a[1], w[2]))
            else: merged.append((t, w[1], w[2]))
        ln["w"] = merged
    return lines


def pdf_grid(pages, split_x=None, split_titles=None):
    """Rebuild a table from word positions, page by page: value columns are the x positions where the trailing
    numbers of many lines line up; a line's leading text is the programme cell; text-only lines next to a data
    line (wrapped names) join its name, other text-only lines stay as rows of their own (titles, sections, headers)."""
    grid = []
    halves = []
    for pg in pages:
        if split_x:
            cut = pg["w"] * split_x
            halves.append(([w for w in pg["words"] if w[1] < cut], 0)); halves.append(([w for w in pg["words"] if w[1] >= cut], 1))
        else: halves.append((pg["words"], 0))
    for words, side in halves:
        if split_titles: grid.append([split_titles[side]])  # what each half of a split page counts
        lines = pdf_lines(words)
        if not lines: continue
        runs = []
        for ln in lines:
            k = len(ln["w"])
            while k > 0 and VALTOK.match(ln["w"][k - 1][0]): k -= 1
            runs.append(k)
        centers = sorted((w[1] + w[2]) / 2 for ln, k in zip(lines, runs) if k > 0 and k < len(ln["w"]) for w in ln["w"][k:])
        clusters = []
        for c in centers:
            if clusters and c - clusters[-1][-1] <= 14: clusters[-1].append(c)
            else: clusters.append([c])
        nlines = sum(1 for ln, k in zip(lines, runs) if 0 < k < len(ln["w"]))
        cols = [statistics.median(c) for c in clusters if len(c) >= max(2, 0.04 * nlines)]
        if not cols:
            grid += [[" ".join(w[0] for w in ln["w"])] for ln in lines]; continue
        first_x = min(cols)
        recs = []  # (top, kind, name parts, values)
        colx = collections.defaultdict(list)
        for ln in lines:
            ws, vals, k = ln["w"], {}, len(ln["w"])
            used = len(cols)
            while k > 0 and VALTOK.match(ws[k - 1][0]):
                c = (ws[k - 1][1] + ws[k - 1][2]) / 2
                j = min(range(len(cols)), key=lambda j: abs(cols[j] - c))
                if abs(cols[j] - c) > 22 or j >= used: break
                vals[j] = ws[k - 1][0]; used = j; k -= 1
                colx[j].append((ws[k][1], ws[k][2]))
            text = [w for w in ws[:k]]
            if vals and not any(is_value(v) for v in vals.values()):  # only dashes: a header line ('Total Applications -')
                vals, text = {}, ws
            if vals and text and any(alpha(w[0]) for w in text):
                recs.append([ln["top"], "data", [" ".join(w[0] for w in text)], vals])
            elif vals and not text:
                recs.append([ln["top"], "data", [], vals])
            else:
                recs.append([ln["top"], "text", ws, {}])
        # attach wrapped name fragments (text lines in the name area, within a line height of a data line)
        tops = [r[0] for r in recs if r[1] == "data"]
        gaps = sorted(b - a for a, b in zip(tops, tops[1:]) if b > a)
        lh = statistics.median(gaps) if gaps else 12
        out = []
        for i, r in enumerate(recs):
            if r[1] != "text": continue
            ws = r[2]
            if any(VALTOK.match(w[0]) and min(abs((w[1] + w[2]) / 2 - c) for c in cols) < 10 for w in ws): continue
            if ws[-1][2] > first_x - 5 and not all(w[2] < first_x for w in ws):  # spreads over the value columns: header/title
                continue
            if re.search(r"^(table|figure|page)\b", ws[0][0], re.I): continue
            txt = " ".join(w[0] for w in ws)
            above = next(((r[0] - d[0], j) for j, d in reversed(list(enumerate(recs[:i]))) if d[1] == "data"), None)
            below = next(((d[0] - r[0], j) for j, d in enumerate(recs) if j > i and d[1] == "data"), None)
            cands = [c for c in (above, below) if c and c[0] <= 1.2 * lh]
            if not cands: continue
            def name_of(j): return " ".join(p for p in recs[j][2] if isinstance(p, str))
            cont_down = below and below in cands and (re.match(r"^[a-z(&\-–,]", name_of(below[1]) or "x") or not name_of(below[1])
                                                      or (LEAD_CODE.match(txt) and not LEAD_CODE.match(name_of(below[1]))))
            cont_up = above and above in cands and (re.match(r"^[a-z(&\-–]", txt) or re.search(r"(,|\band|&|-|–|\bof|\bin|\bfor|\bwith)$", name_of(above[1])))
            j = None
            if cont_down and not cont_up: j = below[1]
            elif cont_up and not cont_down: j = above[1]
            else:
                d, jj = min(cands)
                if d <= 0.9 * lh: j = jj
            if j is not None:
                recs[j][2].append((r[0], txt)); r[1] = "joined"
        ext = {j: (min(a for a, _ in v), max(b for _, b in v)) for j, v in colx.items()}
        starts = [r[2][0] for r in recs if r[1] == "data" and r[2] and isinstance(r[2][0], str)]
        name_x = min((w[1] for ln, k in zip(lines, runs) if 0 < k < len(ln["w"]) for w in ln["w"][:1]), default=0)
        # a phrase starting left of where most names end is the name column's header (it may be centred over it)
        name_x1 = statistics.median([ln["w"][k - 1][2] for ln, k in zip(lines, runs) if 0 < k < len(ln["w"])] or [0])
        centers = {j: (a + b) / 2 for j, (a, b) in ext.items()}
        for ri, r in enumerate(recs):
            nxt = recs[ri + 1] if ri + 1 < len(recs) else None
            upper = nxt is not None and nxt[1] == "text" and sum(1 for w in nxt[2] if w[1] > name_x1) >= 2
            sub_starts = [w[1] for k2, w in enumerate(nxt[2]) if k2 == 0 or w[1] - nxt[2][k2 - 1][2] >= 4] if upper else []
            if r[1] == "data":
                parts = [p for p in r[2] if isinstance(p, str)]
                frags = sorted([(r[0], p) for p in parts] + [p for p in r[2] if isinstance(p, tuple)])
                name = " ".join(p for _, p in frags)
                grid.append([name] + [r[3].get(j, "") for j in range(len(cols))])
            elif r[1] == "text":
                ws = r[2]
                gaps = [b[1] - a[2] for a, b in zip(ws, ws[1:])]
                if len(" ".join(w[0] for w in ws)) > 30 and (not gaps or max(gaps) < 9) and ws[0][1] < name_x + 40:  # a sentence from the margin: title / section
                    grid.append([" ".join(w[0] for w in ws)]); continue
                # header line: phrases (words less than 4pt apart) starting at the name margin form the name cell;
                # another phrase goes to the value column it is aligned with (left, right or centre), else to the first
                # column whose numbers end right of it (labels left-aligned in wide cells; a label centred over two
                # columns lands on the left one and carries right)
                row = [""] * (len(cols) + 1)
                phrases = []
                for w in ws:
                    prev = " ".join(x[0] for x in phrases[-1]) if phrases else ""
                    new_label = (w[1] - phrases[-1][-1][2] >= 3 and (APPS.search(prev) or OFFERS.search(prev) or SKIP_METRIC.search(prev))
                                 and re.match(r"(Offer|Applica|Accept|Regist|Enrol|Total|Number|No\.|Count)", w[0])) if phrases else False
                    if phrases and w[1] - phrases[-1][-1][2] < 4 and not new_label: phrases[-1].append(w)
                    else: phrases.append([w])
                for ph in phrases:
                    x0, x1, txt = ph[0][1], ph[-1][2], " ".join(w[0] for w in ph)
                    j = None
                    c = (x0 + x1) / 2
                    if upper and not any(abs(x0 - a) <= 3 for a in sub_starts):
                        # a label centred over two sub-labelled columns ('Applications' over 'Total | China'): the left one
                        for jj in sorted(centers)[1:]:
                            if jj - 1 in centers and centers[jj - 1] + 12 < c < centers[jj] - 12: j = jj - 1
                    for jj, (a, b) in ext.items():
                        if j is not None: break
                        if abs(x0 - a) <= 6 or abs(x1 - b) <= 6 or abs(c - (a + b) / 2) <= 12: j = jj; break
                    if j is None and (x0 < name_x + 12 or x0 < name_x1):
                        row[0] = (row[0] + " " + txt).strip(); continue
                    if j is None: j = next((jj for jj in sorted(ext) if ext[jj][1] >= x1 - 5), max(ext) if ext else 0)
                    row[j + 1] = (row[j + 1] + " " + txt).strip()
                grid.append(row)
        grid.append([])
    return grid


def sheets_pdf(p, rule):
    pages = pdf_pages(p)
    if pages and not any(pg["words"] for pg in pages): return  # scanned images only
    yield "", pdf_grid(pages, rule.get("split_x"), rule.get("split_titles"))


def docx_text(p):
    import zipfile
    x = zipfile.ZipFile(p).read("word/document.xml").decode("utf8", "ignore")
    return re.sub(r"<[^>]+>", " ", x)


# ---------------------------------------------------------------- grid -> records
def row_kind(r):
    cells = [c for c in r if c]
    if not cells: return "blank"
    if cells[0].startswith("§"): return "title"
    vals = [c for c in cells if is_value(c)]
    years = [c for c in cells if years_in(c) and not is_value(c)] + [c for c in vals if num(c) is not None and 2010 <= num(c) <= 2030]
    texts = [c for c in cells if alpha(c)]
    hdr = [c for c in texts if len(c) <= 90 and (APPS.search(c) or OFFERS.search(c) or SKIP_METRIC.search(c)) and not DEGREE_TOKEN.search(c)]
    nonyear_vals = [c for c in vals if not (num(c) is not None and 2010 <= num(c) <= 2030)]
    if (hdr and not nonyear_vals) or (len(years) >= 2 and not nonyear_vals): return "header"
    if vals and (texts or len(vals) >= 1 and any(c for c in r[:2] if c and not is_value(c))): return "data"
    if vals and not texts: return "data"
    return "text"


def ctx_from_text(ctx, text, descriptor_resets=True, section=False):
    """Update a running context (year / group / metric / level / basis) from a title or section row. A section row
    inside a table (a single cell between programmes) only changes the year and level."""
    t = (text or "").lstrip("§ ")
    if section:
        y = years_in(t)
        if y and len(t.strip()) <= 20: ctx["year"] = y[0]; ctx["group"] = None
        if re.fullmatch(r"\s*(undergraduate|postgraduate research|pgr|ug)( programmes| courses)?\s*", t, re.I): ctx["level"] = "ug" if "u" in t.lower()[:1] else "pgr"
        elif re.fullmatch(r"\s*(postgraduate taught|pgt|taught)( programmes| courses)?\s*", t, re.I): ctx["level"] = None
        return
    if not t.strip() or BULLET.search(t) or len(t) > 260: return
    y = years_in(t)
    has_metric = bool(APPS.search(t) or OFFERS.search(t))
    if has_metric and descriptor_resets:
        ctx["group"] = None; ctx["metric"] = None
    if y: ctx["year"] = y[0]
    if y and len(t.strip()) <= 20: ctx["group"] = None  # a bare year heading ('2021-22') starts a new section
    if NC.search(t): ctx["group"] = "nc"
    elif CN.search(t): ctx["group"] = "cn"; ctx["basis"] = basis_of(t) or ctx.get("basis")
    elif OTHER.search(t) and not re.search(r"international (master|student)", t, re.I): ctx["group"] = "other"
    elif re.search(r"\ball\b", t, re.I) and has_metric: ctx["group"] = "all"
    if OFFERS.search(t) and not APPS.search(t): ctx["metric"] = "offers"
    elif APPS.search(t) and not OFFERS.search(t): ctx["metric"] = "apps"
    if len(t) > 100 or re.search(r"\bnot\b|exclud|n't", t, re.I): return  # notes mention levels in passing ('does not include ...')
    if re.search(r"undergraduate", t, re.I) and not re.search(r"postgraduate", t, re.I): ctx["level"] = "ug"
    elif re.search(r"postgraduate research|\bPGR\b|research programmes|research degree", t, re.I): ctx["level"] = "pgr"
    elif re.search(r"postgraduate|taught|\bPGT\b", t, re.I): ctx["level"] = None


def basis_of(t):
    t = t or ""
    if re.search(r"domicil|resid|\bCOD\b", t, re.I): return "domicile"
    if re.search(r"national", t, re.I): return "nationality"
    return None


def col_labels(hdr_rows, width):
    labels = []
    for j in range(width):
        parts = []
        for i, r in enumerate(hdr_rows):
            v = r[j] if j < len(r) else ""
            if not v and i < len(hdr_rows) - 1:  # merged cell over several columns: carry from the left
                k = j
                while k > 0 and not (r[k] if k < len(r) else ""): k -= 1
                v = r[k] if k < j and r[k] and len(r[k]) < 70 else ""
            if v and len(v) < 160: parts.append(v)
        labels.append(parts)
    return labels


def parse_grid(grid, sheet, fctx, rule):
    """One sheet (or PDF) -> list of records {name, code, mode, degree, level, year, group, metric, value, raw}."""
    width = max((len(r) for r in grid), default=0)
    grid = [list(r) + [""] * (width - len(r)) for r in grid]
    ctx = {"year": None, "group": None, "metric": None, "level": None, "basis": None}
    ctx_from_text(ctx, sheet)
    if sheet and re.search(r"\bch\b|chin", sheet, re.I): ctx["group"] = "cn"
    kinds = [row_kind(r) for r in grid]
    out, i, n = [], 0, len(grid)
    table = None
    pending = []
    for i in range(n):
        k = kinds[i]
        if k != "data":
            pending.append(i); continue
        # a data row: new table if a header row is pending (or none yet)
        hdr_idx = [j for j in pending if kinds[j] in ("header", "title")]
        if table is None or hdr_idx:
            # header block: the contiguous non-blank rows right above, at most 4, ending at this row
            block, group_rows = [], []
            for j in reversed(pending):
                if kinds[j] == "blank" and not block and j >= i - 2: continue  # a blank row between header and data
                if not block and kinds[j] == "text" and grid[j][0] and not any(grid[j][1:]):
                    group_rows.append(j); continue  # a department / group row right above the first programme
                if kinds[j] == "blank" and block == [] and group_rows: continue
                if kinds[j] in ("blank", "title") or len(block) >= 4: break
                if kinds[j] == "text" and any(len(c) > 120 for c in grid[j] if c): break
                block.insert(0, j)
            titles = [j for j in pending if j not in block and j not in group_rows and kinds[j] != "blank"][-4:]
            for j in titles: ctx_from_text(ctx, " ".join(c for c in grid[j] if c))
            single = [j for j in block if len([c for c in grid[j] if c]) == 1 and j != block[-1]]
            for j in single:   # a single-cell row inside the header block is a title ('2019/20 Apps'), not a label
                ctx_from_text(ctx, next(c for c in grid[j] if c))
            labels = col_labels([grid[j] for j in block if j not in single], width)
            if table and not any(APPS.search(" ".join(p)) or OFFERS.search(" ".join(p)) for p in labels[1:]):
                labels = table["labels"]  # a continuation page whose header lost its labels: keep the previous ones
            # header rows that label no column ('TOTAL APPLICATIONS | Admit Term' over year columns) still say what
            # the table counts: used when no column label names a measure / group
            btext = " ".join(c for j in block for c in grid[j] if c)
            bm = "offers" if OFFERS.search(btext) and not APPS.search(btext) else "apps" if APPS.search(btext) and not OFFERS.search(btext) else None
            bg = "cn" if CN.search(btext) and not NC.search(btext) and not ALL.search(re.sub(r"grand total", "", btext, flags=re.I)) else None
            table = {"labels": labels, "rows": [], "ctx": dict(ctx), "bmetric": bm, "bgroup": bg}
            out.append(table)
        else:
            for j in pending:  # section rows inside a table ('2020-21', 'Undergraduate'); department names say nothing
                cells = [c for c in grid[j] if c]
                if cells and kinds[j] in ("text", "title") and len(cells) <= 2: ctx_from_text(table["ctx"], " ".join(cells), section=kinds[j] == "text")
        pending = []
        table["rows"].append((grid[i], dict(table["ctx"])))
    recs = []
    for t in out: recs += table_records(t, sheet, fctx, rule)
    return recs


def table_records(t, sheet, fctx, rule):
    labels, rows = t["labels"], t["rows"]
    if not rows: return []
    width = len(labels)
    data = [r for r, _ in rows]
    lab = [" | ".join(p) for p in labels]

    def colvals(j): return [r[j] for r in data if r[j]]

    def share(j, f):
        v = colvals(j)
        return sum(1 for x in v if f(x)) / len(v) if v else 0

    filled = {j: len(colvals(j)) for j in range(width)}
    valcols = [j for j in range(width) if filled[j] and share(j, lambda x: is_value(x) or BLANKISH.match(x)) >= 0.6]
    textcols = [j for j in range(width) if filled[j] and j not in valcols]
    role = {}
    for j in textcols:
        L, last = lab[j], (labels[j][-1] if labels[j] else "")
        if len(last) > 28 or (NAME_HDR.search(last) and not CODE_HDR.search(last) and not DEGREE_HDR.search(last)):
            last = "~"  # a long / programme label (a PDF name cell holds several headers): judge by values only
        if share(j, lambda x: bool(years_in(x)) and len(x) <= 12) >= 0.8: role[j] = "year"
        elif share(j, lambda x: bool(MODE_VAL.match(x))) >= 0.7 or MODE_HDR.search(last): role[j] = "mode"
        elif share(j, lambda x: bool(LEVEL_VAL.match(x))) >= 0.7 or (LEVEL_HDR.search(last) and share(j, lambda x: len(x) < 25) > .9): role[j] = "level"
        elif NAT_HDR.search(last) and len(set(colvals(j))) < 40: role[j] = "nat"
        elif (CODE_HDR.search(last) or not last) and share(j, lambda x: bool(CODE_VAL.match(x))) >= 0.7: role[j] = "code"
        elif DEGREE_HDR.search(last) and share(j, lambda x: len(x) <= 12) >= 0.8: role[j] = "degree"
    # numeric-looking year column ('Session' 2022)
    for j in list(valcols):
        if YEARCOL_HDR.search(lab[j]) and not (APPS.search(lab[j]) or OFFERS.search(lab[j])) and share(j, lambda x: num(x) is not None and 2010 <= num(x) <= 2030) >= 0.9:
            role[j] = "year"; valcols.remove(j)
    cands = [j for j in textcols if j not in role]
    if not cands: return []
    # two tables side by side (all | Chinese), each with its own programme column: read each block on its own
    named = [j for j in cands if labels[j] and NAME_HDR.search(labels[j][-1]) and not UNIT_HDR.search(labels[j][-1])]
    for a, b in zip(named, named[1:]):
        if any(a < v < b for v in valcols) and any(v > b for v in valcols) and not t.get("split"):
            left = {**t, "labels": [p if j < b else [] for j, p in enumerate(labels)], "split": True,
                    "rows": [([c if j < b else "" for j, c in enumerate(r)], x) for r, x in rows]}
            right = {**t, "labels": [p if j >= b else [] for j, p in enumerate(labels)], "split": True,
                     "rows": [([c if j >= b else "" for j, c in enumerate(r)], x) for r, x in rows]}
            return table_records(left, sheet, fctx, rule) + table_records(right, sheet, fctx, rule)

    def score(j):
        v = colvals(j)
        dist = len(set(v)) / len(v)
        ln = min(40, sum(len(x) for x in v) / len(v))
        al = sum(1 for x in v if alpha(x)) / len(v)
        s = dist * ln * al * (len(v) / len(data)) ** 0.5
        last = labels[j][-1] if labels[j] else ""
        if NAME_HDR.search(last) and not UNIT_HDR.search(last): s *= 1.5
        if UNIT_HDR.search(last) and not re.search(r"programme|course", last, re.I): s *= 0.3
        return s
    name_j = rule.get("name_col", max(cands, key=score))
    if score(name_j) < 2 and "name_col" not in rule: return []
    lastname = labels[name_j][-1] if labels[name_j] else ""
    if UNIT_HDR.search(lastname) and not re.search(r"programme|course|plan", lastname, re.I) and not rule.get("name_col"): return []  # division totals
    unit_cols = [j for j in cands if j != name_j]
    # value columns: measure, group, year
    cols = []
    for j in valcols:
        parts = labels[j]
        metric = None
        for p in reversed(parts):
            if SKIP_METRIC.search(p) and not re.search(r"offers? made|offer holder", p, re.I): metric = "skip"; break
            if OFFERS.search(p): metric = "offers"; break
            if APPS.search(p): metric = "apps"; break
        if metric is None: metric = "?"
        if metric == "skip": continue
        L = " | ".join(parts)
        g = None
        for p in reversed(parts):  # the most specific label part naming a nationality group decides ...
            g = "nc" if NC_LABEL.search(p) else "cn" if CN.search(p) else "other" if OTHER.search(p) else None
            if g: break
        if g is None and any(ALL.search(p) for p in parts): g = "all"  # ... 'Total' / 'All' only when none does
        ys = [y for p in parts for y in years_in(p)]
        cols.append({"j": j, "metric": metric, "g": g, "year": ys[-1] if ys else None, "label": L})
    explicit = any(c["metric"] != "?" for c in cols)
    for c in cols:
        if c["metric"] == "?": c["metric"] = (None if explicit else t.get("bmetric")) or t["ctx"].get("metric") or rule.get("metric")
    cols = [c for c in cols if c["metric"]]
    if t.get("bgroup") and not any(c["g"] in ("cn", "nc", "other") for c in cols):
        for c in cols: c["g"] = t["bgroup"]
    if DEBUG:
        print(f"  TABLE sheet={sheet!r} rows={len(rows)} name={name_j}:{lab[name_j][:40]!r} roles={role} ctx={ {k: v for k, v in t['ctx'].items() if v} }", file=sys.stderr)
        for c in cols: print(f"     col {c['j']} {c['metric']:6} g={c['g']} y={c['year']} {c['label'][:70]!r}", file=sys.stderr)
    if not cols: return []
    labelled = any(c["g"] in ("cn", "nc") for c in cols)
    for c in cols:
        if c["g"] is None or (c["g"] == "all" and not labelled):
            c["g"] = "all" if labelled else None  # None: from the row's context
    years_given = {c["year"] for c in cols if c["year"]}
    if years_given:  # a 'Grand Total' over years next to per-year columns
        cols = [c for c in cols if c["year"] or not ALL.search(c["label"])]
    # programme cells that start with a code ('TMSFINSING01 MSc Finance', 'X906 : Education', 'Q110-5000 - MSc ...')
    trail_mode = "mode" not in role.values() and share(name_j, lambda x: bool(re.search(r"\s(FT|PT|DL)$", x))) >= 0.6
    trail_level = share(name_j, lambda x: bool(TRAIL_LEVEL.search(x))) >= 0.5
    trail_year = share(name_j, lambda x: bool(re.search(r"\s20[12]\d(/\d+)?$", x))) >= 0.6
    lead_year = share(name_j, lambda x: bool(re.match(r"^20[12]\d(/\d+)?\s", x))) >= 0.6
    split_code = "code" not in role.values() and share(name_j, lambda x: bool(LEAD_CODE.match(re.sub(r"^20[12]\d(/\d+)?\s+", "", x) if lead_year else x))) >= 0.6
    level_j = next((j for j, ro in role.items() if ro == "level"), None)
    if level_j is not None:  # 'Postgraduate Research' written once above its block of rows
        last = ""
        for r, _ in rows:
            if r[level_j]: last = r[level_j]
            else: r[level_j] = last
    recs = []
    year_j = next((j for j, r in role.items() if r == "year"), None)
    for r, rctx in rows:
        name = re.sub(r"\s+", " ", r[name_j]).strip()
        rec = {}
        if trail_year and re.search(r"\s20[12]\d(/\d+)?$", name):  # 'MSc in Economics 2023/4' (a Year column in a PDF)
            rec["_year"] = first_year(name.split()[-1]); name = name.rsplit(None, 1)[0]
        if lead_year and re.match(r"^20[12]\d(/\d+)?\s", name):  # PDF rows starting with the session ('2020 TAFxxx MSc ...')
            rec["_year"] = first_year(name.split()[0]); name = name.split(None, 1)[1]
        if split_code and LEAD_CODE.match(name):
            m = LEAD_CODE.match(name); rec["code"] = m.group(1); name = m.group(2).strip()
        elif split_code and MID_CODE.match(name):  # 'School of Culture and Creative Arts W621-5000 - Film Curation,MSc'
            m = MID_CODE.match(name); rec["code"] = m.group(1); name = m.group(2).strip()
        if trail_mode and "mode" not in rec:
            m = re.search(r"\s(FT|PT|DL)$", name)
            if m: rec["mode"] = m.group(1); name = name[:m.start()].strip()
        if trail_level:
            m = TRAIL_LEVEL.search(name)
            if m: rec["level"] = m.group(1); name = name[:m.start()].strip()
        if not name or TOTAL.search(name) or not alpha(name): continue
        if " " not in name and re.fullmatch(r"[A-Z0-9_\-]+", name): continue  # department / group code rows (UCL 'ENGLS_ART')
        rec["name"] = name
        for j, ro in role.items():
            if ro in ("code", "mode", "degree", "level", "nat") and r[j]: rec[ro] = r[j].strip()
        if rctx.get("level") in ("ug", "pgr"): continue
        if rec.get("level") and re.search(r"^(ug|pgr|undergraduate|postgraduate research|research|pg ?research)$", rec["level"], re.I): continue
        rowg = None
        if "nat" in rec:
            nv = rec["nat"]
            rowg = "nc" if NC.search(nv) else "cn" if CN.search(nv) else "all" if ALL.search(nv) else "other"
        ry = first_year(r[year_j]) if year_j is not None else (num(r[year_j]) if year_j is not None else None)
        for c in cols:
            g = c["g"] or rowg or rctx.get("group") or "all"
            if rowg and c["g"] in (None, "all"): g = rowg
            if g in ("other",): continue
            y = c["year"] or ry or rec.get("_year") or rctx.get("year") or fctx["year"]
            v = r[c["j"]]
            recs.append({**{a: b for a, b in rec.items() if a != "_year"}, "year": y, "group": g, "metric": c["metric"], "value": num(v), "supp": is_supp(v),
                         "basis": basis_of(c["label"]) if g == "cn" else None, "ctxbasis": rctx.get("basis")})
    return recs


# ---------------------------------------------------------------- per-file rules
def qmul_raw(path, rule):
    """QMUL FOI 2020 471: 2018-19 comes as one row per application (programme, route, decision, nationality);
    2019-20 as totals per programme + route (all) and per route (Chinese). Both are summed per route, the only
    name the Chinese sheets give."""
    import openpyxl
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    recs = []
    for ws in wb.worksheets:
        rows = list(ws.iter_rows(values_only=True))
        hdr = [str(c or "").strip() for c in rows[0]]
        if ws.title == "2018-19":
            ix = {h: i for i, h in enumerate(hdr)}
            agg = collections.defaultdict(lambda: collections.Counter())
            for r in rows[1:]:
                route = (r[ix["Route Name"]] or r[ix["Programme Name"]] or "").strip()
                if not route: continue
                dec = str(r[ix["Decision"]] or ""); nat = str(r[ix["Nationality"]] or "")
                # an offer was made if the decision is an offer, or a later stage only reached with one
                # (ATR'ed = confirmed as a student, UF = unconditional firm, RAT'ed no-show, conditional acceptance)
                offer = bool(re.search(r"offer|ATR'ed|\bUF\b|RAT'ed|acceptance", dec, re.I))
                cn = nat.strip().lower() in ("chinese", "china")  # the column is 'Chinese' / 'Not Chinese' / blank
                agg[route]["all_apps"] += 1; agg[route]["all_offers"] += offer
                if cn: agg[route]["cn_apps"] += 1; agg[route]["cn_offers"] += offer
            for route, c in agg.items():
                # 41% of these applications are 'Withdrawn (before rejection)' with no word on an earlier offer, so the
                # offer count is only a lower bound: applications are kept, offers are not
                for f in ("all_apps", "cn_apps"):
                    g, m = f.split("_")
                    recs.append({"name": route, "year": 2018, "group": g, "metric": m, "value": c[f], "supp": False, "basis": "nationality", "ctxbasis": None})
            continue
        m = re.match(r"(Apps|Offers)(\d\d)-(\d\d)-(all|Ch)", ws.title)
        if not m: continue
        metric = "apps" if m.group(1) == "Apps" else "offers"; g = "all" if m.group(4) == "all" else "cn"
        agg, supp = collections.Counter(), collections.defaultdict(bool)
        for r in rows[1:]:
            cells = [str(c or "").strip() for c in r]
            if len(cells) < 2 or not any(cells): continue
            route = (cells[1] or cells[0]) if len(hdr) >= 3 and hdr[1] == "Route Name" else cells[0]
            v = cells[-1] if len(hdr) < 3 else cells[2]
            if not route or TOTAL.search(route): continue
            if num(v) is not None: agg[route] += num(v)
            elif is_supp(v): supp[route] = True
        for route in set(agg) | set(supp):
            recs.append({"name": route, "year": 2000 + int(m.group(2)), "group": g, "metric": metric,
                         "value": agg[route] if route in agg else None, "supp": supp[route], "basis": "nationality", "ctxbasis": None})
    return recs


SPLIT_ALL_CN = ("§ Applications and offers - all applicants", "§ Applications and offers - Chinese applicants")  # '§': a title row
RULES = {
    # ---- refusals, letters, other questions
    "FOI 2021 822 Wilkinson": {"skip": "one programme by year plus applicant-level grade lists"},
    "893 21 results": {"skip": "South American / Peruvian applicants only"},
    "Interview statistics": {"skip": "Imperial Business School interview counts (same programmes as the main file)"},
    "FOI 2020 750 Li data.pdf": {"skip": "totals per degree type (Master of Philosophy, ...); superseded by 'revised data'"},
    "FOI 2020 471": {"custom": qmul_raw},
    # UCL's April 2020 reply has its two sheets the wrong way round: the 'Chinese' sheet lists 787 programmes
    # (incl. DClinPsy with 72 applications, a UK-only course) and is larger than the other on every programme, while
    # the October replies for the same cycle (020 664 / 020 647) agree with the sheets swapped
    # (MSc Finance: 935 here vs 1,046 Chinese in October; 1,456 here vs 1,620 all in October).
    "020 273 response": {"sheets": {r"^Applications & Offers$": {"group": "cn"}, r"Chinese": {"group": "all"}}},
    "Annex B.xlsx": {"skip": "programme lists only"},
    "FOI 799 19 answer courses": {"skip": "programme list only"},
    "Data for FOI 020 174": {"skip": "Manchester sent a programme list only"},
    # LSE lists each department's total above its programmes ('Accounting', then 'MSc in Accounting and Finance');
    # programme rows name an award, department rows do not
    "FOI 3550A FOI3657": {"keep_names": r"\b(MSc|MA|LLM|MPA|MPP|MRes|MPhil|PhD|Diploma|Degree|Master|Executive|EMBA|MBA|Certificate|TRIUM|MFin|Programme)\b"},
    "FOI 3595.xlsx": {"keep_names": r"\b(MSc|MA|LLM|MPA|MPP|MRes|MPhil|PhD|Diploma|Degree|Master|Executive|EMBA|MBA|Certificate|TRIUM|MFin|Programme)\b"},
    "FOI6307 Final": {"skip": "applicants from the University of Nottingham Ningbo only"},
    # asked for all applicants and those 'residing in China'; the one table LSE sent is below its Chinese-national
    # counts for the same years (MSc Economics 2019: 168 vs 284 Chinese nationals in FOI 3550A), so it is the
    # China-resident subset
    "FoI5780": {"group": "cn", "basis": "domicile"},
    # 'Converted to offer' counts waiting-list applicants who later got an offer, not all offers
    "FOI 6444": {"drop_fields": ["offers"]},
    # ---- Oxford: tables by division / previous institution / previous qualification are not programmes
    "202307 669 Postgraduate Data and Chinese.xlsx": {"sheets": {r"^Table [234]$": {"skip": True}}},
    "FOI 202601 91 Data": {"skip": "Chinese applicants by division only"},
    "FOI 202603 364 Data": {"skip": "two MSc(Res) courses summed over 2021-2025"},
    "FOI Response Post grad taught admission statistics": {"skip": "one course summed over 2015/16-2024/25"},
    # ---- side-by-side tables in one PDF page (all | Chinese)
    "FOI 2020 750 Li revised data": {"split_x": 0.5, "split_titles": SPLIT_ALL_CN},
    "FOI 2024 873 Wu data": {"split_x": 0.51, "split_titles": SPLIT_ALL_CN, "keep_small": True},
    # Cambridge
    "FOI 2020 658 Shah data.pdf": {"skip": "superseded by 'Shah corrected data.xlsx' of the same request"},
    "FOI 2025 592 Wu data": {"skip": "four MPhils split by UK / Chinese first-degree institution, not nationality"},
    "FOI 2025 593 Wu data": {"skip": "lists of previous institutions and degrees of admitted applicants"},
    "FOI 2024 799 Luo data": {"skip": "three MPhil Sociology streams as year rows under a title; not parsed (small)"},
    "FOI 2025 432 Bao data": {"drop_names": r"\([A-Z0-9]{4}\)$"},  # page 1 is undergraduate (UCAS course codes)
    # Glasgow re-issued this table in Feb 2020 (F1206160) because its 'all' columns were smaller than the China ones
    "2019_2020_admission_statistics_p_8__1__Appendix A.pdf": {"skip": "superseded by Glasgow's corrected re-issue F1206160"},
}


def rule_for(fname):
    r = {}
    for k, v in RULES.items():
        if k in fname: r.update(v)
    return r


# ---------------------------------------------------------------- files
def request_date(req):
    m = re.search(r"(\d{1,2}) (January|February|March|April|May|June|July|August|September|October|November|December) (20\d\d)", req.get("ask", ""))
    months = "January February March April May June July August September October November December".split()
    return (int(m.group(3)), months.index(m.group(2)) + 1, int(m.group(1))) if m else (req.get("yr", 0), 0, 0)


def default_year(req):
    for src in ("title", "ask"):
        y = first_year(req.get(src, ""))
        if y: return y, src
    return req.get("yr"), "manifest"


def file_records(path):
    slug, idx = path.name[5:].split("__")[0], int(path.name[5:].split("__")[1])
    req = MAN[slug]
    rule = rule_for(path.name)
    if rule.get("skip"): return req, [], rule["skip"]
    y, ysrc = default_year(req)
    if "year" in rule: y, ysrc = rule["year"], "rule"
    fctx = {"year": y, "ysrc": ysrc}
    suf = path.suffix.lower()
    recs = []
    if rule.get("custom"):
        recs = rule["custom"](path, rule)
    else:
        reader = sheets_xlsx(path) if suf == ".xlsx" else sheets_pdf(path, rule) if suf == ".pdf" else None
        if reader is None: return req, [], "not a table format (" + suf + ")"
        for sheet, grid in reader:
            sr = {}
            for pat, v in rule.get("sheets", {}).items():
                if re.search(pat, sheet): sr = v
            if sr.get("skip"): continue
            rr = {**rule, **sr}
            rs = parse_grid(grid, sheet, fctx, rr)
            for r in rs:
                if "group" in sr: r["group"] = sr["group"]
                if "year" in sr: r["year"] = sr["year"]
            recs += rs
    if suf == ".pdf" and len({r["name"] for r in recs}) < 8 and not rule.get("keep_small"):
        # a covering letter: the few 'rows' are addresses, dates and reference numbers
        txt = " ".join(w[0] for pg in pdf_pages(path)[:1] for w in pg["words"])
        if re.search(r"\bDear\b|Freedom of Information", txt): return req, [], "letter"
    if "force_year" in rule:
        for r in recs: r["year"] = rule["force_year"]
    if rule.get("drop_groups"): recs = [r for r in recs if r["group"] not in rule["drop_groups"]]
    if rule.get("drop_names"): recs = [r for r in recs if not re.search(rule["drop_names"], r["name"])]
    if rule.get("keep_names"): recs = [r for r in recs if re.search(rule["keep_names"], r["name"])]
    if rule.get("group"):
        for r in recs: r["group"] = rule["group"]; r["basis"] = rule.get("basis") or r.get("basis")
    if rule.get("drop_fields"): recs = [r for r in recs if r["metric"] not in rule["drop_fields"]]
    if rule.get("rename"):
        for r in recs: r["name"] = rule["rename"](r["name"])
    return req, recs, None


def file_text(path):
    """All text of a file, to find what 'Chinese' means (nationality or domicile)."""
    try:
        if path.suffix.lower() == ".xlsx": return " ".join(" ".join(r) for _, g in sheets_xlsx(path) for r in g)
        if path.suffix.lower() == ".pdf": return " ".join(w[0] for pg in pdf_pages(path) for w in pg["words"])
        if path.suffix.lower() == ".docx": return docx_text(path)
    except Exception: pass
    return ""


def basis_in_text(t):
    t = re.sub(r"\s+", " ", t or "")
    dom = re.search(r"(domicil\w*|resid\w*|country of domicile)[^.]{0,60}chin|chin\w*[^.]{0,25}(domicil|resid)", t, re.I)
    nat = re.search(r"chin\w*[^.]{0,6}national|nationalit\w*[^.]{0,60}chin|chin\w* citizens", t, re.I)
    if dom and not nat: return "domicile"
    if nat and not dom: return "nationality"
    return None


def norm_name(s):
    s = s.lower().replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return " ".join(s.split())


def is_taught(name, degree=None):
    full = name + " " + (degree or "")
    if DOCTORAL.search(full): return False
    if UNDERGRAD.search(full) and not re.search(r"\b(MSc|MA|LLM|MBA|PG ?Dip|PG ?Cert|Postgraduate|Master|MRes|Graduate Diploma)\b", name, re.I): return False
    return True


def file_rows(path, recs):
    """Records of one file -> rows per (programme, degree, mode, year[, code])."""
    # programme names repeated with different codes in one file: key by code too
    by = collections.defaultdict(set)
    for r in recs:
        if r.get("code"): by[(norm_name(r["name"]), r.get("degree"), r.get("mode"), r["year"], r["group"], r["metric"])].add(r["code"])
    use_code = any(len(v) > 1 for v in by.values())
    rows, dups = {}, 0
    for r in recs:
        if r["year"] is None: continue
        k = (norm_name(r["name"]), (r.get("degree") or "").upper(), (r.get("mode") or "").lower(), r["year"], r.get("code") if use_code else None)
        row = rows.setdefault(k, {"programme": r["name"], "year": r["year"], "smallSuppressed": False, "_f": {}})
        for a in ("code", "degree", "mode"):
            if r.get(a): row.setdefault(a, r[a])
        f = r["group"] + "_" + r["metric"]
        if f in row["_f"]:
            # the same programme twice in one table / sheet (different routes, sub-plans): add up
            if r["value"] is not None:
                prev = row.get(f)
                if row["_f"][f] == "supp" or prev is None: row[f] = r["value"] if prev is None else prev + r["value"]
                else: row[f] = prev + r["value"]
                dups += 1
            if r["supp"]: row["smallSuppressed"] = True
            continue
        row["_f"][f] = "supp" if r["supp"] else "v"
        row[f] = r["value"]
        if r["supp"]: row["smallSuppressed"] = True
        if r["group"] == "cn" and r.get("basis"): row["cnBasis"] = r["basis"]
        elif r["group"] == "cn" and r.get("ctxbasis"): row.setdefault("_ctxbasis", r["ctxbasis"])
    out = []
    for row in rows.values():
        for g in ("apps", "offers"):
            if row.get("all_" + g) is None and row["_f"].get("cn_" + g) and row["_f"].get("nc_" + g):
                if row.get("cn_" + g) is not None and row.get("nc_" + g) is not None: row["all_" + g] = row["cn_" + g] + row["nc_" + g]
                else: row["_f"]["all_" + g] = "supp"  # one part suppressed: the total is unknown
            row.pop("nc_" + g, None)
        if "_ctxbasis" in row: row.setdefault("cnBasis", row.pop("_ctxbasis"))
        row["_supp"] = [f for f, how in row.pop("_f").items() if how == "supp" and row.get(f) is None and not f.startswith("nc")]
        if not any(row.get(f) is not None for f in ("all_apps", "all_offers", "cn_apps", "cn_offers")) and not row["smallSuppressed"]: continue
        if not is_taught(row["programme"], row.get("degree")): continue
        out.append(row)
    return out, dups


FIELDS = ("all_apps", "all_offers", "cn_apps", "cn_offers")


def rounded_file(rows):
    vals = [r[f] for r in rows for f in FIELDS if r.get(f)]
    return len(vals) >= 10 and all(v % 5 == 0 for v in vals)


BASIS_RANK = {"nationality": 2, None: 1, "domicile": 0}
AWARD_PREFIX = re.compile(r"^(int(ernational)? )?(msc|ma|masc|mres|mphil|mphilstud|march|mba|llm|med|mpa|mph|mpp|mlitt|mst|mfa|pg ?cert|pg ?dip|"
                          r"pgcert|pgdip|pgce|grad ?dip|graduate diploma|postgraduate (certificate|diploma)|master of \w+( in)?)\b ?", re.I)


def merge(per_file):
    """Rows of the same university, programme and year from several files -> one row. Files come most recent first;
    a programme matches on its name (or its code), else on the name without the award / a truncated name when
    exactly one row of that university and year fits. A field the newest file has (or suppressed) is not refilled
    from older files; older files only fill fields the newer ones do not report."""
    merged, bycode, byyear, conflicts, allm = {}, {}, collections.defaultdict(list), [], []
    for f in per_file:
        uni, touched = f["req"]["uni"], set()
        codes_here = {r.get("code") for r in f["rows"] if r.get("code")}
        def exact(r):
            k = (uni, norm_name(r["programme"]), (r.get("degree") or "").upper(), (r.get("mode") or "").lower(), r["year"])
            m = bycode.get((uni, r["code"], r["year"])) if r.get("code") else None
            if m is None: m = merged.get(k)
            if m is not None and r.get("code") and m.get("code") and m["code"] != r["code"] and m["code"] in codes_here: m = None  # a namesake
            return m
        # exact matches first, so that a loose match cannot take a row another row of this file names exactly
        order = sorted(f["rows"], key=lambda r: exact(r) is None)
        for r in order:
            nn = norm_name(r["programme"])
            k = (uni, nn, (r.get("degree") or "").upper(), (r.get("mode") or "").lower(), r["year"])
            m = exact(r)
            if m is None:
                bare = AWARD_PREFIX.sub("", nn)
                fits = [x for x in byyear[(uni, r["year"])] if id(x) not in touched and (x.get("mode") or "").lower() == k[3]
                        and (AWARD_PREFIX.sub("", x["_nn"]) == bare or (min(len(nn), len(x["_nn"])) >= 30 and (x["_nn"].startswith(nn) or nn.startswith(x["_nn"]))))]
                if len(fits) == 1: m = fits[0]
            if m is not None and id(m) in touched and m.get("code") != r.get("code"): m = None  # two rows of one file never merge
            if m is None:
                m = {"university": uni, "programme": r["programme"], "year": r["year"], **{a: r[a] for a in ("code", "degree", "mode") if r.get(a)},
                     "all_apps": None, "all_offers": None, "cn_apps": None, "cn_offers": None, "smallSuppressed": False, "sources": [], "_src": {}, "_nn": nn}
                merged.setdefault(k, m); byyear[(uni, r["year"])].append(m); allm.append(m)
                if r.get("code"): bycode.setdefault((uni, r["code"], r["year"]), m)
            touched.add(id(m))
            if f["slug"] not in m["sources"]: m["sources"].append(f["slug"])
            has_cn = r.get("cn_apps") is not None or r.get("cn_offers") is not None
            if has_cn and BASIS_RANK.get(r.get("cnBasis"), 1) > BASIS_RANK.get(m.get("cnBasis"), 1) and \
                    any(m["_src"].get(a, (f["slug"],))[0] != f["slug"] for a in ("cn_apps", "cn_offers")):
                # Chinese nationality is preferred over China domicile whatever the request date
                for a in ("cn_apps", "cn_offers"): m[a] = None; m["_src"].pop(a, None)
                m.pop("cnBasis", None)
            for a in FIELDS:
                v, supp = r.get(a), a in r.get("_supp", ())
                if v is None and not supp: continue
                if a not in m["_src"]:
                    m[a] = v; m["_src"][a] = (f["slug"], f["rounded"], supp)
                    if supp: m["smallSuppressed"] = True
                    if a.startswith("cn") and not m.get("cnBasis"): m["cnBasis"] = r.get("cnBasis")
                elif m["_src"][a][0] != f["slug"] and v is not None and m[a] is not None:
                    s0, r0, _ = m["_src"][a]
                    if not r0 and not f["rounded"] and abs(m[a] - v) > 0.1 * max(m[a], v):
                        conflicts.append({"university": uni, "programme": m["programme"], "year": m["year"], "field": a,
                                          "kept": {"source": s0, "value": m[a]}, "other": {"source": f["slug"], "value": v}})
    rows = []
    for m in allm:
        m.pop("_src"); m.pop("_nn")
        if m.get("cn_apps") is None and m.get("cn_offers") is None: m.pop("cnBasis", None)
        rows.append(m)
    return rows, conflicts


def main():
    verbose = "-v" in sys.argv
    files = sorted(p for p in DIR.iterdir() if p.name.startswith("foi__") and p.name != "foi__manifest.json")
    report, per_file = [], []
    texts = {}
    for p in files:
        req, recs, why = file_records(p)
        slug = p.name[5:].split("__")[0]; idx = int(p.name[5:].split("__")[1])
        rows, dups = file_rows(p, recs) if recs else ([], 0)
        if rows and any(r.get("cn_apps") is not None or r.get("cn_offers") is not None for r in rows) and not all(r.get("cnBasis") for r in rows if r.get("cn_apps") is not None):
            b = basis_in_text(file_text(p))
            if not b:  # the covering letter of the same request
                for q in files:
                    if q != p and q.name[5:].split("__")[0] == slug: b = b or basis_in_text(file_text(q))
            for r in rows:
                if (r.get("cn_apps") is not None or r.get("cn_offers") is not None) and not r.get("cnBasis") and b: r["cnBasis"] = b
        per_file.append({"path": p, "slug": slug, "idx": idx, "req": req, "rows": rows, "rounded": rounded_file(rows)})
        both = sum(1 for r in rows if r.get("all_apps") is not None and r.get("all_offers") is not None)
        cnb = sum(1 for r in rows if r.get("cn_apps") is not None and r.get("cn_offers") is not None)
        yrs = sorted({r["year"] for r in rows})
        report.append((req["uni"], p.name[5:85], len(rows), both, cnb, yrs, why or "", dups))
    # merge: most recent request (then later attachment) wins; record every source; list disagreements
    per_file.sort(key=lambda f: (request_date(f["req"]), f["idx"]), reverse=True)
    rows, conflicts = merge(per_file)
    rows.sort(key=lambda r: (r["university"], r["programme"].lower(), r["year"]))
    save(WORK / "foi_rows.json", {"rows": rows, "conflicts": conflicts}, indent=None)
    if verbose:
        for u, f, n, b, c, yrs, why, dups in sorted(report):
            ys = f"{yrs[0]}-{yrs[-1]}" if yrs else ""
            print(f"{n:5d} {b:5d} {c:5d} {ys:9} {u[:22]:22} {f}" + (f"  [{why}]" if why else "") + (f"  (+{dups} summed)" if dups else ""))
    by = collections.Counter(r["university"] for r in rows if r.get("all_apps") is not None and r.get("all_offers") is not None)
    bc = collections.Counter(r["university"] for r in rows if r.get("cn_apps") is not None and r.get("cn_offers") is not None)
    yr = collections.defaultdict(set)
    for r in rows: yr[r["university"]].add(r["year"])
    print(f"files {len(report)}; with rows {sum(1 for x in report if x[2])}; programme-years {len(rows)} ({sum(by.values())} with apps and offers, "
          f"{sum(bc.values())} with Chinese apps and offers); conflicts {len(conflicts)}")
    for u in sorted(set(by) | set(bc), key=lambda u: -by[u]):
        print(f"  {by[u]:5d} {bc[u]:5d}  {min(yr[u])}-{max(yr[u])}  {u}")


if __name__ == "__main__":
    main()
