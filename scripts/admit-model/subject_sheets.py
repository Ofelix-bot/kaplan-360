"""The QS by Subject 2026 sheets behind each of Kaplan's disciplines, the workbook, and the name key used to match its
institutions to ours. Shared by subjects.py (the admission model's subject rank) and subject_strength.py (the finder)."""
import re, unicodedata
import openpyxl
from common import SOURCES

QSF = next((SOURCES / "qs").glob("QS World University Rankings by Subject 2026*.xlsx"))
SHEETS = {"business": ["Business & Management Studies"], "accounting-finance": ["Accounting & Finance"], "marketing": ["Marketing"],
          "ai-data": ["Data Science and Artificial Int", "Computer Science & Information ", "Statistics & Operational Resear"],
          "it": ["Computer Science & Information "], "education": ["Education"], "psychology-counselling": ["Psychology"],
          "healthcare-nursing": ["Nursing"], "law-criminology": ["Law"], "communication": ["Communication & Media Studies"],
          "sports-science": ["Sports-related Subjects"], "construction": ["Architecture _ Built Environmen", "Engineering - Civil & Structura"],
          "hospitality-tourism": ["Hospitality & Leisure Managemen"], "economics": ["Economics & Econometrics"]}

def workbook():
    return openpyxl.load_workbook(QSF, read_only=True)

def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\([^)]*\)", " ", s).replace("&", " and "); s = re.sub(r"\bthe\b", " ", s)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

def byname(insts):
    """Normalised name (and QS name) -> our institution id."""
    out = {}
    for i in insts:
        for n in [i["name"], i.get("qsName")]:
            if n: out.setdefault(norm(n), i["id"])
    return out
