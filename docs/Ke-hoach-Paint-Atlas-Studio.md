# Kế hoạch phát triển Paint Atlas Studio

**Mục tiêu của bản đầu** là để một người đưa tranh tham chiếu và ý tưởng thế giới vào Studio, dùng Codex tạo một cảnh 3D có thể chơi, tự chỉnh các vật thể trong cảnh, rồi mang toàn bộ kết quả đi bằng một tệp HTML. Tiêu chuẩn hình ảnh và trải nghiệm chơi ban đầu lấy từ *The Starry Ride*.

## 1. Người dùng tạo thế giới như thế nào

| Bước | Thao tác trong Studio | Kết quả |
|---|---|---|
| 1. Đưa tranh vào | Tải ảnh và chọn **Lấy phong cách** hoặc **Lấy phong cách và dựng chủ thể**. Chế độ thứ hai cho khoanh vùng người hoặc vật. | Một ảnh tham chiếu và vùng chủ thể nếu có. |
| 2. Duyệt phong cách | Xem bảng màu, màu sáng, màu bóng, màu nhấn, hình dạng và hướng nét, chất bề mặt. Sửa được màu và đoạn mô tả. | Khối `【Visual Style】` mà tác giả muốn áp dụng. |
| 3. Chọn nội dung | Chọn hoặc viết bối cảnh, vật thể, vị trí tương đối, nhân vật, hành vi, cách điều khiển. Nếu có chủ thể từ tranh, chỉ định vai trò và nơi xuất hiện. | Prompt đầy đủ để xem lại trước khi dựng. |
| 4. Dựng và chơi | Codex viết mã cảnh, Studio ghép với bộ chạy dùng chung, mở bản chơi và các khung hình kiểm tra. | Một thế giới có thể đi vào, xoay góc nhìn và khám phá. |
| 5. Chỉnh và mang đi | Chuyển sang **Chỉnh sửa**, chọn vật trong khung nhìn hoặc danh sách, sửa thuộc tính rồi bấm **Xuất HTML**. | Tệp HTML mở lại được ngoại tuyến ở cả chế độ **Chơi** và **Chỉnh sửa**. |

**Ví dụ khi ảnh chỉ có chân dung.** Tác giả đưa tranh cô gái áo đỏ cầm đèn và chọn dựng phố ven sông Hội An có nhà cổ, cầu, thuyền thúng. Ở chế độ **Lấy phong cách**, phố dùng bảng màu và cách đi nét của bức chân dung. Khi tác giả khoanh cô gái và chọn **Dựng chủ thể**, Codex còn dựng cô thành nhân vật 3D đứng đầu cầu. Trong Studio có thể xoay nhân vật, dời cô xuống bến hoặc chỉnh riêng màu áo. Mặt sau và những phần ngoài khung tranh là chi tiết Codex diễn giải. Người dùng đánh giá độ giống từ phía nhìn thấy trong tranh và duyệt các góc còn lại.

## 2. Điểm xuất phát và những phần cần xây

| Thành phần hiện có | Quyết định cho bản Studio |
|---|---|
| `The-Starry-Ride.html` có cảnh chơi, nét cọ theo bề mặt, điều khiển, vật lý và tour. Trong hàm dựng ngôi nhà, nét cọ và khối va chạm được tạo từ tọa độ của nhà lúc khởi tạo. | Dùng làm cảnh đối chiếu và bài thử editor đầu tiên. Gom các phần của mỗi nhà theo một ID để khi kéo nhà, tường, cửa sáng, nét cọ và va chạm cùng di chuyển. |
| Backend Paint Atlas có FastAPI, SQLite, nhập ảnh, đo màu từ pixel, đọc các phần của prompt, lưu bản nháp theo phiên bản và xuất HTML. | Dùng lại phần nhập ảnh, đo màu, lưu dự án và quản lý phiên bản. Mở rộng bộ đọc prompt để hiểu WebGPU, TSL và chủ thể được chọn. |
| Trình dựng `WorldPlan` cũ dùng một phong cách `oil_impasto`, hai dạng địa hình và bảy loại vật thể có sẵn. Hướng dẫn cũ yêu cầu lấy cả vật thể và bố cục từ tranh. | Giữ đường mở các dự án cũ. Thêm đường dựng mới nhận mã cảnh từ Codex. Đổi hướng dẫn đọc tranh theo hai chế độ ở trên. Dùng chiếc thuyền thúng làm bài thử vật thể ngoài danh mục cũ. |

