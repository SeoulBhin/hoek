"""획 화면 캡처: 내 PC 폰트로 목록·상세·비교를 여러 폭에서 찍어 out/design/<이름>/ 에 남긴다(눈으로 보는 용).
사용: npm run build && python tests/capture.py after
"""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from serve_sub import start  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
WIDTHS = [(2560, 1600), (1280, 800), (390, 844)]


def main(tag):
    out = ROOT / "out" / "design" / tag
    out.mkdir(parents=True, exist_ok=True)
    srv, url = start()
    origin = url.rsplit("/hoek/", 1)[0]
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True)
        for w, h in WIDTHS:
            c = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
            c.grant_permissions(["local-fonts"], origin=origin)
            pg = c.new_page()
            pg.goto(url + "?e2e")
            pg.wait_for_selector("[data-testid=list]", timeout=20000)
            pg.wait_for_function("window.__hoek && window.__hoek.done === window.__hoek.families.length", timeout=60000)
            pg.wait_for_timeout(600)
            pg.screenshot(path=str(out / f"list_{w}.png"))
            # 줄 위에 마우스를 올린 모습
            pg.hover("[data-testid=row] >> nth=1")
            pg.wait_for_timeout(250)
            pg.screenshot(path=str(out / f"list_hover_{w}.png"))
            # 비교 2개 → 트레이
            for i in (0, 3):
                pg.hover(f"[data-testid=row] >> nth={i}")
                pg.locator("[data-testid=cmp] input, input[data-testid=cmp], [data-testid=cmp]").nth(i).click()
            pg.wait_for_timeout(250)
            pg.screenshot(path=str(out / f"tray_{w}.png"))
            pg.click("[data-testid=show-compare]")
            pg.wait_for_timeout(500)
            pg.screenshot(path=str(out / f"compare_{w}.png"))
            pg.go_back() if False else None
            c.close()
            c = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
            c.grant_permissions(["local-fonts"], origin=origin)
            pg = c.new_page()
            pg.goto(url)
            pg.wait_for_selector("[data-testid=list]", timeout=20000)
            pg.hover("[data-testid=row] >> nth=0")
            pg.click("[data-testid=open] >> nth=0")
            pg.wait_for_timeout(600)
            pg.screenshot(path=str(out / f"detail_{w}.png"))
            c.close()
        b.close()
    srv.shutdown()
    print("saved", out)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "now")
