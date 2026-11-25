"""획의 한글 판별(sfnt.js)을 fontTools 로 따로 센 값과 대조한다. 내 PC 폰트 전부.
사용: node tools/dump-hangul.mjs out/hoek.json && python tools/crosscheck.py out/hoek.json
fontTools 는 '글리프 이름이 .notdef 가 아닌' 가~힣 글자를 센다. 둘이 다르면 그 폰트를 줄로 찍는다.
"""
import json, os, sys, glob
from fontTools.ttLib import TTFont, TTCollection

mine = json.load(open(sys.argv[1], encoding="utf-8"))
dirs = [r"C:\Windows\Fonts", os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Windows\Fonts")]
ref = {}
for d in dirs:
    for f in glob.glob(os.path.join(d, "*")):
        if not f.lower().endswith((".ttf", ".otf", ".ttc", ".otc")):
            continue
        try:
            fonts = TTCollection(f, lazy=True).fonts if f.lower().endswith(("ttc", "otc")) else [TTFont(f, lazy=True)]
        except Exception:
            continue
        for ft in fonts:
            try:
                ps = ft["name"].getDebugName(6)
                cm = ft.getBestCmap()
                ref[ps] = None if cm is None else sum(1 for c in range(0xAC00, 0xD7A4) if c in cm and cm[c] != ".notdef")
            except Exception:
                pass

same = diff = missing = 0
for ps, n in ref.items():
    if ps not in mine:
        missing += 1
        print("없음", ps)
        continue
    if mine[ps].get("hangul") == n:
        same += 1
    else:
        diff += 1
        print("다름", ps, "fontTools", n, "획", mine[ps].get("hangul"))
print(f"면 {len(ref)}개: 같음 {same}, 다름 {diff}, 획 쪽에 없음 {missing}")
sys.exit(1 if diff or missing else 0)
