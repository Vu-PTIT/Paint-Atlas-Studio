# Công nghệ dự án Paint Atlas Studio

**Stack đề xuất cho bản đầu** gồm Python 3.12 và FastAPI cho backend, Rust cho bộ kiểm tra tuyến và xử lý dữ liệu theo lô, React + TypeScript + Vite cho giao diện. Cảnh 3D dùng trực tiếp **Three.js WebGPURenderer + TSL**, với WebGL2 dự phòng và Rapier WASM cho vật lý. Codex hiện tại đọc tranh và sinh mã cảnh. Studio đóng gói bộ chạy, editor và trạng thái đã chỉnh vào **một tệp HTML mở ngoại tuyến**.

Tài liệu này cụ thể hóa các mốc đã thống nhất trong [Ke-hoach-Paint-Atlas-Studio.md](https://chatgpt.com/library?file_id=libfile_fe5d88417e4481918b8e9164af79597f&account_id=52e14697-d28d-46d1-9cae-1876c2ffa647).

## 1. Kiến trúc

~~~mermaid
flowchart TD
    A["Tranh tham chiếu và mô tả thế giới"] --> B["Studio React"]
    B --> C["API FastAPI"]
    C --> D["Lưu dự án trong SQLite"]
    C --> E["Kiểm tra tuyến bằng Rust"]
    C --> F["Giao việc cho Codex"]
    F --> G["Mã và dữ liệu cảnh"]
    G --> H["Đóng gói bằng esbuild"]
    H --> I["Một HTML có Chơi và Chỉnh sửa"]
    I --> J["Xem trước trong Studio"]
    I --> K["Mở ngoại tuyến"]
~~~

| Thành phần | Công nghệ | Trách nhiệm |
|---|---|---|
| Giao diện Studio | React, TypeScript, Vite, CSS Grid và CSS Modules | Chọn ảnh, khoanh chủ thể, duyệt phong cách, nhập mô tả thế giới, theo dõi lượt dựng và mở editor. |
| API và dữ liệu | Python 3.12, FastAPI, Pydantic v2, Uvicorn, SQLite, Pillow | Nhận ảnh, đo bảng màu, kiểm tra dữ liệu, lưu dự án theo phiên bản và điều phối lượt dựng. |
| Xử lý native | Rust, Cargo, CLI atlas-graph hiện có | Kiểm tra tuyến nối giữa các thế giới. Dùng Rust cho tác vụ chuẩn bị dữ liệu cảnh đã được đo là tốn CPU. |
| Bộ chạy 3D | TypeScript, Three.js WebGPURenderer, TSL, Rapier 3D compat | Vẽ nét cọ, điều khiển, va chạm, vòng lặp mô phỏng, chọn và chỉnh vật thể. |
| Sinh cảnh và đóng gói | Codex, Node.js 24 LTS, esbuild | Codex tạo mã cảnh. Trình đóng gói chèn mã vào HTML cùng bộ chạy và dữ liệu. |
| Kiểm thử | pytest, cargo test, Playwright Python | Kiểm tra API, tuyến, ảnh mẫu, thao tác chỉnh sửa và mở lại ngoại tuyến. |

FastAPI phục vụ giao diện đã build và API cùng địa chỉ loopback khi chạy Studio trên máy. Vite dùng trong lúc phát triển. Node.js chạy Vite và trình đóng gói trên máy dựng cảnh. Trình duyệt thực thi bộ chạy của HTML đã tải về. [Vite](https://vite.dev/guide/) · [Node.js LTS](https://nodejs.org/en/about/previous-releases) · [FastAPI](https://fastapi.tiangolo.com/features/) · [Playwright Python](https://playwright.dev/python/docs/intro)

## 2. Nghiên cứu frontend

Tiêu chí chọn là tái sử dụng cảnh The Starry Ride, kiểm soát cách vẽ hàng trăm nghìn nét bằng GPU, dùng chung editor giữa Studio và file tải về, và tổ chức được các panel chỉnh tham số.

| Phương án | Điểm phù hợp | Chi phí tích hợp với Paint Atlas |
|---|---|---|
| **React + TypeScript + Vite + Three.js trực tiếp** | React dựng panel và biểu mẫu. Mã Three.js dùng đối tượng và bộ đệm hiện có, tái sử dụng được trong bộ chạy độc lập. | Studio quản lý vòng đời của renderer và đồng bộ giữa editor với canvas. |
| React + React Three Fiber | Mô tả scene graph bằng JSX, có hệ sự kiện chọn vật thể và hỗ trợ khởi tạo WebGPURenderer qua hàm bất đồng bộ. | Cần quyết định phần nào của cảnh procedural do R3F quản lý, phần nào do bộ chạy hiện có sở hữu. |
| Vue 3 + Vite + Three.js trực tiếp | Single-File Components thuận tiện cho biểu mẫu và inspector. Bộ chạy Three.js vẫn có thể dùng chung. | Phù hợp nếu nhóm quen Vue. Phần vòng lặp GPU, chọn vật thể và đóng gói HTML vẫn cần triển khai ở lớp dùng chung. |
| Svelte + Vite + Three.js trực tiếp | Component được biên dịch. Giao diện có thể quản lý bằng trạng thái phản ứng và dùng cùng bộ chạy Three.js độc lập. | Cần quy ước cho nhóm và Codex về việc gắn, hủy renderer và chuyển dữ liệu từ canvas sang UI. |

Tài liệu đối chiếu gồm [React createRoot](https://react.dev/reference/react-dom/client/createRoot), [R3F Canvas và WebGPU](https://r3f.docs.pmnd.rs/api/canvas#webgpu), [Vue + Vite](https://vuejs.org/guide/quick-start.html) và [Svelte](https://svelte.dev/docs/svelte/overview).

**Chọn React và Three.js trực tiếp.** Phần nhập tranh và quản lý dự án dùng React trong Studio. Trình chơi/editor cũng dùng các component React cho danh sách vật thể, bảng thuộc tính và nút đổi chế độ. Canvas, vòng lặp khung hình, animation, physics và bộ đệm GPU thuộc module TypeScript dùng chung. React nhận snapshot khi chọn vật hoặc xác nhận một chỉnh sửa qua useSyncExternalStore. Khi kéo vật, Three.js cập nhật bản xem trước trong vòng lặp của renderer. Một lần thả chuột ghi một thao tác có thể hoàn tác. [React useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore) · [Three.js TransformControls](https://threejs.org/docs/pages/TransformControls.html)

**Bố cục editor** gồm danh sách vật thể bên trái, canvas ở giữa và thuộc tính bên phải. Trên điện thoại, hai bảng mở theo nút ở cạnh màn hình. Trình chơi dùng cùng cảnh với bàn phím, chuột, cảm ứng và tour theo cấu hình của từng thế giới. Phần khoanh chủ thể dùng tọa độ tỷ lệ trên ảnh đã chuẩn hóa chiều xoay để vùng chọn khớp giữa bản xem trước và ảnh gửi Codex.

## 3. Backend Python và Rust

### Python điều phối dự án

- **FastAPI + Pydantic.** Dùng lại API ảnh và lưu bản nháp từ backend hiện có. Khai báo schema cho yêu cầu dựng, nhật ký trạng thái, manifest vật thể và bản chỉnh sửa. Studio sinh kiểu dữ liệu TypeScript từ OpenAPI bằng openapi-typescript để dùng cùng tên trường và kiểu với backend. Pydantic kiểm tra dữ liệu lúc nhận, kể cả kết quả do model trả về. [Pydantic JSON Schema](https://docs.pydantic.dev/latest/concepts/json_schema/) · [openapi-typescript](https://openapi-ts.dev/introduction)
- **Pillow và SQLite.** Dùng lại bước chuẩn hóa ảnh, đo mẫu màu và SQLite ở chế độ WAL có sẵn. Lưu prompt đã duyệt, phiên bản cảnh, thiết lập đã chỉnh, mã tác vụ và đường dẫn bản build. Tệp HTML, mã cảnh và ảnh nghiệm thu nằm trong thư mục theo phiên bản. Khi lưu bản chỉnh sửa, kiểm tra revision để hai tab cập nhật cùng dự án nhận biết xung đột. [SQLite WAL](https://sqlite.org/wal.html)
- **Tiến trình dựng chạy nền.** HTTP trả mã lượt dựng ngay. Python xử lý các bước đọc tranh, chờ người dùng duyệt, sinh cảnh, build và kiểm thử. React đọc trạng thái qua REST để tiếp tục theo dõi sau khi tải lại trang. Mỗi lượt dựng ghi phiên bản đầu vào đã duyệt. Khi một bản build qua kiểm thử, Python thêm nó vào danh sách bản có thể chơi. Lượt dựng sau có trạng thái riêng để người dùng tiếp tục làm việc trên bản đã đạt.

### Rust xử lý tuyến và tác vụ CPU theo lô

| Hạng mục | Thiết kế |
|---|---|
| Tích hợp ngay | Giữ **atlas-graph** và giao thức stdin/stdout hiện có. Python chuyển ID thế giới thành chỉ số, Rust trả về các điểm chưa thể đi tới. Bản Windows dùng atlas-graph.exe, bản Linux dùng atlas-graph. Giữ test Cargo và chế độ Python dự phòng của backend cũ. |
| Tác vụ mở rộng | Ứng viên đầu tiên là tạo mẫu nét cọ theo ô địa hình bằng seed và chuẩn bị bộ đệm theo tầng khoảng cách. Đo JavaScript và Rust trên cùng dữ liệu 100.000, 500.000 và 1 triệu nét. Đo cả thời gian trao đổi dữ liệu, thời gian dựng và bộ nhớ đỉnh để quyết định đưa phần nào sang Rust. |
| Giao tiếp Python–Rust | Giữ CLI cho các tác vụ theo lô. Với tác vụ mới, dùng Serde cho metadata JSON và tệp nhị phân trong thư mục lượt dựng cho bộ đệm lớn. Nếu profiling cho thấy thời gian gọi tiến trình chiếm phần đáng kể, thử PyO3 cho chính phần đó. |

Rapier là một phần Rust khác chạy dưới dạng WASM trong **trình duyệt**. Bộ chạy cập nhật vật lý theo nhịp mô phỏng tại máy người chơi. Rust CLI phục vụ bước dựng và kiểm tra dữ liệu phía backend. [Cargo](https://doc.rust-lang.org/cargo/) · [Serde JSON](https://docs.rs/serde_json/latest/serde_json/) · [PyO3](https://pyo3.rs/main/) · [Rapier JavaScript](https://rapier.rs/docs/user_guides/javascript/getting_started_js/)

Các điểm tái sử dụng đã đối chiếu trong [Paint-Atlas-Backend.zip](https://chatgpt.com/library?file_id=libfile_48153b6770648191a5f22dc66c4a815a&account_id=52e14697-d28d-46d1-9cae-1876c2ffa647).

## 4. Codex và quy ước dữ liệu cảnh

1. **Đọc tranh.** Pillow lấy màu đại diện. Codex diễn giải bảng màu chính, sáng, bóng, nhấn cùng hình dáng và hướng nét. Người dùng sửa và duyệt khối Visual Style. Nếu người dùng khoanh chủ thể, Codex nhận thêm vùng chọn để mô tả đặc điểm, hình khối và tư thế thấy được.
2. **Dựng thế giới.** Lượt dựng nhận Visual Style đã duyệt, Rendering Technique và World do người dùng quyết định. Ảnh cắt làm Subject Reference chỉ đi vào lượt dựng khi người dùng chọn chế độ dựng chủ thể. Codex viết TypeScript để dựng hình học mới, vật liệu TSL và hành vi. Cảnh khai báo vật thể có thể chỉnh qua API của bộ chạy. Có thể sinh chiếc thuyền thúng hoặc nhân vật riêng theo yêu cầu.
3. **Kết nối model.** Mốc đầu giao ảnh và prompt trực tiếp cho Codex trong tài khoản ChatGPT, rồi đưa mã cảnh vào trình đóng gói. Mốc tích hợp chạy Codex App Server bằng tiến trình do Python quản lý trên máy người dùng. Gửi văn bản và ảnh dạng localImage qua JSONL trên stdio, lưu mã thread và turn để gắn thông báo vào đúng lượt dựng. Python và Codex dùng đường dẫn trong cùng thư mục dự án trên máy để đọc ảnh và ghi mã cảnh. Lượt sinh cần kết nối mạng. Tài khoản được đăng nhập và quản lý trong Codex. [Đăng nhập Codex](https://developers.openai.com/codex/auth/) · [Codex App Server](https://developers.openai.com/codex/app-server/)
4. **Đối chứng API sau.** Giữ prompt, schema, bộ đóng gói và bài nghiệm thu làm chuẩn. Khi có ngân sách, thử bộ kết nối API trên cùng đầu vào để đo chất lượng, thời gian và chi phí theo một thế giới đạt kiểm thử.

| Dữ liệu | Nội dung tối thiểu |
|---|---|
| Phong cách đã duyệt | Màu theo vai trò, độ tương phản, hướng nét, đặc điểm vật liệu và ghi chú của người dùng. |
| Chủ thể tùy chọn | Vùng ảnh, đặc điểm nhận biết, tư thế, vai trò và vị trí mong muốn trong cảnh. |
| Mã cảnh TypeScript | Hàm dựng cảnh nhận seed và API bộ chạy. Có thể tạo hình học, shader, animation, collider và tuyến riêng. Mỗi vật cần chỉnh được đăng ký cùng ID ổn định và vùng bắt chọn. |
| Manifest và trạng thái chỉnh | Phiên bản schema, phiên bản bộ chạy, ID vật thể, thuộc tính cho phép chỉnh, đơn vị, giá trị mặc định, khoảng giá trị và giá trị đã sửa. |

Ví dụ ngôi nhà khai báo vị trí tính bằng mét, góc xoay, tỷ lệ, màu và độ sáng cửa sổ. Sông khai báo tốc độ nước. Editor đọc loại tham số để tạo ô chỉnh và dùng ID để áp lại đúng thay đổi khi mở file. Trạng thái xuất ra giữ seed và các giá trị theo ID. Bộ chạy tự tạo lại bộ đệm nét khi khởi động.

## 5. Đồ họa, chỉnh sửa và HTML ngoại tuyến

**Nét cọ và độ chi tiết.** Bản đầu lấy sơn dầu làm chuẩn. Dùng các lô instanced quad. Mỗi nét có vị trí, hướng, kích thước và biến thể màu được sinh từ seed. Shader TSL tạo độ nổi sơn, giữ số rãnh lông cọ trên mỗi nét ổn định và phối màu sáng và bóng theo chiếu sáng. Three.js có backend WebGPU và WebGL2. TSL sinh WGSL hoặc GLSL tương ứng. Chia địa hình theo ô, giữ seed theo thế giới để quay camera ổn định. Nét ở xa thưa hơn, lớn lên trong giới hạn, rồi thu nhỏ và mờ dần ở vùng chuyển tầng. Mobile bắt đầu ở độ phân giải màn hình và dùng ít nét hơn. Bộ chạy điều chỉnh độ phân giải theo thời gian khung hình. [Three.js WebGPURenderer](https://threejs.org/docs/pages/WebGPURenderer.html) · [TSL](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language) · [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html)

**Chọn và chỉnh vật.** Gắn gizmo vào nhóm Three.js mang ID vật thể. Nét, hình học và đèn dùng hệ tọa độ của nhóm để cùng di chuyển khi cập nhật một transform. Dùng collider hoặc hình đơn giản làm vùng bắt chọn. Thay đổi vị trí cập nhật collider và dữ liệu tự nhảy khi xác nhận. Màu và tốc độ chuyển động có thể cập nhật bằng tham số shader hoặc animation. Rapier khởi động bất đồng bộ. Bộ vật lý đơn giản xử lý di chuyển và nhảy trong trường hợp tải Rapier thất bại. [Three.js TransformControls](https://threejs.org/docs/pages/TransformControls.html) · [Rapier compat](https://rapier.rs/docs/user_guides/javascript/getting_started_js/#compatibility)

**Hai điểm build.** Vite build giao diện Studio. esbuild tạo bundle trình duyệt định dạng IIFE cho bộ chạy, editor và mã cảnh, sau bước kiểm tra kiểu bằng TypeScript. Tool đóng gói chèn JS, CSS và dữ liệu vào HTML. Rapier 3D compat mang WASM nhúng trong JavaScript. Cảnh dựng hình ảnh và mô hình bằng mã như yêu cầu của bản mẫu. Bản The Starry Ride đã dùng esbuild theo cách này, với ba phiên bản đã khóa là Three.js 0.182.0, Rapier 0.19.3 và esbuild 0.27.4. Dùng bộ đó để đối chiếu trước khi nâng từng gói. [esbuild IIFE](https://esbuild.github.io/api/#format) · [Rapier compat](https://rapier.rs/docs/user_guides/javascript/getting_started_js/#compatibility) · [The-Starry-Ride.html](https://chatgpt.com/library?file_id=libfile_7092704879b88191bddf1475c1182be8&account_id=52e14697-d28d-46d1-9cae-1876c2ffa647)

**Xem trước và lưu.** Studio mở bản build HTML trong iframe sandbox với origin cô lập. Chính sách CSP của preview giới hạn tài nguyên và kết nối theo gói đã build, đồng thời cho phép WASM của Rapier. Preview gửi trạng thái chỉnh qua postMessage. Studio kiểm tra cửa sổ gửi, mã phiên và schema trước khi lưu. API xác thực, tiến trình Codex và tệp gốc của dự án thuộc phần Studio. Bản HTML mở riêng lưu bằng nút **Xuất HTML** để nhúng snapshot mới vào bản tài liệu. Trạng thái đi theo tệp khi gửi sang máy khác. Bộ đóng gói mã hóa JSON phù hợp với HTML và bộ chạy kiểm tra dữ liệu khi mở. [MDN iframe sandbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#sandbox) · [MDN postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) · [MDN CSP và WASM](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src#unsafe_webassembly_execution) · [MDN localStorage và file URL](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)

## 6. Trình tự áp dụng và kiểm chứng

Bắt đầu trên Windows với Python 3.12, Node.js 24 LTS và Rust/Cargo stable. Codex App Server, Python và bộ đóng gói chạy trên cùng máy trong mốc tích hợp. Dùng lockfile cho gói frontend, backend và Rust để tái tạo bản build đã nghiệm thu. Compose của backend hiện có là điểm xuất phát cho môi trường kiểm thử Linux.

| Mốc | Việc tích hợp | Dấu hiệu đạt |
|---|---|---|
| **1. Codex thủ công** | Dùng cùng một chân dung để sinh cảnh Hội An ở hai chế độ. Sinh thuyền thúng bằng mã mới và áp dụng cùng quy ước vật thể. | Chế độ lấy phong cách ra đúng bối cảnh đã yêu cầu. Khi bật dựng chủ thể, nhân vật có đặc điểm nhận ra được ở góc tham chiếu và có khối từ các góc còn lại. |
| **2. Bộ chạy và editor** | Thử React gắn vào một canvas Three.js của The Starry Ride. Dời nhà, chỉnh ánh đèn, tốc độ nước và hoàn tác. | Nét cọ, cửa sổ và collider đi theo nhà. Bản ngoại tuyến mở từ file URL giữ sửa đổi qua hai lần xuất. |
| **3. Studio trên máy** | Nối Vite/React, FastAPI và SQLite. Gọi Codex App Server, đóng gói ứng viên, mở preview iframe và ghi phiên bản. | Tạo cảnh mới từ giao diện. Có thể tải lại tab để xem tiến độ, lưu bản chỉnh và mở phiên bản chạy tốt đã có. |
| **4. Nghiệm thu trình duyệt** | Playwright chụp toàn cảnh, góc gần và sau chỉnh sửa. Chạy WebGPU và WebGL2, Rapier và dự phòng. Thử điều khiển, tour và hiệu năng trên PC và điện thoại. | Ghi phiên bản trình duyệt, backend thực tế, ảnh và lỗi khi chạy. Khi mở HTML đã tải về ở phiên mới với mạng bị chặn, số yêu cầu ra mạng bằng 0. |

Hai kiểm chứng kỹ thuật cần ưu tiên là WebGPU trong preview và khi mở file trực tiếp, cùng thời gian khung hình lúc kéo một vật có nhiều nét. Dùng Chromium headless cho ảnh đối chiếu, rồi đo FPS trung vị và thời gian khung hình phân vị 95 trên thiết bị thật. Mục tiêu ban đầu trên điện thoại là FPS trung vị 30 trở lên trong tuyến thử. Hỗ trợ WebGPU phụ thuộc trình duyệt, ngữ cảnh và GPU. Ghi backend thực khi kiểm thử để biết phép đo dùng WebGPU hay WebGL2. [MDN WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) · [Playwright screenshots](https://playwright.dev/python/docs/screenshots)
