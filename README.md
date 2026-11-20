# 🐎 Cờ Cá Ngựa Anime

Cờ cá ngựa trên web, phong cách anime. Chơi offline với bot hoặc bạn bè trên cùng máy, hoặc chơi online qua link phòng.

- **2 chế độ:** *Cổ điển* (luật truyền thống) và *Lễ hội hỗn loạn* (ô đặc biệt + thẻ bài)
- **Bot 4 cấp:** Dễ / Thường / Khó / Siêu cấp. Độ mạnh được kiểm chứng bằng cách cho bot tự đấu (`npm run bench`)
- **Online:** server giữ toàn bộ luật (client chỉ gửi hành động), vào lại phòng sau khi F5, bot tự chơi thay người rớt mạng quá 20s
- **Đồ hoạ:** bàn cờ SVG, hiệu ứng [anime.js v4](https://github.com/juliangarnier/anime) (nhảy squash & stretch, chữ "BAM!" kiểu manga, speed lines, nổ bom, cổng dịch chuyển, banner cut-in, pháo giấy)

## Chạy

Cần Node ≥ 22.18 (server chạy TypeScript trực tiếp, không cần build).

Chỉ có một bộ code, chạy theo 2 cách:

| | Khi nào | Lệnh | Mở trình duyệt |
|---|---|---|---|
| **Dev** | đang code: sửa code là trang tự cập nhật | terminal 1: `npm run dev:server` (server online, cổng 3000)<br>terminal 2: `npm run dev` (giao diện, cổng 5173, tự chuyển kết nối online sang 3000) | `http://localhost:5173` |
| **Production** | deploy lên server | `npm run build && npm start` (hoặc Docker, xem bên dưới) | `http://<ip>:3000` |

Ở chế độ dev, cổng 3000 chỉ lo phần online. Mở thẳng cổng 3000 sẽ thấy "Client not built" vì giao diện chưa được build.
Chỉ chơi offline với bot thì chỉ cần `npm install && npm run dev`.

```bash
npm test             # test luật chơi
npm run typecheck
npm run bench        # bot tự đấu: node test/bench.ts [classic|party] [số ván] [ms suy nghĩ của bot Siêu cấp]
npm run models       # nén model .glb vừa xuất từ Blender (meshopt); file đã nén thì bỏ qua
```

## Deploy lên server riêng

```bash
docker compose up -d --build        # → http://<ip-server>:3000
```

Không dùng Docker: `npm ci && npm run build && npm start` (đổi cổng bằng biến `PORT`).
Muốn dùng tên miền + HTTPS thì đặt reverse proxy phía trước, nhớ bật WebSocket. Ví dụ với Caddy:
`your.domain { reverse_proxy localhost:3000 }`. Với Nginx cần thêm header `Upgrade`/`Connection`.

Mở game bằng `localhost` thì link phòng tự đổi sang IP mạng LAN của máy (chỉ bạn bè cùng Wi-Fi vào được; bạn ở xa cần deploy hoặc chạy `npm run build && npm start` rồi mở tunnel, ví dụ `cloudflared tunnel --url http://localhost:3000`, và gửi link tunnel).

Mời bạn chơi: **Tạo phòng** → gửi link `…/#room=ABCD` (hoặc mã 4 chữ) → chủ phòng chọn chế độ, ghế (người / bot / trống) → **Bắt đầu**.

## Cấu trúc thư mục

```
src/
├─ core/                    LUẬT CHƠI: thuần TypeScript, không DOM, không Node. Dùng chung cho client & server
│  ├─ types.ts              GameState, Action, GameEvent, interface Variant
│  ├─ board.ts              cấu trúc bàn cờ (52 ô, cửa chuồng, 6 bậc), các hàm truy vấn
│  ├─ engine.ts             createGame / legalActions / step(): áp dụng hành động → danh sách sự kiện
│  └─ variants/
│     ├─ index.ts           đăng ký các chế độ chơi
│     ├─ classic.ts         luật truyền thống
│     └─ party/             chế độ "Lễ hội hỗn loạn" (tiles.ts: ô đặc biệt, cards.ts: thẻ bài)
├─ ai/
│  ├─ evaluate.ts           hàm đánh giá thế cờ (trọng số đã được tinh chỉnh qua tự đấu)
│  └─ bots.ts               4 cấp bot
├─ session.ts               điều phối 1 ván: kiểm tra hợp lệ, cho bot đi, nhịp chờ hoạt ảnh
├─ protocol.ts              kiểu dữ liệu trao đổi client ↔ server
├─ server/index.ts          HTTP (phục vụ dist/) + Socket.IO (phòng chơi)
└─ client/
   ├─ main.ts               menu, phòng chờ, chơi offline/online
   ├─ net.ts                kết nối socket
   ├─ ui/game.ts            màn chơi: phát sự kiện qua renderer, nhận click → hành động
   ├─ style.css             CSS chung của menu và màn chơi
   ├─ atlas.css             giao diện Tinh bàn Thiên Mã (bản đồ 2D)
   ├─ audio/                ÂM THANH: tạo bằng Web Audio, không cần file âm thanh
   │  ├─ engine.ts          phần dùng chung: AudioContext, kênh riêng cho nhạc/hiệu ứng, hàm tạo âm cơ bản
   │  ├─ music.ts           nhạc nền: music.play(on), music.setEnabled(on)
   │  └─ sfx.ts             hiệu ứng: đổ xúc xắc, bước đi, đá, từng ô đặc biệt, thẻ bài: sfx.play(name)
   │                        muốn dùng file thật: giữ nguyên API, chỉ thay phần thân hàm của file tương ứng
   ├─ render3d/             TEMPLATE 3D (three.js, chỉ tải khi người chơi chọn 3D)
   │  ├─ board3d.ts         BẢN ĐỒ 3D Tinh bàn Thiên Mã: bàn và quân cờ dựng trong Blender, camera tự canh khung + xoay/zoom
   │  ├─ dice3d.ts          XÚC XẮC 3D: widget WebGL riêng, tung lộn vòng rồi dừng đúng mặt số
   │  └─ toon.ts            vật liệu toon/viền dùng chung, giải phóng WebGL khi đổi template
   └─ render/               ĐỒ HOẠ: thay/nâng cấp ở đây mà không đụng vào luật
      ├─ renderer.ts        2 interface độc lập: BoardRenderer (bản đồ) và DiceRenderer (xúc xắc) + loadBoard/loadDice
      ├─ theme.ts           màu từng phe, chữ hiệu ứng, ký hiệu ngựa
      ├─ skins.ts           icon/màu của ô đặc biệt & thẻ bài
      ├─ layout.ts          ô logic → toạ độ pixel
      ├─ board-view.ts      bàn SVG: quân ngựa + hoạt ảnh di chuyển/đá/ô đặc biệt
      ├─ board-art.ts       BoardArt: phần vẽ mặt bàn 2D mà board-view dùng (thêm bản đồ 2D mới = thêm một BoardArt)
      ├─ atlas.ts           mặt bàn 2D Tinh bàn Thiên Mã
      ├─ dice.ts            xúc xắc
      └─ fx.ts              hiệu ứng anime.js dùng chung
```

**Luồng dữ liệu:** `Action` → `engine.step()` → `GameEvent[]` + state mới → renderer phát lần lượt từng sự kiện thành hoạt ảnh → khớp lại theo state thật. Luật không biết gì về đồ hoạ, đồ hoạ chỉ đọc sự kiện. Vì vậy có thể thay toàn bộ `render/` (ví dụ sang PixiJS/Three.js, sprite nhân vật anime) mà không sửa `core/`.

## Mở rộng

**Thêm chế độ chơi mới:** tạo `src/core/variants/<tên>/index.ts` export một `Variant` (thường bắt đầu bằng `...classic`), dùng các hook `setup`, `onLand`, `canKick`, `onTurnStart`, `cardActions`, `applyCard`, rồi thêm vào `VARIANTS` trong `variants/index.ts`. Menu, server và bot sẽ tự nhận chế độ mới. Phần hình ảnh riêng của chế độ (icon ô, thẻ) để trong `render/skins.ts`.

**Template đồ hoạ:** bản đồ và xúc xắc là 2 phần độc lập, ghép tùy ý (2D/3D × 2D/3D). Ở menu, nút "2D | 3D" đặt nhanh cả hai. Trong ván, bấm 🎨 để đổi riêng từng phần ngay lúc đang chơi: lệnh đổi được xếp hàng sau hoạt ảnh đang chạy, bản cũ được giải phóng hoàn toàn (kể cả WebGL context), bản mới vẽ lại từ trạng thái ván. Lựa chọn lưu trong trình duyệt (`ccn.look`) và chỉ ảnh hưởng người chơi đó, kể cả khi chơi online. Muốn thêm template mới (ví dụ PixiJS) thì implement `BoardRenderer` hoặc `DiceRenderer` trong `render/renderer.ts` và thêm vào `loadBoard`/`loadDice`. Máy không chạy được WebGL thì tự quay về 2D.

**Asset 3D** nằm trong `public/models/` (credit và giấy phép ở `public/models/LICENSE.md`). Sau mỗi lần xuất lại một file `.glb` từ Blender, chạy `npm run models` để nén nó (khoảng 3–6 lần nhỏ hơn, hình không đổi). Bàn: `atlas-board.glb` (từ `blender/atlas-board.blend`). Quân ngựa: `horse-piece.glb` (dựng bằng `tools/blender/horse_piece.py`); code tô màu theo tên vật liệu `hp_mane`, `hp_base`.

**Nâng cấp đồ hoạ:** đổi màu/phong cách trong `theme.ts` và `style.css`; thay quân ngựa trong `BoardView.drawHorse()` (ví dụ dùng `<image>` sprite chibi); thêm hiệu ứng vào `fx.ts`. Nếu hoạt ảnh dài/ngắn hơn đáng kể thì chỉnh `TIMING` trong `session.ts` để bot chờ đúng nhịp.

## Luật

- Đổ **6** để xuất chuồng (Lễ hội: **1 hoặc 6**). Đổ 6 được đổ thêm lượt.
- Không được nhảy qua ngựa khác. Đi đúng vào ô có ngựa địch thì **đá** nó về chuồng.
- Phải dừng đúng ở **cửa chuồng**. Từ cửa, đổ *n* thì lên thẳng bậc *n*. Trong chuồng, muốn lên bậc *k+1* phải đổ đúng *k+1*.
- Thắng khi cả 4 ngựa đứng ở bậc 3–6.

**Lễ hội hỗn loạn.** Mỗi ván có 24 ô đặc biệt, xếp đối xứng cho 4 phe nên công bằng:
- ⚡ Tăng tốc · 🕳️ Hố bùn · 🌀 Cổng dịch chuyển · 🎁 Hộp quà · 🛡️ Khiên · ❄️ Băng giá · 💣 Bom
- Thẻ bài: 🎲 Đổ lại · 🧊 Đóng băng · 🛡️ Khiên thần · 🪢 Dây kéo

## Bot

| Cấp | Cách nghĩ |
|---|---|
| Dễ | đi ngẫu nhiên |
| Thường | luật kinh nghiệm: ưu tiên đẩy ngựa đi xa nhất, xuất quân, đá |
| Khó | expectimax: xét mọi kết quả xúc xắc và cách dùng thẻ của mình, rồi lượt đáp trả tốt nhất của đối thủ kế tiếp. Có mô hình xác suất bị đá |
| Siêu cấp | Monte-Carlo (UCB1): mô phỏng hàng nghìn diễn biến tương lai cho từng nước, ~0.5s mỗi quyết định |

Một điều rút ra khi cho bot tự đấu: với luật "không nhảy qua quân" và "dừng đúng cửa", đẩy con ngựa dẫn đầu là chiến thuật mạnh nhất. Ngựa vào chuồng ở bậc thấp lại là nước đi tệ.
