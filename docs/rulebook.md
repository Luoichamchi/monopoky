# Rulebook — Chế độ Đấu bài (v0.5, bản thiết kế)

Cờ cá ngựa truyền thống kết hợp bộ bài draft. Chế độ này chưa được lập trình. Chế độ "Lễ hội hỗn loạn" vẫn giữ nguyên.

Tài liệu gồm 3 phần:
- **Phần I — Định luật:** các nguyên tắc không được phá. Mọi lá bài, bẫy hay chế độ mở rộng về sau đều phải tuân theo. Lá bài nào mâu thuẫn với một định luật thì sửa lá bài, không sửa định luật.
- **Phần II — Luật chơi:** cách một ván diễn ra.
- **Phần III — Bộ bài:** các lá cơ bản, combo, bẫy và lá huyền thoại.

Ký hiệu: **[Thử]** là luật đang chơi thử, có thể đổi sau khi đo bằng mô phỏng. ★ là lá thuộc nhóm combo.

---

## Phần I — Định luật

### Định luật 0 — Luật nền
1. Luật truyền thống của game là nền: đổ 6 để xuất chuồng, đổ 6 được đổ thêm, không nhảy qua quân, dừng đúng ô có ngựa địch thì đá nó về chuồng, phải dừng đúng ô cổng, thắng khi cả 4 ngựa đứng ở bậc 3–6.
2. Một lá bài chỉ được làm khác luật nền ở đúng điều nó ghi rõ. Những gì lá bài không nhắc tới thì vẫn theo luật nền.

### Định luật 1 — Lượt đi
Có hai cấp lượt. **Lượt người chơi** là cấp trên và chứa một hoặc nhiều **lượt ngựa**.

**1A. Lượt người chơi**
- Tính từ lúc bắt đầu lượt của một người đến khi chuyển sang người kế tiếp, gồm cả mọi lần đổ thưởng.
- Các bước theo thứ tự cố định: **Đầu lượt → Rút → (Đổ → Đánh bài → Giao lượt ngựa) → Hết lượt**. Phần trong ngoặc lặp lại mỗi lần được đổ thưởng.
- Những thứ tính theo lượt người chơi:
  - Rút bài.
  - Giới hạn 1 lần đánh bài.
  - Hiệu ứng lên người chơi (Phong Ấn, Đoạt Hồn).
  - Hiệu ứng bảo hộ lên ngựa (Hộ Thuẫn, Giáp Bảo Hộ, Miễn Nhiễm).
  - Thời hạn bẫy.
  - Lá huyền thoại.

**1B. Lượt ngựa**
- Mỗi lần đổ xúc xắc, kể cả đổ thưởng, người chơi **giao kết quả cho đúng 1 ngựa**. Đó là một lượt ngựa của con ngựa ấy.
- Với ngựa bình thường, lượt ngựa nghĩa là đi theo xúc xắc. Với ngựa đang bị khống chế, lượt ngựa dùng để **trả lớp khống chế** (Định luật 11).
- Bỏ lượt (không giao cho ngựa nào) thì không ngựa nào được tính lượt.
- Đi bằng bài, bị đẩy, bị kéo hay bị hoán đổi **không** tính là lượt ngựa.
- Những thứ tính theo lượt ngựa: mọi **khống chế** (Đóng băng, Xích Chân, Đảo Chiều) và bẫy Liên Kết.

**Vì sao chia hai cấp như vậy:**
- *Khống chế tính theo lượt ngựa*, nên người chơi phải bỏ công ra giải. Nếu tính theo lượt người chơi, họ chỉ cần đi con ngựa khác chờ băng tự tan, và khống chế gần như vô hại.
- *Bảo hộ tính theo lượt người chơi*. Nếu tính theo lượt ngựa, người chơi có thể để yên một con ngựa có khiên làm vật cản bất tử.

**1C. Mặt xúc xắc và đánh bài**
1. **Không có tài nguyên tích luỹ.** Mặt xúc xắc chỉ có giá trị trong lần đổ đó.
2. **Mặt xúc xắc quyết định được đánh bài gì:**
   - 1 lá đơn: mặt phải bằng điểm in trên lá.
   - Combo N lá: mặt phải bằng N (xem Định luật 4).
   - Bẫy: đánh được với mọi mặt (xem Định luật 2).
