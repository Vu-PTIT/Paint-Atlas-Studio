# Paint Atlas · Backend thử nghiệm
## Chạy với Docker Desktop
Mở terminal trong thư mục chứa compose.yaml và chạy `docker compose up --build`.
Mở http://localhost:8000/legacy để dùng bàn thử tiếng Việt. /health kiểm tra SQLite và trình kiểm tra tuyến, /docs có Swagger, /openapi.json mô tả API cho frontend.
Docker biên dịch Rust trong bước build. Dữ liệu SQLite nằm trong volume atlas-data, giữ lại khi dừng bằng `docker compose down`.

## Dựng thế giới với ChatGPT

Gửi ảnh tranh và [WORLD-GUIDE.md](WORLD-GUIDE.md) trong chat. ChatGPT dùng cấu trúc của `examples/legacy/river-moon.json` để ghi quan sát, bố trí vật thể, chọn địa hình và đặt màu cho từng chất liệu. Nhập tệp JSON nhận được vào **Dựng thế giới từ tranh**. Chọn **Dựng cảnh**, sau đó **Mở cảnh vừa dựng** hoặc tải HTML để chơi ngoại tuyến. Luồng nhập tệp chạy độc lập với chế độ nhận dạng bằng API.

**Thêm vào bản nháp** lưu cảnh vào sách. Sau khi xuất bản, mở cảnh từ liên kết **Chơi [tên thế giới]**. Với sách nhiều cảnh, đặt liên kết bằng phần **Bản nháp** trước khi xuất bản.

Có thể dựng mẫu từ terminal trong thư mục gốc của dự án bằng `python -m backend.app.legacy.worlds examples/legacy/river-moon.json Ben-Song-Duoi-Trang.html`. Trình dựng bản đầu dùng nét cọ sơn dầu, địa hình đồng cỏ hoặc thung lũng sông, và nhóm vật thể mô tả trong hướng dẫn. Tệp HTML gồm cả WebGL2 và Rapier.

## Thử trong trình duyệt
1. Chọn **Tạo sách mẫu hai thế giới**. Mỗi lần tạo sinh một sách và khóa mới. Bàn thử giữ quyền sửa sách gần nhất trong sessionStorage của tab. Muốn quản lý lâu dài, tạo sách qua API và giữ edit_token trả về.
2. Chọn thế giới, chọn tệp PNG/JPEG/WebP và gắn tranh. Có thể chỉnh tên, điểm vào/ra, vị trí [x,y,z] và yaw (radian) trong JSON. Bấm **Lưu bản nháp**.
3. Chọn **Xuất bản bản đã lưu** rồi **Thử lối ra đầu tiên**. Kết quả chứa thế giới đích và tọa độ cho renderer. Link /play là dữ liệu JSON đọc công khai cho frontend trên cùng máy chủ. Khi chạy localhost, người khác không truy cập được từ máy của họ.
4. Thử xóa links, lưu và xuất bản lại. API trả 422 cùng danh sách thế giới không đi tới được. Phiên bản xuất bản thành công trước đó vẫn mở được.

## Chạy trực tiếp
Cài Python 3.11+ cùng Rust/Cargo, rồi chạy từ thư mục gốc của dự án.
```
python -m pip install -r backend/requirements.lock
cargo build --release --manifest-path backend/rust/atlas-graph/Cargo.toml
python run_studio.py
```
Nếu bỏ bước Cargo, server tự dùng trình kiểm tra tuyến bằng Python. `/health` trả engine thực tế. Khi đặt `ATLAS_ENGINE=rust`, lỗi thực thi binary trả mã 503.

## Phân tích tranh và prompt

1. Tạo sách mẫu rồi chọn thế giới trong **Bản nháp**. Để đo màu từ ảnh, tải ảnh lên bằng **Gắn tranh vào bản nháp**.
2. Mở **Phân tích tranh và prompt**. Dán mô tả hoặc bấm **Dùng prompt The Night Ride**. Có thể phân tích ảnh, prompt hoặc cả hai.
3. Bấm **Phân tích đầu vào**. Xem bảng màu, phong cách, vật thể và JSON chi tiết. Bấm **Gắn kết quả vào bản nháp** rồi **Lưu bản nháp** để áp dụng. Khi xuất bản, kết quả đã gắn xuất hiện trong `worlds[].analysis`.

