// Game screen: plays server/local updates through the renderer and turns clicks into actions.
import { GATE, WIN_STEP, seatOf } from '../../core/board.ts';
import { legalActions, target } from '../../core/engine.ts';
import type { Action, GameEvent, GameState } from '../../core/types.ts';
import { CARD_INFO } from '../../core/variants/party/cards.ts';
import { TILE_INFO } from '../../core/variants/party/tiles.ts';
import { getVariant } from '../../core/variants/index.ts';
import { BOT_LABEL } from '../../protocol.ts';
import type { Update } from '../../session.ts';
import { unlock } from '../audio/engine.ts';
import { music } from '../audio/music.ts';
import { sfx, type Sfx } from '../audio/sfx.ts';
import { look, saveLook, themeSelect, type Look } from '../look.ts';
import { BOARD_THEMES, isBoardTheme } from '../render/board-themes.ts';
import { loadBoard, loadDice, type BoardRenderer, type DiceRenderer, type TemplateKind } from '../render/renderer.ts';
import { confetti, cutIn } from '../render/fx.ts';
import { CARD_SKIN, TILE_SKIN } from '../render/skins.ts';
import { THEME, seatColor } from '../render/theme.ts';
import { esc } from './dom.ts';
import { icon } from './icons.ts';
import '../arena.css';
import '../atlas.css';
import '../spirit.css';

export interface Conn {
  send(a: Action): void;
  controls(player: number): boolean; // may this browser act for that player?
  leave(): void;
  restart?(): void; // offline: replay, online host: back to lobby
  restartLabel?: string;
}

export class GameScreen {
  private el: HTMLElement;
  private board!: BoardRenderer; // set by the first queued template swap
  private dice!: DiceRenderer;
  private shown: Partial<Look> = {}; // templates currently on screen
  private status: HTMLElement;
  private panels: HTMLElement[] = [];
  private s?: GameState;
  private tasks: (() => Promise<void>)[] = []; // updates and template swaps run strictly in order
  private busy = false;
  private canRoll = false;
  private waiting = false; // an action was sent, wait for the answer
  private aiming?: string; // card being targeted
  private autoMove?: ReturnType<typeof setTimeout>;
  private conn: Conn;
  private keyHandler = (e: KeyboardEvent) => {
    if (e.code === 'Escape' && this.aiming) (this.aiming = undefined), this.refreshInput();
  };

  constructor(host: HTMLElement, conn: Conn) {
    this.conn = conn;
    this.el = document.createElement('div');
    this.el.className = 'game';
    this.el.innerHTML = `
      <header class="topbar">
        <button class="btn ghost" data-leave aria-label="Về menu">${icon('back')}<span class="lbl"> Menu</span></button>
        <div class="arena-brand arena-only">${icon('star')} Cờ Cá Ngựa</div>
        <div class="status" aria-live="polite"></div>
        <button class="btn ghost icon" data-sfx></button>
        <button class="btn ghost icon" data-music></button>
        <button class="btn ghost icon" data-look title="Giao diện" aria-label="Giao diện">${icon('layers')}</button>
        <button class="btn ghost" data-help aria-label="Luật chơi">${icon('book')}<span class="lbl"> Luật</span></button>
      </header>
      <div class="table"><div class="grid">
        <div class="arena-stage">
          <div class="arena-heading arena-only"><h1>Đảo trên mây</h1><span data-variant></span></div>
          <div class="board-slot"></div>
        </div>
        <div class="arena-rail">
          <div class="dock">
            <div class="turn-portrait arena-only"><span>Lượt hiện tại</span><strong data-turn-name></strong></div>
            <div class="roll-well"><div class="dice-slot"></div>
              <button class="roll-button arena-only" data-roll disabled>Đổ xúc xắc <kbd>Space</kbd></button>
              <button class="btn" data-pass hidden>Bỏ lượt</button>
            </div>
          </div>
          <section class="roster">
            <header class="roster-title arena-only"><h2>Kỵ sĩ</h2><span data-round></span></header>
            <div class="panel-slot s0"></div><div class="panel-slot s1"></div>
            <div class="panel-slot s2"></div><div class="panel-slot s3"></div>
          </section>
        </div>
      </div></div>
      <div class="overlay" hidden></div>`;
    host.appendChild(this.el);
    this.status = this.el.querySelector('.status')!;
    this.setLook({ ...look }); // first task: load the chosen templates before any update is drawn
    this.panels = [0, 1, 2, 3].map(i => this.el.querySelector<HTMLElement>(`.s${i}`)!);
    this.el.querySelector<HTMLButtonElement>('[data-leave]')!.onclick = () => conn.leave();
    this.el.querySelector<HTMLButtonElement>('[data-help]')!.onclick = () => this.showHelp();
    this.el.querySelector<HTMLButtonElement>('[data-look]')!.onclick = () => this.showLook();
    this.el.querySelector<HTMLButtonElement>('[data-pass]')!.onclick = () => this.send({ type: 'pass' });
    this.el.querySelector<HTMLButtonElement>('[data-roll]')!.onclick = () => this.canRoll && this.send({ type: 'roll' });
    addEventListener('keydown', this.keyHandler);
    this.setupSound();
  }

