"""Versioned data shared by the analysis API and the world manifest."""

from typing import Annotated, Literal, Self

from pydantic import Field, model_validator

from ..artwork import PixelProfile
from ..models import Model, Unit

Key = Annotated[str, Field(pattern=r"^[a-zA-Z0-9_-]{1,64}$")]
Title = Annotated[str, Field(min_length=1, max_length=120)]
Note = Annotated[str, Field(min_length=1, max_length=12000)]
Description = Annotated[str, Field(max_length=480)]
StyleFamily = Literal[
    "oil_impasto", "oil_paint", "watercolor", "ink", "paper_cut",
    "pixel_art", "flat_illustration", "photographic", "other", "unknown",
]
ObjectCategory = Literal[
    "sky", "terrain", "vegetation", "structure", "water",
    "character", "animal", "prop", "other",
]


class ImageBox(Model):
    x0: Unit
    y0: Unit
    x1: Unit
    y1: Unit

    @model_validator(mode="after")
    def positive_area(self) -> Self:
        if self.x1 <= self.x0 or self.y1 <= self.y0:
            raise ValueError("Khung 2D phải có chiều rộng và chiều cao dương")
        return self


class ObservedStyle(Model):
    family: StyleFamily
    description: Description
    confidence: Literal["low", "medium", "high"]


class ObservedObject(Model):
    label: Title
    category: ObjectCategory
    layer: Literal["foreground", "midground", "background", "unknown"]
    description: Description
    box: ImageBox | None


class ImageObservation(Model):
    style: ObservedStyle
    lighting: Description
    composition: Description
    objects: list[ObservedObject] = Field(max_length=24)


class Recognition(Model):
    provider: Literal["openai"] = "openai"
    model: str = Field(min_length=1, max_length=120)
    observation: ImageObservation


class RenderingBrief(Model):
    api: Literal["webgl2", "webgl"] | None = None
    single_html: bool | None = None
    external_images_allowed: bool | None = None
    external_models_allowed: bool | None = None
    stroke_geometry: Literal["instanced_quad"] | None = None
    shader: Literal["glsl"] | None = None
    impasto: bool | None = None
    requirements: list[Note] = Field(default_factory=list, max_length=256)


class ArtBrief(Model):
    family: StyleFamily
    requirements: list[Note] = Field(default_factory=list, max_length=256)


class ObjectMention(Model):
    kind: Key
    label: Title
    category: ObjectCategory
    context: list[Note] = Field(min_length=1, max_length=256)


class ControlsBrief(Model):
    desktop: list[Note] = Field(default_factory=list, max_length=256)
    mobile: list[Note] = Field(default_factory=list, max_length=256)
    movement: list[Note] = Field(default_factory=list, max_length=256)


class PhysicsBrief(Model):
    engine: Literal["rapier"] | None = None
    fallback: Literal["built_in"] | None = None
    requirements: list[Note] = Field(default_factory=list, max_length=256)


class SceneBrief(Model):
    rendering: RenderingBrief
    art: ArtBrief
    world: list[Note] = Field(default_factory=list, max_length=256)
    object_mentions: list[ObjectMention] = Field(default_factory=list, max_length=128)
    protagonist: list[Note] = Field(default_factory=list, max_length=256)
    controls: ControlsBrief
    physics: PhysicsBrief
    panoramic_tour: bool | None = None
    adaptive_resolution: bool | None = None
    extras: list[Note] = Field(default_factory=list, max_length=256)
    verification: list[Note] = Field(default_factory=list, max_length=256)
    other: list[Note] = Field(default_factory=list, max_length=256)


class SceneAnalysis(Model):
    schema_version: Literal[1] = 1
    artwork: Key | None = None
    pixels: PixelProfile | None = None
    recognition: Recognition | None = None
    brief: SceneBrief | None = None

    @model_validator(mode="after")
    def consistent_sources(self) -> Self:
        if (self.artwork is None) != (self.pixels is None):
            raise ValueError("Dữ liệu đo từ ảnh phải đi cùng mã ảnh")
        if self.recognition and not self.artwork:
            raise ValueError("Kết quả nhận dạng phải đi cùng mã ảnh")
        if not self.artwork and not self.brief:
            raise ValueError("Cần tranh hoặc prompt")
        return self


class AnalyzeInput(Model):
    artwork: Key | None = None
    prompt: Annotated[str, Field(max_length=12000)] = ""
    vision: bool = False

    @model_validator(mode="after")
    def validate_sources(self) -> Self:
        if not self.artwork and not self.prompt:
            raise ValueError("Chọn một bức tranh hoặc nhập prompt")
        if self.vision and not self.artwork:
            raise ValueError("Cần tải tranh trước khi nhận dạng ảnh")
        if len(self.prompt.splitlines()) > 240:
            raise ValueError("Prompt hỗ trợ tối đa 240 dòng")
        return self
