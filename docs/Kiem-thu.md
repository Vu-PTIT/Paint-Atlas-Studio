# Nghiệm thu Paint Atlas Studio

Môi trường kiểm thử dùng Linux, Python 3.12, Node.js 24 và Chromium headless 143.0.7499.0. Các ảnh PNG trong **tests/results/frames/** là khung hình dựng từ tệp HTML hoặc giao diện Studio. WebGPU và WebGL2 dùng trình điều khiển phần mềm SwiftShader. Số nét là số instance đã tạo, trước bước giảm mật độ theo khoảng cách.

## Cùng một tranh, hai cách dựng

| Cảnh | Nét cọ trên cấu hình desktop | Vật thể chọn sửa | Chi tiết đã đối chiếu |
|---|---:|---:|---|
| The Starry Ride | 475.774 | 32 | Hiệp sĩ cưỡi ngựa, làng, cối xay và đồng hướng dương dưới bầu trời xoáy. |
| Đêm bên sông Hoài | 239.096 | 16 | Phố, đèn lồng, cầu gỗ, ba thuyền thúng. Danh sách vật thể chỉ gồm nội dung của thế giới. |
| Người làm đèn | 245.186 | 17 | Cùng seed, bảng màu và hình học Hội An. Phần thêm là nhân vật có tóc đen, hoa cài tóc, áo dài đỏ và đèn. Nhân vật có ID, kích thước và thuộc tính màu riêng. |

Tranh chân dung tham chiếu được tạo riêng cho dự án. Tranh phong cảnh mẫu lấy từ một khung hình của The Starry Ride. Trong bản HTML của thế giới, các ngôi nhà, thuyền, khuôn mặt và trang phục đều được dựng bằng mã. Phố Hội An và nhân vật mẫu được viết trong phiên Codex phát triển sản phẩm.

## Kết quả trong trình duyệt và ở backend

| Bài thử | Kết quả |
|---|---|
| Tải tranh và cắt chủ thể | API nhận ảnh 795 × 1.060 px, nhận diện sáu màu và trả vùng cắt 397 × 636 px theo tọa độ chuẩn hóa. Tắt chủ thể loại phần mô tả chủ thể ra khỏi prompt. |
| Tạo thế giới từ giao diện | Trong wizard đã chọn tranh chân dung, khoanh vùng, duyệt phong cách, xem prompt và nhập module TypeScript có xưởng gốm cùng người thợ. Backend kiểm tra kiểu, đóng gói, chụp ảnh thật và xuất bản mới. |
| Sửa và tải lại Studio | Preview iframe chạy WebGPU. Dời xưởng gốm tới X = 3 m, tải lại trang và đọc lại đúng 3 m từ trình chỉnh sửa. Hai tab gửi cùng revision nhận phản hồi xung đột 409 cho lần ghi cũ. |
| Thử lại khi lỗi | Một module import sai bị từ chối. Thử lại dùng đúng revision ban đầu. Bản đã qua kiểm thử vẫn mở được. |
| Sửa và chuyển tệp | Dời nhà số 1 thêm 3 m, xoay 30°, phóng 1,2 lần, đổi cửa sổ sang #48c9ba và giảm độ sáng. Tốc độ nước đổi từ 1 lên 1,7, hoàn tác rồi làm lại. Bản xuất thứ nhất mở ở phiên khác đã ngắt mạng. Từ bản này sửa nước thành 2,4, xuất lần hai và kiểm lại trạng thái nhà lẫn sông. |
| Khởi tạo đồ họa và vật lý | Mở bằng WebGPURenderer ở cả WebGPU và WebGL2. Có ma trận riêng cho Rapier và lỗi nạp WASM. Sau khi dời từ X = −17,3 m lên −14,3 m, tọa độ X đọc từ collider Rapier là −14,30000019 m. |
| Điều khiển | Bài thử PC nhập WASD/Shift/Space, kéo và cuộn chuột, theo tuyến, nhảy và bật tour. Sau 55 giây mô phỏng, ngựa đã tự nhảy hai lần qua thân cây đổ, một lần qua hàng rào và một lần qua tường đá. Bài thử màn hình cảm ứng giả lập dùng sự kiện chạm của Chromium cho joystick, nhảy và chụm hai ngón. |
| Mật độ và độ phân giải | Bản màn hình cảm ứng giả lập rộng 412 px tạo 396.846 nét ở The Starry Ride. Trong phép thử chạy trực tiếp rộng 430 CSS px, DPR 1,5, canvas bắt đầu ở 645 px rồi giảm còn 564 px khi render chậm. |
| Codex trong kiểm thử | Đã thử giao thức JSONL với một tiến trình mô phỏng riêng. Đã thử lại hai nhánh phân tích và sinh cảnh qua HTTP với kết quả model mô phỏng và bộ build thực. Chế độ phong cách gửi một ảnh khi phân tích. Chế độ chủ thể gửi cả ảnh gốc và vùng cắt khi phân tích, rồi chỉ gửi vùng cắt và thông tin đã duyệt khi sinh mã. |
| Backend kế thừa | Bộ smoke test HTTP cho luồng sách/thế giới cũ chạy với CLI Rust. Cargo đã chạy các unit test của đồ thị. TypeScript và cả hai điểm build hoàn tất. |

## Ảnh và dữ liệu để đối chiếu

- **tests/results/frames/starry.png**, **tests/results/frames/hoian.png**, **tests/results/frames/portrait.png** là các góc mở đầu.
- **tests/results/frames/starry-editor.png**, **tests/results/frames/starry-tour-webgpu.png**, **tests/results/frames/starry-mobile.png** là ảnh sau khi sửa nhà, ảnh tour và ảnh cảm ứng giả lập.
- **tests/results/frames/portrait-front.png**, **tests/results/frames/portrait-side.png**, **tests/results/frames/portrait-back.png** là ba góc chụp cùng một chủ thể trong thế giới.
- **tests/results/portable-results.json**, **tests/results/studio-results.json**, **tests/results/adaptive.json** chứa kết quả đọc lúc chạy, gồm backend, engine vật lý, vị trí collider, số lần nhảy, trạng thái qua hai lần xuất và kích thước canvas.

## Kiểm tra sau khi tách thư mục

- Sau khi tách frontend và backend, cả 25 đường dẫn trong OpenAPI và kiểu TypeScript sinh từ schema khớp với bản trước. Ba cảnh HTML build lại có nội dung trùng với bản đã bàn giao.
- Đã mở một database từ bản trước có chỉnh sửa lưu ở cả cảnh mẫu lẫn một phiên bản do người dùng tạo. API mới đọc được đúng revision, màu cửa sổ, trạng thái nhúng trong HTML và ảnh xem trước của cả hai.
- Đã mở Vite dev, tải gallery và lưu bản nháp qua proxy tới FastAPI. Bộ kiểm tra tuyến Rust đã chạy qua `/health` và bài smoke test của API cũ với binary ở đường dẫn mới.

## Những phần còn cần xác nhận

- **Lượt model thật từ nút trong Studio.** CLI trong môi trường chạy thử nhận đăng nhập ChatGPT, nhưng tiến trình Codex App Server lồng bên trong không có quyền ghi hồ sơ và đóng kết nối. Đã kiểm tra riêng đường dùng cuộc trò chuyện Codex rồi nhập mã .ts vào Studio. Chất lượng và độ ổn định khi tự động đọc một tranh mới và sinh toàn bộ mã từ tài khoản trên máy cá nhân còn cần thử trực tiếp.
- **Thiết bị thật.** Chưa chạy các tệp .cmd trên Windows, chưa chạy Docker Compose, Safari/iOS và Android thật. FPS trung vị, thời gian khung hình phân vị 95 và mục tiêu 30 FPS trên điện thoại cần đo trên phần cứng.
- **Đánh giá nghệ thuật và khả dụng.** Có khung hình nhiều góc để so với chân dung. Độ giống từ ảnh đơn, phong cách ngoài hai biến thể sơn dầu, và mục tiêu 4/5 người tự sửa–xuất trong năm phút chưa được đánh giá với người dùng thật.
