# Paint Atlas Studio

Paint Atlas biến tranh tham chiếu và mô tả của bạn thành một thế giới 3D có thể chơi và chỉnh trong trình duyệt. Màu sắc và nét cọ đến từ tranh. Bạn quyết định trong cảnh có nhà, cầu, thuyền hay nhân vật nào. Khi bật **Dựng thêm chủ thể**, bạn còn có thể khoanh vùng người hoặc vật trong tranh để Codex dựng lại bằng hình khối 3D. Những mặt khuất được diễn giải từ ảnh đơn.

## Mở ngay một thế giới

Mở **examples/worlds/portrait.html** trong Chrome hoặc Edge trên máy tính. Bạn sẽ thấy người làm đèn áo dài đỏ ở đầu cầu Hội An. Bấm **Chỉnh sửa → Người làm đèn**, đổi **Màu áo dài** hoặc **Vị trí X**, rồi bấm **Xuất HTML**. Mở tệp vừa tải để chơi hoặc sửa tiếp. Mỗi tệp đã chứa editor, thế giới và vật lý. Hai cảnh còn lại là **examples/worlds/hoian.html** và **examples/worlds/starry.html**. Những tệp HTML này chạy được khi ngắt mạng.

## Mở toàn bộ xưởng trên Windows

1. Giải nén toàn bộ ZIP vào một thư mục. Cài Python 3.12 kèm Python Launcher (lệnh `py -3.12`).
2. Nhấp **Mo-Studio.cmd**. Lần đầu chương trình tạo môi trường Python và cài thư viện qua mạng. Trình duyệt mở tại **http://127.0.0.1:8000**. Có thể mở và sửa cả ba cảnh đi kèm ngay.
3. Để **dựng thêm thế giới**, cài Node.js 24 LTS rồi chạy **Cai-bo-dung.cmd** một lần. Lệnh này cài các gói đã khóa và Chromium dành cho bước kiểm tra bản dựng. Để chạy lại xưởng, dùng **Mo-Studio.cmd**.

Linux/macOS, từ thư mục dự án, dùng Python 3.12 và Node.js 24.

```sh
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.lock
npm --prefix frontend ci
python -m playwright install chromium
python run_studio.py --open
```

