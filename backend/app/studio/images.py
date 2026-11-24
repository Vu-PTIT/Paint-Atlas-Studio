"""Normalize uploads and crop the region selected in the Studio."""

from io import BytesIO

from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError

from .models import Crop


def normalize_image(raw: bytes) -> bytes:
    try:
        with Image.open(BytesIO(raw)) as image:
            if image.format not in {"WEBP", "PNG", "JPEG"} or image.width * image.height > 12_000_000:
                raise ValueError()
            image = ImageOps.exif_transpose(image).convert("RGBA")
            image.thumbnail((1600, 1600))
            output = BytesIO()
            image.save(output, format="PNG")
            return output.getvalue()
    except (ValueError, OSError, UnidentifiedImageError, Image.DecompressionBombError) as exc:
        raise HTTPException(415, "Dùng ảnh JPEG, PNG hoặc WebP từ 12 megapixel trở xuống.") from exc


def crop_subject(raw: bytes, crop: Crop) -> bytes:
    with Image.open(BytesIO(raw)) as image:
        width, height = image.size
        left, top = round(width * crop.x), round(height * crop.y)
        right = min(width, max(left + 1, round(width * (crop.x + crop.w))))
        bottom = min(height, max(top + 1, round(height * (crop.y + crop.h))))
        output = BytesIO()
        image.crop((left, top, right, bottom)).save(output, format="PNG")
        return output.getvalue()
