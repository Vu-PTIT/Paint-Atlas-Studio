"""HTTP routes for artwork, project drafts, versions and build jobs."""

import json
import os
import shutil
from urllib.parse import urlsplit
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from starlette.concurrency import run_in_threadpool

from ..artwork import measure_pixels
from ..database import connection
from .images import crop_subject, normalize_image
from .jobs import enqueue, start_job
from .models import Draft, JobRequest, SaveDraft, SaveState
from .prompts import author_prompt, prompt_for, redact_notes
from .storage import (
    encode_json, get_artwork, get_project, get_version, project_payload,
    require_row, timestamp, validate_state, version_file,
)

router = APIRouter(prefix="/api")
IMAGE_LIMIT = 6 * 1024 * 1024


async def studio_origin(request, call_next):
    if request.url.path.startswith("/api/") and request.method not in {"GET", "HEAD", "OPTIONS"}:
        origin = request.headers.get("origin")
        cross_origin = origin and urlsplit(origin).netloc != request.headers.get("host")
        if cross_origin or request.headers.get("x-paint-atlas") != "studio":
            return JSONResponse(
                {"detail": "Thao tác chỉnh sửa cần đến từ Studio trên máy này."},
                status_code=403,
            )
    return await call_next(request)


@router.get("/projects")
def projects():
    with connection() as db:
        rows = db.execute("SELECT * FROM studio_projects ORDER BY updated DESC,rowid DESC").fetchall()
        return [project_payload(db, row) for row in rows]


@router.get("/projects/{key}")
def project(key: str):
    with connection() as db:
        return project_payload(db, get_project(db, key))


@router.post("/projects", status_code=201)
def create(draft: Draft):
    key = uuid4().hex
    with connection(True) as db:
        if draft.artwork:
            get_artwork(db, draft.artwork)
        db.execute(
            "INSERT INTO studio_projects VALUES(?,?,0,?)",
            (key, redact_notes(draft).model_dump_json(), timestamp()),
        )
        return project_payload(db, get_project(db, key))


@router.put("/projects/{key}")
def save(key: str, body: SaveDraft):
    with connection(True) as db:
        row = get_project(db, key)
        if row["revision"] != body.revision:
            raise HTTPException(409, "Dự án đã được sửa ở tab khác. Tải lại để xem bản mới.")
        if body.draft.artwork:
            get_artwork(db, body.draft.artwork)
        db.execute(
            "UPDATE studio_projects SET draft=?,revision=revision+1,updated=? WHERE id=?",
            (redact_notes(body.draft).model_dump_json(), timestamp(), key),
        )
        return project_payload(db, get_project(db, key))


@router.get("/projects/{key}/prompt")
def prompt(key: str):
    with connection() as db:
        draft = Draft.model_validate_json(get_project(db, key)["draft"])
    return {"prompt": prompt_for(draft), "manual": author_prompt(draft)}


@router.post("/prompt")
def preview_prompt(draft: Draft):
    draft = redact_notes(draft)
    return {"prompt": prompt_for(draft), "manual": author_prompt(draft)}


@router.get("/projects/{key}/crop")
def crop(key: str):
    with connection() as db:
        draft = Draft.model_validate_json(get_project(db, key)["draft"])
        if draft.mode != "subject":
            raise HTTPException(422, "Dự án đang lấy phong cách.")
        raw = get_artwork(db, draft.artwork)
    return Response(crop_subject(raw, draft.crop), media_type="image/png")


@router.post("/artworks", status_code=201)
async def upload(request: Request):
    buffer = bytearray()
    async for chunk in request.stream():
        if len(buffer) + len(chunk) > IMAGE_LIMIT:
            raise HTTPException(413, "Ảnh tối đa 6 MiB.")
        buffer.extend(chunk)
    raw = await run_in_threadpool(normalize_image, buffer)
    try:
        profile = await run_in_threadpool(measure_pixels, raw)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    key = uuid4().hex
    with connection(True) as db:
        db.execute("INSERT INTO studio_art VALUES(?,?)", (key, raw))
    return {
        "id": key, "palette": [color.hex for color in profile.palette],
        "width": profile.width, "height": profile.height,
    }


@router.get("/artworks/{key}")
def artwork(key: str):
    with connection() as db:
        return Response(get_artwork(db, key), media_type="image/png")