3. **Mỗi lượt người chơi đánh bài chủ động tối đa 1 lần**, kể cả khi có các lần đổ thưởng. Một lần đánh có thể là 1 lá, 1 combo, 1 bẫy hoặc 1 lá huyền thoại.
4. Bài được đánh **sau khi đổ, trước khi giao lượt ngựa**. Mặt xúc xắc dùng để mở bài cũng chính là số ô đi, không bị trừ đi.
5. Lần đổ nào không có nước đi hợp lệ thì vẫn được đánh bài.
6. **Phản là ngoại lệ duy nhất của việc đánh bài ngoài lượt mình**:
   - Chỉ người có ngựa (hoặc chính người đó) bị một lá bài nhắm tới mới được dùng.
   - Lá Phản phải cùng điểm với mặt xúc xắc của người tấn công.
   - Mỗi đòn tấn công chỉ được phản 1 lần, và không ai được phản lại một lá Phản.
7. Không được phản bẫy và không được phản lá huyền thoại.

### Định luật 2 — Bẫy
1. **Vị trí công khai, loại bẫy bí mật.** Chỉ chủ bẫy biết loại. Lá Dò Bẫy có thể xem loại.
2. **Bẫy chỉ nổ khi ngựa địch dừng đúng ô.** Đây là luật cố định.
   - Dừng vì bất kỳ lý do nào cũng tính: đi theo xúc xắc, đi bằng bài, bị đẩy, bị kéo, bị hoán đổi, bay tới, hay dừng ở đó để đá quân.
   - Đi ngang qua thì không nổ.
3. **Ngựa của chủ bẫy không bao giờ kích hoạt bẫy của mình.** Nếu bẫy có mang lại lợi cho chủ bẫy, lợi đó chỉ đến khi ngựa địch dính bẫy.
4. Mỗi bẫy chỉ nổ 1 lần rồi biến mất. Nếu hiệu ứng không thực hiện được thì bẫy vẫn mất.
5. **Bẫy không kích hoạt dây chuyền.** Nếu hiệu ứng của một bẫy đưa ngựa sang một ô bẫy khác, bẫy thứ hai không nổ.
6. Không ai được phản bẫy, kể cả lúc đặt lẫn lúc nổ. Chỉ phòng thủ được bằng lá bị động: Giáp Bảo Hộ, Miễn Nhiễm, Dò Bẫy. Hộ Thuẫn không chặn được bẫy.
7. **Không được đặt bẫy ở ô mà ngựa buộc phải dừng**, tức là ô xuất phát và ô cổng (ngay trước bậc 1) của mọi ghế. Cũng không đặt trong cột đích, trên ô đang có quân hay ô đã có bẫy.
8. Bẫy tồn tại **3 lượt người chơi của chủ bẫy**. Mỗi người có tối đa **2 bẫy** trên bàn.
9. **[Thử]** Đặt bẫy với bất kỳ mặt nào. Khoảng cách đặt tối đa là **mặt × 2 ô**, tính dọc đường đua, phía trước hoặc phía sau 1 ngựa của mình đang ở trên đường. Lý do: nếu mỗi loại bẫy gắn với một mặt, mặt xúc xắc lúc đặt sẽ để lộ loại bẫy.
10. Vì khó dính, **bẫy phải mạnh hơn một lá thường cùng loại**. Bẫy không được ghép combo.

### Định luật 3 — Lá huyền thoại
1. **Cách nhận:** một người đổ ra cùng một mặt 3 lần liên tiếp. Chuỗi tính qua các lượt và tính cả lần đổ thưởng.
   - Kết quả bị bỏ bởi lá Đổ Lại không được tính vào chuỗi.
   - Nhận xong thì chuỗi đếm lại từ đầu.
2. **Mỗi mặt ứng với 1 lá huyền thoại, và mỗi lá chỉ có 1 bản trong cả ván.** Nếu lá đã có người lấy thì người đó được rút 2 lá thường thay vào.
3. Mỗi người giữ tối đa 1 lá huyền thoại. Mọi người đều biết ai đang giữ lá nào.
4. **Lá huyền thoại chỉ đánh được khi đổ ra đúng mặt của nó.** Nếu bộ ba vừa đổ cũng chính là mặt đó thì đánh được ngay trong lượt.
   - Đánh lá huyền thoại tính là lần đánh bài của lượt.
   - Không được ghép combo.