Trên Linux tối giản, `python -m playwright install --with-deps chromium` cài cả các thư viện hệ thống cho Chromium. Đổi cổng bằng `python run_studio.py --port 8010`. Mỗi thư mục dữ liệu dùng một tiến trình Studio. Dự án lưu trong **data/**. Khi sao lưu, dừng Studio rồi chép cả thư mục này.

## Tạo cảnh bằng Codex hiện tại

1. Bấm **Tạo thế giới**. Đặt tên, tải tranh hoặc dùng tranh mẫu. **Chỉ lấy phong cách** dành cho màu sắc, ánh sáng và cách đi nét. **Dựng thêm chủ thể** cho phép kéo chọn một vùng trên tranh.
2. Ở **Phong cách vẽ**, duyệt bảng màu và đoạn mô tả. Pillow đo màu ngay khi tải ảnh. Nếu đang dùng Codex trên máy, bấm **Đọc phong cách bằng Codex**. Với cuộc trò chuyện hiện tại, bấm **Lấy prompt để đọc tranh trong ChatGPT**, gửi prompt cùng tranh, rồi điền kết quả vào Studio.
3. Ở **Mô tả thế giới**, nhập địa điểm, vật thể và cách chơi bạn muốn. Nếu có chủ thể, mô tả vị trí và vai trò. Bấm **Xem prompt** để kiểm tra.
4. Trong **Cách dựng**, chọn một trong các cách dưới đây. Khi bản dựng xong, Studio kiểm tra TypeScript, mở tệp HTML ngoại tuyến, chụp ảnh thật rồi mới thêm phiên bản vào dự án.

| Cách dựng | Cách dùng |
|---|---|
| Nhập mã .ts từ cuộc trò chuyện Codex | Bấm **Prompt cho Codex**, sao chép cả hướng dẫn và gửi cho Codex. Với chủ thể đã chọn, đính kèm **Tải vùng đã chọn**. Dán mã TypeScript trả về hoặc chọn tệp .ts rồi bấm **Dựng từ mã**. Vật thể mới như thuyền thúng có thể được viết thẳng bằng mã. |
| Codex trên máy | Cài Codex CLI, chạy `codex login`, chọn đăng nhập bằng ChatGPT và kiểm tra `codex login status`. Mở lại xưởng sau khi cài CLI. Studio gọi `codex app-server` qua stdin/stdout. Đọc tranh và sinh cảnh cần mạng. Trạng thái “Đã cài trên máy” chỉ xác nhận tìm thấy CLI. |
| Dùng bố cục có sẵn | Thử trình dựng và editor bằng một bố cục cố định. Hội An nhận bảng màu mới và có nhân vật mẫu khi bật chủ thể. The Starry Ride giữ màu và hình học của tác phẩm mẫu. |

Theo dõi tiến độ trong **Lượt dựng** sau khi tải lại trang. Nếu một lượt thất bại, có thể thử lại với cùng đầu vào. Từ **Thế giới của tôi**, dùng biểu tượng bút để sửa bản nháp trước khi dựng phiên bản khác. Mỗi phiên bản giữ riêng trạng thái chỉnh sửa.

## Chơi và chỉnh

| Tác vụ | Thao tác |
|---|---|
| Di chuyển | WASD hoặc mũi tên, Shift chạy nhanh, Space nhảy. Trên màn hình cảm ứng dùng cần trái và nút Nhảy. Nhập hướng di chuyển để rời tuyến tự động. |
| Góc nhìn | Kéo để xoay, lăn chuột hoặc chụm hai ngón để zoom. **Toàn cảnh** chạy tour. **Theo tuyến / Tự do** bật tắt tự di chuyển và tự nhảy. |
| Sửa cảnh | Chọn từ danh sách hoặc bấm vật thể. Dùng tay nắm hoặc nhập X/Y/Z, góc xoay quanh trục đứng và tỷ lệ đồng nhất. Phím G/R/S đổi công cụ, F đưa vật vào tâm nhìn. |
| Thuộc tính | Mỗi vật khai báo trường riêng như màu cửa sổ, cường độ đèn, tốc độ nước, màu nan thuyền, màu áo. Có hoàn tác và làm lại. |
| Bảng màu cảnh | Trong **Chỉnh sửa → Bảng màu cảnh**, chọn **Trời**, **Nước** hoặc **Kiến trúc** rồi chỉnh từng ô màu. Ví dụ ở Hội An, nền trời, nét mây, vệt sáng và trăng có ô riêng. **Khôi phục màu gốc** đặt lại các màu của khu vực đang xem. |
| Lưu | Trong xưởng, chờ **Đã lưu**. Trong HTML đứng riêng, bấm **Xuất HTML** để lấy tệp có thay đổi. |

## Cấu trúc mã nguồn

| Thư mục | Đặt mã gì ở đây |
|---|---|
| `backend/app/` | FastAPI, cấu hình đường dẫn và kết nối SQLite. `main.py` là điểm vào ASGI. |
| `backend/app/studio/` | `routes.py` nhận yêu cầu. `images.py` xử lý ảnh, `prompts.py` ghép prompt, `jobs.py` chạy các lượt dựng, `storage.py` lưu phiên bản. |
| `backend/app/integrations/` | Kết nối Codex App Server và Chromium headless. |
| `backend/rust/atlas-graph/` | CLI Rust kiểm tra tuyến đi giữa các thế giới. Rust ở trình chơi được đóng gói riêng trong Rapier WASM. |
| `frontend/studio/src/` | React Studio. `pages/` chứa các màn hình, `api/` gửi yêu cầu và chứa kiểu dữ liệu, `styles/` chứa CSS. |
| `frontend/player/src/` | Mã TypeScript/JavaScript chạy trong HTML đứng riêng. `core/` dựng cảnh và điều khiển, `editor/` chứa giao diện sửa vật thể, `rendering/` chứa shader/nét cọ, `physics/` chứa mô phỏng, `actors/` chứa người cưỡi và ngựa, `scenes/` chứa các thế giới mẫu. |
| `frontend/tools/` và `frontend/dist/` | Công cụ đóng gói cảnh và bản build Vite của Studio. ZIP đi kèm bản build sẵn. |
| `backend/app/legacy/` và `frontend/legacy/` | API và trình chơi tương thích với định dạng sách/cảnh của Paint Atlas đời đầu. Mở giao diện tại `/legacy`. |
| `shared/` | Hợp đồng OpenAPI của backend với frontend và hướng dẫn viết module cảnh cho Codex. |
| `assets/reference/` | Tranh tham chiếu mẫu dùng ở bước nhập tranh. |
| `examples/` | HTML chơi trực tiếp trong `worlds/`, danh sách vật thể trong `manifests/`, ảnh gallery trong `previews/`. `legacy/` chứa dữ liệu mẫu của API cũ. |
| `tools/`, `tests/`, `docs/` | Lệnh cập nhật schema và ảnh mẫu, bài kiểm thử và kết quả, tài liệu thiết kế và hướng dẫn. |
| `data/` | SQLite, ảnh người dùng và cảnh đã tạo. Studio tạo thư mục này ở lần chạy đầu. |

Các lệnh dưới đây chạy từ thư mục chứa README. Để phát triển giao diện, mở API bằng `python run_studio.py` ở một terminal. Ở terminal khác, chạy `npm --prefix frontend run dev` rồi mở địa chỉ Vite in ra. Vite gửi các yêu cầu API về cổng 8000.

```sh
# Build Studio và xuất lại ba cảnh HTML mẫu
npm --prefix frontend run build

# Cập nhật schema và kiểu frontend sau khi sửa API
python -m tools.export_openapi
npm --prefix frontend run types:api

# Chụp ảnh và cập nhật gallery sau khi sửa cảnh mẫu
python -m tools.render_samples

# Biên dịch bộ kiểm tra tuyến Rust
cargo build --release --locked --offline --manifest-path backend/rust/atlas-graph/Cargo.toml
```

Bộ kiểm tra tuyến dùng Python khi chưa có binary Rust. Để buộc dùng một bản cụ thể, đặt `ATLAS_ENGINE=rust` hoặc `ATLAS_ENGINE=python` trước khi chạy. Bạn có thể sao chép `data/` từ bản Studio trước sang bản này khi server đã dừng. Các dự án và chỉnh sửa đã lưu sẽ mở từ cùng cơ sở dữ liệu.

`docker compose up --build` dựng backend, frontend và công cụ build trong container. Bản chạy local dùng tài khoản Codex CLI trên máy. [Codex CLI](https://developers.openai.com/codex/cli/) · [Đăng nhập](https://developers.openai.com/codex/auth/) · [App Server](https://developers.openai.com/codex/app-server/)

## Chạy lại kiểm thử

```sh
npm --prefix frontend run typecheck
python tests/backend/check_codex.py
python tests/integration/check_studio.py
python tests/browser/check_portable.py
cargo test --locked --offline --manifest-path backend/rust/atlas-graph/Cargo.toml
```

Bài thử dùng dữ liệu tạm và Chromium headless, lưu kết quả trong `tests/results/`. Có thể đổi thư mục kết quả bằng `ATLAS_TEST_OUT` và chọn Chromium bằng `ATLAS_CHROMIUM`. [Báo cáo kiểm thử](docs/Kiem-thu.md)
