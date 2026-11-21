// Duel mode card list (docs/rulebook.md, Phần III). Names and texts live here with the rules; icons live in client/render/skins.ts.

/** hex = aimed at an opponent (can be reacted to), buff = for yourself, react = only on an opponent's turn. */
export type CardKind = 'hex' | 'buff' | 'react' | 'trap' | 'legend';

/**
 * What a pick's `t` holds:
 *  none        []
 *  own / foe   [horse]          own or enemy horse on the track
 *  any         [horse]          any horse on the track
 *  stable      [horse]          own horse in the stable
 *  player      [player]         an opponent
 *  square      [abs]            a track square
 *  trap        [abs]            a square holding a trap
 *  ownFoe      [own, foe]       two horses
 *  ownN        [own, n]         own horse and a distance
 *  anyN        [horse, n]       any horse and a distance
 *  ownDest     [own, pos]       own horse and a destination (relative pos)
 *  any2        [horse, horse]
 */
export type Aim =
  | 'none' | 'own' | 'foe' | 'any' | 'stable' | 'player' | 'square' | 'trap'
  | 'ownFoe' | 'ownN' | 'anyN' | 'ownDest' | 'any2';

export interface CardDef {
  name: string;
  point: number; // die face that plays it alone; 0 = any face (traps)
  kind: CardKind;
  aim: Aim;
  desc: string;
  copies: number; // in the draft pool
  combo?: boolean; // ★: forms combos
  range?: number; // squares / reach that Mở Rộng multiplies
}