5. Lá huyền thoại không bị phản. Nó xuyên qua mọi phòng thủ (Hộ Thuẫn, Giáp Bảo Hộ, Miễn Nhiễm), trừ phòng thủ của một lá huyền thoại khác.
6. **Trần sức mạnh** (lá huyền thoại có thể quyết định một trận đấu nhỏ, nhưng không tự thắng cả ván):
   - Không đưa ngựa vào cột đích, và không tác động lên ngựa trong cột đích (Định luật 5).
   - Đá về chuồng tối đa 1 ngựa.
   - Hiệu lực tối đa 2 lượt người chơi. Nếu là khống chế thì tối đa 2 lớp trên mỗi ngựa.
   - Không loại người chơi khỏi ván, không xoá vĩnh viễn bài hay bộ bài của ai.

### Định luật 4 — Combo
1. **Combo N lá đánh được khi mặt xúc xắc bằng N.** Điểm in trên từng lá không quan trọng. N tối đa là 6, đúng bằng giới hạn tay bài.
2. Chỉ các lá ★ mới tạo combo được với nhau. Riêng ★Mở Rộng ghép được với một lá thường có số ô hoặc phạm vi; mỗi combo có tối đa 1 lá thường như vậy.
3. **Mỗi tên lá ★ tự tính bậc theo số lá cùng tên trong combo.** Ví dụ 2 Tích Lực + 1 Hộ Thuẫn thành combo 3 lá: Tích Lực bậc 2, Hộ Thuẫn bậc 1.
4. **Mỗi lá Mở Rộng thêm một lần nhân** cho số ô hoặc phạm vi của 1 lá được chọn trong combo: 1 lá ×2, 2 lá ×3, cứ thế tăng. Combo có Mở Rộng mà không có lá nào mang số ô hoặc phạm vi thì không hợp lệ.
5. Người đánh chọn thứ tự phân giải các phần của combo.
6. Combo chỉ có một cửa sổ phản. Lá Phản phải có điểm bằng N, và áp dụng cho cả combo.
7. Mỗi lá ★ phải có bảng hiệu ứng cho đủ bậc 1 đến 6. Hiệu ứng ở bậc 6 phải thấp hơn trần sức mạnh của lá huyền thoại.

### Định luật 5 — Vùng an toàn: chuồng và cột đích
1. **Ngựa trong cột đích không chịu tác động của bất kỳ lá bài, bẫy hay lá huyền thoại nào**, kể cả của chính chủ. Vào cột đích rồi thì chỉ còn đổ xúc xắc như truyền thống.
2. **Không lá bài nào đưa được ngựa vào cột đích.** Đi bằng bài thì dừng muộn nhất ở ô cổng.
3. Ngựa trong chuồng xuất phát cũng không bị nhắm tới. Ngoại lệ duy nhất là lá Xuất Chuồng (và lá huyền thoại Cổng Sao) dùng cho ngựa của chính mình.
4. Ô cổng vẫn là ô trên đường đua: ngựa đứng ở đó vẫn bị nhắm và bị đá như truyền thống, nhưng không được đặt bẫy ở đó.

### Định luật 6 — Di chuyển bằng bài
1. Ngựa đi bằng bài đi đúng số ô ghi trên lá, hoặc chọn số ô nếu lá ghi "tối đa". Nó dừng sớm trong 2 trường hợp:
   - Gặp quân chặn đường: đứng ngay sau quân đó, không nhảy qua.
   - Đến ô cổng của chính mình.
2. Nếu ô dừng cuối có ngựa địch thì đá nó, như truyền thống. Nếu có bẫy địch thì bẫy nổ sau cú đá.
3. **Bay** (Dịch Chuyển, Hoán Đổi, Đoạt Vị, Cổng Sao) không đi qua từng ô: không bị chặn và không đá ai. Chỉ được bay tới ô trống, trừ hoán đổi. Ô đáp xuống có bẫy địch thì vẫn dính.
4. Đi lùi không lùi quá ô xuất phát của chính ngựa đó.

### Định luật 7 — Phân giải và giới hạn
1. Thứ tự khi đánh một lá nhắm vào ngựa địch:
   1. Tuyên bố lá và mục tiêu.
   2. Phòng thủ bị động tự chặn: Hộ Thuẫn, Miễn Nhiễm. Nếu đòn đã bị chặn thì không mở cửa sổ phản.
   3. Mở cửa sổ phản.
   4. Phân giải hiệu ứng.
