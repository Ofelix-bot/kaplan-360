# Chinese fonts for the plan PDF (lib/plan-files.ts): Noto Sans SC and TC (SIL Open Font License),
# fixed at the regular weight and cut down to the characters the plan can contain: ASCII and Latin-1,
# punctuation, every character in the site's Chinese messages and data, and the common characters of
# GB 2312 level 1 (Simplified) or Big5 level 1 (Traditional) for names on official pages.
# Writes public/fonts/plan-zh-hans.ttf and plan-zh-hant.ttf.
# Usage: python scripts/i18n/pdf-fonts.py <NotoSansSC[wght].ttf> <NotoSansTC[wght].ttf>
# (from https://github.com/google/fonts/tree/main/ofl/notosanssc and .../notosanstc)

import glob, json, os, re, sys
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")

def chars_of(paths):
    out = set()
    for p in paths:
        out |= set(open(p, encoding="utf8").read())
    return {c for c in out if ord(c) >= 0x2E80}

data = chars_of(glob.glob(os.path.join(ROOT, "data", "raw", "*.json")))
base = {chr(c) for c in list(range(0x20, 0x7F)) + list(range(0xA0, 0x100)) + list(range(0x2000, 0x2070)) + list(range(0x2190, 0x2200))
        + list(range(0x3000, 0x3040)) + list(range(0xFF00, 0xFFF0)) + [0x2248, 0x2264, 0x2265, 0x2605, 0x2606, 0x2713]}

def gb2312():
    out = set()
    for hi in range(0xB0, 0xD8):
        for lo in range(0xA1, 0xFF):
            try:
                out.add(bytes([hi, lo]).decode("gb2312"))
            except UnicodeDecodeError:
                pass
    return out

def big5():
    out = set()
    for hi in range(0xA4, 0xC7):
        for lo in list(range(0x40, 0x7F)) + list(range(0xA1, 0xFF)):
            try:
                out.add(bytes([hi, lo]).decode("big5"))
            except UnicodeDecodeError:
                pass
    return out

def build(src, messages, common, out):
    font = TTFont(src)
    font = instancer.instantiateVariableFont(font, {"wght": 400})
    text = "".join(base | common | data | chars_of([os.path.join(ROOT, "lib", "i18n", "messages", messages)]))
    opts = subset.Options()
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    sub.populate(text=text)
    sub.subset(font)
    font.save(out)
    print(out, os.path.getsize(out) // 1024, "KB,", len(text), "characters")

os.makedirs(os.path.join(ROOT, "public", "fonts"), exist_ok=True)
build(sys.argv[1], "zh-hans.json", gb2312(), os.path.join(ROOT, "public", "fonts", "plan-zh-hans.ttf"))
build(sys.argv[2], "zh-hant.json", big5(), os.path.join(ROOT, "public", "fonts", "plan-zh-hant.ttf"))
