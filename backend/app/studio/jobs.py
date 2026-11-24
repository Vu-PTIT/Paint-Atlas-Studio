"""Queue image analysis and build and verify one generated scene at a time."""

import asyncio
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import shutil
import subprocess
from tempfile import TemporaryDirectory
from uuid import uuid4

from PIL import Image

from ..config import FRONTEND_DIR, PLAYER_SCENES_DIR, STUDIO_DATA_DIR
from ..database import connection
from ..integrations.codex import run_codex
from .images import crop_subject
from .models import AnalysisResult, Draft
from .prompts import author_prompt
from .storage import encode_json, get_artwork, timestamp

workers = ThreadPoolExecutor(max_workers=1, thread_name_prefix="paint-atlas")

ANALYSIS_SCHEMA = {
    "type": "object",
    "properties": {
        "style": {"type": "string"},
        "palette": {"type": "array", "items": {"type": "string"}},
        "subject_notes": {"type": "string"},
    },
    "required": ["style", "palette", "subject_notes"],
    "additionalProperties": False,
}
SOURCE_SCHEMA = {
    "type": "object",
    "properties": {"source": {"type": "string"}},
    "required": ["source"],
    "additionalProperties": False,
}


def enqueue(db, project_id, action, inputs):
    job = uuid4().hex
    db.execute(
        "INSERT INTO studio_jobs(id,project,action,status,stage,created,input)"
        " VALUES(?,?,?,'queued','Đang chờ',?,?)",
        (job, project_id, action, timestamp(), encode_json(inputs)),
    )
    return job


def start_job(job, project_id, action, inputs):
    workers.submit(process, job, project_id, action, inputs)


def update_job(key, status, stage, **changes):
    if not set(changes) <= {"result", "error", "thread", "turn"}:
        raise RuntimeError("Invalid job update")
    columns = ["status=?", "stage=?", *(f"{key}=?" for key in changes)]
    with connection(True) as db:
        db.execute("UPDATE studio_jobs SET " + ",".join(columns) + " WHERE id=?",
                   (status, stage, *changes.values(), key))


def analyze_art(draft, raw, images, work, stage):
    stage("Đọc phong cách tranh")
    full = work / "reference.png"
    full.write_bytes(raw)
    prompt = (
        "Phân tích ảnh đầu tiên. Viết tiếng Việt, trường style chỉ mô tả chất liệu, "
        "hình dạng, hướng nét, sáng tối. palette gồm 5–7 mã #RRGGBB."
    )
    if images:
        prompt += " Ảnh thứ hai là vùng đã chọn. Mô tả riêng hình khối, tư thế và màu chủ thể vào subject_notes."
    else:
        prompt += " subject_notes phải rỗng. Không lấy vật thể hay bố cục từ tranh."
    result = AnalysisResult.model_validate(asyncio.run(
        run_codex(prompt, [full, *images], ANALYSIS_SCHEMA, work, stage)
    ))
    if draft.mode == "style":
        result.subject_notes = ""
    return result


def scene_source(action, draft, inputs, images, work, stage):
    if action == "sample":
        return (PLAYER_SCENES_DIR / f"{inputs['sample']}.ts").read_text(encoding="utf-8")
    if action == "import":
        return inputs["source"]
    stage("Codex đang viết mã cảnh")
    prompt = author_prompt(draft) + "\nTrả JSON trường source chứa module TypeScript hoàn chỉnh."
    return asyncio.run(run_codex(prompt, images, SOURCE_SCHEMA, work, stage))["source"]


def build_scene(source, draft, work, stage):
    if not source or len(source) > 600000:
        raise ValueError("Mã cảnh rỗng hoặc vượt 600.000 ký tự.")
    code = work / "scene.ts"
    code.write_text(source, encoding="utf-8")
    meta = work / "meta.json"
    meta.write_text(encode_json({
        "version": 1, "title": draft.title, "seed": draft.seed, "palette": draft.palette,
        "subject": draft.mode == "subject", "description": draft.world,
    }), encoding="utf-8")

    stage("Kiểm tra TypeScript và đóng gói HTML")
    node = shutil.which("node")
    if not node:
        raise RuntimeError("Cần Node.js và npm --prefix frontend ci để dựng thêm cảnh.")
    html = work / "world.html"
    builder = FRONTEND_DIR / "tools" / "build-world.mjs"
    result = subprocess.run(
        [node, str(builder), str(code), str(meta), str(html)],
        cwd=FRONTEND_DIR, timeout=160, capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    if result.returncode:
        raise ValueError(result.stderr.strip()[-2400:] or "Đóng gói thất bại.")

    stage("Mở ngoại tuyến và chụp khung hình")
    from ..integrations.browser import inspect_scene

    screenshot = work / "frame.png"
    checked = inspect_scene(html, screenshot)
    with Image.open(screenshot) as frame:
        frame.convert("RGB").save(work / "frame.webp", quality=87)
    return checked


def publish_version(job, project_id, action, source, work, checked):
    relative_dir = Path("builds") / job
    output_dir = STUDIO_DATA_DIR / relative_dir
    output_dir.mkdir(parents=True, exist_ok=False)
    try:
        shutil.move(work / "world.html", output_dir / "world.html")
        shutil.move(work / "frame.webp", output_dir / "frame.webp")
        label = {"import": "Nhập từ Codex", "generate": "Codex", "sample": "Từ cảnh mẫu"}[action]
        summary = {
            "version": job, "backend": checked["backend"], "physics": checked["physics"],
            "strokes": checked["strokes"],
            "objects": sum(item["id"] != "@scene-palette" for item in checked["manifest"]),
        }
        with connection(True) as db:
            db.execute(
                "INSERT INTO studio_versions(id,project,label,created,html,frame,source,manifest)"
                " VALUES(?,?,?,?,?,?,?,?)",
                (
                    job, project_id, label, timestamp(), (relative_dir / "world.html").as_posix(),
                    (relative_dir / "frame.webp").as_posix(), source, encode_json(checked["manifest"]),
                ),
            )
            db.execute("UPDATE studio_projects SET updated=? WHERE id=?", (timestamp(), project_id))
            db.execute(
                "UPDATE studio_jobs SET status='done',stage='Đã kiểm tra và đóng gói',result=? WHERE id=?",
                (encode_json(summary), job),
            )
    except Exception:
        shutil.rmtree(output_dir, ignore_errors=True)
        raise


def process(job, project_id, action, inputs):
    def stage(message, thread=None, turn=None):
        ids = {"thread": thread, "turn": turn} if thread else {}
        update_job(job, "running", message, **ids)

    try:
        draft = Draft.model_validate(inputs["draft"])
        with TemporaryDirectory(prefix="atlas-", dir=STUDIO_DATA_DIR) as temporary:
            work = Path(temporary)
            raw = None
            images = []
            if draft.artwork:
                with connection() as db:
                    raw = get_artwork(db, draft.artwork)
            if draft.mode == "subject" and raw:
                subject = work / "subject.png"
                subject.write_bytes(crop_subject(raw, draft.crop))
                images.append(subject)
            if action == "analyze":
                result = analyze_art(draft, raw, images, work, stage)
                update_job(job, "done", "Đã phân tích tranh", result=result.model_dump_json())
                return
            source = scene_source(action, draft, inputs, images, work, stage)
            checked = build_scene(source, draft, work, stage)
            publish_version(job, project_id, action, source, work, checked)
    except Exception as exc:
        update_job(job, "failed", "Lượt dựng dừng", error=str(exc)[:2600])
