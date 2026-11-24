"""ASGI entry point for the Studio and the original Paint Atlas API."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .config import DB_PATH, REFERENCE_DIR, STUDIO_DIST
from .database import connection
from .legacy.routes import initialize as initialize_legacy
from .legacy.routes import router as legacy_router
from .studio.routes import router as studio_router
from .studio.routes import studio_origin
from .studio.storage import initialize as initialize_studio


@asynccontextmanager
async def lifespan(app):
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connection() as db:
        db.execute("PRAGMA journal_mode=WAL")
        initialize_legacy(db)
        initialize_studio(db)
    yield


app = FastAPI(title="Paint Atlas Studio", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["localhost", "127.0.0.1", "[::1]", "::1", "testserver"],
)
app.middleware("http")(studio_origin)
app.include_router(studio_router)
app.mount("/studio-ui", StaticFiles(directory=STUDIO_DIST, check_dir=False), name="studio-ui")
app.mount("/reference", StaticFiles(directory=REFERENCE_DIR), name="reference")


@app.get("/", include_in_schema=False)
def console():
    return FileResponse(STUDIO_DIST / "index.html")


app.include_router(legacy_router)
