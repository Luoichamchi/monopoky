# Chơi thử Đấu bài bằng bot (21/11/2026)

Khoảng 25.000 ván bot tự chơi (2, 3 và 4 người), cộng thêm vài ván chơi thử trên trình duyệt. Chạy lại bằng hai công cụ:
- `npm run duel:lab -- <số ván> <số người> <mức bot> <bot|random>`: thống kê từng lá bài.
- `npm run duel:ab -- <số ván> <bot A> <bot B>`: cho hai cấu hình bot đấu nhau.

**Cách đọc các chỉ số:**
- **Lift** là số điểm tỉ lệ thắng mà bộ bài có lá đó hơn mức trung bình. Lấy từ các ván mà bộ bài được chọn ngẫu nhiên, sai số khoảng ±2,5 điểm.
- **Gain** là điểm thế trận thay đổi ngay sau khi đánh lá, theo cách bot chấm điểm.

## 1. Số liệu chung (luật hiện tại, bot Khó, bot tự draft)

| | 2 người | 3 người | 4 người | Truyền thống 2 / 4 người |
|---|---|---|---|---|
| Lượt mỗi người | 82 | 96 | 110 | 120 / 185 |
| Lần đổ có lá đánh được | 71% | 69% | 72% | |
| Lá huyền thoại nhận / đánh mỗi ván | 2,2 / 1,3 | 3,5 / 2,3 | 4,4 / 3,0 | |
| Bẫy nổ trên số bẫy đặt | 8% | 12% | 16% | |
| Cửa sổ phản mỗi ván | 0,7 | 3,5 | 6,7 | |

- Lá bài quyết định thắng thua: bot có đánh bài thắng bot không đánh bài **90–92%**.
- Draft quyết định rất mạnh: bot chọn bài theo số liệu thắng bot chọn bài không theo số liệu **93,7%**.

## 2. Vấn đề cân bằng

**a. Bộ "chạy nhanh" áp đảo.** Có bốn lá rõ rệt mạnh hơn phần còn lại:

| Lá | Lift |
|---|---|
| Dịch Chuyển | +11 |
| Gió Xô | +7 |
| Hoán Đổi | +6 |
| Xuất Chuồng | +4 |

- Mở Rộng (+4) nhân sức mạnh của chúng: combo **Dịch Chuyển + Mở Rộng đánh khi đổ ra 2, bay tới 20 ô**.
- Khi tự draft, mọi bot đều chọn cùng một bộ, nên số chiêu thức thực sự được dùng bị thu hẹp.
- Gió Xô bị dùng để đẩy **ngựa mình**, tức là thành một lá di chuyển chứ không còn là lá Cản.

**b. Ván 4 người không công bằng theo thứ tự chọn bài.** Hai người chọn đầu lấy hết 2 bản Dịch Chuyển. Tỉ lệ thắng theo ghế qua 2000 ván: **31,5 / 34,2 / 15,5 / 18,8%**. Khi bộ bài chọn ngẫu nhiên thì bốn ghế ngang nhau, khoảng 25%.

**c. Lá Phản gần như không bao giờ dùng được.**

| Lá | Lift |
|---|---|
| Phản Đòn | +1 |
| Né | −2,5 |
| Hoá Giải | −2,1 |
| Bật Lùi | −3,7 |
| Chiếm Đoạt | −4,7 |

- Lá Phản phải trùng mặt với đòn tấn công. Nhưng mặt 1 chỉ có một lá Cản (Phá Khiên), mặt 6 có hai lá đánh khi bị dồn thế (Đoạt Vị, Phong Ấn). Vì vậy Né và Chiếm Đoạt hầu như không có dịp dùng.
- Phản Đòn sống được vì combo 2 lá rất phổ biến, mà combo 2 lá thì đánh ở mặt 2.

**d. Lá "lấy thêm bài" vô giá trị.** Mỗi lượt rút 1 lá nhưng chỉ đánh được tối đa 1, nên tay bài luôn đầy (bot bỏ 40–90 lá mỗi ván). Cướp Bài (−4,1), Chiếm Đoạt, Hấp Thụ, Mở Rộng khi đánh đơn và Bẫy Đoạt Hồn (−2,7) vì thế gần như không có tác dụng.

**e. Các lá yếu vì tình huống quá hẹp.** Đổ Lại (−3), Giáp Bảo Hộ (−2,6), Phá Khiên (−2,3), Đoạt Vị (−2,2), Song Mã (−1,8), Giải Trừ (−1,3), Dò Bẫy (−1,2).

**f. Bẫy.** Chỉ 5–8% số bẫy nổ khi chơi 2 người (16% khi 4 người), vì ai cũng tránh được ô bẫy đã lộ vị trí. Giá trị thật của bẫy là **chặn đường**: đối thủ phải đi ngựa khác. Trong 6 loại, bot chỉ đánh giá cao Hố Đen, kế đến là Hoán Đổi. Kéo tuổi bẫy lên 5 lượt chỉ nâng tỉ lệ nổ từ 6% lên 9%, sức mạnh gần như không đổi.

