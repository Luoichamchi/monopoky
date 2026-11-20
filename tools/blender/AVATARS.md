# Làm avatar low-poly từ model tải trên mạng (cho AI agent dùng Blender MCP)

Avatar là nhân vật đứng trên đỉnh núi ở mỗi góc bàn Tinh bàn Thiên Mã, để biết góc đó của người chơi nào.
Trên màn hình nó chỉ cao khoảng 60–100px, nên dùng **bản low-poly**, không dùng bản gốc vài triệu tam giác.

Mọi bước nặng đã nằm trong script `tools/blender/avatar_lowpoly.py`. Việc của agent là: giải nén, chạy script,
**nhìn ảnh xem trước để kiểm tra**, chỉnh tham số nếu hỏng, nén, ghi giấy phép.

## Mức cần đạt (mỗi avatar)

| | Mức | Vì sao |
|---|---|---|
| Tam giác | 3.000–6.000 (mặc định 4.000) | quân ngựa ~9.800; cả cảnh ~416k |
| Vật liệu | 1 (`av_body`) | mỗi vật liệu = 1 lệnh vẽ |
| Ảnh | 1 ảnh màu, cạnh ≤ 512px, JPEG | không normal map, không kim loại (bàn 3D không có ánh sáng môi trường, kim loại sẽ đen) |
| File `.glb` sau `npm run models` | ≤ 200KB | đã thử: ORDEVAL 104KB, VELMIRIE 144KB |
| Hệ trục | Z lên, nhìn về **-Y**, chân ở z=0 giữa gốc, cao 1 | game tự đặt lên đỉnh núi và co giãn |

Kiểu low-poly: mặt phẳng (flat shading). File xuất **không có normal**: three.js tự vẽ mặt phẳng, file nhẹ gần một nửa.

## Nguồn

File zip nằm trong `~/Downloads`. **Giải nén ra ngoài repo** (ví dụ `/tmp/avatars-src/<tên>/`), không bao giờ đưa
file gốc (vài chục MB) vào repo.

| Zip | Tên (`NAME`) | Bên trong | Ghi chú |
|---|---|---|---|
| `ordeval-the-gilded-lionheart.zip` | `ordeval` | `source/*.glb` + 4 ảnh | đã thử, đạt |
| `seraphielle-the-celestial-oathmaiden.zip` | `seraphielle` | như trên | đôi cánh nhiều lông mỏng: kiểm tra kỹ, có thể cần `TRIS=6000` |
| `aurencast-the-ivory-oathkeeper.zip` | `aurencast` | như trên | 3,1 triệu tam giác: **cần `TRIS=8000`**, ở 4.000–6.000 mất thanh kiếm, áo choàng vỡ |
| `noxariel-the-sanctified-deathbringer.zip` | `noxariel` | như trên | lưỡi hái dài và mỏng: kiểm tra |
| `nocturne-hunter-the-black-veil.zip` | `nocturne` | như trên | mũ rộng vành, kiếm mảnh: kiểm tra |
| `velmirie-the-monochrome-doll.zip` | `velmirie` | `source/*.glb` + 1 ảnh | đã thử, đạt. Giấy phép: có thể giống Harley Quinn (xem LICENSE.md) |
| `succubus-1.zip` | `succubus` | FBX, có xương, shape key, nhiều ảnh | đã làm theo yêu cầu: còn **9 vật liệu**. Giấy phép: có thể lấy từ game TERA |
| `queen-chess-harry-potter.zip` | `queen` | zip lồng zip: `ферзь.stl` (tên tiếng Nga, giải nén bằng Python) | đã làm theo yêu cầu: **không màu**. Giấy phép: thiết kế của phim |

## Các bước cho mỗi model

1. Giải nén: `unzip -o ~/Downloads/<zip> -d /tmp/avatars-src/<NAME>/`. File cần dùng là `source/*.glb`.
2. Chạy script, chọn **một** trong hai cách:
   - Shell (nhanh, không đụng Blender đang mở):
     ```sh
     /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
       -P tools/blender/avatar_lowpoly.py -- "/tmp/avatars-src/ordeval/source/ORDEVAL  The Gilded Lionheart.glb" ordeval 4000
     ```
   - Qua MCP (`execute_blender_code`). Script **xoá sạch cảnh đang mở**, nên mở file trống trước:
     ```python
     path = "/Users/luoicc/Documents/freeTimeApp/monopoky/tools/blender/avatar_lowpoly.py"
     exec(compile(open(path).read(), path, "exec"), {
         "__file__": path, "SRC": "/tmp/avatars-src/ordeval/source/ORDEVAL  The Gilded Lionheart.glb",
         "NAME": "ordeval", "TRIS": 4000})
     ```
   Tham số tuỳ chọn: `TRIS` (số tam giác), `TEX` (cạnh ảnh, mặc định 512), `FLAT` (False = mặt mịn).
3. Đọc dòng `[avatar] … → … tam giác, … vật liệu, …KB` mà script in ra.
4. **Mở ảnh `blender/avatar-<NAME>-preview.png` (256px, cỡ gần bằng trong game) và kiểm tra:**
   - nhân vật **nhìn về phía camera** (camera ở phía trước, chếch phải). Nếu quay lưng hoặc nằm ngang: xoay object
     (Z 180°, hoặc X 90°), apply rotation, rồi xuất lại (bước xuất ở cuối script);
   - vũ khí, cánh, lông mũ **còn nguyên hình**, không vỡ thành mảnh rời hay mất hẳn. Nếu hỏng: chạy lại với `TRIS=6000`,
     tối đa 8000;
   - màu đúng như bản gốc, không đen hay trắng toát. Nếu mặt mờ quá: `TEX=1024`;
   - chỉ **1 vật liệu**. Nếu script in "lưu ý: thêm vật liệu": báo người dùng, đừng tự gộp.
   Agent có MCP thì chụp thêm viewport (`get_viewport_screenshot`) nhìn từ trước và từ bên cạnh.
5. Nén: `npm run models` (tự tìm mọi `.glb` trong `public/models/` và `public/models/avatars/`, bỏ qua file đã nén).
6. Ghi vào `public/models/LICENSE.md`: ở dòng của model, đổi cột *File* thành `avatars/<NAME>.glb` và cột *Changes*
   thành, ví dụ, `reduced from 1.9M to 4k triangles, flat shaded, 512px colour texture, normal/metal maps removed`
   (CC BY bắt buộc ghi rõ đã sửa gì).

## Kết quả và những gì không được làm

- Script tạo: `public/models/avatars/<NAME>.glb` (cho game), `blender/avatars/<NAME>.blend` (chỉ bản low-poly, để
  sửa tay sau) và `blender/avatar-<NAME>-preview.png` (git bỏ qua).
- Không sửa `blender/atlas-board.blend` và code game. Việc đặt avatar lên đỉnh núi và tô màu theo ghế là bước sau.
- Không commit, không đưa file gốc vào repo.
- Cuối cùng báo lại cho người dùng một bảng: tên, tam giác trước → sau, KB sau khi nén, có phải chỉnh tham số không,
  và ảnh xem trước của từng avatar.
