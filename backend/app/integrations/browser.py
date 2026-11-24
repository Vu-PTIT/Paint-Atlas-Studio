"""Render a fresh portable file in an offline Chromium context before publishing it."""
import os
from pathlib import Path
import shutil

from playwright.sync_api import sync_playwright
from PIL import Image, ImageStat

def browser_options(backend="webgl"):
    system = os.environ.get("ATLAS_CHROMIUM")
    if not system and os.name != "nt":
        system = shutil.which("chromium") or shutil.which("google-chrome")
    args = ["--disable-dev-shm-usage","--enable-unsafe-swiftshader","--use-angle=swiftshader"]
    if backend=="webgpu" and os.name!="nt":
        args += ["--enable-gpu","--enable-unsafe-webgpu","--enable-features=Vulkan","--use-vulkan=swiftshader",
                 "--use-webgpu-adapter=swiftshader","--disable-vulkan-surface"]
        if os.environ.get("ATLAS_CHROME_SINGLE")=="1":args += ["--no-zygote","--disable-gpu-sandbox"]
    elif os.environ.get("ATLAS_CHROME_SINGLE")=="1":
        args += ["--no-zygote","--single-process","--in-process-gpu"]
    return {"headless": True, "args": args, **({"executable_path":system} if system else {})}

def inspect_scene(file: Path, screenshot: Path, backend="webgl", mobile=False):
    errors, requests = [], []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(**browser_options(backend))
        try:
            page = browser.new_page(viewport={"width":520 if mobile else 980,"height":770 if mobile else 600},
                                    has_touch=mobile,is_mobile=mobile,offline=True)
            page.on("pageerror", lambda error: errors.append(str(error)[:500]))
            page.on("request", lambda req: requests.append(req.url) if req.url.startswith(("http:", "https:")) else None)
            page.goto(file.resolve().as_uri()+"?test=1&backend="+backend, wait_until="domcontentloaded")
            page.locator("body[data-status=ready],body[data-status=error]").wait_for(state="attached",timeout=100_000)
            if page.locator("body").get_attribute("data-status")!="ready":
                raise RuntimeError(page.locator("#ui").inner_text()[:700])
            data=page.evaluate("""() => { const p=window.atlasProbe, v=p.info(); return {
                backend:v.backend,physics:v.physics,strokes:v.strokes,manifest:p.manifest(),initial:v.state,
                subject:JSON.parse(document.getElementById("world-meta").textContent).subject
            }}""")
            if not data["manifest"]:
                raise ValueError("Cảnh cần ít nhất một vật thể có thể chỉnh trong Studio.")
            subjects=[s for s in data["manifest"] if s.get("role")=="subject"]
            if data["subject"] and not any(s.get("box") and s.get("movable") is not False for s in subjects):
                raise ValueError("Bản dựng thiếu chủ thể có thể chọn và di chuyển. Khai báo role: 'subject' và box cho chủ thể của tranh.")
            if not data["subject"] and subjects:
                raise ValueError("Chế độ chỉ lấy phong cách nhưng mã cảnh vẫn thêm chủ thể từ tranh.")
            page.evaluate("document.documentElement.dataset.clean='true'")
            page.add_style_tag(content="#ui{visibility:hidden!important}")
            page.screenshot(path=str(screenshot),timeout=60_000)
            with Image.open(screenshot) as captured:
                if max(ImageStat.Stat(captured.convert("RGB")).stddev)<3:
                    raise ValueError("Khung ảnh hầu như chỉ có một màu. Kiểm tra camera và hình học của cảnh.")
            if errors or requests:
                raise RuntimeError("Lỗi trình duyệt hoặc phụ thuộc mạng. "+" ".join((errors+requests)[:3]))
            return data
        finally:
            browser.close()
