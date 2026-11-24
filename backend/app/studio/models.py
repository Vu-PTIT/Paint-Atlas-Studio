from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

Color = Annotated[str,Field(pattern=r"^#[0-9a-fA-F]{6}$")]
Key = Annotated[str,Field(pattern=r"^[A-Za-z0-9_-]{1,80}$")]
Unit = Annotated[float,Field(ge=0,le=1,allow_inf_nan=False)]
Coord = Annotated[float,Field(ge=-5000,le=5000,allow_inf_nan=False)]
class Model(BaseModel):
    model_config=ConfigDict(extra="forbid", allow_inf_nan=False)

class Crop(Model):
    x: Unit=0
    y: Unit=0
    w: Unit=1
    h: Unit=1
    @model_validator(mode="after")
    def inside(self):
        if min(self.w,self.h)<.015 or self.x+self.w>1.00001 or self.y+self.h>1.00001:
            raise ValueError("Vùng chủ thể phải nằm trong ảnh và rộng ít nhất 1,5%.")
        return self

class Draft(Model):
    title: str=Field(min_length=1,max_length=96)
    artwork: Key|None=None
    mode: Literal["style","subject"]="style"
    crop: Crop=Field(default_factory=Crop)
    palette: list[Color]=Field(min_length=1,max_length=8)
    style: str=Field(default="",max_length=5000)
    world: str=Field(default="",max_length=9000)
    subject_notes: str=Field(default="",max_length=3000)
    subject_role: str=Field(default="",max_length=1500)
    technique: Literal["impasto","reference"]="impasto"
    controls: str=Field(default="WASD, cảm ứng, nhảy, camera xoay và tour.",max_length=2500)
    seed: int=Field(default=6207,ge=0,le=2**31-1)

class SaveDraft(Model):
    revision:int=Field(ge=0)
    draft:Draft
class JobRequest(Model):
    project:Key
    revision:int=Field(ge=0)
    action:Literal["analyze","generate","import","sample"]
    source:str=Field(default="",max_length=600000)
    sample:Literal["starry","hoian"]="hoian"
class ObjectState(Model):
    position:tuple[Coord,Coord,Coord]
    yaw:float=Field(ge=-36000,le=36000)
    scale:float=Field(ge=.05,le=30)
    values:dict[str,float|str]=Field(max_length=80)
class SaveState(Model):
    revision:int=Field(ge=0)
    state:dict[str,ObjectState]=Field(max_length=1201)

class AnalysisResult(Model):
    style:str=Field(min_length=2,max_length=5000)
    palette:list[Color]=Field(min_length=1,max_length=8)
    subject_notes:str=Field(max_length=3000)