export const DUEL_CARDS: Record<string, CardDef> = {
  // ---- 1 ----
  phakhien: { name: 'Phá Khiên', point: 1, kind: 'hex', aim: 'foe', copies: 2, desc: 'Gỡ Hộ Thuẫn, Giáp Bảo Hộ và Miễn Nhiễm khỏi 1 ngựa địch.' },
  tichluc: { name: 'Tích Lực', point: 1, kind: 'buff', aim: 'own', copies: 6, combo: true, range: 1, desc: '1 ngựa mình tiến 1 ô. Combo: 3 / 6 / 10 / 15 / 21 ô.' },
  giaitru: { name: 'Giải Trừ', point: 1, kind: 'buff', aim: 'own', copies: 2, desc: 'Xoá mọi lớp khống chế trên 1 ngựa mình.' },
  morong: { name: 'Mở Rộng', point: 1, kind: 'buff', aim: 'none', copies: 6, combo: true, desc: 'Đánh đơn: rút 1 lá. Trong combo: nhân số ô / phạm vi của lá đi kèm (×2, ×3…).' },
  ne: { name: 'Né', point: 1, kind: 'react', aim: 'none', copies: 2, desc: 'Phản: huỷ lá hoặc combo đang nhắm vào bạn.' },
  // ---- 2 ----
  hoandoi: { name: 'Hoán Đổi', point: 2, kind: 'hex', aim: 'ownFoe', copies: 2, range: 10, desc: 'Đổi chỗ 1 ngựa mình với 1 ngựa địch cách nhau tối đa 10 ô.' },
  xichchan: { name: 'Xích Chân', point: 2, kind: 'hex', aim: 'foe', copies: 2, desc: '1 ngựa địch nhận 2 lớp Xích Chân (chỉ đi được khi đổ 1 hoặc 2).' },
  songma: { name: 'Song Mã', point: 2, kind: 'buff', aim: 'own', copies: 2, desc: 'Ngựa này đi 2 ô ngay, rồi bạn vẫn đi thêm 1 ngựa khác.' },
  dobay: { name: 'Dò Bẫy', point: 2, kind: 'buff', aim: 'trap', copies: 2, desc: 'Xem loại 1 bẫy. Nếu nó nằm trong 12 ô trước một ngựa mình thì phá luôn.' },
  phandon: { name: 'Phản Đòn', point: 2, kind: 'react', aim: 'none', copies: 2, desc: 'Phản: đòn bị trả lại lên ngựa đi đầu của người đánh.' },
  // ---- 3 ----
  bangphong: { name: 'Băng Phong', point: 3, kind: 'hex', aim: 'foe', copies: 6, combo: true, desc: '1 lớp băng lên 1 ngựa địch. Combo: mỗi lá thêm 1 lớp, tối đa 3 lớp mỗi ngựa.' },
  daykeo: { name: 'Dây Kéo', point: 3, kind: 'hex', aim: 'foe', copies: 2, range: 4, desc: 'Kéo 1 ngựa địch lùi 4 ô.' },
  luine: { name: 'Lùi Né', point: 3, kind: 'buff', aim: 'ownN', copies: 2, range: 3, desc: '1 ngựa mình lùi tối đa 3 ô; dừng trúng ngựa địch thì đá.' },
  dolai: { name: 'Đổ Lại', point: 3, kind: 'buff', aim: 'none', copies: 2, desc: 'Bỏ kết quả 3, đổ lại và đi theo số mới.' },
  hapthu: { name: 'Hấp Thụ', point: 3, kind: 'react', aim: 'none', copies: 2, desc: 'Phản: huỷ lá đang nhắm vào bạn, rồi rút 1 lá.' },
  // ---- 4 ----
  cuopbai: { name: 'Cướp Bài', point: 4, kind: 'hex', aim: 'player', copies: 2, desc: 'Lấy ngẫu nhiên 1 lá trên tay 1 đối thủ.' },
  gioxo: { name: 'Gió Xô', point: 4, kind: 'hex', aim: 'anyN', copies: 2, range: 4, desc: 'Đẩy 1 ngựa bất kỳ tiến tối đa 4 ô (không đá ai). Đẩy vào bẫy thì bẫy nổ.' },
  hothuan: { name: 'Hộ Thuẫn', point: 4, kind: 'buff', aim: 'own', copies: 6, combo: true, desc: '1 ngựa không bị đá trong 3 lượt; mỗi lá Cản trúng nó tiêu 1 lớp. Combo: mỗi lá thêm 1 lớp.' },
  giap: { name: 'Giáp Bảo Hộ', point: 4, kind: 'buff', aim: 'own', copies: 2, desc: '1 ngựa: chặn và phá cái bẫy đầu tiên nó dính trong 3 lượt.' },
  batlui: { name: 'Bật Lùi', point: 4, kind: 'react', aim: 'none', copies: 2, desc: 'Phản: huỷ lá; ngựa đi đầu của người đánh lùi 2 ô.' },
  // ---- 5 ----
  dotkich: { name: 'Đột Kích', point: 5, kind: 'hex', aim: 'own', copies: 2, range: 5, desc: 'Ngựa mình lao tới ngựa địch gần nhất phía trước trong 5 ô và đá nó.' },
  locxoay: { name: 'Lốc Xoáy', point: 5, kind: 'hex', aim: 'square', copies: 2, range: 10, desc: 'Chọn 1 ô trong 10 ô quanh ngựa mình: ngựa địch trong 2 ô quanh đó lùi 2 ô.' },
  xuatchuong: { name: 'Xuất Chuồng', point: 5, kind: 'buff', aim: 'stable', copies: 2, desc: '1 ngựa ra ô xuất phát không cần đổ 6, rồi vẫn đi như thường.' },
  miennhiem: { name: 'Miễn Nhiễm', point: 5, kind: 'buff', aim: 'own', copies: 2, desc: '1 ngựa: tới lượt sau của bạn không chịu lá Cản, khống chế mới hay bẫy.' },
  hoagiai: { name: 'Hoá Giải', point: 5, kind: 'react', aim: 'none', copies: 2, desc: 'Phản: huỷ lá; người đánh bỏ 1 lá ngẫu nhiên.' },
  // ---- 6 ----
  doatvi: { name: 'Đoạt Vị', point: 6, kind: 'hex', aim: 'player', copies: 2, desc: 'Đổi chỗ ngựa đi đầu và ngựa đi cuối trên đường của 1 đối thủ.' },
  phongan: { name: 'Phong Ấn', point: 6, kind: 'hex', aim: 'player', copies: 2, desc: '1 đối thủ không được đánh bài (kể cả Phản) tới hết lượt sau của họ.' },
  dichchuyen: { name: 'Dịch Chuyển', point: 6, kind: 'buff', aim: 'ownDest', copies: 2, range: 10, desc: '1 ngựa mình bay tới ô trống trong 10 ô phía trước.' },
  xungphong: { name: 'Xung Phong', point: 6, kind: 'buff', aim: 'own', copies: 2, desc: 'Lượt này ngựa đó đi 12 ô thay vì 6 (không được thì đi 6).' },
  chiemdoat: { name: 'Chiếm Đoạt', point: 6, kind: 'react', aim: 'none', copies: 2, desc: 'Phản: huỷ lá hoặc combo, các lá đó về tay bạn.' },
  // ---- traps: any face, hidden kind ----
  bhoandoi: { name: 'Bẫy Hoán Đổi', point: 0, kind: 'trap', aim: 'square', copies: 2, desc: 'Ngựa địch dính: đổi chỗ với ngựa đi sau cùng của bạn.' },
  blienket: { name: 'Bẫy Liên Kết', point: 0, kind: 'trap', aim: 'square', copies: 2, desc: 'Ngựa địch dính: ngựa đi sau cùng của bạn đi ké theo nó trong 2 lượt ngựa.' },
  bdoathon: { name: 'Bẫy Đoạt Hồn', point: 0, kind: 'trap', aim: 'square', copies: 2, desc: 'Ngựa địch dính: bạn lấy 2 lá của chủ nó, họ không được đánh bài tới hết lượt sau.' },
  bhoden: { name: 'Bẫy Hố Đen', point: 0, kind: 'trap', aim: 'square', copies: 2, desc: 'Ngựa địch dính: về chuồng.' },
  bbanggioi: { name: 'Bẫy Băng Giới', point: 0, kind: 'trap', aim: 'square', copies: 2, desc: 'Ngựa địch dính: mọi ngựa không phải của bạn trong 3 ô nhận 2 lớp băng.' },
  bdaochieu: { name: 'Bẫy Đảo Chiều', point: 0, kind: 'trap', aim: 'square', copies: 2, desc: 'Ngựa địch dính: nhận 2 lớp Đảo Chiều (đi lùi theo xúc xắc).' },
  // ---- legends: one copy per game, from three identical rolls; played on that face ----
  l1: { name: 'Ngưng Đọng', point: 1, kind: 'legend', aim: 'none', copies: 0, desc: 'Huyền thoại: mọi ngựa địch trên đường nhận 1 lớp băng.' },
  l2: { name: 'Hoán Vị Vạn Mã', point: 2, kind: 'legend', aim: 'any2', copies: 0, desc: 'Huyền thoại: đổi chỗ 2 ngựa bất kỳ trên đường.' },
  l3: { name: 'Thiên Lôi', point: 3, kind: 'legend', aim: 'foe', copies: 0, desc: 'Huyền thoại: 1 ngựa địch trên đường về chuồng, xuyên khiên.' },
  l4: { name: 'Khiên Thiên Mã', point: 4, kind: 'legend', aim: 'none', copies: 0, desc: 'Huyền thoại: 2 lượt tới, mọi ngựa của bạn miễn bài, bẫy và bị đá.' },
  l5: { name: 'Cổng Sao', point: 5, kind: 'legend', aim: 'ownDest', copies: 0, desc: 'Huyền thoại: 1 ngựa (kể cả trong chuồng) bay tới ô trống bất kỳ phía trước, tới ô cổng.' },
  l6: { name: 'Giáng Thế', point: 6, kind: 'legend', aim: 'none', copies: 0, desc: 'Huyền thoại: đi xong được đổ thêm 2 lần, mỗi lần được đánh 1 lá.' },
};

export const LEGENDS = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6'];
export const DECK_SIZE = 12;
export const START_HAND = 4;
export const MAX_HAND = 6;
export const MAX_TRAPS = 2;
export const TRAP_LIFE = 3;
export const MAX_LAYERS = 3;
export const TRI = [0, 1, 3, 6, 10, 15, 21]; // Tích Lực squares by level

export const card = (id: string): CardDef | undefined => DUEL_CARDS[id];