  destroy() {
    clearTimeout(this.autoMove);
    removeEventListener('keydown', this.keyHandler);
    music.play(false);
    this.tasks = [];
    this.board?.destroy();
    this.dice?.destroy();
    this.el.remove();
  }

  private setupSound() {
    const sfxBtn = this.el.querySelector<HTMLButtonElement>('[data-sfx]')!;
    const musicBtn = this.el.querySelector<HTMLButtonElement>('[data-music]')!;
    const paint = () => {
      sfxBtn.innerHTML = icon(sfx.enabled ? 'sound' : 'mute');
      sfxBtn.title = sfx.enabled ? 'Tắt hiệu ứng âm thanh' : 'Bật hiệu ứng âm thanh';
      musicBtn.innerHTML = icon('music');
      musicBtn.style.opacity = music.enabled ? '1' : '.45';
      musicBtn.title = music.enabled ? 'Tắt nhạc nền' : 'Bật nhạc nền';
      sfxBtn.setAttribute('aria-label', sfxBtn.title);
      musicBtn.setAttribute('aria-label', musicBtn.title);
    };
    sfxBtn.onclick = () => (sfx.setEnabled(!sfx.enabled), paint());
    musicBtn.onclick = () => (music.setEnabled(!music.enabled), paint());
    paint();
    // audio may only start after a user gesture; the menu click that opened this screen usually counts
    unlock();
    music.play(true);
  }

  update(u: Update) {
    const copy = structuredClone(u);
    this.enqueue(() => this.apply(copy));
  }

  /** Swap board and/or dice templates. Queued, so it never cuts an animation in half. */
  setLook(l: Look) {
    this.enqueue(() => this.swap(l));
  }

  private enqueue(task: () => Promise<void>) {
    this.tasks.push(task);
    if (!this.busy) this.drain();
  }

  private async drain() {
    this.busy = true;
    while (this.tasks.length) {
      try {
        await this.tasks.shift()!();
      } catch (e) {
        console.error(e); // a broken animation must not freeze the game
      }
    }
    this.busy = false;
    this.refreshInput();
  }

  private async apply(u: Update) {
    if (!this.s) {
      this.board.build(u.state);
      this.s = u.state;
      this.renderPanels();
    }
    this.waiting = false;
    this.lockInput();
    for (const e of u.events) await this.play(e);
    this.s = u.state;
    this.board.sync(u.state);
    this.board.setTurn(u.state.phase === 'over' ? -1 : seatOf(u.state, u.state.turn));
    this.renderPanels();
  }

