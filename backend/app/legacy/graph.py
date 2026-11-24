import os
import subprocess

from pydantic import Field
from typing import Literal

from ..config import GRAPH_BINARY
from ..models import Model
from .scene import Key, SceneAnalysis, Title
from .worlds import WorldPlan


class Anchor(Model):
    id: Key
    kind: Literal["entry", "exit", "both"]
    position: tuple[float, float, float]
    yaw: float = 0


class World(Model):
    id: Key
    title: Title
    template: Literal["night-ride", "meadow", "riverside", "painted"]
    artwork: Key | None = None
    anchors: list[Anchor] = Field(min_length=1, max_length=32)
    analysis: SceneAnalysis | None = None
    recipe: WorldPlan | None = None


class Endpoint(Model):
    world: Key
    anchor: Key


class Link(Model):
    source: Endpoint
    target: Endpoint


class Book(Model):
    title: Title
    start: Endpoint | None = None
    worlds: list[World] = Field(default_factory=list, max_length=128)
    links: list[Link] = Field(default_factory=list, max_length=1024)


class InvalidBook(ValueError):
    pass


def check_structure(book, assets):
    worlds = {}
    for world in book.worlds:
        if world.id in worlds:
            raise InvalidBook(f"Trùng mã thế giới {world.id}")
        if world.artwork and world.artwork not in assets:
            raise InvalidBook(f"Tranh chưa được tải lên cuốn sách này: {world.artwork}")
        if world.analysis and world.analysis.artwork and world.analysis.artwork != world.artwork:
            raise InvalidBook(f"Kết quả phân tích thuộc ảnh khác: {world.id}")
        if (world.template == "painted") != (world.recipe is not None):
            raise InvalidBook(f"Thế giới dựng từ tranh cần có hồ sơ cảnh hợp lệ: {world.id}")
        anchors = {a.id: a.kind for a in world.anchors}
        if len(anchors) != len(world.anchors):
            raise InvalidBook(f"Trùng điểm trong {world.id}")
        worlds[world.id] = anchors

    def check(point, kind):
        if worlds.get(point.world, {}).get(point.anchor) not in (kind, "both"):
            raise InvalidBook(f"Điểm {point.world}/{point.anchor} không hỗ trợ {kind}")

    if book.start:
        check(book.start, "entry")
    used = set()
    for link in book.links:
        check(link.source, "exit")
        check(link.target, "entry")
        key = (link.source.world, link.source.anchor)
        if key in used:
            raise InvalidBook(f"Lối ra đã có đích: {'/'.join(key)}")
        used.add(key)


def engine():
    mode = os.getenv("ATLAS_ENGINE", "rust" if GRAPH_BINARY.is_file() else "python")
    if mode not in ("rust", "python"):
        raise RuntimeError("ATLAS_ENGINE must be rust or python")
    return mode


def unreachable(book):
    ids = [w.id for w in book.worlds]
    indexes = {key: i for i, key in enumerate(ids)}
    start = indexes[book.start.world]
    edges = [(indexes[l.source.world], indexes[l.target.world]) for l in book.links]
    if engine() == "rust":
        payload = "\n".join(f"{a} {b}" for a, b in [(len(ids), start), *edges])
        result = subprocess.run([str(GRAPH_BINARY)], input=payload, capture_output=True,
                                text=True, check=True, timeout=3)
        return [ids[int(i)] for i in result.stdout.split()]
    neighbours = [[] for _ in ids]
    for a, b in edges:
        neighbours[a].append(b)
    seen, stack = set(), [start]
    while stack:
        node = stack.pop()
        if node not in seen:
            seen.add(node)
            stack.extend(neighbours[node])
    return [key for i, key in enumerate(ids) if i not in seen]
