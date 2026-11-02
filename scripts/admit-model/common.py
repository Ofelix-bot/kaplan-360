"""Shared paths and constants for the admission model scripts (run from anywhere; paths are repo-relative)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
PIPE = ROOT / "data" / "pipeline"
WORK = PIPE / "admit-model"
SOURCES = ROOT / "data" / "sources"
WORK.mkdir(parents=True, exist_ok=True)

# First-degree tier offsets on the 4-point scale: the gap between tiers' admitted medians on the same programme.
SHIFT = {"A": 0.21, "B": 0.10, "C": 0.0}

def load(path):
    return json.load(open(path, encoding="utf-8"))

def save(path, obj, indent=None):
    json.dump(obj, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=indent)

def ucd_to_four(g):
    """UCD 4.2 GPA -> 4-point: UCD's own class table, then the UK bands, straight-line within a class."""
    for (a, b), (c, d) in [((3.68, 4.2), (3.7, 4.0)), ((3.08, 3.67), (3.3, 3.66)), ((2.48, 3.07), (2.7, 3.24)), ((2.0, 2.47), (2.0, 2.63))]:
        if a <= g <= b + 0.005:
            return c + (min(g, b) - a) / (b - a) * (d - c)
    return 2.0