  private async swap(l: Look) {
    const needBoard = l.board !== this.shown.board || l.theme !== this.shown.theme;
    const needDice = l.dice !== this.shown.dice;
    if (!needBoard && !needDice) return;
    if (this.board && this.dice) this.lockInput();
    const before = this.status.innerHTML;
    if ((needBoard && l.board === '3d') || (needDice && l.dice === '3d')) this.say('Đang tải giao diện 3D…');
    const [makeBoard, makeDice] = await Promise.all([needBoard && loadBoard(l.board, l.theme), needDice && loadDice(l.dice)]);
    if (makeBoard) {
      this.board?.destroy();
      this.board = makeBoard(this.el.querySelector('.board-slot')!);
      this.board.onHop = () => sfx.play('hop');
      this.el.classList.toggle('full-board', !!this.board.fullTable);
      const layered = !this.board.fullTable && l.theme !== 'original';
      this.el.dataset.theme = this.board.fullTable ? '3d' : l.theme;
      this.el.dataset.boardTheme = l.theme; // lets 3D pick up the theme's backdrop
      this.el.classList.toggle('arena-game', layered && l.theme !== 'atlas');
      this.el.classList.toggle('atlas-game', layered && l.theme === 'atlas');
      this.el.querySelector('.arena-heading h1')!.textContent = l.theme === 'atlas' ? 'Tinh bàn' : BOARD_THEMES[l.theme];
      this.el.querySelector('.arena-brand')!.innerHTML = icon('star') + (l.theme === 'atlas' ? ' Thiên Mã' : ' Cờ Cá Ngựa');
      const anchor = this.el.querySelector(layered ? '.roll-well' : '[data-sfx]')!;
      anchor.before(this.status);
      if (this.s) {
        this.board.build(this.s);
        this.board.setTurn(this.s.phase === 'over' ? -1 : seatOf(this.s, this.s.turn));
      }
    }
    if (makeDice) {
      this.dice?.destroy();
      this.dice = makeDice(this.el.querySelector('.dice-slot')!, () => this.diceArena());
      this.dice.onRoll = toss => this.send({ type: 'roll', toss });
    }
    this.shown = { ...l };
    this.say(before);
  }

  /** Where a thrown die may roll: the board. A full-table board is a square in the middle of the table. */
  private diceArena() {
    const r = this.el.querySelector('.board-slot')!.getBoundingClientRect();
    if (!this.board?.fullTable) return r;
    const s = Math.min(r.width, r.height) * 0.9;
    return new DOMRect(r.x + (r.width - s) / 2, r.y + (r.height - s) / 2, s, s);
  }

  // ---------- events ----------

  private name(p: number) {
    return esc(this.s!.players[p].name);
  }
  private color(p: number) {
    return seatColor(seatOf(this.s!, p));
  }

