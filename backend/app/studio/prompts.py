"""Compose the scene brief used by manual export and Codex generation."""

from ..config import SHARED_DIR
from .models import Draft


def redact_notes(draft: Draft) -> Draft:
    if draft.mode == "style":
        return draft.model_copy(update={"subject_notes": "", "subject_role": ""})
    return draft


def prompt_for(draft: Draft) -> str:
    technique = (
        "Dùng instanced quad và TSL cho sơn dầu impasto. Nét gắn theo bề mặt, số rãnh lông cọ cố định, có LOD và chuyển mờ."
        if draft.technique == "impasto"
        else "Chọn vật liệu TSL và nét vẽ theo phong cách đã duyệt. Giữ kết quả đồng nhất ở nhiều góc."
    )
    blocks = [
        ("Rendering Technique", technique),
        ("Visual Style", draft.style + "\nBảng màu " + " · ".join(draft.palette)),
    ]
    if draft.mode == "subject":
        subject = (
            draft.subject_notes + "\nVai trò và vị trí: " + draft.subject_role
            + "\nDựng bằng hình khối 3D, ưu tiên góc tham chiếu."
        )
        blocks.append(("Subject Reference", subject))
    blocks.extend([
        ("World", draft.world),
        ("Protagonist & Controls", draft.controls),
        ("Miscellaneous", "Chế độ tham quan toàn cảnh, cảm ứng và điều chỉnh độ phân giải theo tốc độ khung hình."),
        ("Editable World", "Mỗi vật thể chỉnh được có ID và trường thuộc tính. Khai báo ô màu riêng cho từng màu chính của trời, nước và kiến trúc khi chúng xuất hiện trong cảnh. Xuất một HTML ngoại tuyến. Dựng hình và chất liệu bằng mã."),
    ])
    return "\n\n".join(f"【{title}】\n{content.strip()}" for title, content in blocks)


def author_prompt(draft: Draft) -> str:
    guide = (SHARED_DIR / "scene-authoring.md").read_text(encoding="utf-8")
    output = "Hãy trả toàn bộ mã TypeScript của thế giới theo đặc tả trên, khi nhập thủ công dùng tệp scene.ts."
    return "\n\n".join((prompt_for(draft), guide, output))