2. Nếu lá nhắm vào ngựa của nhiều người, quyền phản lần lượt theo thứ tự ghế tính từ người đánh. Người đầu tiên đánh lá Phản quyết định kết quả; những người sau không được phản nữa.
3. Khi ngựa dừng lại: **đá trước, bẫy sau**.
4. **Không hiệu ứng nào tự tồn tại mãi.** Giới hạn trên:
   - Bảo hộ và hiệu ứng lên người chơi: tối đa 3 lượt người chơi.
   - Bẫy: 3 lượt người chơi của chủ bẫy.
   - Lá huyền thoại: 2 lượt người chơi.
   - Khống chế: tối đa 3 lớp mỗi loại trên một ngựa. Khống chế chỉ hết khi được giải (Định luật 11), nhưng chủ ngựa luôn có cách giải.
5. **Đơn vị thời gian:** mọi lá bài phải ghi rõ đơn vị là "lượt người chơi", "lượt ngựa" hay "lớp" (Định luật 1). Thời hạn theo lượt người chơi giảm 1 ở đầu mỗi lượt của người đó.
6. **Ngựa bị đá về chuồng hoặc vào cột đích thì mất mọi hiệu ứng**, cả tốt lẫn xấu.

### Định luật 8 — Thông tin
- **Công khai:**
  - Mặt xúc xắc.
  - Danh sách 12 lá của mỗi người (vì draft công khai).
  - Số lá trên tay, đống bài đã bỏ.
  - Vị trí và chủ của bẫy.
  - Ai đang giữ lá huyền thoại nào.
  - Mọi lá đã đánh.
- **Bí mật:**
  - Nội dung tay bài.
  - Loại bẫy.
  - Thứ tự bộ bài.
  - Lá bị cướp: chỉ người cướp và người bị cướp biết.
- Bot cũng không được nhìn thông tin bí mật của người khác.

### Định luật 9 — Cân bằng mặt
1. Sáu mặt xúc xắc có giá trị chiến thuật ngang nhau. **Mỗi mặt có cùng số loại bài** (hiện là 5 loại), trong đó đúng 1 lá Phản. Bẫy không gắn với mặt nào.
2. **Điểm của lá không quyết định sức mạnh.** Lá điểm 1 không mặc định yếu hơn lá điểm 6.
3. Mở rộng bộ bài thì thêm theo bội số của 6, mỗi mặt 1 lá. Riêng bẫy có thể thêm từng lá một.

### Định luật 10 — Tốc độ trận đấu
Bộ bài tồn tại để ván đấu nhanh hơn chứ không chậm hơn. Theo mô phỏng bot với luật truyền thống: ván 2 người khoảng 100 lượt người chơi mỗi người, ván 4 người khoảng 160, và mỗi người bị đá về chuồng khoảng 14 lần mỗi ván 4 người.
1. **Lá Action không trực tiếp đưa ngựa về chuồng.** Đá bằng cách dừng đúng ô như truyền thống thì vẫn được, kể cả khi đi bằng bài.
2. Chỉ bẫy (Hố Đen) và lá huyền thoại (Thiên Lôi) được đưa ngựa về chuồng trực tiếp.
3. Đòn cản nên **lấy của đối thủ cho mình** (hoán đổi, cướp, đi ké) thay vì xoá tiến độ của họ.
4. Mỗi thay đổi lớn về bộ bài phải đo lại số lượt mỗi ván bằng mô phỏng bot. Mục tiêu **[Thử]**: khoảng 60 lượt người chơi mỗi người khi chơi 2 người, khoảng 100 lượt khi chơi 4 người.

### Định luật 11 — Khống chế và giải khống chế
**Ba loại khống chế, xếp từ mạnh đến yếu:**

| Khống chế | Trong lượt ngựa, ngựa sẽ… |
|---|---|
| Đóng băng | đứng yên |
| Đảo Chiều | đi **lùi** theo xúc xắc |
| Xích Chân | chỉ đi được khi đổ ra 1 hoặc 2; ra mặt khác thì đứng yên |

