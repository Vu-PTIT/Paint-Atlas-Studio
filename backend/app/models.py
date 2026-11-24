"""Shared constraints for artwork measurements and the original scene format."""

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

Unit = Annotated[float, Field(ge=0, le=1)]


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, allow_inf_nan=False)
