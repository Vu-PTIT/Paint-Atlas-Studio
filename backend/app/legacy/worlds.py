"""Validate a world plan and compile it to a portable WebGL2 player."""

from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal, Self

from pydantic import Field, model_validator

from ..config import LEGACY_FRONTEND_DIR
from ..models import Model
from .scene import Description, ImageObservation, Title

RUNTIME = LEGACY_FRONTEND_DIR / "runtime"
Paint = Annotated[str, Field(pattern=r"^#[0-9a-fA-F]{6}$")]
PaintPair = tuple[Paint, Paint]
ObjectKind = Literal["cottage", "windmill", "chapel", "cypress", "sunflowers", "wheat", "lantern"]


class Palette(Model):
    sky: PaintPair
    land: PaintPair
    water: PaintPair
    path: PaintPair
    walls: PaintPair
    roof: PaintPair
    foliage: PaintPair
    light: PaintPair


class Sky(Model):
    moon: bool = True
    stars: bool = True
    swirls: bool = True


class Placement(Model):
    kind: ObjectKind
    x: float = Field(ge=-57, le=52)
    z: float = Field(ge=-74, le=24)
    scale: float = Field(default=1, ge=0.65, le=1.35)

    @model_validator(mode="after")
    def fixed_size_models(self) -> Self:
        if self.kind in {"chapel", "lantern"} and self.scale != 1:
            raise ValueError(f"{self.kind} dùng kích thước cố định, scale phải là 1")
        return self


class WorldPlan(Model):
    version: Literal[1]
    title: Title
    style: Literal["oil_impasto"]
    seed: int = Field(default=0, ge=0, le=2**32 - 1)
    terrain: Literal["river_valley", "meadow"]
    sky: Sky = Field(default_factory=Sky)
    mountains: bool = True
    waterfall: bool = False
    obstacles: bool = False
    palette: Palette
    objects: list[Placement] = Field(max_length=32)
    observation: ImageObservation | None = None
    design_notes: list[Description] = Field(default_factory=list, max_length=12)

    @model_validator(mode="after")
    def compatible_landmarks(self) -> Self:
        if self.waterfall and self.terrain != "river_valley":
            raise ValueError("Thác nước cần địa hình river_valley")
        for kind, available in (("chapel", 1), ("windmill", 4), ("sunflowers", 4), ("wheat", 4)):
            if sum(item.kind == kind for item in self.objects) > available:
                raise ValueError(f"Cảnh hỗ trợ tối đa {available} vật thể loại {kind}")
        if sum(item.kind == "cottage" for item in self.objects) > 14:
            raise ValueError("Cảnh hỗ trợ tối đa 14 căn nhà")
        return self


@lru_cache(maxsize=1)
def player_template():
    shell = (RUNTIME / "shell.html").read_text(encoding="utf-8")
    parts = ("renderer", "settings", "valley", "landscape", "heavens", "rider", "play")
    program = "\n".join((RUNTIME / f"{name}.js").read_text(encoding="utf-8") for name in parts)
    vendor = (RUNTIME / "rapier.cjs").read_text(encoding="utf-8").split("//# sourceMappingURL=")[0]
    license_text = (RUNTIME / "rapier-license.txt").read_text(encoding="utf-8")
    scripts = (
        f"<!-- Rapier 3D, copyright Dimforge contributors.\n{license_text}\n-->\n"
        "<script>\n(() => {\nconst exports = {};\n"
        f"{vendor}\nwindow.__rideRapier = exports;\n}})();\n</script>\n"
        "<script>\n(() => {\n'use strict';\n"
        f"const worldPlan = /* WORLD_PLAN */;\n{program}\n}})();\n</script>"
    )
    return shell.replace("<!-- APPLICATION -->", scripts)


def compile_world(plan: WorldPlan) -> str:
    # Escaping '<' keeps even an HTML-like title inside the JSON string.
    payload = plan.model_dump_json(exclude={"observation", "design_notes"}).replace("<", "\\u003c")
    return player_template().replace("/* WORLD_PLAN */", payload, 1)


if __name__ == "__main__":
    from argparse import ArgumentParser

    parser = ArgumentParser(description="Dựng một thế giới Paint Atlas từ JSON.")
    parser.add_argument("plan", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    plan = WorldPlan.model_validate_json(args.plan.read_bytes())
    args.output.write_text(compile_world(plan), encoding="utf-8")
    print(f"Đã dựng {plan.title} → {args.output}")