**Lớp:**
1. Mỗi lượt khống chế là **1 lớp**. Bị dính thêm cùng loại thì cộng lớp, mỗi loại tối đa 3 lớp trên một ngựa. Ví dụ Băng Phong ×3 dồn vào một ngựa cho 3 lớp băng.
2. Lớp vượt quá giới hạn 3 thì mất.

**Giải bằng lượt ngựa:**
1. Người chơi giao kết quả đổ cho ngựa đang bị khống chế. Ngựa làm theo **khống chế mạnh nhất** nó đang có, rồi **mọi loại khống chế trên ngựa đều giảm 1 lớp cùng lúc**.
   - Ví dụ ngựa có 2 lớp băng và 1 lớp xích. Lượt ngựa thứ nhất: đứng yên, còn 1 lớp băng và hết xích. Lượt ngựa thứ hai: đứng yên, sạch hết. Lượt ngựa thứ ba: đi bình thường.
2. **Giao lượt cho ngựa bị khống chế luôn hợp lệ**, kể cả khi không đi được ô nào. Vì vậy lần đổ không có nước đi nào khác vẫn có ích: dùng để giải.
3. Người chơi không bắt buộc phải giải. Ngựa bị khống chế cứ đứng đó (vẫn có thể bị đá) cho tới khi chủ của nó trả lớp.
4. Đổ thưởng cũng là một lượt ngựa. Đổ ra 6 rồi giao cho ngựa bị băng thì giải 1 lớp, lần đổ thưởng có thể giải tiếp.
5. Chủ ngựa không được dùng bài của mình để di chuyển con ngựa đang bị khống chế. Bài của đối thủ (Dây Kéo, Gió Xô, Hoán Đổi…) vẫn di chuyển được nó.

**Giải và phòng bằng bài:**

| Lá | Tác dụng với khống chế |
|---|---|
| **Giải Trừ** | **Xoá toàn bộ** mọi lớp, mọi loại khống chế trên 1 ngựa. Sau đó ngựa có thể đi ngay trong lần đổ này |
| **Miễn Nhiễm** | **Không xoá** lớp đang có. Trong thời hạn, ngựa không nhận thêm lớp mới nào và không dính bẫy |
| **Hộ Thuẫn** | Chặn theo **đòn**, không theo lớp. 1 lượt chặn đỡ trọn một lá hoặc một combo nhắm vào ngựa đó, dù đòn mang bao nhiêu lớp. Combo chia lớp cho nhiều ngựa thì mỗi ngựa tự đỡ phần của mình |
| **Lá Phản** | Huỷ cả lá hoặc combo trước khi lớp được thêm vào |

Câu hỏi "một lá giải được bao nhiêu lượt khống chế" có câu trả lời: Giải Trừ xoá tất cả, tối đa 3 lớp mỗi loại. Miễn Nhiễm không xoá lớp nào, chỉ ngăn lớp mới.

---

## Phần II — Luật chơi

### Chuẩn bị: draft
| Thông số | Giá trị |
|---|---|
| Kho bài chung | 88 lá: 4 lá ★ × 6 bản, 26 lá thường × 2 bản, 6 bẫy × 2 bản |
| Bài mỗi người | 12 lá |
| Cách chọn | Công khai, thứ tự kiểu rắn (1-2-3-4, rồi 4-3-2-1), mỗi lần chọn 1 lá |
| Thời gian | 15 giây mỗi lượt chọn, hết giờ thì tự chọn |
| Chơi nhanh | Có thể chọn 1 trong các bộ dựng sẵn thay vì draft |

Lá huyền thoại không có trong kho draft.

### Bắt đầu ván
Mỗi người xáo 12 lá của mình thành bộ bài riêng và rút 4 lá.

### Một lượt người chơi
1. **Đầu lượt:** giảm 1 thời hạn của các hiệu ứng tính theo lượt người chơi (bảo hộ, Phong Ấn…); gỡ bẫy của mình đã hết hạn. Khống chế không giảm ở bước này.
2. **Rút** 1 lá.
   - Quá 6 lá thì tự chọn bỏ 1 lá.
   - Hết bộ bài thì xáo đống bài đã bỏ của mình thành bộ mới.
