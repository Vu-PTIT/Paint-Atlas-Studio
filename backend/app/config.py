"""Paths shared by the Studio server, launchers and local build tools."""

import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DIR = PROJECT_ROOT / "frontend"
STUDIO_DIST = FRONTEND_DIR / "dist"
PLAYER_SCENES_DIR = FRONTEND_DIR / "player" / "src" / "scenes"
LEGACY_FRONTEND_DIR = FRONTEND_DIR / "legacy"
EXAMPLES_DIR = PROJECT_ROOT / "examples"
REFERENCE_DIR = PROJECT_ROOT / "assets" / "reference"
SHARED_DIR = PROJECT_ROOT / "shared"
DOCS_DIR = PROJECT_ROOT / "docs"
DB_PATH = Path(os.environ.get("ATLAS_DB", str(PROJECT_ROOT / "data" / "atlas.sqlite3")))
STUDIO_DATA_DIR = Path(os.environ.get("ATLAS_WORK_DIR", str(PROJECT_ROOT / "data" / "studio"))).resolve()
GRAPH_BINARY = (
    PROJECT_ROOT / "backend" / "rust" / "atlas-graph" / "target" / "release"
    / ("atlas-graph.exe" if os.name == "nt" else "atlas-graph")
)
