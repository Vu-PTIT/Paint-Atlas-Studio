FROM rust:1-bookworm AS graph
WORKDIR /build
COPY backend/rust/atlas-graph/ ./
RUN cargo test --locked --offline && cargo build --release --locked --offline

FROM node:24-bookworm-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
COPY examples/catalog.json /app/examples/catalog.json
RUN npm run build

FROM python:3.12-slim-bookworm
WORKDIR /app
ENV ATLAS_DB=/data/atlas.sqlite3 ATLAS_WORK_DIR=/data/studio ATLAS_ENGINE=rust PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
COPY backend/requirements.lock backend/requirements.lock
RUN pip install --no-cache-dir -r backend/requirements.lock && python -m playwright install --with-deps chromium
COPY --from=frontend /usr/local/bin/node /usr/local/bin/node
COPY --from=frontend /app/frontend /app/frontend
COPY --from=frontend /app/examples /app/examples
COPY --from=graph /build/target/release/atlas-graph backend/rust/atlas-graph/target/release/atlas-graph
COPY backend/__init__.py backend/
COPY backend/app/ backend/app/
COPY examples/legacy/ examples/legacy/
COPY examples/manifests/ examples/manifests/
COPY examples/previews/ examples/previews/
COPY assets/reference/ assets/reference/
COPY docs/legacy/WORLD-GUIDE.md docs/legacy/WORLD-GUIDE.md
COPY shared/ shared/
CMD ["python","-m","uvicorn","backend.app.main:app","--host","0.0.0.0","--port","8000"]
