# CLAUDE.md

Cờ cá ngựa anime: TypeScript, Vite client, Node + Socket.IO server. Xem README.md để biết cách chạy và cấu trúc thư mục.

## Quy tắc

### 1. Logic và đồ hoạ phải tách biệt

Luật chơi chỉ nằm ở một chỗ. Phần hiển thị (ngựa, hiệu ứng, âm thanh, UI) chỉ **đọc** trạng thái và **phát lại** sự kiện.

- `src/core/`, `src/ai/`, `src/session.ts`, `src/protocol.ts`, `src/server/` không được import gì từ `src/client/`, `three`, `animejs`, DOM hay Web Audio.
- Luật mới (ô, thẻ, hiệu ứng như đóng băng, khiên…) viết trong `src/core/` và có test trong `test/`. Mọi thay đổi trạng thái đều sinh ra `GameEvent` (khai báo trong `src/core/types.ts`).
- `src/client/` chỉ làm các việc sau:
  - nhận `GameState` qua `sync()` và `GameEvent` qua `animate()`;
  - hỏi `legalActions()` / `target()` để biết người chơi được bấm gì;
  - gửi `Action` đi.
- Client không tự tính luật và không tự sửa `GameState`, kể cả để "hiển thị cho kịp". Nếu UI cần thông tin thì engine phải phát thêm event.
- Renderer (`render/`, `render3d/`) chỉ vẽ và tạo hiệu ứng hình. Âm thanh (`audio/`) được phát từ `ui/game.ts` theo event, không phát trong renderer.
- Một hiệu ứng mới phải có mặt ở mọi renderer: `render/board-view.ts`, `render/classic-board.ts`, `render3d/board3d.ts`.
- `session.ts` được phép biết thời lượng hoạt ảnh (`TIMING`, `animMs`), vì server cần chờ client diễn xong mới cho bot đi tiếp. Không đưa thêm thứ gì khác về đồ hoạ vào đây.
