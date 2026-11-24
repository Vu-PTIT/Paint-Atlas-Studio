"""Extract dimensions and a representative palette from the uploaded artwork."""

import io
from typing import Annotated

from PIL import Image, ImageStat
from pydantic import Field

from .models import Model, Unit


class ColorSample(Model):
    hex: Annotated[str, Field(pattern=r"^#[0-9A-F]{6}$")]
    share: Unit


class PixelProfile(Model):
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    palette: list[ColorSample] = Field(min_length=1, max_length=8)
    brightness: Unit
    saturation: Unit


def measure_pixels(png):
    with Image.open(io.BytesIO(png)) as image:
        width, height = image.size
        sample = image.convert("RGBA")
        sample.thumbnail((144, 144))
        pixels = [(r, g, b) for r, g, b, alpha in sample.getdata() if alpha >= 32]
    if not pixels:
        raise ValueError("Ảnh hoàn toàn trong suốt")

    colors = Image.new("RGB", (len(pixels), 1))
    colors.putdata(pixels)
    bins = colors.quantize(colors=6, method=Image.Quantize.MEDIANCUT)
    rgb = bins.getpalette()
    palette = [
        ColorSample(hex="#{:02X}{:02X}{:02X}".format(*rgb[i * 3:i * 3 + 3]),
                    share=round(count / len(pixels), 4))
        for count, i in sorted(bins.getcolors(), reverse=True)
    ]
    brightness = ImageStat.Stat(colors.convert("L")).mean[0] / 255
    saturation = ImageStat.Stat(colors.convert("HSV")).mean[1] / 255
    return PixelProfile(width=width, height=height, palette=palette,
                        brightness=round(brightness, 4), saturation=round(saturation, 4))
