"""Store project drafts and built versions and seed the example catalog."""

from datetime import datetime, timezone
from io import BytesIO
import json
import re

from fastapi import HTTPException
from PIL import Image

from ..config import EXAMPLES_DIR, PLAYER_SCENES_DIR, PROJECT_ROOT, REFERENCE_DIR, STUDIO_DATA_DIR
from .models import Draft, ObjectState


def timestamp():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def encode_json(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def require_row(db, query, args, detail):
    row = db.execute(query, args).fetchone()
    if row is None:
        raise HTTPException(404, detail)
    return row


def sample_files(key):
    return {
        "html": EXAMPLES_DIR / "worlds" / f"{key}.html",
        "frame": EXAMPLES_DIR / "previews" / f"{key}-frame.webp",
    }


def initialize(db):
    STUDIO_DATA_DIR.mkdir(parents=True, exist_ok=True)
    db.executescript("""
        CREATE TABLE IF NOT EXISTS studio_art(id TEXT PRIMARY KEY, png BLOB NOT NULL);
        CREATE TABLE IF NOT EXISTS studio_projects(
            id TEXT PRIMARY KEY, draft TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, updated TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS studio_versions(
            id TEXT PRIMARY KEY, project TEXT NOT NULL, label TEXT NOT NULL, created TEXT NOT NULL,
            html TEXT NOT NULL, frame TEXT NOT NULL, source TEXT NOT NULL, manifest TEXT NOT NULL,
            state TEXT NOT NULL DEFAULT '{}', revision INTEGER NOT NULL DEFAULT 0);
        CREATE INDEX IF NOT EXISTS studio_version_project ON studio_versions(project,created);
        CREATE TABLE IF NOT EXISTS studio_jobs(
            id TEXT PRIMARY KEY, project TEXT NOT NULL, action TEXT NOT NULL, status TEXT NOT NULL,
            stage TEXT NOT NULL, created TEXT NOT NULL, input TEXT NOT NULL, result TEXT, error TEXT,
            thread TEXT, turn TEXT);
    """)
    db.execute(
        "UPDATE studio_jobs SET status='interrupted',stage='Studio đã dừng trong lượt trước'"
        " WHERE status IN ('running','queued')"
    )
    catalog = json.loads((EXAMPLES_DIR / "catalog.json").read_text(encoding="utf-8"))
    for entry in catalog:
        key = entry["key"]
        files = sample_files(key)
        manifest = EXAMPLES_DIR / "manifests" / f"{key}.manifest.json"
        if not manifest.is_file() or not all(path.is_file() for path in files.values()):
            continue
        art = "sample-sky" if key == "starry" else "sample-portrait"
        if not db.execute("SELECT 1 FROM studio_art WHERE id=?", (art,)).fetchone():
            with Image.open(REFERENCE_DIR / entry["reference"]) as image:
                output = BytesIO()
                image.convert("RGB").save(output, format="PNG")
            db.execute("INSERT INTO studio_art VALUES(?,?)", (art, output.getvalue()))
        subject = entry["subject"]
        draft = Draft(
            title=entry["title"], artwork=art, mode="subject" if subject else "style",
            palette=entry["palette"], world=entry["world"], style=entry["style"], seed=entry["seed"],
            subject_notes="Tóc đen có mái, hoa trắng, áo dài đỏ, tay cầm đèn vàng." if subject else "",
            subject_role="Đứng bên đầu cầu." if subject else "",
        )
        db.execute("INSERT OR IGNORE INTO studio_projects VALUES(?,?,0,?)", (key, draft.model_dump_json(), timestamp()))
        spec = encode_json(json.loads(manifest.read_text(encoding="utf-8"))["manifest"])
        scene_code = (PLAYER_SCENES_DIR / entry["source"]).read_text(encoding="utf-8")
        db.execute(
            "INSERT OR IGNORE INTO studio_versions(id,project,label,created,html,frame,source,manifest)"
            " VALUES(?,?,?,?,?,?,?,?)",
            (
                "sample-" + key, key, "Cảnh mẫu", timestamp(),
                files["html"].relative_to(PROJECT_ROOT).as_posix(),
                files["frame"].relative_to(PROJECT_ROOT).as_posix(),
                scene_code, spec,
            ),
        )
        # Bundled HTML and its manifest ship together. Keep saved sample edits and revisions.
        db.execute("UPDATE studio_versions SET manifest=? WHERE id=? AND manifest<>?",
                   (spec, "sample-" + key, spec))


def get_artwork(db, key):
    return require_row(db, "SELECT png FROM studio_art WHERE id=?", (key,), "Ảnh tham chiếu chưa tồn tại.")[0]


def get_project(db, key):
    return require_row(db, "SELECT * FROM studio_projects WHERE id=?", (key,), "Chưa tìm thấy dự án.")


def get_version(db, key):
    return require_row(db, "SELECT * FROM studio_versions WHERE id=?", (key,), "Chưa tìm thấy bản dựng.")


def project_payload(db, row):
    versions = db.execute(
        "SELECT id,label,created,revision FROM studio_versions WHERE project=? ORDER BY created DESC,rowid DESC",
        (row["id"],),
    )
    return {
        "id": row["id"],
        "revision": row["revision"],
        "updated": row["updated"],
        "draft": json.loads(row["draft"]),
        "versions": [dict(version) for version in versions],
    }


def version_file(row, column):
    if row["id"].startswith("sample-"):
        # Resolve shipped samples by ID so databases with earlier relative paths keep working.
        return sample_files(row["id"].removeprefix("sample-"))[column]
    return STUDIO_DATA_DIR / row[column]


def validate_state(state: dict[str, ObjectState], manifest):
    objects = {entry["id"]: entry for entry in manifest}
    for key, edited in state.items():
        spec = objects.get(key)
        if not spec:
            raise HTTPException(422, "ID vật thể ngoài cảnh.")
        if spec.get("movable") is False and (
            list(edited.position) != spec.get("position", [0, 0, 0])
            or edited.yaw != spec.get("yaw", 0)
            or edited.scale != spec.get("scale", 1)
        ):
            raise HTTPException(422, "Vật thể này có vị trí cố định.")
        allowed = spec.get("fields", {})
        if set(edited.values) != set(allowed):
            raise HTTPException(422, "Bộ thuộc tính không khớp bản dựng.")
        for key, value in edited.values.items():
            field = allowed[key]
            if field["kind"] == "number":
                if not isinstance(value, (float, int)) or not field["min"] <= value <= field["max"]:
                    raise HTTPException(422, "Tham số vượt giới hạn.")
            elif not isinstance(value, str) or not re.fullmatch(r"#[a-fA-F0-9]{6}", value):
                raise HTTPException(422, "Màu sai định dạng.")