| Trường kết quả | Nguồn và ý nghĩa |
|---|---|
| `pixels` | Kích thước ảnh chuẩn hóa, tối đa sáu màu đại diện và tỷ lệ mẫu, độ sáng và độ bão hòa trung bình. |
| `recognition` | Phong cách ước tính từ ảnh, bố cục, ánh sáng, vật thể quan sát được và khung 2D nếu có. Mỗi khung dùng tọa độ tỷ lệ 0 đến 1 từ góc trên trái. |
| `brief` | Yêu cầu của tác giả sau khi đọc prompt. Tách phong cách, thông số WebGL2, vật thể được nhắc tới, điều khiển, vật lý, tham quan, độ phân giải và kiểm thử. Giữ lại mô tả gốc trong từng nhóm. |

Bộ đọc prompt chạy tại máy, nhận tiêu đề Anh/Việt và gắn mã cho các vật thể có trong danh mục. Vật thể ngoài danh mục vẫn xuất hiện trong mô tả gốc của tác giả. Các khoảng nhìn và khung từ ảnh là gợi ý 2D để duyệt trong trình dựng. Tọa độ 3D và các tuyến nối vẫn thuộc cấu hình của thế giới.

Để nhận dạng phong cách và vật thể trực tiếp từ ảnh, cấu hình `OPENAI_API_KEY` trên máy chạy backend. Với Docker Compose, khai báo biến trong môi trường hoặc tệp `.env` cạnh `compose.yaml`, rồi khởi động lại dịch vụ bằng `docker compose up -d`. Có thể đặt `ATLAS_VISION_MODEL` nếu dùng model khác hỗ trợ ảnh và Structured Outputs. Mặc định dùng `gpt-4.1-mini`. [Tài liệu model](https://developers.openai.com/api/docs/models/gpt-4.1-mini)

Tích **Nhận dạng ảnh qua OpenAI** cho lượt phân tích muốn gửi ảnh. Lượt gọi chỉ gửi bản ảnh đã thu nhỏ và chỉ dẫn phân tích ảnh, với `store: false`. Kết quả `recognition: null` là lượt không chạy nhận dạng ảnh. Nếu đã yêu cầu nhận dạng nhưng thiếu khóa, API trả 503. Khi cần, bỏ tích để dùng phân tích cục bộ.

## API
Mọi thao tác với bản nháp và ảnh gốc dùng header `Authorization: Bearer <edit_token>`. Chỉ trả khóa tại thời điểm tạo sách.
| Phương thức | Đường dẫn | Dữ liệu |
|---|---|---|
| POST | /books | {"title":"Tên sách"} → id, edit_token, revision, book |
| GET | /books/{id} | Nội dung bản nháp và revision |
| POST | /books/{id}/images | Body là byte ảnh, tối đa 6 MiB và 12 MP. Trả artwork ID. Ảnh lưu ở dạng PNG, cạnh dài tối đa 1600 px. |
| POST | /books/{id}/analyze | {"artwork":"mã ảnh","prompt":"mô tả","vision":false}. Cần ảnh hoặc prompt. Trả kết quả phân tích, dùng PUT để gắn kết quả vào thế giới. |
| GET | /worlds/schema.json | Schema JSON cho tệp mô tả thế giới. |
| POST | /worlds/render | Nhận tệp mô tả và trả một tệp HTML có thể mở để chơi. |
| PUT | /books/{id} | {"revision":n,"book":{...}}. Ghi toàn bộ bản nháp trong một transaction. 409 nếu revision cũ. |
| POST | /books/{id}/publish | {"revision":n}. Kiểm tra mọi thế giới đi tới được từ start và xuất bản snapshot. |
| GET | /play/{id} | Snapshot và URL ảnh của phiên bản đang xuất bản |
| GET | /play/{id}/travel/{world}/{exit_id} | World, template, điểm đến, tọa độ, góc quay và revision |
| GET | /play/{id}/images/{artwork} | Ảnh đang dùng trong bản xuất bản |
| GET | /play/{id}/worlds/{world_id}/view | Cảnh chơi WebGL2 của thế giới dựng từ JSON đã xuất bản. |

Mỗi liên kết có chiều từ source sang target. Muốn quay lại, thêm tuyến ngược và dùng điểm hỗ trợ đúng chiều (entry, exit hoặc both). Có thể tạo nhánh qua các lối ra riêng và tạo chu trình. Paint Atlas lưu tranh, tệp mô tả cảnh và tuyến nối. Trình chơi hiện mở từng cảnh qua liên kết `views` của bản xuất bản.
## Kiểm tra
Khởi động API rồi chạy `python tests/backend/smoke_legacy.py` từ terminal khác. Script kiểm tra phân tích cục bộ bằng prompt The Night Ride, lưu kết quả và đi qua tuyến nối đã xuất bản. Để chạy test Rust riêng, dùng `cargo test --manifest-path backend/rust/atlas-graph/Cargo.toml`.
