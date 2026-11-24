"""HTTP routes for original Paint Atlas world recipes and published books."""

import hashlib
import io
import json
import secrets
import sqlite3
import subprocess
from uuid import uuid4

from fastapi import APIRouter, Header, HTTPException, Request, Response
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from PIL import Image, ImageOps, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool

from ..artwork import measure_pixels
from ..config import DOCS_DIR, EXAMPLES_DIR, LEGACY_FRONTEND_DIR
from ..database import connection
from ..models import Model
from .analysis import compile_brief
from .graph import Book, InvalidBook, check_structure, engine, unreachable
from .scene import AnalyzeInput, SceneAnalysis, Title
from .vision import VisionError, recognize
from .worlds import WorldPlan, compile_world

router = APIRouter()
IMAGE_LIMIT = 6 * 1024 * 1024


def initialize(db):
    db.executescript("""
        CREATE TABLE IF NOT EXISTS books(
            id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, draft TEXT NOT NULL,
            revision INTEGER NOT NULL, published TEXT, published_revision INTEGER);
        CREATE TABLE IF NOT EXISTS images(
            id TEXT PRIMARY KEY, book_id TEXT NOT NULL, png BLOB NOT NULL);
        CREATE INDEX IF NOT EXISTS images_by_book ON images(book_id);
    """)


class NewBook(Model):
    title: Title


class Save(Model):
    revision: int
    book: Book


class Publish(Model):
    revision: int


def owner(db, key, authorization):
    row = db.execute("SELECT * FROM books WHERE id=?", (key,)).fetchone()
    token = (authorization or "").removeprefix("Bearer ")
    digest = hashlib.sha256(token.encode()).hexdigest()
    if not row or not secrets.compare_digest(digest, row["token_hash"]):
        raise HTTPException(404, "Không tìm thấy sách hoặc khóa chỉnh sửa sai")
    return row


def current(row, revision):
    if revision != row["revision"]:
        raise HTTPException(409, "Bản nháp đã thay đổi. Tải lại trước khi ghi.")


def checked(db, key, book):
    assets = {r[0] for r in db.execute("SELECT id FROM images WHERE book_id=?", (key,))}
    try:
        check_structure(book, assets)
    except InvalidBook as exc:
        raise HTTPException(422, str(exc)) from exc


@router.get("/legacy", include_in_schema=False)
def legacy_console():
    return FileResponse(LEGACY_FRONTEND_DIR / "console.html")


@router.get("/examples/night-ride.txt", include_in_schema=False)
def example():
    return FileResponse(EXAMPLES_DIR / "legacy" / "night-ride.txt", media_type="text/plain")


@router.get("/worlds/schema.json")
def world_schema():
    return WorldPlan.model_json_schema()


@router.get("/worlds/guide", include_in_schema=False)
def world_guide():
    return FileResponse(DOCS_DIR / "legacy" / "WORLD-GUIDE.md", media_type="text/markdown",
                        filename="WORLD-GUIDE.md")


@router.get("/examples/river-moon.json", include_in_schema=False)
def world_example():
    return FileResponse(EXAMPLES_DIR / "legacy" / "river-moon.json", media_type="application/json")


@router.post("/worlds/render", response_class=HTMLResponse)
def render_world(plan: WorldPlan):
    return compile_world(plan)


@router.get("/worlds/demo", response_class=HTMLResponse, include_in_schema=False)
def world_demo():
    example = (EXAMPLES_DIR / "legacy" / "river-moon.json").read_text(encoding="utf-8")
    return compile_world(WorldPlan.model_validate_json(example))


@router.get("/health")
def health():
    try:
        probe = Book.model_validate({"title":"probe","worlds":[{"id":"a","title":"a","template":"meadow",
            "anchors":[{"id":"in","kind":"entry","position":[0,0,0]}]}],"start":{"world":"a","anchor":"in"}})
        unreachable(probe)
        with connection() as db:
            db.execute("SELECT id FROM books LIMIT 1")
    except (OSError, ValueError, subprocess.SubprocessError, sqlite3.Error) as exc:
        raise HTTPException(503, "Kiểm tra cơ sở dữ liệu hoặc trình kiểm tra tuyến nối") from exc
    return {"status": "ok", "engine": engine()}


@router.post("/books", status_code=201)
def create(body: NewBook):
    key, token = uuid4().hex, secrets.token_urlsafe(32)
    book = Book(title=body.title)
    with connection(True) as db:
        db.execute("INSERT INTO books(id,token_hash,draft,revision) VALUES(?,?,?,0)",
                   (key, hashlib.sha256(token.encode()).hexdigest(), book.model_dump_json()))
    return JSONResponse({"id":key, "edit_token":token, "revision":0, "book":book.model_dump()},
                        status_code=201, headers={"Cache-Control":"no-store"})


@router.get("/books/{key}")
def draft(key: str, authorization: str | None = Header(None)):
    with connection() as db:
        row = owner(db, key, authorization)
        return {"revision":row["revision"], "book":json.loads(row["draft"])}


@router.put("/books/{key}")
def save(key: str, body: Save, authorization: str | None = Header(None)):
    with connection(True) as db:
        row = owner(db, key, authorization)
        current(row, body.revision)
        checked(db, key, body.book)
        db.execute("UPDATE books SET draft=?,revision=revision+1 WHERE id=?", (body.book.model_dump_json(), key))
        return {"revision":row["revision"] + 1, "book":body.book}