  private async play(e: GameEvent) {
    const s = this.s!;
    switch (e.t) {
      case 'roll':
        this.say(`${this.name(e.player)} đổ được <b>${e.value}</b>`);
        sfx.play('roll');
        void this.board.animate(e); // 3D atlas: the centre flag catches a gust
        await this.dice.roll(e.value, this.color(e.player).main, e.toss);
        sfx.play('land');
        break;
      case 'move':
      case 'kick':
      case 'tile':
      case 'shield':
        if (e.t === 'move') {
          sfx.resetHop();
          if (e.path.length === 1 && e.path[0] === 0 && !e.jump) sfx.play('exit');
        }
        if (e.t === 'kick') sfx.play('kick');
        if (e.t === 'tile') sfx.play(e.tile as Sfx);
        if (e.t === 'kick') this.say(`💥 ${this.name(s.horses[e.by].owner)} đá ngựa của ${this.name(s.horses[e.horse].owner)}!`);
        if (e.t === 'tile') this.say(`${TILE_SKIN[e.tile].icon} ${TILE_INFO[e.tile].name}: ${TILE_INFO[e.tile].desc}`);
        await this.board.animate(e);
        break;
      case 'pass':
        this.say(`${this.name(e.player)} không đi được`);
        sfx.play('pass');
        await wait(350);
        break;
      case 'freeze':
        if (e.on) {
          sfx.play('ice');
          this.say(`❄ Ngựa của ${this.name(s.horses[e.horse].owner)} bị đóng băng, lượt tới không được đi!`);
        }
        await this.board.animate(e);
        break;
      case 'gain':
        this.say(`${CARD_SKIN[e.card]} ${this.name(e.player)} nhận thẻ <b>${CARD_INFO[e.card].name}</b>`);
        sfx.play('gain');
        this.s!.players[e.player].cards.push(e.card);
        this.renderPanels();
        await wait(300);
        break;
      case 'card': {
        this.say(`${CARD_SKIN[e.card]} ${this.name(e.player)} dùng <b>${CARD_INFO[e.card].name}</b>`);
        sfx.play('card');
        const hand = this.s!.players[e.player].cards;
        hand.splice(hand.indexOf(e.card), 1);
        this.renderPanels();
        await (e.target >= 0 ? this.board.cheer(e.target, CARD_SKIN[e.card], '#fff') : wait(300));
        break;
      }
      case 'turn':
        this.s = { ...s, turn: e.player };
        this.board.setTurn(seatOf(s, e.player));
        this.say(`Lượt của <b>${this.name(e.player)}</b>`);
        this.renderPanels();
        if (this.conn.controls(e.player) && !s.players[e.player].bot) {
          sfx.play('turn');
          await cutIn(this.el, `Lượt của ${this.name(e.player)}!`, this.color(e.player).main);
        }
        break;
      case 'win':
        this.say(`🏆 ${this.name(e.player)} chiến thắng!`);
        music.play(false);
        sfx.play('win');
        confetti(document.body, THEME.seats.map(c => c.main).concat('#ffffff'));
        this.showWin(e.player);
        break;
    }
  }

  // ---------- input ----------

  private send(a: Action) {
    if (this.waiting) return;
    this.waiting = true;
    this.aiming = undefined;
    this.lockInput();
    this.conn.send(a);
  }

  private lockInput() {
    clearTimeout(this.autoMove);
    this.canRoll = false;
    this.el.querySelector<HTMLButtonElement>('[data-roll]')!.disabled = true;
    this.dice.setReady(false, '');
    this.board.setPickable([]);
    this.el.querySelector<HTMLButtonElement>('[data-pass]')!.hidden = true;
  }

  private refreshInput() {
    const s = this.s;
    this.lockInput();
    if (!s || this.waiting || s.phase === 'over' || !this.conn.controls(s.turn) || s.players[s.turn].bot) return this.renderPanels();
    const acts = legalActions(s);

    if (this.aiming) {
      const cardActs = acts.filter(a => a.type === 'card' && a.card === this.aiming) as Extract<Action, { type: 'card' }>[];
      const pick = (id: number) => cardActs.find(a => a.target === id);
      const ids = s.horses.filter(h => pick(h.id)).map(h => h.id);
      this.say(`${CARD_SKIN[this.aiming]} Chọn mục tiêu cho <b>${CARD_INFO[this.aiming].name}</b> (Esc để huỷ)`);
      this.board.setPickable(ids, id => this.send(pick(id)!));
      return this.renderPanels();
    }

    if (s.phase === 'roll') {
      this.canRoll = true;
      this.el.querySelector<HTMLButtonElement>('[data-roll]')!.disabled = false;
      this.dice.setReady(true, this.color(s.turn).main);
      this.say(`Lượt của <b>${this.name(s.turn)}</b> — giữ xúc xắc (hoặc phím Space) để lắc, thả hoặc vuốt để quăng`);
    } else {
      const moves = acts.filter(a => a.type === 'move') as Extract<Action, { type: 'move' }>[];
      if (acts.length === 1 && moves.length === 1) {
        this.autoMove = setTimeout(() => this.send(moves[0]), 350); // only one choice: play it
        return this.renderPanels();
      }
      this.board.setPickable(
        moves.map(m => m.horse),
        id => this.send({ type: 'move', horse: id }),
        id => target(s, s.horses[id], s.dice),
      );
      this.el.querySelector<HTMLButtonElement>('[data-pass]')!.hidden = !acts.some(a => a.type === 'pass');
      if (moves.length) this.say(`${this.name(s.turn)} đổ <b>${s.dice}</b> — chọn ngựa để đi`);
    }
    this.renderPanels();
  }

