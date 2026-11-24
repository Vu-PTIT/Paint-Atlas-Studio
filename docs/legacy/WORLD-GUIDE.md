# Từ bức tranh đến một thế giới Paint Atlas

Gửi ChatGPT ảnh tranh, tệp này và schema `/worlds/schema.json` hoặc tệp `examples/legacy/river-moon.json`. Các yêu cầu tương tác như đi tự động, ngựa và chướng ngại có thể ghi kèm khi gửi.

## Chỉ dẫn cho ChatGPT

1. Quan sát bố cục, phong cách, ánh sáng và các vật thể nhìn thấy trong ảnh. Điền vào `observation`. Khung `box` dùng tỉ lệ 0–1 với gốc ở góc trên bên trái. Dùng `null` cho khung khó ước lượng.
2. Tạo một bố cục 3D có thể đi được. Chọn `river_valley` cho địa hình có sông và cầu, hoặc `meadow` cho đồng cỏ. Đặt các vật thể nhìn thấy vào `objects` nếu có mẫu phù hợp. Ghi các chi tiết được thêm để chơi và phần khuất được diễn giải vào `design_notes`. Bản dựng dùng `style: "oil_impasto"`. Kiểu art quan sát được trong tranh nằm trong `observation.style`.
3. Chọn màu tối và sáng cho từng chất liệu trong `palette`, theo đúng thứ tự `["#TỐI", "#SÁNG"]` với mã RGB hex hợp lệ. Dùng màu của tranh để giữ ánh sáng và nhấn màu chủ đạo của cảnh. Chọn mặt trăng, sao, nét xoáy, dãy núi, thác và chướng ngại theo bố cục.
4. Trả về một **tệp JSON thuần** khớp schema. Lấy tệp mẫu làm tham chiếu cho tất cả trường. Nếu có thư mục dự án, chạy `python -m backend.app.legacy.worlds du-lieu.json The-Gioi.html` để kiểm tra tệp và xuất HTML. Mở HTML và kiểm tra cảnh đầu, vị trí vật thể, một đoạn di chuyển và tour.

## Tọa độ và vật thể

Đơn vị là mét. Trục X dương nằm về bên phải từ điểm vào. Trục Z âm hướng vào xa. Điểm vào nằm gần `(-2, 10)` và camera hướng về vùng Z âm. Cảnh mẫu có đường đi vòng qua 2 cầu, một ở gần `(5, -21)`, một ở `(-40, -14)`. Giữ nhà, cối xay và cây ngoài mặt đường. X từ -57 đến 52, Z từ -74 đến 24.

| Mã | Vật thể |
|---|---|
| `cottage` | Nhà có cửa sổ sáng |
| `windmill` | Cối xay đang quay |
| `chapel` | Nhà nguyện và tháp |
| `cypress` | Cây bách |
| `sunflowers` | Khoảnh hướng dương |
| `wheat` | Khoảnh lúa mì |
| `lantern` | Cột đèn |

Mỗi mục có `kind`, `x`, `z` và `scale` (0,65–1,35). Nhà nguyện và cột đèn dùng `scale: 1`. Tối đa 32 mục, gồm nhiều nhất một nhà nguyện, bốn cối xay, bốn khoảnh mỗi loại hoa hoặc lúa mì và 14 căn nhà. Sông, cầu, lối đi và thác dùng cấu trúc địa hình của trình dựng. Chọn `obstacles: true` để thêm hàng rào, gỗ đổ và tường thấp trên lối.

## Dùng trong Paint Atlas

- Ở trang `/`, chọn **Nhập tệp từ ChatGPT** trong **Dựng thế giới từ tranh**. Chọn **Dựng cảnh** rồi mở cảnh hoặc tải HTML về. HTML tự chạy trên trình duyệt WebGL2, kể cả khi ngoại tuyến.
- Chọn **Thêm vào bản nháp** để đưa cảnh vào sách đang mở. Nếu chưa có sách, Paint Atlas tạo một sách có một cảnh. Dùng phần **Bản nháp** để nối cảnh vào tuyến nếu sách đã có các thế giới khác.
- `POST /worlds/render` nhận cùng tệp JSON và trả HTML. Cảnh đã xuất bản có đường dẫn tại trường `views` của `GET /play/{id}`.