@router.get("/versions/{key}/html")
def html(key: str):
    with connection() as db:
        row = get_version(db, key)
    source = version_file(row, "html").read_text(encoding="utf-8")
    marker = '<script id="world-state" type="application/json">'
    start = source.index(marker) + len(marker)
    end = source.index("</script>", start)
    state_json = encode_json(json.loads(row["state"])).replace("<", "\\u003c")
    return HTMLResponse(source[:start] + state_json + source[end:],
                        headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"})


@router.get("/versions/{key}/frame")
def frame(key: str):
    with connection() as db:
        row = get_version(db, key)
    return FileResponse(version_file(row, "frame"))


@router.get("/versions/{key}/state")
def state(key: str):
    with connection() as db:
        row = get_version(db, key)
    return {"revision": row["revision"], "state": json.loads(row["state"]), "manifest": json.loads(row["manifest"])}


@router.put("/versions/{key}/state")
def save_state(key: str, body: SaveState):
    with connection(True) as db:
        row = get_version(db, key)
        if body.revision != row["revision"]:
            raise HTTPException(409, "Bản này đã thay đổi ở tab khác. Xuất HTML để giữ sửa đổi của bạn.")
        validate_state(body.state, json.loads(row["manifest"]))
        state_json = encode_json({key: value.model_dump() for key, value in body.state.items()})
        db.execute("UPDATE studio_versions SET state=?,revision=revision+1 WHERE id=?", (state_json, key))
        return {"revision": body.revision + 1}


@router.post("/jobs", status_code=202)
def submit(body: JobRequest):
    with connection(True) as db:
        row = get_project(db, body.project)
        draft = Draft.model_validate_json(row["draft"])
        if body.revision != row["revision"]:
            raise HTTPException(409, "Bản nháp đã thay đổi.")
        if (body.action == "analyze" or draft.mode == "subject") and not draft.artwork:
            raise HTTPException(422, "Hãy chọn ảnh tham chiếu.")
        if body.action == "sample" and body.sample == "starry" and draft.mode == "subject":
            raise HTTPException(422, "Dùng bố cục Hội An, mã TypeScript hoặc Codex để dựng kèm chủ thể.")
        if body.action == "import" and not body.source.strip():
            raise HTTPException(422, "Chọn tệp .ts hoặc dán mã cảnh.")
        if body.action == "generate" and (not draft.style.strip() or not draft.world.strip()):
            raise HTTPException(422, "Cần duyệt phong cách và mô tả thế giới.")
        inputs = {
            "revision": row["revision"], "draft": redact_notes(draft).model_dump(),
            "source": body.source, "sample": body.sample,
        }
        job = enqueue(db, body.project, body.action, inputs)
    start_job(job, body.project, body.action, inputs)
    return {"id": job}


@router.post("/jobs/{key}/retry", status_code=202)
def retry(key: str):
    with connection(True) as db:
        row = require_row(db, "SELECT * FROM studio_jobs WHERE id=?", (key,), "Chưa có lượt dựng.")
        if row["status"] not in {"failed", "interrupted"}:
            raise HTTPException(409, "Chỉ thử lại lượt đã dừng.")
        inputs = json.loads(row["input"])
        job = enqueue(db, row["project"], row["action"], inputs)
    start_job(job, row["project"], row["action"], inputs)
    return {"id": job}


@router.get("/jobs")
def jobs():
    with connection() as db:
        rows = db.execute("""
            SELECT j.id,j.project,j.action,j.status,j.stage,j.created,j.result,j.error,
                   json_extract(j.input,'$.revision') AS draft_revision,p.draft
            FROM studio_jobs j JOIN studio_projects p ON p.id=j.project
            ORDER BY j.rowid DESC LIMIT 100
        """).fetchall()
    return [
        {
            **{key: row[key] for key in row.keys() if key not in {"draft", "result"}},
            "title": json.loads(row["draft"])["title"],
            "result": json.loads(row["result"]) if row["result"] else None,
        }
        for row in rows
    ]


@router.get("/status")
def status():
    return {
        "codex": bool(shutil.which(os.environ.get("ATLAS_CODEX_BIN", "codex"))),
        "node": bool(shutil.which("node")),
        "physics": "Rapier 3D",
    }