Hai tệp dùng để rà soát gồm [The-Starry-Ride.html](https://chatgpt.com/library?file_id=libfile_7092704879b88191bddf1475c1182be8&account_id=52e14697-d28d-46d1-9cae-1876c2ffa647) và [Paint-Atlas-Backend.zip](https://chatgpt.com/library?file_id=libfile_48153b6770648191a5f22dc66c4a815a&account_id=52e14697-d28d-46d1-9cae-1876c2ffa647).

## 3. Codex nhận gì và tạo gì

**Lượt đọc tranh.** Backend lấy các mẫu màu trực tiếp từ pixel. Codex dùng ảnh để giải thích vai trò của màu, cách chuyển sáng tối, hình dáng nét và bề mặt. Tác giả có thể sửa kết quả. Với **Lấy phong cách**, lượt dựng cảnh chỉ nhận phần phong cách đã duyệt cùng mô tả thế giới. Với **Dựng chủ thể**, lượt dựng nhận thêm vùng ảnh đã chọn, đặc điểm nhận biết, tư thế và ghi chú của tác giả.

**Lượt dựng thế giới.** Studio ghép các phần sau theo mẫu prompt ban đầu. Codex có thể viết hình học, vật liệu, chuyển động và hành vi mới cho từng cảnh.

| Phần trong prompt | Ai quyết định | Ví dụ |
|---|---|---|
| `【Rendering Technique】` | Cấu hình kỹ thuật của dự án | Nét sơn dầu dạng instanced quad, shader TSL và giới hạn mật độ theo khoảng cách. |
| `【Visual Style】` | Trích từ ảnh, người dùng duyệt | Nền xanh sâu, điểm vàng hẹp, màu bóng tím, nét ngắn uốn theo bề mặt. |
| `【Subject Reference】` | Vùng ảnh người dùng chủ động chọn | Dáng mũ, tỷ lệ đầu và vai, áo đỏ, tay cầm đèn, hướng nhìn thấy trong tranh. |
| `【World】` | Người dùng chọn hoặc tự viết | Phố Hội An, thuyền thúng bên bờ, nhân vật đứng ở đầu cầu. |
| `【Protagonist & Controls】` và `【Miscellaneous】` | Người dùng và cấu hình trải nghiệm | Nhân vật điều khiển được, chuyển động, vật lý, thiết bị và tour. |
| `【Editable World】` | Quy ước Studio | Mã định danh ổn định, thuộc tính có thể sửa, cách áp dụng thay đổi và khôi phục khi mở lại. |

Người dùng có thể khóa kỹ thuật của dự án, chẳng hạn yêu cầu toàn cảnh bằng sơn dầu, hoặc cho phép Codex đề xuất kỹ thuật theo bức tranh. Ở lựa chọn thứ hai, phần duyệt phong cách cho thấy đặc điểm nào cần thể hiện trong shader, chẳng hạn nét gãy có gờ nổi hay mảng màu loang có mép mềm. Điều này quyết định cả cách vẽ bề mặt khi đổi tranh.

**Dùng model theo hai giai đoạn.** Trong bản thử đầu, đưa ảnh và prompt vào Codex bằng tài khoản ChatGPT hiện có. Khi luồng này đã cho kết quả đạt yêu cầu, nối Studio trên máy với Codex App Server để gửi ảnh, giao việc và nhận tiến độ ngay trong giao diện. Việc sinh thế giới cần kết nối đến Codex. Sau khi xuất, trình chơi và editor chạy trực tiếp từ HTML. Khi có ngân sách, chạy đối chứng bằng API trên cùng đầu vào và bộ bài thử. Đường gọi model là phần có thể thay riêng. [Đăng nhập Codex](https://developers.openai.com/codex/auth/) · [Codex App Server](https://developers.openai.com/codex/app-server/)

## 4. Cách giữ cho thế giới chỉnh sửa được

- **Lưu mã cảnh và trạng thái chỉnh sửa.** Dự án lưu prompt đã duyệt, mã cảnh Codex tạo, phiên bản bộ chạy, hạt giống dùng để tái tạo bố cục và bảng thay đổi theo ID. Mở lại tệp sẽ dựng đúng phiên bản đã xuất. Việc kéo, xoay, đổi màu hoặc hoàn tác diễn ra ngay tại máy.
- **Chọn theo vật thể.** Người dùng bấm vào ngôi nhà, chiếc thuyền hay nhân vật. Mỗi vật có một điểm gốc, vùng để bấm chọn và danh sách thuộc tính. Các nét vẽ của vật có thể nằm trong cùng lô vẽ trên GPU với vật khác, nhưng vẫn truy được vật sở hữu. Nét trên vật chuyển động đi theo bộ phận tương ứng.
- **Chỉnh đúng phần được chọn.** Vật thể có vị trí, góc xoay và kích thước khi thích hợp. Nhà có màu và độ sáng cửa sổ, sông có tốc độ dòng, áo có màu riêng. Các tham số bề mặt có thể gồm màu sáng, màu bóng và độ dày nét. Khi vật cản thay đổi, cập nhật hình va chạm và thông tin mà chức năng tự nhảy sử dụng. [Three.js TransformControls](https://threejs.org/docs/pages/TransformControls.html)
- **Xuất một HTML tự chứa.** Đóng gói bộ chạy, shader, mã cảnh, dữ liệu vật lý, editor và trạng thái đã sửa. Hình ảnh trong thế giới và mô hình 3D được dựng bằng mã. Ảnh người dùng cung cấp phục vụ bước phân tích hoặc làm tham chiếu chủ thể. Thử mở bản tải về trong phiên trình duyệt mới đã ngắt mạng, sửa lần hai và xuất tiếp.

### Quy chuẩn hình ảnh và trải nghiệm dùng làm mốc

Với cấu hình sơn dầu của *The Starry Ride*, nét cọ được vẽ trực tiếp bằng hàng trăm nghìn instanced quad, có thể tăng theo ngân sách thiết bị. Mỗi vật liệu có màu sáng và bóng, biến thiên sắc độ và rãnh lông cọ tạo cảm giác sơn dày. Giữ số rãnh trên mỗi nét ổn định. Ở xa, giãn khoảng cách giữa nét, giảm mật độ, tăng kích thước trong giới hạn và thu nhỏ, làm mờ dần những nét bị loại. Cùng một vị trí quan sát phải cho phân bố nét ổn định khi quay máy. Viết shader bằng TSL để Three.js sinh WGSL cho WebGPU và GLSL cho WebGL2. [WebGPURenderer](https://threejs.org/docs/pages/WebGPURenderer.html) · [Three.js Shading Language](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language)

Giữ prompt gốc làm một bài thử đầy đủ với làng, cối xay, đồng hướng dương, sông, cầu, thác, ba lớp núi và hiệp sĩ cưỡi ngựa cầm đèn. Kiểm tra cỏ quanh camera, ánh đèn ấm và ánh trăng lạnh, điều khiển PC/cảm ứng, tự đi đường và nhảy, tour, Rapier và vật lý dự phòng. Trên điện thoại, bắt đầu ở độ phân giải màn hình với ít nét hơn và điều chỉnh độ phân giải khi tốc độ khung hình giảm. Các cảnh khác dùng nội dung trong `【World】` của chính chúng. Bản đầu dùng hai lối đi nét sơn dầu khác biệt để kiểm tra khả năng chuyển phong cách. Một chất liệu khác như màu nước sẽ cần bài thử riêng về loang màu và mép nét.

## 5. Bốn mốc triển khai

Ước tính **19–27 ngày làm việc**, khoảng **4–6 tuần** với một người làm chính toàn thời gian đã quen JavaScript/Three.js và có người góp ý hình ảnh ở từng mốc. Phạm vi thử gồm một cảnh chuẩn, một cảnh mới và một chủ thể cách điệu từ ảnh đơn.

| Mốc | Đầu việc và sản phẩm bàn giao | Điều kiện qua mốc |
|---|---|---|
| **1 · Chứng minh ảnh và prompt điều khiển được cảnh** · 3–4 ngày | Chuẩn bị một tranh phong cảnh, một chân dung và mô tả Hội An. Tạo mẫu prompt, dùng Codex trực tiếp, dựng cảnh tối giản với thuyền thúng. Chạy cùng chân dung ở cả hai chế độ. | Tác giả duyệt màu và nét. Cảnh lấy phong cách chỉ có nội dung đã yêu cầu. Cảnh có chủ thể cho thấy nhân vật có khối từ ba góc và mang đặc điểm đã chọn. |
| **2 · Làm editor trên cảnh đã chơi được** · 6–8 ngày | Tách các vật thể thử nghiệm trong *The Starry Ride*, thêm chọn, di chuyển, xoay, đổi kích thước, bảng thuộc tính, hoàn tác/làm lại và xuất HTML. | Dời nhà 3 m, đổi màu cửa sổ, chỉnh tốc độ nước. Va chạm ở đúng chỗ mới. Xuất, mở ngoại tuyến, chỉnh và xuất lần hai vẫn giữ đúng giá trị. |
| **3 · Nối thành Studio trên máy** · 5–7 ngày | Dùng lại backend cho ảnh và bản nháp. Nối các màn hình nhập tranh, chọn vùng, sửa phong cách, nhập `World`, xem prompt và xem tiến độ. Gửi việc sang Codex App Server rồi đóng gói mã cảnh với cùng editor. | Người thử tạo được cảnh mới từ giao diện. Thuyền và nhân vật do Codex dựng đều chọn và chỉnh được. Nếu sinh cảnh lỗi, lượt thử lại dùng cùng đầu vào đã duyệt và vẫn mở được bản tốt trước đó. |
| **4 · Kiểm tra chất lượng và thử với người dùng** · 5–8 ngày | Chạy ma trận bên dưới, thử trên thiết bị thật và mời 5 người vẽ hoặc làm nội dung dùng bản demo. | Có ảnh nhiều góc, kết quả kiểm thử và trạng thái từng thiết bị. Mục tiêu đề xuất là 4/5 người tự sửa một vật thể rồi xuất, mở lại thành công trong 5 phút kể từ lúc vào editor. |

## 6. Cách nghiệm thu

| Bài thử | Bằng chứng cần thu |
|---|---|
| Cùng thế giới, hai ảnh phong cách | Cố định bố cục và camera. So cặp ảnh ở cùng góc. Người duyệt nhận ra thay đổi về bảng màu, nét và xử lý sáng tối. |
| Cùng ảnh, hai mô tả thế giới | Yêu cầu hai cảnh khác nhau, chẳng hạn phố Hội An và vườn trên đồi. Đối chiếu danh sách vật thể và bố cục với từng prompt. |
| Cùng chân dung, bật và tắt dựng chủ thể | Chọn trước ba đặc điểm thấy rõ. Kiểm tra chúng ở góc tham chiếu, kiểm tra độ nổi khối ở góc nghiêng và phía sau. Người dùng duyệt phần được suy diễn, rồi thử chọn và xoay riêng nhân vật. |
| Chỉnh sửa, va chạm và mở lại | So ID, vị trí, góc, tỷ lệ, màu và tham số trước/sau hai lần xuất. Đi qua vị trí cũ, tiếp cận vật ở vị trí mới. Mở trong phiên mới với mạng bị chặn và kiểm tra lỗi lúc chạy. |
| Khung hình, điều khiển và tốc độ | Dùng trình duyệt headless chụp góc toàn, góc gần và sau chỉnh sửa. Kiểm tra WebGPU/WebGL2 và hai đường vật lý. Chạy cùng tuyến 60 giây trên PC và điện thoại thật, ghi thiết bị, độ phân giải, FPS trung vị và thời gian khung hình phân vị 95. Mục tiêu thử ban đầu trên điện thoại là FPS trung vị từ 30. [Playwright screenshots](https://playwright.dev/docs/screenshots) · [Giả lập thiết bị](https://playwright.dev/docs/emulation) |

Mỗi lượt dựng ghi thời gian đến lần chơi được đầu tiên, số lần cần Codex sửa và kết quả từng tiêu chí. Báo cáo phân biệt phần đã chạy tự động, phần đã thử trên thiết bị thật, phần tác giả đã duyệt về mỹ thuật và phần còn thiếu bằng chứng.

## 7. Thử API khi có ngân sách

Chạy lại bộ tranh, prompt và bài thử trên đúng phiên bản Studio đã dùng với Codex. So sánh chất lượng màu và nét, độ giống chủ thể, tỷ lệ cảnh chạy đạt ngay lần đầu, thời gian và chi phí cho **một thế giới đạt nghiệm thu**, tính cả các lượt sửa lỗi. Bản Studio cá nhân dùng Codex là mốc đối chiếu để quyết định khi nào đáng chuyển chức năng tạo thế giới sang API.