def store_image(raw, key, authorization):
    try:
        with Image.open(io.BytesIO(raw)) as image:
            if image.format not in {"JPEG", "PNG", "WEBP"} or image.width * image.height > 12_000_000:
                raise HTTPException(415, "Dùng PNG, JPEG hoặc WebP tối đa 12 megapixel")
            frame = ImageOps.exif_transpose(image)
            frame.thumbnail((1600,1600))
            out = io.BytesIO()
            frame.convert("RGBA").save(out, "PNG")
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise HTTPException(415, "Tệp tranh không hợp lệ") from exc
    img_id = uuid4().hex
    with connection(True) as db:
        owner(db, key, authorization)
        db.execute("INSERT INTO images VALUES(?,?,?)", (img_id, key, out.getvalue()))
    return {"artwork":img_id}


@router.post("/books/{key}/images", status_code=201)
async def upload(key: str, request: Request, authorization: str | None = Header(None)):
    with connection() as db:
        owner(db, key, authorization)
    data = bytearray()
    async for chunk in request.stream():
        if len(data) + len(chunk) > IMAGE_LIMIT:
            raise HTTPException(413, "Tệp vượt quá 6 MiB")
        data.extend(chunk)
    return await run_in_threadpool(store_image, data, key, authorization)


@router.post("/books/{key}/analyze", response_model=SceneAnalysis)
def analyze(key: str, body: AnalyzeInput, authorization: str | None = Header(None)):
    png = None
    with connection() as db:
        owner(db, key, authorization)
        if body.artwork:
            row = db.execute("SELECT png FROM images WHERE id=? AND book_id=?",
                             (body.artwork, key)).fetchone()
            if not row:
                raise HTTPException(404, "Không tìm thấy tranh trong sách này")
            png = row["png"]
    try:
        pixels = measure_pixels(png) if png is not None else None
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    brief = compile_brief(body.prompt) if body.prompt else None
    try:
        recognition = recognize(png) if body.vision else None
    except VisionError as exc:
        raise HTTPException(exc.status, str(exc)) from exc
    return SceneAnalysis(artwork=body.artwork, pixels=pixels,
                         recognition=recognition, brief=brief)


@router.post("/books/{key}/publish")
def publish(key: str, body: Publish, authorization: str | None = Header(None)):
    with connection(True) as db:
        row = owner(db, key, authorization)
        current(row, body.revision)
        book = Book.model_validate_json(row["draft"])
        checked(db, key, book)
        if not book.start:
            raise HTTPException(422, "Chọn điểm bắt đầu trước khi xuất bản")
        try:
            missing = unreachable(book)
        except (OSError, subprocess.SubprocessError) as exc:
            raise HTTPException(503, "Trình kiểm tra tuyến chưa chạy. Kiểm tra /health.") from exc
        if missing:
            raise HTTPException(422, {"unreachable":missing})
        db.execute("UPDATE books SET published=draft,published_revision=revision WHERE id=?", (key,))
    return {"revision":body.revision, "url":f"/play/{key}"}


def published(db, key):
    row = db.execute("SELECT published,published_revision FROM books WHERE id=?", (key,)).fetchone()
    if not row or not row["published"]:
        raise HTTPException(404, "Hành trình chưa xuất bản")
    return json.loads(row["published"]), row["published_revision"]


@router.get("/play/{key}")
def manifest(key: str):
    with connection() as db:
        book, version = published(db, key)
        return {"revision": version, "book": book,
                "images":{w["artwork"]:f"/play/{key}/images/{w['artwork']}" for w in book["worlds"] if w["artwork"]},
                "views":{w["id"]:f"/play/{key}/worlds/{w['id']}/view" for w in book["worlds"] if w.get("recipe")}}


@router.get("/play/{key}/worlds/{world_id}/view", response_class=HTMLResponse)
def view_world(key: str, world_id: str):
    with connection() as db:
        book, _ = published(db, key)
    world = next((w for w in book["worlds"] if w["id"] == world_id and w.get("recipe")), None)
    if world is None:
        raise HTTPException(404, "Thế giới chưa có cảnh đã xuất bản")
    return compile_world(WorldPlan.model_validate(world["recipe"]))


@router.get("/play/{key}/images/{img_id}")
def artwork(key: str, img_id: str):
    with connection() as db:
        book, _ = published(db, key)
        if img_id not in {w["artwork"] for w in book["worlds"]}:
            raise HTTPException(404)
        row = db.execute("SELECT png FROM images WHERE id=? AND book_id=?", (img_id, key)).fetchone()
        if not row:
            raise HTTPException(404)
        return Response(row[0], media_type="image/png")


@router.get("/play/{key}/travel/{world}/{exit_id}")
def travel(key: str, world: str, exit_id: str):
    with connection() as db:
        book, version = published(db, key)
    for link in book["links"]:
        if link["source"] == {"world":world, "anchor":exit_id}:
            target = link["target"]
            scene = next(w for w in book["worlds"] if w["id"] == target["world"])
            spawn = next(a for a in scene["anchors"] if a["id"] == target["anchor"])
            return {"revision":version, "world":scene["id"], "template":scene["template"], "spawn":spawn}
    raise HTTPException(404, "Lối này chưa nối sang thế giới khác")
