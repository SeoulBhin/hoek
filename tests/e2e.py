"""획 e2e: 실제 Chrome 에서 내 PC 폰트로 화면을 끝까지 눌러 본다.
사용: npm run build && python tests/e2e.py   (Chrome 설치 필요, 서버는 시험이 dist/ 를 /hoek/ 하위 경로로 직접 띄움)

protects: 다시 온 사람(허락됨)은 버튼 없이 목록 / 가족 수 = queryLocalFonts 고유 family 수 / 판별 결과가 fontTools 와 같음 /
          "맑은" 검색 / 내 문장·크기·즐겨찾기·거르기가 새로고침 뒤 남음 / 한글 거르기 / 없는 글자 흐리게 /
          비교 4개 제한·나란히 4칸·빼기 / 상세 굵기마다 실제로 다른 폭(영문) / 글자표 없는 글자 수 /
          미지원 브라우저 안내 / 허락 안 됨 → 거절 안내 / 저장소 막힘에도 동작 / 외부 주소 요청 0건 / 하위 경로
fails_when: 위 중 하나라도 다르면 FAIL 줄을 찍고 종료 코드 1
no_claim: 진짜 허락 창에서 사람이 '허용'·'차단'을 누르는 경로(Playwright 로 못 누름, 권한을 미리 주거나 안 준 상태로 대신함),
          보기 좋은지(캡처는 out/ 에 남겨 눈으로 본다), Edge
"""
import json
import subprocess
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from serve_sub import start  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out"
OUT.mkdir(exist_ok=True)
fails = []
passes = 0


def check(name, ok, detail=""):
    global passes
    if ok:
        passes += 1
        print(f"PASS {name}")
    else:
        fails.append(name)
        print(f"FAIL {name} {detail}")


def wait_inspected(pg, timeout=60000):
    pg.wait_for_function("window.__hoek && window.__hoek.families.length && window.__hoek.done === window.__hoek.families.length", timeout=timeout)


def rows(pg):
    return pg.eval_on_selector_all("[data-testid=row]", "els => els.map(e => e.dataset.family)")


def list_count(pg):
    el = pg.query_selector("[data-testid=list]")
    return int(el.get_attribute("data-count")) if el else 0


def set_input(pg, testid, text):
    inp = pg.locator(f"[data-testid={testid}] input, input[data-testid={testid}]").first
    inp.fill(text)