3. **Đổ** xúc xắc. Kiểm tra chuỗi 3 lần trùng mặt để nhận lá huyền thoại.
4. **Đánh bài** (không bắt buộc, tối đa 1 lần mỗi lượt người chơi): lá đơn, combo, bẫy hoặc lá huyền thoại, theo đúng mặt vừa đổ. Nếu nhắm vào đối thủ, chủ ngựa bị nhắm có **5 giây** để phản.
5. **Giao lượt ngựa:** chọn 1 ngựa. Ngựa bình thường thì đi theo luật truyền thống. Ngựa bị khống chế thì làm theo khống chế rồi giảm lớp (Định luật 11). Không có lựa chọn hợp lệ nào thì bỏ lượt. Ngựa dừng lại thì xét đá trước, bẫy sau.
6. Đổ ra 6 thì được đổ thêm: quay lại bước 3, không rút thêm bài. Mỗi lần đổ thêm là một lượt ngựa mới. Chỉ được đánh bài ở lần đổ thêm nếu trong lượt người chơi chưa đánh lần nào.

### Bài đi đâu sau khi dùng
- Lá đã đánh, lá bị phản huỷ, lá bị bỏ: vào đống bỏ của người sở hữu lá lúc đó.
- Lá bị cướp: vào tay người cướp, và từ đó thuộc về người cướp.

### Thắng
Như truyền thống: cả 4 ngựa đứng ở bậc 3–6 của cột đích.

---

## Phần III — Bộ bài

### Lá thường theo mặt (30 loại)

Phân loại: **Cản** là lá nhắm vào đối thủ (bị phản được), **Buff** là lá dùng cho mình (không mở cửa sổ phản), **Phản** là lá chỉ dùng trong lượt đối thủ.

#### Mặt 1
| Lá | Loại | Bản | Hiệu ứng |
|---|---|---|---|
| Phá Khiên | Cản | 2 | Gỡ mọi Hộ Thuẫn, Giáp Bảo Hộ và Miễn Nhiễm khỏi 1 ngựa địch |
| ★Tích Lực | Buff | 6 | 1 ngựa mình tiến theo bậc (bảng combo). Đánh đơn: tiến 1 ô |
| Giải Trừ | Buff | 2 | Xoá toàn bộ lớp khống chế trên 1 ngựa mình, hoặc gỡ Phong Ấn khỏi chính mình |
| ★Mở Rộng | Buff | 6 | Đánh đơn: rút 1 lá. Trong combo: nhân số ô hoặc phạm vi của 1 lá |
| Né | Phản | 2 | Huỷ lá hoặc combo đang nhắm vào mình |

#### Mặt 2
| Lá | Loại | Bản | Hiệu ứng |
|---|---|---|---|
| Hoán Đổi | Cản | 2 | Đổi chỗ 1 ngựa mình với 1 ngựa địch, cả hai trên đường và cách nhau tối đa 10 ô. Không đá ai |
| Xích Chân | Cản | 2 | 1 ngựa địch nhận 2 lớp Xích Chân |
| Song Mã | Buff | 2 | Lượt này 2 ngựa khác nhau của mình cùng đi theo xúc xắc |
| Dò Bẫy | Buff | 2 | Xem loại 1 bẫy bất kỳ. Nếu bẫy nằm trong 12 ô phía trước một ngựa mình thì được phá nó |
| Phản Đòn | Phản | 2 | Hiệu ứng bị trả lại lên ngựa của người đánh (người phản chọn mục tiêu hợp lệ) |

#### Mặt 3
| Lá | Loại | Bản | Hiệu ứng |
|---|---|---|---|
| ★Băng Phong | Cản | 6 | Thêm lớp băng theo bậc. Đánh đơn: 1 ngựa địch nhận 1 lớp băng |
| Dây Kéo | Cản | 2 | Kéo 1 ngựa địch lùi 4 ô |
| Lùi Né | Buff | 2 | 1 ngựa mình lùi tối đa 3 ô; dừng trúng ngựa địch thì đá |
| Đổ Lại | Buff | 2 | Bỏ kết quả và đổ lại, đi theo số mới. Không được đánh thêm bài |
| Hấp Thụ | Phản | 2 | Huỷ lá đang nhắm vào mình, rồi rút 1 lá |

