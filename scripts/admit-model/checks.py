"""External checks on the built model (last step of run.py). Warns, never fails the build.

1. Hong Kong GPA slope. Huang, Wang & Shu (2024), a logistic regression on about 240 mainland applicants to Hong Kong
   taught master's, found an odds ratio of 1.150 per point of a 100-point average (and a ROC cut-off of 86.05).
   The model's slope for a mainland applicant from an ordinary university is computed the same way: the change in
   log-odds per point between 78 and 92, through Peking University's percentage-to-4-point rule (lib/gpa4.ts),
   floor band included; the median over Hong Kong programmes should stay near 1.15.
2. UK ceilings. Every programme with an official offer rate should have a ceiling c at or above that rate.
Writes data/pipeline/admit-model/checks.json."""
import math, statistics as st
from common import RAW, WORK, load, save

M = load(RAW / "admit-model.json")["programmes"]
P = {p["id"]: p for p in load(RAW / "programmes.json")["programmes"]}
COUNTRY = {i["id"]: i.get("country") for i in load(RAW / "institutions.json")["institutions"]}

PAPER_OR, TOL = 1.150, 0.05
sig = lambda z: 1 / (1 + math.exp(-z))
four = lambda x: 4 - 3 * (100 - x) ** 2 / 1600  # lib/gpa4.ts chinesePercentToFour
logit = lambda p: math.log(p / (1 - p))


def chance(e, g):
    c, th, s, k = e["c"], e["theta"], e["s"], e["k"]
    return max(c * sig((g - th) / s), (e.get("floorBandFactor") or 1) * c * sig((k - th) / s))


def slope(country):
    ors = []
    for pid, e in M.items():
        if COUNTRY.get(P[pid]["institutionId"]) != country: continue
        d = [logit(chance(e, four(x + 1))) - logit(chance(e, four(x))) for x in range(78, 92)]
        ors.append(math.exp(st.mean(d)))
    q = st.quantiles(ors, n=4)
    return {"programmes": len(ors), "oddsRatioPerPoint": {"q1": round(q[0], 3), "median": round(q[1], 3), "q3": round(q[2], 3)}}


hk = slope("Hong Kong SAR")
hk["paper"] = {"oddsRatioPerPoint": PAPER_OR, "cutOff": 86.05, "cutOff4": round(four(86.05), 3),
               "source": "Huang, Wang & Shu (2024), doi:10.56028/aetr.11.1.507.2024"}
hk["ok"] = abs(hk["oddsRatioPerPoint"]["median"] - PAPER_OR) <= TOL
ks = [e["k"] for pid, e in M.items() if COUNTRY.get(P[pid]["institutionId"]) == "Hong Kong SAR"]
hk["admittedMedianK"] = round(st.median(ks), 3)

low = [pid for pid, e in M.items() if e.get("offerRate") and e["c"] < e["offerRate"]]
out = {"hongKongSlope": hk, "singaporeSlope": slope("Singapore"), "ceilingBelowOfficialOfferRate": low}
save(WORK / "checks.json", out, indent=1)
print(f"Hong Kong: median odds ratio per point {hk['oddsRatioPerPoint']['median']} vs paper {PAPER_OR}" + ("" if hk["ok"] else "  WARNING: outside ±0.05"))
print(f"ceilings below the official offer rate: {len(low)}" + (f"  WARNING: {low[:5]}" if low else ""))
