"""Import an author-provided scene brief in the original format."""

import re
import unicodedata
from collections import defaultdict

from .scene import ArtBrief, ControlsBrief, ObjectMention, PhysicsBrief, RenderingBrief, SceneBrief


def folded(text):
    text = unicodedata.normalize("NFD", text.lower()).replace("đ", "d")
    return "".join(char for char in text if not unicodedata.combining(char))


HEADINGS = {
    "rendering": "rendering technique|rendering|ky thuat dung hinh|ky thuat render|dung hinh",
    "art": "visual style|art style|art direction|phong cach|phong cach hinh anh|my thuat",
    "world": "world|world elements|scene objects|the gioi|vat the|boi canh",
    "character": "protagonist & controls|protagonist and controls|protagonist|character|"
                 "nhan vat va dieu khien|nhan vat & dieu khien|nhan vat",
    "controls": "controls|dieu khien",
    "physics": "physics|physics engine|vat ly",
    "extras": "miscellaneous|other features|features|tinh nang khac|tinh nang",
    "verification": "verification|testing|kiem thu|xac minh",
}
SECTION = {title: key for key, aliases in HEADINGS.items() for title in aliases.split("|")}
BRACKETS = re.compile(r"【([^】\n]{1,120})】")
LIST_MARKER = re.compile(r"^(?:[-*+]\s+|\d+[.)]\s+)")
DEVICE = re.compile(r"^(?:\*{1,2}|_)?(pc|desktop|mobile|dien thoai|may tinh)(?:\*{1,2}|_)?\s*:")


def sections(prompt):
    groups = defaultdict(list)
    current = "other"
    # Bracket headings may start mid-line, as in the Night Ride brief.
    for line in BRACKETS.sub(r"\n【\1】\n", prompt).splitlines():
        line = LIST_MARKER.sub("", line.strip()).strip()
        if not line:
            continue
        title = folded(line.strip("#【】[]*_ :"))
        inline, sep, content = line.partition(":")
        prefix = folded(inline.strip("#*_ "))
        if title in SECTION:
            current = SECTION[title]
            continue
        if sep and content.strip() and prefix in SECTION:
            current = SECTION[prefix]
            line = content.strip().strip("*_ ")
        clean = folded(line)
        device = DEVICE.match(clean)
        if device:
            target = "desktop" if device[1] in {"pc", "desktop", "may tinh"} else "mobile"
        elif re.match(r"^(physics engine|physics|vat ly)\s*:", clean):
            target = "physics"
        elif re.match(r"^(once completed|after completion|sau khi hoan thanh)\b", clean):
            target = "verification"
        elif current in {"character", "controls"} and re.match(
            r"^(obstacles?|chuong ngai|jumping|auto-follow|di chuyen)\b", clean
        ):
            target = "movement"
        elif current == "controls":
            target = "movement"
        elif current == "other" and re.search(r"\bwebgl\s*2?\b|single html|glsl", clean):
            target = "rendering"
        else:
            target = current
        groups[target].append(line)
    return groups


OBJECTS = [
    ("sky", "Bầu trời", "sky", r"sk(?:y|ies)|bau troi"),
    ("moon", "Mặt trăng", "sky", r"moons?|mat trang|trang tron"),
    ("stars", "Sao", "sky", r"stars?|starbursts?|ngoi sao"),
    ("sunflower_field", "Cánh đồng hướng dương", "vegetation",
     r"sunflowers?(?: fields?)?|(?:canh dong )?hoa huong duong"),
    ("path", "Lối mòn", "terrain", r"(?:circular )?paths?|loi mon|duong mon"),
    ("windmill", "Cối xay gió", "structure", r"windmills?|coi xay gio"),
    ("cottage", "Nhà nhỏ", "structure", r"cottages?|nha nho|nha go"),
    ("village", "Làng", "structure", r"villages?|lang"),
    ("church_spire", "Tháp nhà thờ", "structure", r"church(?: spires?)?|(?:thap )?nha tho"),
    ("cypress", "Cây bách", "vegetation", r"cypress(?: trees?)?|cay bach"),
    ("wheat_field", "Ruộng lúa mì", "vegetation", r"wheat(?: fields?)?|(?:ruong )?lua mi"),
    ("road", "Đường", "terrain", r"roads?|duong di|con duong"),
    ("river", "Sông", "water", r"rivers?|song"),
    ("lake", "Hồ", "water", r"lakes?|ho nuoc|mat ho"),
    ("bridge", "Cầu", "structure", r"(?:stone )?bridges?|cay cau|cau da|cau go"),
    ("waterfall", "Thác nước", "water", r"waterfalls?|thac nuoc|thac"),
    ("rock_face", "Vách đá", "terrain", r"rock faces?|cliffs?|vach da"),
    ("mountains", "Dãy núi", "terrain", r"mountains?(?: ranges?)?|(?:day )?nui"),
    ("grass", "Cỏ", "vegetation", r"grass|bai co|tham co|co dai"),
    ("fence", "Hàng rào", "structure", r"fences?|hang rao"),
    ("stone_wall", "Tường đá", "structure", r"stone walls?|tuong da"),
    ("fallen_log", "Thân cây đổ", "prop", r"fallen logs?|(?:than )?cay do"),
    ("knight", "Hiệp sĩ", "character", r"knights?|hiep si"),
    ("horse", "Ngựa", "animal", r"horses?|ngua"),
    ("lantern", "Đèn lồng", "prop", r"lanterns?|den long"),
    ("cloak", "Áo choàng", "prop", r"cloaks?|ao choang"),
    ("hat", "Mũ", "prop", r"(?:wide[- ]brimmed )?hats?|mu rong vanh"),
    ("saddle", "Yên ngựa", "prop", r"saddles?|yen ngua"),
    ("reins", "Dây cương", "prop", r"reins?|day cuong"),
]
OBJECT_PATTERNS = [
    (kind, label, category, re.compile(r"\b(?:" + names + r")\b"))
    for kind, label, category, names in OBJECTS
]