#### Mặt 4
| Lá | Loại | Bản | Hiệu ứng |
|---|---|---|---|
| Cướp Bài | Cản | 2 | Lấy ngẫu nhiên 1 lá trên tay 1 đối thủ |
| Gió Xô | Cản* | 2 | Đẩy 1 ngựa bất kỳ trên đường tiến tối đa 4 ô. Đẩy vào bẫy thì bẫy nổ. *Chỉ tính là đòn cản khi đẩy ngựa địch |
| ★Hộ Thuẫn | Buff | 6 | Chặn đòn theo bậc: bị đá, hoặc trúng một lá hay combo Cản, dù mang bao nhiêu lớp. Không chặn bẫy. Tồn tại 3 lượt người chơi. Đánh đơn: chặn 1 đòn |
| Giáp Bảo Hộ | Buff | 2 | 1 ngựa: chặn lần dính bẫy đầu tiên trong 3 lượt người chơi, và bẫy đó bị phá |
| Bật Lùi | Phản | 2 | Huỷ lá đang nhắm vào mình; ngựa gần nhất của người đánh lùi 2 ô |

#### Mặt 5
| Lá | Loại | Bản | Hiệu ứng |
|---|---|---|---|
| Đột Kích | Cản | 2 | 1 ngựa mình lao tới ngựa địch gần nhất phía trước trong vòng 5 ô (không có quân chắn giữa) và đá nó. Nếu nó có khiên thì ngựa mình dừng ngay sau |
| Lốc Xoáy | Cản | 2 | Chọn 1 ô trong vòng 10 ô quanh một ngựa mình. Mọi ngựa địch trong vòng 2 ô quanh ô đó lùi 2 ô |
| Xuất Chuồng | Buff | 2 | 1 ngựa ra ô xuất phát không cần mặt 6. Sau đó vẫn đi 5 ô như thường |
| Miễn Nhiễm | Buff | 2 | 1 ngựa: đến đầu lượt người chơi kế tiếp của mình, không chịu lá Cản, không nhận lớp khống chế mới, không dính bẫy. Không xoá lớp đang có |
| Hoá Giải | Phản | 2 | Huỷ lá đang nhắm vào mình; người đánh bỏ 1 lá ngẫu nhiên |

#### Mặt 6
| Lá | Loại | Bản | Hiệu ứng |
|---|---|---|---|
| Đoạt Vị **[Thử]** | Cản | 2 | Đổi chỗ ngựa đi đầu và ngựa đi cuối trên đường của 1 đối thủ (họ phải có ít nhất 2 ngựa trên đường) |
| Phong Ấn | Cản | 2 | 1 đối thủ không được đánh bài, kể cả lá Phản, đến hết lượt người chơi kế tiếp của họ |
| Dịch Chuyển | Buff | 2 | 1 ngựa mình bay tới ô trống bất kỳ trong 10 ô phía trước, không vượt quá ô cổng |
| Xung Phong | Buff | 2 | Lượt này 1 ngựa đi 12 ô thay vì 6. Nếu 12 ô không hợp lệ thì đi 6 |
| Chiếm Đoạt | Phản | 2 | Huỷ lá hoặc combo đang nhắm vào mình; các lá đó về tay mình (quá 6 lá thì bỏ bớt) |

### Combo

Bảng bậc của các lá ★. Bậc = số lá cùng tên trong combo; mặt cần đổ = tổng số lá trong combo.

| Bậc | ★Tích Lực: tiến | ★Hộ Thuẫn: chặn | ★Băng Phong: số lớp băng | ★Mở Rộng |
|---|---|---|---|---|
| 1 | 1 ô | 1 đòn | 1 | ×2 |
| 2 | 3 ô | 2 đòn | 2 | ×3 |
| 3 | 6 ô | 3 đòn | 3 | ×4 |
| 4 | 10 ô | 4 đòn | 4 | ×5 |
| 5 | 15 ô | 5 đòn | 5 | ×6 |
| 6 | 21 ô | 6 đòn | 6 | ×7 |

- Hộ Thuẫn: số đòn chặn được chia cho các ngựa của mình tuỳ ý.
- Băng Phong: số lớp được chia cho các ngựa địch tuỳ ý, mỗi ngựa tối đa 3 lớp (Định luật 11).
- Tích Lực: 1 ngựa, đi theo Định luật 6 (bị chặn thì dừng, tới ô cổng thì dừng).

Ví dụ:

