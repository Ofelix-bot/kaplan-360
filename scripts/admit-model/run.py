"""Rebuilds data/raw/admit-model.json end to end. Usage (from the repo root):
    python scripts/admit-model/run.py            # all steps
    python scripts/admit-model/run.py --from fit # resume at a step
Needs Python 3.10+ with numpy, openpyxl (and pandas + pyarrow for the GradCafe parquet), and Node for admit-dump.ts.
External datasets: see ingest_external.py for the clone commands (skipped with a warning when missing)."""
import subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
STEPS = [
    ("dump", ["npx", "tsx", "scripts/admit-model/admit-dump.ts"]),
    ("floors", ["npx", "tsx", "scripts/admit-model/floors.ts"]),
    ("external", [sys.executable, str(HERE / "ingest_external.py")]),
    ("targets", [sys.executable, str(HERE / "targets.py")]),
    ("calibrate", [sys.executable, str(HERE / "calibrate.py")]),
    ("floorband", [sys.executable, str(HERE / "floor_band.py")]),
    ("subjects", [sys.executable, str(HERE / "subjects.py")]),
    ("fit", [sys.executable, str(HERE / "fit.py")]),
    ("pei", [sys.executable, str(HERE / "match_pei.py")]),
    ("delta", [sys.executable, str(HERE / "delta.py")]),
    ("foiparse", [sys.executable, str(HERE / "foi_parse.py")]),
    ("foimatch", [sys.executable, str(HERE / "foi_match.py")]),
    ("ukofficial", [sys.executable, str(HERE / "uk_official.py")]),
    ("build", [sys.executable, str(HERE / "build_model.py")]),
    ("check", [sys.executable, str(HERE / "checks.py")]),
]
start = sys.argv[sys.argv.index("--from") + 1] if "--from" in sys.argv else STEPS[0][0]
names = [s for s, _ in STEPS]
for name, cmd in STEPS[names.index(start):]:
    print(f"== {name}", flush=True)
    r = subprocess.run(cmd, cwd=ROOT, shell=(sys.platform == "win32" and cmd[0] == "npx"))
    if r.returncode:
        sys.exit(f"step {name} failed")
print("done: data/raw/admit-model.json  (load with: npm run data:load-admit)")
