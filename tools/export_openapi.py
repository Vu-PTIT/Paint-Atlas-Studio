"""Update the versioned OpenAPI contract from the FastAPI routes."""

import json

from backend.app.config import SHARED_DIR
from backend.app.main import app


if __name__ == "__main__":
    contract = SHARED_DIR / "openapi.json"
    contract.write_text(json.dumps(app.openapi(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(contract)