| Đổ ra | Combo | Kết quả |
|---|---|---|
| 2 | Tích Lực ×2 | Tiến 3 ô, rồi đi thêm 2 ô theo xúc xắc |
| 2 | Hoán Đổi + Mở Rộng | Hoán đổi với ngựa địch trong vòng 20 ô |
| 3 | Tích Lực ×2 + Hộ Thuẫn | Tiến 3 ô và chặn được 1 đòn |
| 3 | Dây Kéo + Mở Rộng ×2 | Kéo ngựa địch lùi 12 ô |
| 4 | Băng Phong ×2 + Mở Rộng ×2 | **Không hợp lệ**: Băng Phong không có số ô hay phạm vi nên Mở Rộng không có lá để nhân |
| 6 | Tích Lực ×6 | Tiến 21 ô, rồi đi thêm 6 ô và được đổ thêm |

### Bẫy (6 loại, mỗi loại 2 bản)

Tất cả chỉ nổ khi ngựa địch dừng đúng ô (Định luật 2).

| Bẫy | Hiệu ứng | Chủ bẫy được lợi |
|---|---|---|
| **Hoán Đổi** | Chủ bẫy chọn 1 ngựa mình trên đường để đổi chỗ với ngựa dính bẫy | Có |
| **Liên Kết** | Chủ bẫy nối 1 ngựa mình vào ngựa dính bẫy. Trong 2 lượt ngựa kế tiếp của ngựa dính bẫy, nó đi bao nhiêu ô thì ngựa nối đi bấy nhiêu ô (theo Định luật 6; ngựa nối đang bị đóng băng thì đứng yên) | Có |
| **Đoạt Hồn** | Chủ bẫy lấy 2 lá ngẫu nhiên trên tay chủ ngựa dính bẫy; người đó không được đánh bài đến hết lượt người chơi kế tiếp | Có |
| **Hố Đen** | Ngựa dính bẫy về chuồng | Không |
| **Băng Giới** | Mọi ngựa không thuộc chủ bẫy trong vòng 3 ô quanh bẫy nhận 2 lớp băng | Không |
| **Đảo Chiều** | Ngựa dính bẫy nhận 2 lớp Đảo Chiều: ở lượt ngựa của nó, nó đi lùi theo xúc xắc (không lùi quá ô xuất phát) | Không |

### Lá huyền thoại (6 lá, mỗi lá 1 bản trong ván)

| Bộ ba | Lá | Hiệu ứng |
|---|---|---|
| 1-1-1 | **Ngưng Đọng** | Mọi ngựa địch trên đường nhận 1 lớp băng |
| 2-2-2 | **Hoán Vị Vạn Mã** | Đổi chỗ 2 ngựa bất kỳ trên đường, không giới hạn khoảng cách, của bất kỳ ai |
| 3-3-3 | **Thiên Lôi** | 1 ngựa địch trên đường về chuồng |
| 4-4-4 | **Khiên Thiên Mã** | Trong 2 lượt người chơi của mình, mọi ngựa mình miễn bài, bẫy, bị đá và cả lá huyền thoại khác |
| 5-5-5 | **Cổng Sao** | 1 ngựa mình, kể cả ngựa trong chuồng, bay tới ô trống bất kỳ trên đường, không vượt quá ô cổng |
| 6-6-6 | **Giáng Thế** | Sau khi đi, được đổ thêm 2 lần. Mỗi lần được đánh 1 lá đúng mặt như thường |

---

## Phụ lục — Câu hỏi mở và việc cần đo

- **[Thử] Đặt bẫy với mọi mặt** (Định luật 2.9) và **[Thử] Đoạt Vị** thay cho lá Trục Xuất cũ: cần chơi thử.
- **Thời gian phản 5 giây:** cần kiểm tra trên điện thoại.
- **Số liệu cần cân bằng bằng mô phỏng bot:** số ô của các lá, bảng bậc của lá ★, thời hạn bẫy, số bản trong kho draft. Mục tiêu là số lượt ở Định luật 10.
- **Tần suất lá huyền thoại:** mô phỏng với luật truyền thống cho ra khoảng 2,9 bộ ba mỗi người mỗi ván 2 người. Vì mỗi lá chỉ có 1 bản, phần lớn bộ ba về sau sẽ chỉ cho 2 lá thường.
- **Kỹ thuật:**
  - Tay bài và loại bẫy đang nằm trong state chung gửi cho mọi máy. Server phải lọc theo từng ghế trước khi gửi.
  - Cửa sổ phản cần một pha chờ mới trong engine và session.
