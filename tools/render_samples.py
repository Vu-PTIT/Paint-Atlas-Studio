"""Refresh example manifests, gallery images and screenshots from the standalone HTMLs."""

import json
from PIL import Image

from backend.app.config import EXAMPLES_DIR, PROJECT_ROOT, REFERENCE_DIR
from backend.app.integrations.browser import inspect_scene


def main():
    frames = PROJECT_ROOT / "tests" / "results" / "frames"
    manifests = EXAMPLES_DIR / "manifests"
    previews = EXAMPLES_DIR / "previews"
    for directory in (frames, manifests, previews):
        directory.mkdir(parents=True, exist_ok=True)

    catalog = json.loads((EXAMPLES_DIR / "catalog.json").read_text(encoding="utf-8"))
    for entry in catalog:
        key = entry["key"]
        screenshot = frames / f"{key}.png"
        result = inspect_scene(EXAMPLES_DIR / "worlds" / f"{key}.html", screenshot)
        (manifests / f"{key}.manifest.json").write_text(
            json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8",
        )
        with Image.open(screenshot) as captured:
            frame = captured.convert("RGB")
            frame.save(previews / f"{key}-frame.webp", quality=87)
            if key == "starry":
                frame.save(REFERENCE_DIR / "landscape.webp", quality=87)
        print(key, result["backend"], result["strokes"], len(result["manifest"]), flush=True)


if __name__ == "__main__":
    main()