**g. Lá huyền thoại.** Gain mỗi lần đánh:

| Lá | Gain |
|---|---|
| Cổng Sao | +225–260 |
| Thiên Lôi | +140 |
| Hoán Vị Vạn Mã | +100–110 |
| Khiên Thiên Mã | +13 |
| Ngưng Đọng | +7–25 |

Cổng Sao mạnh gấp đôi lá đứng thứ hai, vì đưa được ngựa từ chuồng bay thẳng tới ô cổng. Khiên Thiên Mã và Ngưng Đọng thì yếu.

## 3. Các thử nghiệm sửa luật (trên bản sao, chưa áp dụng vào game)

| Thay đổi | Kết quả |
|---|---|
| **Kho có 4 bản Dịch Chuyển, Gió Xô, Hoán Đổi, Xuất Chuồng** | 4 người: các ghế **26,1 / 25,8 / 24,5 / 23,6%** (công bằng). Ván **ngắn hơn hẳn**: 2 người 71 lượt, 4 người 78 lượt. Đổi lại, bộ bài của mọi người càng giống nhau |
| Dịch Chuyển thay cho nước đi, không ghép được với Mở Rộng; Gió Xô chỉ đẩy ngựa địch | Độ lệch sức mạnh giữa các lá giảm từ 3,6 xuống 2,8. Ghế 4 người 28 / 26 / 22 / 24% (sau khi bot học lại). Nhưng ván **dài hơn**: 2 người 109 lượt, 4 người 134 lượt |
| Lá Phản dùng được ở mặt bất kỳ | Cửa sổ phản từ 3,6 lên 11 lần mỗi ván. Lift của Bật Lùi từ −3,7 lên +1,3, Né từ −2,5 lên −0,7 |
| Chỉ rút bài khi tay còn dưới 4 lá | Không còn bỏ bài. Lần đổ có lá đánh được giảm từ 77% xuống 56%, nên lớp may rủi thứ hai rõ hơn. Độ lệch giữa các lá giảm xuống 2,6 |
| Bẫy sống 5 lượt | Tỉ lệ nổ 6% lên 9%, sức mạnh của bẫy gần như không đổi |

## 4. Đề xuất (cần bạn quyết)

1. **Tăng lên 4 bản cho Dịch Chuyển, Gió Xô, Hoán Đổi, Xuất Chuồng.** Đây là thay đổi lợi nhất: vừa công bằng giữa các ghế vừa đạt mục tiêu tốc độ.
2. **Lá Phản dùng được ở mặt bất kỳ, hoặc trùng mặt với một lá trong đòn tấn công.** Phương án này giữ được tinh thần "Phản theo xúc xắc".
3. **Đổi tác dụng các lá "lấy bài"** cho khớp với tay bài luôn đầy: Cướp Bài lấy và đánh ngay, Chiếm Đoạt dùng lại hiệu ứng vừa chặn. Hoặc chuyển sang luật chỉ rút khi tay dưới 4 lá.
4. **Gió Xô chỉ đẩy ngựa địch** cho đúng là lá Cản. Nếu muốn giữ tác dụng tăng tốc thì tách thành một lá Buff riêng.
5. **Giảm sức Cổng Sao:** chỉ bay tối đa 15 ô, hoặc không bay được từ chuồng. **Tăng sức Khiên Thiên Mã và Ngưng Đọng.**
6. **Cho các lá yếu thêm một tác dụng phụ để không bao giờ thành lá chết:** Đổ Lại, Giáp Bảo Hộ, Phá Khiên, Đoạt Vị, Song Mã, Giải Trừ, Dò Bẫy.

## 5. Bot (đã huấn luyện)

- **Thường:** đánh lá khi một bước mô phỏng cho thấy có lợi. Ngưỡng hạ từ 12 xuống 2, nhờ đó bot dùng được mọi loại lá, kể cả bẫy.
- **Khó:** so sánh trọn kế hoạch "đánh lá rồi đi" với "chỉ đi". Thắng bot Thường **62–68%**.
- **Siêu cấp** dùng chung cách nghĩ của bot Khó. Phiên bản mô phỏng ngẫu nhiên (Monte-Carlo) đã thử và thua bot Khó 41–45%, vì trong lượt giả lập đối thủ không đánh được bài (bot không nhìn thấy bài của họ).
- **Draft:** điểm giá trị mỗi lá (`DRAFT_VALUE` trong `src/ai/duel.ts`) học từ khoảng 3.600 ván dùng bộ bài ngẫu nhiên. Chạy lại bằng `npm run duel:lab -- 700 2 hard random` với biến `OUT=...` để lấy số liệu, rồi tính lại bảng.
- **Chưa làm:** bot chưa tính tới khả năng bị phản, chưa chia combo cho nhiều ngựa, và tránh bẫy địch theo kiểu luật kinh nghiệm.