def main():
    srv, url = start()
    url = url + "?e2e"
    origin = url.rsplit("/hoek/", 1)[0]  # 권한은 출처 단위
    # fontTools 대조값(tools/dump-hangul.mjs + crosscheck.py 가 같다고 확인한 값)
    # 대조값: 매번 새로 만들고(node 로 파일 경로 읽기) 그 값을 fontTools 와 맞춰 본 뒤에 쓴다
    ref_path = OUT / "hoek.json"
    subprocess.run(["node", "tools/dump-hangul.mjs", str(ref_path)], cwd=ROOT, check=True)
    cc = subprocess.run([sys.executable, "tools/crosscheck.py", str(ref_path)], cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
    check("파일 경로 판별 = fontTools(내 PC 폰트 전부)", cc.returncode == 0, cc.stdout[-300:])
    print("INFO", cc.stdout.strip().splitlines()[-1] if cc.stdout.strip() else "")
    ref = json.loads(ref_path.read_text(encoding="utf-8"))

    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True)

        # 1) 다시 온 사람: 허락이 이미 있음
        c = b.new_context(viewport={"width": 1280, "height": 860})
        c.grant_permissions(["local-fonts"], origin=origin)
        pg = c.new_page()
        outside = []
        pg.on("request", lambda r: outside.append(r.url) if not r.url.startswith(origin) and not r.url.startswith("data:") else None)
        errors = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto(url)
        pg.wait_for_selector("[data-testid=list]", timeout=20000)
        check("허락된 방문자는 버튼 없이 바로 목록", pg.query_selector("[data-testid=start]") is None)
        fams = pg.evaluate("async () => new Set((await queryLocalFonts()).map(f => f.family)).size")
        st = pg.evaluate("window.__hoek")
        check("가족 수 = queryLocalFonts 고유 family 수", len(st["families"]) == fams, f"{len(st['families'])} vs {fams}")
        wait_inspected(pg)
        st = pg.evaluate("window.__hoek")
        print(f"INFO 가족 {len(st['families'])}개 한글 판별 {st['ms']}ms")
        bad = []
        for f in st["families"]:
            mine = st["hangul"].get(f["key"])
            want = ref.get(f["rep"], {}).get("hangul", "missing")
            if want != "missing" and mine != want:
                bad.append((f["family"], mine, want))
        compared = sum(1 for f in st["families"] if f["rep"] in ref)
        check(f"브라우저 판별 = 파일 경로 판별({compared}가족 대조)", not bad and compared > 0, f"{bad[:5]} errors={st.get('errors')}")
        print(f"INFO 대조 못 한 가족 {len(st['families']) - compared}개(가변 폰트: Chrome 이 굵기마다 붙인 이름이 파일 안 이름과 달라 대조표에서 못 찾음)")
        full = [f["family"] for f in st["families"] if st["hangul"].get(f["key"]) == 11172]
        print(f"INFO 한글 11,172자 가족 {len(full)}개")
        pg.screenshot(path=str(OUT / "e2e_list.png"))

        # 검색: 한국어 이름
        set_input(pg, "search", "맑은")
        pg.wait_for_timeout(300)
        check("'맑은' 검색 → Malgun Gothic", "Malgun Gothic" in rows(pg), str(rows(pg)))
        set_input(pg, "search", "")

        # 내 문장 + 없는 글자
        set_input(pg, "sample", "Hamburgefonts 한글")
        set_input(pg, "search", "Arial")
        pg.wait_for_timeout(300)
        arial = pg.locator("[data-testid=row][data-family='Arial']")
        check("내 문장이 미리보기에 반영", "Hamburgefonts" in arial.locator("[data-testid=preview]").inner_text())
        check("Arial 에 없는 한글은 흐린 글자로", arial.locator("[data-missing]").count() >= 1)
        set_input(pg, "sample", "")
        pg.wait_for_timeout(200)
        arial = pg.locator("[data-testid=row][data-family='Arial']")
        check("문장을 비우면 기본 문장으로 미리보기", "quick brown fox" in arial.locator("[data-testid=preview]").inner_text())
        set_input(pg, "sample", "Hamburgefonts 한글")
        set_input(pg, "search", "")

        # 크기·즐겨찾기·거르기 → 새로고침 뒤 남음
        set_input(pg, "search", "맑은")
        pg.wait_for_timeout(200)
        pg.locator("[data-testid=row][data-family='Malgun Gothic'] [data-testid=fav]").click()
        set_input(pg, "search", "")
        pg.get_by_role("radio", name="한글").click()
        pg.wait_for_timeout(300)
        n_hangul = list_count(pg)
        check("한글 거르기 수 = 11,172자 가족 수", n_hangul == len(full), f"{n_hangul} vs {len(full)}")
        names = rows(pg)
        check("한글 거르기에 Arial 없음", "Arial" not in names)
        pg.reload()
        pg.wait_for_selector("[data-testid=list]", timeout=20000)
        sample_after = pg.locator("[data-testid=sample] input, input[data-testid=sample]").first.input_value()
        check("새로고침 뒤 내 문장 남음", sample_after == "Hamburgefonts 한글", sample_after)
        checked = pg.get_by_role("radio", name="한글").get_attribute("aria-checked")
        check("새로고침 뒤 거르기 남음", checked == "true", str(checked))
        pg.get_by_role("radio", name="즐겨찾기").click()
        pg.wait_for_timeout(300)
        check("새로고침 뒤 즐겨찾기 남음", rows(pg) == ["Malgun Gothic"], str(rows(pg)))
        pg.get_by_role("radio", name="전체").click()
        wait_inspected(pg)

        # 비교: 4개까지
        for name in ["Malgun Gothic", "Gulim", "Batang", "Arial", "Consolas"]:
            set_input(pg, "search", name)
            pg.wait_for_timeout(250)
            box = pg.locator(f"[data-testid=row][data-family='{name}'] input[type=checkbox]")
            if name == "Consolas":
                check("5번째 비교는 막힘", box.is_disabled() or box.get_attribute("aria-disabled") == "true")
            else:
                box.click()
        set_input(pg, "search", "")
        check("트레이에 4개", pg.locator("[data-testid=tray-item]").count() == 4)
        # 디자인 리뷰 1번: Layout 슬롯을 잘못 써서 트레이·목록 끝이 화면 밖으로 밀렸던 것
        geo = pg.evaluate("""() => { const t = document.querySelector('[data-testid=show-compare]').getBoundingClientRect();
            const l = document.querySelector('[data-testid=list]').getBoundingClientRect(); return [t.bottom, l.bottom, innerHeight]; }""")
        check("비교 버튼과 목록 끝이 화면 안", geo[0] <= geo[2] and geo[1] <= geo[2], str(geo))
        pg.screenshot(path=str(OUT / "e2e_tray.png"))
        pg.locator("[data-testid=show-compare]").click()
        pg.wait_for_selector("[data-testid=compare]")
        check("나란히 4칸", pg.locator("[data-testid=compare-col]").count() == 4)
        back_top = pg.evaluate("document.querySelector('[data-testid=compare] [data-testid=back]').getBoundingClientRect().top")
        check("비교 화면 머리가 보임", 0 <= back_top < 100, str(back_top))
        pg.screenshot(path=str(OUT / "e2e_compare.png"))
        pg.locator("[data-testid=col-remove]").first.click()
        check("칸 빼면 3칸", pg.locator("[data-testid=compare-col]").count() == 3)
        pg.keyboard.press("Escape")
        pg.wait_for_selector("[data-testid=list]", state="visible")

        # 상세: 굵기마다 다른 면, 글자표
        set_input(pg, "search", "맑은")
        pg.wait_for_timeout(250)
        pg.locator("[data-testid=row][data-family='Malgun Gothic'] [data-testid=open]").click()
        pg.wait_for_selector("[data-testid=detail]")
        pg.wait_for_timeout(800)
        widths = pg.eval_on_selector_all(
            "[data-testid=weight]",
            """els => els.map(e => { const r = document.createRange(); r.selectNodeContents(e);
                const s = document.createElement('span'); s.textContent = 'Hamburgefonts'; s.style.font = getComputedStyle(e).font;
                s.style.fontFamily = getComputedStyle(e).fontFamily; document.body.append(s); const w = s.getBoundingClientRect().width; s.remove(); return [e.dataset.face, e.dataset.status, Math.round(w*10)/10]; })""",
        )
        print("INFO 굵기 폭", widths)
        ws = [w[2] for w in widths]
        check("상세: 맑은 고딕 스타일 3개", len(widths) == 3)
        check("상세: 굵기마다 영문 폭이 다름(실제 다른 면)", len(set(ws)) == len(ws), str(ws))
        check("상세: 모든 면 등록 성공", all(w[1] == "loaded" for w in widths), str(widths))
        summ = pg.locator("[data-testid=glyph-summary]").inner_text()
        check("글자표: 맑은 고딕 한글 전부 있음", "전부 있어요" in summ, summ)
        pg.screenshot(path=str(OUT / "e2e_detail.png"))
        pg.locator("[data-testid=back]").click()

        # 가변 폰트: 이름 붙은 굵기마다 실제로 굵기가 달라야 한다(local() 만으론 전부 기본 굵기였음)
        if any(f["family"] == "Noto Sans KR" for f in st["families"]):
            set_input(pg, "search", "Noto Sans KR")
            pg.wait_for_timeout(250)
            pg.locator("[data-testid=row][data-family='Noto Sans KR'] [data-testid=open]").click()
            pg.wait_for_selector("[data-testid=detail]")
            pg.wait_for_timeout(800)
            vw = pg.eval_on_selector_all(
                "[data-testid=weight]",
                """els => els.map(e => { const s = document.createElement('span'); s.textContent = 'Hamburgefonts';
                    const cs = getComputedStyle(e); s.style.fontFamily = cs.fontFamily; s.style.fontSize = cs.fontSize;
                    s.style.fontVariationSettings = cs.fontVariationSettings; document.body.append(s);
                    const w = s.getBoundingClientRect().width; s.remove(); return Math.round(w * 10) / 10; })""",
            )
            print("INFO Noto Sans KR 굵기 폭", vw)
            check("가변 폰트: 굵기마다 폭이 다름", len(set(vw)) == len(vw) and len(vw) >= 5, str(vw))
            pg.screenshot(path=str(OUT / "e2e_detail_variable.png"))
            pg.locator("[data-testid=back]").click()
        else:
            print("SKIP 가변 폰트 시험(Noto Sans KR 없음)")

        set_input(pg, "search", "Arial")
        pg.wait_for_timeout(250)
        pg.locator("[data-testid=row][data-family='Arial'] [data-testid=open]").click()
        pg.wait_for_selector("[data-testid=detail]")
        summ = pg.locator("[data-testid=glyph-summary]").inner_text()
        check("글자표: Arial 은 한글 11,172자 모두 없음", "11,172자가 이 폰트에 없어요" in summ, summ)
        check("글자표 칸은 보이는 줄만", 0 < pg.locator("[data-testid=glyph]").count() < 2000)
        pg.screenshot(path=str(OUT / "e2e_detail_arial.png"))

        check("페이지 오류 없음", not errors, str(errors[:3]))
        check("외부 주소 요청 0건", not outside, str(outside[:3]))
        c.close()

        # 2) 처음 온 사람(허락 없음) → 안내 → 버튼 → 빈 배열 → 거절 안내
        c = b.new_context(viewport={"width": 1280, "height": 860})
        pg = c.new_page()
        pg.goto(url)
        pg.wait_for_selector("[data-testid=start]")
        check("처음 온 사람은 안내 + 버튼", pg.locator("[data-testid=intro-points]").count() == 1)
        pg.screenshot(path=str(OUT / "e2e_intro.png"))
        pg.locator("[data-testid=start]").click()
        pg.wait_for_selector("[data-testid=retry]", timeout=20000)
        check("허락 안 됨 → 다시 허락받는 안내", "허락" in pg.inner_text("body"))
        pg.screenshot(path=str(OUT / "e2e_denied.png"))
        c.close()

        # 3) 미지원 브라우저(함수 없음)
        c = b.new_context(viewport={"width": 1280, "height": 860})
        c.add_init_script("delete window.queryLocalFonts")
        pg = c.new_page()
        pg.goto(url)
        pg.wait_for_selector("[data-testid=copy-url]")
        check("미지원 → Chrome·Edge 안내", "Chrome" in pg.inner_text("body"))
        pg.screenshot(path=str(OUT / "e2e_unsupported.png"))
        c.close()

        # 4) 저장소가 막힌 환경
        c = b.new_context(viewport={"width": 1280, "height": 860})
        c.grant_permissions(["local-fonts"], origin=origin)
        c.add_init_script("Storage.prototype.getItem = () => { throw new Error('blocked') }; Storage.prototype.setItem = () => { throw new Error('blocked') };")
        pg = c.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(url)
        pg.wait_for_selector("[data-testid=list]", timeout=20000)
        check("저장소 막힘: 목록은 뜨고 안내 배지", "이 창에서만 기억해요" in pg.inner_text("body") and not errs, str(errs[:2]))
        pg.locator("[data-testid=fav]").first.click()
        pg.get_by_role("radio", name="즐겨찾기").click()
        pg.wait_for_timeout(200)
        check("저장소 막힘: 즐겨찾기는 이 창에서 동작", list_count(pg) == 1)
        pg.goto(url.replace("?e2e", ""))
        pg.wait_for_selector("[data-testid=list]", timeout=20000)
        check("시험 주소가 아니면 window.__hoek 없음", pg.evaluate("typeof window.__hoek") == "undefined")
        c.close()
        b.close()
    srv.shutdown()
    print(f"\n{passes} passed, {len(fails)} failed")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