  private say(html: string) {
    this.status.innerHTML = html;
  }

  // ---------- panels / overlays ----------

  private renderPanels() {
    const s = this.s;
    if (!s) return;
    const acts = this.conn.controls(s.turn) && !this.waiting && !this.busy ? legalActions(s) : [];
    this.el.querySelector('[data-variant]')!.textContent = getVariant(s.variant).name;
    this.el.querySelector('[data-round]')!.textContent = `Vòng ${String(s.round).padStart(2, '0')}`;
    this.el.querySelector('[data-turn-name]')!.textContent = s.players[s.turn].name;
    this.el.style.setProperty('--turn-color', this.color(s.turn).light);
    this.el.dataset.turnSeat = String(seatOf(s, s.turn));
    this.panels.forEach(p => (p.innerHTML = ''));
    s.players.forEach((p, i) => {
      const c = seatColor(p.seat);
      const home = s.horses.filter(h => h.owner === i && h.pos >= GATE + WIN_STEP).length;
      const out = s.horses.filter(h => h.owner === i && h.pos >= 0).length;
      const tag = p.bot ? `Bot ${BOT_LABEL[p.bot]}` : this.conn.controls(i) ? 'Bạn' : 'Người chơi';
      const panel = this.panels[p.seat];
      panel.innerHTML = `
        <div class="pcard ${s.turn === i && s.phase !== 'over' ? 'active' : ''} ${s.winner === i ? 'winner' : ''}" style="--c:${c.main};--l:${c.light};--d:${c.dark}">
          <div class="avatar" data-seat="${p.seat}">${THEME.horseGlyph}</div>
          <div class="pinfo">
            <div class="pname">${esc(p.name)} ${s.horses.some(h => h.owner === i && h.frozen) ? '<span title="Có ngựa bị đóng băng">❄</span>' : ''}</div>
            <div class="ptag">${tag}</div>
            <div class="cards"></div>
          </div>
          <div class="horse-stats"><span title="Đã xuất chuồng" aria-label="${out} ngựa đã xuất chuồng">${icon('hoof')}${out}/4</span><span title="Đã về đích" aria-label="${home} ngựa đã về đích">${icon('flag')}${home}/4</span></div>
        </div>`;
      const cardsEl = panel.querySelector('.cards')!;
      p.cards.forEach(card => {
        const b = document.createElement('button');
        b.className = 'card-chip';
        b.title = `${CARD_INFO[card].name}: ${CARD_INFO[card].desc}`;
        b.innerHTML = `${CARD_SKIN[card]} <small>${CARD_INFO[card].name}</small>`;
        const usable = s.turn === i && acts.some(a => a.type === 'card' && a.card === card);
        b.disabled = !usable;
        b.classList.toggle('aiming', this.aiming === card);
        b.onclick = () => {
          const a = acts.find(x => x.type === 'card' && x.card === card) as Extract<Action, { type: 'card' }>;
          if (a.target < 0) return this.send(a);
          this.aiming = this.aiming === card ? undefined : card;
          this.refreshInput();
        };
        cardsEl.appendChild(b);
      });
    });
  }

  private showWin(p: number) {
    const o = this.el.querySelector<HTMLElement>('.overlay')!;
    const c = this.color(p);
    o.hidden = false;
    o.innerHTML = `
      <div class="modal win" style="--c:${c.main}">
        <div class="trophy">🏆</div>
        <h2>${this.name(p)} thắng rồi!</h2>
        <p>Sau ${this.s!.round} vòng đấu nảy lửa.</p>
        <div class="row">
          ${this.conn.restart ? `<button class="btn" data-again>${this.conn.restartLabel ?? 'Chơi lại'}</button>` : ''}
          <button class="btn ghost" data-menu>Menu</button>
        </div>
      </div>`;
    o.querySelector<HTMLButtonElement>('[data-again]')?.addEventListener('click', () => this.conn.restart!());
    o.querySelector<HTMLButtonElement>('[data-menu]')!.onclick = () => this.conn.leave();
  }