def mentions(lines):
    matches = {}
    for line in lines:
        normalized = folded(line)
        for kind, label, category, pattern in OBJECT_PATTERNS:
            if pattern.search(normalized):
                if kind not in matches:
                    matches[kind] = ObjectMention(kind=kind, label=label, category=category, context=[line])
                elif line not in matches[kind].context:
                    matches[kind].context.append(line)
    return list(matches.values())


STYLES = {
    "oil_paint": r"\boil[- ]paint\w*\b|\bson dau\b",
    "watercolor": r"\bwatercolou?r\b|\bmau nuoc\b",
    "ink": r"\bink (?:wash|drawing)\b|\bthuy mac\b",
    "paper_cut": r"\bpaper[- ]cut\b|\bgiay cat\b|\bcat giay\b",
    "pixel_art": r"\bpixel art\b|\btranh pixel\b",
    "flat_illustration": r"\bflat illustration\b|\bminh hoa phang\b",
    "photographic": r"\bphotoreal(?:istic)?\b|\bnhu anh chup\b",
}


def compile_brief(prompt):
    parts = sections(prompt)
    render_rules = parts["rendering"]
    render = folded("\n".join(render_rules))
    art = folded("\n".join(render_rules + parts["art"] + parts["other"]))
    physics = folded("\n".join(parts["physics"]))
    extras = folded("\n".join(parts["extras"] + render_rules))
    mediums = [family for family, pattern in STYLES.items() if re.search(pattern, art)]
    impasto = "impasto" in art
    family = "unknown"
    if impasto and mediums in ([], ["oil_paint"]):
        family = "oil_impasto"
    elif len(mediums) == 1:
        family = mediums[0]

    prohibited = " ".join(
        m[1] for m in re.finditer(
            r"\b(?:do not use|must not use|no external|khong dung|khong su dung)\b([^.!?\n]*)",
            render,
        )
    )
    api = "webgl2" if re.search(r"\bwebgl\s*2\b", render) else "webgl" if "webgl" in render else None
    return SceneBrief(
        rendering=RenderingBrief(
            api=api,
            single_html=True if re.search(r"\bsingle html\b|\bmot (?:tep|file) html\b", render) else None,
            external_images_allowed=False if re.search(r"\bimages?\b|\banh\b", prohibited) else None,
            external_models_allowed=False if re.search(r"\b3d models?\b|\bmo hinh 3d\b", prohibited) else None,
            stroke_geometry="instanced_quad" if re.search(r"\binstanced quads?\b", render) else None,
            shader="glsl" if re.search(r"\bglsl\b", render) else None,
            impasto=True if impasto else None,
            requirements=render_rules,
        ),
        art=ArtBrief(family=family, requirements=parts["art"]),
        world=parts["world"],
        object_mentions=mentions(parts["art"] + parts["world"] + parts["character"] + parts["movement"] + parts["other"]),
        protagonist=parts["character"],
        controls=ControlsBrief(desktop=parts["desktop"], mobile=parts["mobile"], movement=parts["movement"]),
        physics=PhysicsBrief(
            engine="rapier" if "rapier" in physics else None,
            fallback="built_in" if re.search(r"\b(?:built[- ]in|tich hop|noi bo)\b", physics) else None,
            requirements=parts["physics"],
        ),
        panoramic_tour=True if re.search(r"\bpanoramic tour\b|\btham quan toan canh\b", extras) else None,
        adaptive_resolution=True if re.search(r"\bresolution automatically scales\b|\btu dong giam do phan giai\b", extras) else None,
        extras=parts["extras"],
        verification=parts["verification"],
        other=parts["other"],
    )
