# Viết cảnh cho Paint Atlas

Xuất đúng một module TypeScript. Dùng `import type { WorldAPI, Drawing, V3 } from '@atlas/world'` và `export default function build(a: WorldAPI)`. Hình học, shader, animation và vật thể mới được phép viết trực tiếp. Các thư viện dùng trong trình duyệt đã có ở a.THREE, a.TSL. Dùng code và dữ liệu tự tạo, gồm toàn bộ hình vẽ. Hàm build chạy đồng bộ; runtime sở hữu renderer và vòng lặp khung hình.

- a.environment({background,eye,look,route,height,rider,tour,terrainBounds}) đặt nền, góc mở đầu, mô phỏng. eye, look và từng điểm route là bộ ba số. route khép kín, ít nhất ba điểm. height(x,z) trả cao độ mặt đất. Vẽ hình mặt đất bằng lớp vẽ để khớp cao độ. rider là true để dùng ngựa theo lệnh người dùng. Nếu cảnh yêu cầu trải nghiệm đi bộ, dùng false. tour là các cặp {eye,look}.
- a.scene là THREE.Scene. a.point(x,y,z) là Vector3. a.colors(shadowHex,lightHex) trả cặp màu. a.palette là bảng màu đã duyệt. a.seed để tái tạo bố cục. a.subject là cờ cho biết tác giả chọn dựng chủ thể. a.layer(a.scene,seed) tạo một lớp vẽ nền; gọi finish('tên') khi hoàn tất lớp nền tự tạo.
- a.entity({id,name,kind,position,yaw,scale,box,solid,jumpable,movable,fields},({group,layer,values,onFrame,random})=>{ ... }) tạo một vật thể chỉnh được. id ổn định và duy nhất. position [x,y,z] tính bằng mét, yaw theo độ, scale đồng nhất. box:{center:[x,y,z],size:[w,h,d]} trong hệ tọa độ cục bộ dùng để chọn và va chạm. solid:true cho vật cản. jumpable:true thêm điểm tự nhảy trên tuyến. movable:false cho mặt sông hoặc tham số toàn cảnh.
- fields ví dụ {color:{kind:'color',label:'Màu sơn',value:'#d6a452'},speed:{kind:'number',label:'Tốc độ',min:0,max:4,step:0.1,value:1}}. Trong hàm vẽ dùng String(values.color) và Number(values.speed). Runtime tự gọi finish cho layer của entity. onFrame((t,dt)=>{...}) dành cho chuyển động tại chỗ. Khi tái vẽ thuộc tính, nhóm cũ và callback cũ được thay.
- Dùng a.swatch(nhóm, id, tên, '#RRGGBB') để tạo từng ô trong **Bảng màu cảnh**. Nhóm là 'sky', 'water' hoặc 'architecture'. Đặt ID ổn định gồm chữ thường, số và dấu gạch ngang. Khai báo riêng các màu cần chỉnh độc lập, ví dụ nền trời, nét mây, vệt sáng và trăng. Gọi ô màu như một hàm để lấy THREE.Color, rồi truyền trực tiếp vào a.colors(màuTối,màuSáng) hoặc a.environment({background:ôMàu()}).
- Dùng ôMàu('#RRGGBB') cho một sắc độ của chính màu đó, như phần tối của một vệt sáng. Sắc độ giữ màu gốc lúc mở cảnh và thay đổi cùng ô màu khi người dùng chỉnh. Với vật liệu tự viết, giữ tham chiếu màu bằng material.color = ôMàu() hoặc a.TSL.uniform(ôMàu()). Khai báo các ô màu trong hàm build trước khi dùng trong lớp vẽ hoặc callback của entity.
- layer.box(centerVector,sizeVector,colorPair,step,emission), layer.oval(centerVector,radiiVector,colorPair,strokeCount,quaternionOrNull,emission,directionBias), layer.face(origin,alongVector,upVector,colorPair,step,emission,directionBlend), layer.triangle(a,b,c,normal,colorPair,emission), layer.brush.stroke(center,direction,unitNormal,length,width,colorPair,emission,motion). Các đối số cuối có mặc định. motion=1 cho nét nước. Chọn mật độ đủ cho khoảng cách camera, gom nét cùng vật thể thành lô. Sử dụng ánh sáng, chiều và hình dáng nét ngoài bảng màu.
- Đăng ký nhà, thuyền, nhân vật và các vật cần chỉnh thành entity riêng. Khi a.subject đúng, gắn role: 'subject' vào entity chính được dựng từ vùng chọn, đặt box để người dùng có thể bấm chọn. Khi chỉ lấy phong cách, bỏ role này. Với ảnh chân dung, dùng các khối có chiều sâu theo đặc điểm vùng chọn. Tạo thêm vật thể theo World. a.starryRide() dựng nguyên mẫu The Starry Ride, chỉ dùng cho yêu cầu đích danh cảnh đó.

Ví dụ nhỏ

```ts
import type { WorldAPI } from '@atlas/world';
export default function build(a: WorldAPI) {
  const p=a.point;
  const sky=a.swatch('sky','background','Nền trời','#233e46');
  const clouds=a.swatch('sky','clouds','Nét mây','#5d7c83');
  const walls=a.swatch('architecture','walls','Tường xưởng','#d9a75f');
  a.environment({background:sky(), eye:[5,4,9], look:[0,1,0], route:[[-4,0,4],[4,0,4],[4,0,-4],[-4,0,-4]], height:()=>0});
  const skyLayer=a.layer(a.scene,101);
  skyLayer.face(p(-12,4,-14),p(24,0,0),p(0,3,0),a.colors(sky(),clouds()),.5);
  skyLayer.finish('Mây thấp');
  const field=a.layer(a.scene,15);
  field.face(p(-14,0,14),p(28,0,0),p(0,0,-28),a.colors('#23372f','#677d5c'),.24);
  field.finish('Đồng cỏ');
  a.entity({id:'studio',name:'Xưởng gốm',kind:'Nhà',solid:true,box:{center:[0,1,0],size:[2,2,2]}},
    ({layer})=>layer.box(p(0,1,0),p(2,2,2),a.colors(walls('#553d34'),walls()),.15,.1));
}
```