  /** In-game appearance picker: board and dice templates are chosen independently and applied live. */
  private showLook() {
    const o = this.el.querySelector<HTMLElement>('.overlay')!;
    const seg = (name: 'board' | 'dice', label: string) => `
      <div class="look-row"><b>${label}</b><span class="seg" role="radiogroup" aria-label="${label}">${(['2d', '3d'] as TemplateKind[])
        .map(k => `<label><input type="radio" name="${name}" value="${k}" ${look[name] === k ? 'checked' : ''}>${k.toUpperCase()}</label>`)
        .join('')}</span></div>`;
    o.hidden = false;
    o.innerHTML = `
      <div class="modal look">
        <h2>🎨 Giao diện</h2>
        ${seg('board', 'Bản đồ')}
        ${themeSelect()}
        ${seg('dice', 'Xúc xắc')}
        <p class="hint">Đổi ngay trong ván, không ảnh hưởng người chơi khác. 3D cần tải thêm lần đầu.</p>
        <div class="row"><button class="btn" data-close>Xong</button></div>
      </div>`;
    o.querySelectorAll<HTMLInputElement>('input[type=radio]').forEach(r =>
      (r.onchange = () => {
        look[r.name as 'board' | 'dice'] = r.value as TemplateKind;
        saveLook();
        this.setLook({ ...look });
      }),
    );
    o.querySelector<HTMLSelectElement>('[data-theme-select]')!.onchange = e => {
      const value = (e.currentTarget as HTMLSelectElement).value;
      if (!isBoardTheme(value)) return;
      look.theme = value;
      saveLook();
      this.setLook({ ...look });
    };
    o.querySelector<HTMLButtonElement>('[data-close]')!.onclick = () => (o.hidden = true);
  }

  private showHelp() {
    const s = this.s;
    if (!s) return;
    const v = getVariant(s.variant);
    const o = this.el.querySelector<HTMLElement>('.overlay')!;
    const party = s.variant === 'party';
    o.hidden = false;
    o.innerHTML = `
      <div class="modal help">
        <h2>${esc(v.name)}</h2>
        <p>${esc(v.desc)}</p>
        <ul class="rules">
          <li>Đổ <b>${v.exitOn.join(' hoặc ')}</b> để xuất chuồng. Đổ <b>6</b> được đổ thêm lượt.</li>
          <li>Không được nhảy qua ngựa khác. Đi đúng vào ô có ngựa địch = <b>đá</b> nó về chuồng.</li>
          <li>Phải dừng đúng ở <b>cửa chuồng</b> (ô trước hàng số). Từ cửa, đổ <i>n</i> lên thẳng bậc <i>n</i>; trong chuồng muốn lên bậc <i>k+1</i> phải đổ đúng <i>k+1</i>.</li>
          <li>Thắng khi cả 4 ngựa đứng ở bậc <b>3–6</b>.</li>
        </ul>
        ${party ? `<h3>Ô đặc biệt</h3><ul class="legend">${Object.entries(TILE_INFO).map(([k, t]) => `<li><span class="ico" style="background:${TILE_SKIN[k].color}">${TILE_SKIN[k].icon}</span><b>${t.name}</b> — ${t.desc}</li>`).join('')}</ul>
        <h3>Thẻ bài</h3><ul class="legend">${Object.entries(CARD_INFO).map(([k, c]) => `<li><span class="ico">${CARD_SKIN[k]}</span><b>${c.name}</b> — ${c.desc}</li>`).join('')}</ul>` : ''}
        <div class="row"><button class="btn" data-close>Đã hiểu!</button></div>
      </div>`;
    o.querySelector<HTMLButtonElement>('[data-close]')!.onclick = () => (o.hidden = true);
  }
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
