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
import { look, saveLook, type Look } from '../look.ts';
import { loadBoard, loadDice, type BoardRenderer, type DiceRenderer, type TemplateKind } from '../render/renderer.ts';
import { confetti } from '../render/fx.ts';
import { SmokeCall } from '../render3d/smoke-call.ts';
import { chargeOf } from '../dice/motion.ts';
import { CARD_SKIN, TILE_SKIN } from '../render/skins.ts';
import { THEME, seatColor } from '../render/theme.ts';
import { esc } from './dom.ts';
import { icon } from './icons.ts';
import { DuelUI } from './duel.ts';
import { DUEL_CARDS } from '../../core/variants/duel/cards.ts';
import { DUEL_SKIN, KIND_COLOR, STATUS_ICON } from '../render/skins.ts';
import '../atlas.css';

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
  private smoke?: SmokeCall; // spirit smoke behind the turn notice
  private panels: HTMLElement[] = [];
  private s?: GameState;
  private tasks: (() => Promise<void>)[] = []; // updates and template swaps run strictly in order
  private busy = false;
  private canRoll = false;
  private waiting = false; // an action was sent, wait for the answer
  private aiming?: string; // card being targeted
  private autoMove?: ReturnType<typeof setTimeout>;
  private shaking?: ReturnType<typeof setTimeout>;
  private conn: Conn;
  private duel?: DuelUI; // duel mode: hand tray, draft, reactions
  private keyHandler = (e: KeyboardEvent) => {
    if (e.code === 'Escape' && this.duel?.targeting) this.duel.cancel();
    if (e.code === 'Escape' && this.aiming) (this.aiming = undefined), this.refreshInput();
  };

  constructor(host: HTMLElement, conn: Conn) {
    this.conn = conn;
    this.el = document.createElement('div');
    this.el.className = 'game';
    this.el.innerHTML = `
      <header class="topbar">
        <button class="btn ghost icon" data-leave title="Về menu" aria-label="Về menu">${icon('back')}</button>
        <div class="arena-brand arena-only">${icon('star')} Thiên Mã</div>
        <div class="status" aria-live="polite"></div>
        <button class="btn ghost icon" data-follow hidden></button>
        <button class="btn ghost icon" data-settings title="Cài đặt" aria-label="Cài đặt">${icon('gear')}</button>
        <button class="btn ghost icon" data-help title="Luật chơi" aria-label="Luật chơi">${icon('help')}</button>
      </header>
      <div class="table"><div class="grid">
        <div class="arena-stage">
          <div class="arena-heading arena-only"><h1>Tinh bàn</h1><span data-variant></span></div>
          <div class="board-slot"></div>
        </div>
        <div class="arena-rail">
          <div class="dock">
            <div class="turn-portrait arena-only"><span>Lượt hiện tại</span><strong data-turn-name></strong></div>
            <div class="roll-well"><div class="dice-slot"></div>
              <button class="roll-button arena-only" data-roll disabled>Đổ xúc xắc <kbd>Space</kbd></button>
              <button class="btn" data-pass hidden>Bỏ lượt</button>
            </div>
            <div class="hand" aria-label="Thẻ bài của người đang tới lượt"></div>
          </div>
          <section class="roster">
            <header class="roster-title arena-only"><h2>Kỵ sĩ</h2><span data-round></span></header>
            <div class="panel-slot s0"></div><div class="panel-slot s1"></div>
            <div class="panel-slot s2"></div><div class="panel-slot s3"></div>
          </section>
        </div>
      </div></div>
      <div class="turn-call" role="status" hidden><canvas class="call-smoke" aria-hidden="true"></canvas><span class="call-box"></span></div>
      <div class="overlay" hidden></div>`;
    host.appendChild(this.el);
    this.status = this.el.querySelector('.status')!;
    try {
      this.smoke = new SmokeCall(this.el.querySelector('.call-smoke')!);
    } catch (e) {
      console.warn('turn smoke unavailable', e); // the notice still shows, without smoke
    }
    this.setLook({ ...look }); // first task: load the chosen templates before any update is drawn
    this.panels = [0, 1, 2, 3].map(i => this.el.querySelector<HTMLElement>(`.s${i}`)!);
    this.el.querySelector<HTMLButtonElement>('[data-leave]')!.onclick = () => conn.leave();
    this.el.querySelector<HTMLButtonElement>('[data-help]')!.onclick = () => this.showHelp();
    this.el.querySelector<HTMLButtonElement>('[data-settings]')!.onclick = () => this.showSettings();
    this.el.querySelector<HTMLButtonElement>('[data-follow]')!.onclick = () => {
      look.follow = !look.follow;
      saveLook();
      this.showFollow();
    };
    this.el.querySelector<HTMLButtonElement>('[data-pass]')!.onclick = () => this.send({ type: 'pass' });
    this.el.querySelector<HTMLButtonElement>('[data-roll]')!.onclick = () => this.canRoll && this.send({ type: 'roll' });
    addEventListener('keydown', this.keyHandler);
    unlock(); // audio may only start after a user gesture; the menu click that opened this screen usually counts
    music.play(true);
  }

  destroy() {
    clearTimeout(this.autoMove);
    this.shakeSound(false);
    removeEventListener('keydown', this.keyHandler);
    music.play(false);
    this.tasks = [];
    this.board?.destroy();
    this.dice?.destroy();
    this.smoke?.destroy();
    this.duel?.destroy();
    this.el.remove();
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
    if (u.state.duel && !this.duel)
      this.duel = new DuelUI(this.el, {
        me: () => this.me(),
        send: a => this.send(a),
        say: html => this.say(html),
        board: () => this.board,
        name: p => this.name(p),
        color: p => this.color(p).main,
        refresh: () => this.refreshInput(),
      });
    this.placeHand();
    if (!this.s) {
      this.build(u.state);
      this.s = u.state;
      this.renderPanels();
      if (u.state.phase !== 'over') this.announce(u.state.turn); // rejoining mid-turn: no 'turn' event comes
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
    const needBoard = l.board !== this.shown.board;
    const needDice = l.dice !== this.shown.dice;
    if (!needBoard && !needDice) return;
    if (this.board && this.dice) this.lockInput();
    const before = this.status.innerHTML;
    if ((needBoard && l.board === '3d') || (needDice && l.dice === '3d')) this.say('Đang tải giao diện 3D…');
    const [makeBoard, makeDice] = await Promise.all([needBoard && loadBoard(l.board), needDice && loadDice(l.dice)]);
    if (makeBoard) {
      this.board?.destroy();
      this.board = makeBoard(this.el.querySelector('.board-slot')!);
      this.board.onHop = () => sfx.play('hop');
      this.el.classList.toggle('full-board', !!this.board.fullTable);
      this.showFollow();
      const layered = !this.board.fullTable;
      this.el.dataset.theme = layered ? 'atlas' : '3d';
      const anchor = this.el.querySelector(layered ? '.roll-well' : '[data-settings]')!;
      anchor.before(this.status);
      this.placeHand();
      if (this.s) {
        this.build(this.s);
        this.board.setTurn(this.s.phase === 'over' ? -1 : seatOf(this.s, this.s.turn));
      }
    }
    if (makeDice) {
      this.shakeSound(false);
      this.dice?.destroy();
      this.dice = makeDice(this.el.querySelector('.dice-slot')!, () => this.diceArena());
      this.dice.onRoll = toss => this.send({ type: 'roll', toss });
      this.dice.onShake = on => this.shakeSound(on);
    }
    this.shown = { ...l };
    this.say(before);
  }

  private placeHand() {
    this.duel?.place(this.board && !this.board.fullTable ? this.el.querySelector<HTMLElement>('.arena-rail') : null);
  }

  /** Draw a fresh board, seen from this browser's own seat (spectators keep the default view). */
  private build(s: GameState) {
    this.board.build(s);
    const me = s.players.findIndex((p, i) => this.conn.controls(i) && !p.bot);
    if (me >= 0) this.board.face?.(seatOf(s, me));
  }

  /** The lock button: shown when the board can turn to the player on turn; locked = the view stays where the player left it. */
  private showFollow() {
    const b = this.el.querySelector<HTMLButtonElement>('[data-follow]')!;
    b.hidden = this.board?.follow === undefined;
    if (this.board && !b.hidden) this.board.follow = look.follow;
    const label = look.follow ? 'Khoá góc nhìn (bàn đang tự quay theo lượt)' : 'Mở khoá: bàn tự quay theo lượt';
    Object.assign(b, { title: label, innerHTML: icon(look.follow ? 'unlock' : 'lock') });
    b.setAttribute('aria-label', label);
    b.setAttribute('aria-pressed', String(!look.follow));
  }

  /** Rattle while the die is held: faster the longer it is shaken (same charge curve as the throw). */
  private shakeSound(on: boolean) {
    clearTimeout(this.shaking);
    if (!on) return;
    const t0 = performance.now();
    const tick = () => {
      sfx.play('shake');
      this.shaking = setTimeout(tick, 150 - 85 * chargeOf(performance.now() - t0));
    };
    tick();
  }

  /** Where a thrown die may roll: the board. A full-table board is a square in the middle of the table. */
  private diceArena() {
    const r = this.el.querySelector('.board-slot')!.getBoundingClientRect();
    if (!this.board?.fullTable) return r;
    const s = Math.min(r.width, r.height) * 0.9;
    return new DOMRect(r.x + (r.width - s) / 2, r.y + (r.height - s) / 2, s, s);
  }

  // ---------- events ----------

  /** The player this browser plays, -1 when only watching (bots never count). */
  private me() {
    return this.s ? this.s.players.findIndex((p, i) => this.conn.controls(i) && !p.bot) : -1;
  }

  private cardName(id: string) {
    const c = DUEL_CARDS[id];
    return c ? `${DUEL_SKIN[id]} <b>${esc(c.name)}</b>` : 'một lá bài';
  }

  /** Duel events: texts and sounds here, visuals in the board renderer and DuelUI. */
  private async playDuel(e: GameEvent) {
    const s = this.s!;
    const hand = (p: number) => s.players[p].cards;
    /** Take a card out of a hand as this browser sees it (other players' cards are '?'). */
    const take = (p: number, card: string) => {
      const h = hand(p), i = h.indexOf(card), j = i >= 0 ? i : h.indexOf('?');
      if (j >= 0) h.splice(j, 1);
    };
    switch (e.t) {
      case 'pick':
        s.duel!.pool[e.card]--;
        s.duel!.lists[e.player].push(e.card);
        this.say(`${this.name(e.player)} chọn ${this.cardName(e.card)}`);
        sfx.play('gain');
        this.renderPanels();
        await wait(s.players[e.player].bot ? 120 : 60);
        break;
      case 'begin':
        this.say('Bộ bài đã xong. Vào trận!');
        sfx.play('turn');
        break;
      case 'draw':
        hand(e.player).push(e.card);
        if (e.player === this.me()) sfx.play('gain');
        this.renderPanels();
        break;
      case 'discard':
        take(e.player, e.card);
        this.say(`${this.name(e.player)} bỏ ${this.cardName(e.card)}`);
        this.renderPanels();
        break;
      case 'play':
        for (const pk of e.picks) if (DUEL_CARDS[pk.card]?.kind !== 'legend') take(e.player, pk.card);
        if (DUEL_CARDS[e.picks[0].card]?.kind === 'legend') s.duel!.legend[e.player] = '';
        this.renderPanels();
        sfx.play('card');
        this.say(`${this.name(e.player)} đánh ${e.picks.map(p => this.cardName(p.card)).join(' + ')}`);
        await this.duel?.play(e);
        break;
      case 'react':
        take(e.player, e.card);
        this.renderPanels();
        this.say(`${this.name(e.player)} phản bằng ${this.cardName(e.card)}!`);
        sfx.play('card');
        await this.duel?.play(e);
        break;
      case 'legend':
        s.duel!.legend[e.player] = e.card;
        this.say(`🌟 ${this.name(e.player)} đổ trùng 3 lần: nhận ${this.cardName(e.card)}!`);
        sfx.play('win');
        await this.duel?.play(e);
        break;
      case 'status':
        if (e.n > 0 && (e.kind === 'ice' || e.kind === 'rev' || e.kind === 'chain')) sfx.play('ice');
        if (e.n > 0 && (e.kind === 'guard' || e.kind === 'armor' || e.kind === 'immune')) sfx.play('shield');
        await this.board.animate(e);
        break;
      case 'trap':
        if (e.on) this.say(`${this.name(e.owner)} úp một bẫy ${e.kind !== '?' ? `(${this.cardName(e.kind)})` : ''}`);
        if (e.on) sfx.play('trap');
        await this.board.animate(e);
        break;
      case 'spring':
        this.say(`💥 Ngựa của ${this.name(s.horses[e.horse].owner)} dính ${this.cardName(e.kind)} của ${this.name(e.owner)}!`);
        sfx.play('bomb');
        await this.board.animate(e);
        break;
      case 'reveal':
        this.say(`🔍 Bẫy đó là ${this.cardName(e.kind)}`);
        await wait(600);
        break;
      case 'steal':
        take(e.from, e.card);
        hand(e.to).push(e.card);
        this.say(`${this.name(e.to)} lấy ${e.card !== '?' ? this.cardName(e.card) : 'một lá'} của ${this.name(e.from)}`);
        sfx.play('gain');
        this.renderPanels();
        await wait(300);
        break;
      case 'seal':
        if (e.on) this.say(`🔒 ${this.name(e.player)} bị Phong Ấn: chưa được đánh bài`);
        await wait(e.on ? 400 : 0);
        break;
      case 'link':
        if (e.on) this.say(`🔗 Liên Kết: ngựa của ${this.name(s.horses[e.follower].owner)} đi ké`);
        await this.board.animate(e);
        break;
    }
  }

  private name(p: number) {
    return esc(this.s!.players[p].name);
  }
  private color(p: number) {
    return seatColor(seatOf(this.s!, p));
  }

  private async play(e: GameEvent) {
    const s = this.s!;
    if (s.duel && ['pick', 'begin', 'draw', 'discard', 'play', 'react', 'legend', 'status', 'trap', 'spring', 'reveal', 'steal', 'seal', 'link'].includes(e.t))
      return this.playDuel(e);
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
        if (this.announce(e.player)) sfx.play('turn');
        break;
      case 'win':
        this.el.querySelector<HTMLElement>('.turn-call')!.hidden = true;
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
    this.board?.setSquares([]);
    if (!s || this.waiting || s.phase === 'over' || !this.conn.controls(s.turn) || s.players[s.turn].bot) return this.renderPanels();
    const acts = legalActions(s);
    if (s.duel) {
      this.renderPanels();
      if (this.duel?.targeting) return this.duel.applyTargeting();
      if (s.phase === 'draft' || s.phase === 'react' || acts[0]?.type === 'discard') return;
      if (s.phase === 'move') return this.duelMoves(s, acts);
    }

    if (this.aiming) {
      const cardActs = acts.filter(a => a.type === 'card' && a.card === this.aiming) as Extract<Action, { type: 'card' }>[];
      const pick = (id: number) => cardActs.find(a => a.target === id);
      const ids = s.horses.filter(h => pick(h.id)).map(h => h.id);
      this.say(`${CARD_SKIN[this.aiming]} Chọn mục tiêu cho <b>${CARD_INFO[this.aiming].name}</b> (Esc để huỷ)`);
      this.board.setPickable(ids, id => this.send(pick(id)!));
      return this.renderPanels();
    }

    if (s.phase === 'roll' && acts.some(a => a.type === 'roll')) {
      this.canRoll = true;
      this.el.querySelector<HTMLButtonElement>('[data-roll]')!.disabled = false;
      this.dice.setReady(true, this.color(s.turn).main);
      this.say(`Lượt của <b>${this.name(s.turn)}</b>`);
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

  /** Duel move phase: horses to move or to give the roll to (controlled ones); cards are picked in the tray. */
  private duelMoves(s: GameState, acts: Action[]) {
    const moves = acts.filter(a => a.type === 'move') as Extract<Action, { type: 'move' }>[];
    const endure = acts.filter(a => a.type === 'endure') as Extract<Action, { type: 'endure' }>[];
    const ids = [...moves.map(m => m.horse), ...endure.map(m => m.horse)];
    if (acts.length === 1 && moves.length === 1) {
      this.autoMove = setTimeout(() => this.send(moves[0]), 350);
      return;
    }
    this.board.setPickable(
      ids,
      id => this.send(moves.some(m => m.horse === id) ? { type: 'move', horse: id } : { type: 'endure', horse: id }),
      id => (moves.some(m => m.horse === id) ? target(s, s.horses[id], s.dice) : null),
    );
    this.el.querySelector<HTMLButtonElement>('[data-pass]')!.hidden = !acts.some(a => a.type === 'pass');
    const fx = endure.length ? ` · ngựa có ${STATUS_ICON.ice}: bấm để giải 1 lớp` : '';
    this.say(`${this.name(s.turn)} đổ <b>${s.dice}</b> — chọn ngựa để đi${fx}`);
  }

  /** Bottom notice of whose turn it is. Stays up the whole turn (the player may not have rolled yet). True if it's ours. */
  private announce(p: number) {
    const s = this.s!, call = this.el.querySelector<HTMLElement>('.turn-call')!;
    const mine = this.conn.controls(p) && !s.players[p].bot;
    const box = call.querySelector<HTMLElement>('.call-box')!;
    box.innerHTML = mine ? 'Lượt của bạn!' : `Lượt của ${this.name(p)}`;
    call.style.setProperty('--c', this.color(p).main);
    call.classList.toggle('mine', mine);
    call.hidden = false;
    this.smoke?.show(box, this.color(p).main, mine);
    call.classList.remove('pop');
    void call.offsetWidth; // restart the entrance animation
    call.classList.add('pop');
    return mine;
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
          ${s.duel ? this.duelMeta(i) : ''}
        </div>`;
      if (!s.duel) this.chips(i, acts, panel.querySelector('.cards')!); // duel hands live in the tray
    });
    const hand = this.el.querySelector<HTMLElement>('.hand')!; // 3D has no panels: the turn's cards sit by the dice
    hand.innerHTML = '';
    if (s.duel) {
      const me = this.me();
      this.duel?.render(s, me >= 0 && s.turn === me && !this.waiting && !this.busy ? acts : []);
      return;
    }
    this.chips(s.turn, acts, hand);
  }

  /** Duel line on a player panel: hand size, legend held, seals. */
  private duelMeta(p: number) {
    const d = this.s!.duel!;
    const legend = d.legend[p] ? `<span title="Đang giữ lá huyền thoại ${esc(DUEL_CARDS[d.legend[p]].name)}" style="color:${KIND_COLOR.legend}">${DUEL_SKIN[d.legend[p]]}</span>` : '';
    const traps = d.traps.filter(t => t.owner === p).length;
    return `<div class="duel-meta"><span title="Bài trên tay">🂠 ${this.s!.players[p].cards.length}</span>${traps ? `<span title="Bẫy trên bàn">✦ ${traps}</span>` : ''}${legend}${d.sealed[p] ? '<span title="Bị Phong Ấn">🔒</span>' : ''}${d.aegis[p] ? '<span title="Khiên Thiên Mã">🏵️</span>' : ''}</div>`;
  }

  private chips(i: number, acts: Action[], into: Element) {
    const s = this.s!;
    s.players[i].cards.forEach(card => {
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
      into.appendChild(b);
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

  /** Sound and board template (applied live). The dice are always 3D for now (look.ts). */
  private showSettings() {
    const o = this.el.querySelector<HTMLElement>('.overlay')!;
    const seg = (name: 'board', label: string) => `
      <div class="look-row"><b>${label}</b><span class="seg" role="radiogroup" aria-label="${label}">${(['2d', '3d'] as TemplateKind[])
        .map(k => `<label><input type="radio" name="${name}" value="${k}" ${look[name] === k ? 'checked' : ''}>${k.toUpperCase()}</label>`)
        .join('')}</span></div>`;
    const toggle = (name: 'sfx' | 'music', label: string, on: boolean) => `
      <div class="look-row"><b>${label}</b><span class="seg" role="radiogroup" aria-label="${label}">${[[true, 'Bật'], [false, 'Tắt']]
        .map(([v, t]) => `<label><input type="radio" name="${name}" value="${v ? 1 : 0}" ${on === v ? 'checked' : ''}>${t}</label>`)
        .join('')}</span></div>`;
    o.hidden = false;
    o.innerHTML = `
      <div class="modal look">
        <h2>${icon('gear')} Cài đặt</h2>
        ${toggle('sfx', 'Hiệu ứng âm thanh', sfx.enabled)}
        ${toggle('music', 'Nhạc nền', music.enabled)}
        ${seg('board', 'Bản đồ')}
        <p class="hint">Đổi ngay trong ván, không ảnh hưởng người chơi khác. 3D cần tải thêm lần đầu.</p>
        <div class="row"><button class="btn" data-close>Xong</button></div>
      </div>`;
    o.querySelectorAll<HTMLInputElement>('input[type=radio]').forEach(r =>
      (r.onchange = () => {
        if (r.name === 'sfx') return sfx.setEnabled(r.value === '1');
        if (r.name === 'music') return music.setEnabled(r.value === '1');
        look.board = r.value as TemplateKind;
        saveLook();
        this.setLook({ ...look });
      }),
    );
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
          <li>Tới lượt: <b>giữ xúc xắc</b> (hoặc phím <kbd>Space</kbd>) để lắc, thả hoặc vuốt để quăng. Rồi bấm ngựa có vòng sáng để đi.</li>
          <li>Đổ <b>${v.exitOn.join(' hoặc ')}</b> để xuất chuồng. Đổ <b>6</b> được đổ thêm lượt.</li>
          <li>Không được nhảy qua ngựa khác. Đi đúng vào ô có ngựa địch = <b>đá</b> nó về chuồng.</li>
          <li>Phải dừng đúng ở <b>cửa chuồng</b> (ô trước hàng số). Từ cửa, đổ <i>n</i> lên thẳng bậc <i>n</i>; trong chuồng muốn lên bậc <i>k+1</i> phải đổ đúng <i>k+1</i>.</li>
          <li>Thắng khi cả 4 ngựa đứng ở bậc <b>3–6</b>.</li>
        </ul>
        ${s.duel ? `<h3>Đấu bài</h3><ul class="rules">
          <li>Trước trận mỗi người chọn <b>12 lá</b>. Mỗi lượt rút 1 lá, tay tối đa 6.</li>
          <li>Đổ xong, trước khi đi: đánh <b>1 lần</b> — 1 lá có điểm đúng bằng mặt xúc xắc, hoặc <b>combo N lá ★</b> khi đổ ra N, hoặc 1 bẫy (mọi mặt).</li>
          <li>Ngựa bị khống chế (❄ 🔃 ⛓): bấm vào nó để dùng lượt giải 1 lớp.</li>
          <li>Bẫy úp: chỉ nổ khi ngựa địch <b>dừng đúng ô</b>. Đổ trùng 3 lần liên tiếp: nhận lá huyền thoại.</li>
          <li>Ngựa trong cột đích không chịu bất kỳ lá bài nào. Luật đầy đủ: docs/rulebook.md.</li></ul>` : ''}
        ${party ? `<h3>Ô đặc biệt</h3><ul class="legend">${Object.entries(TILE_INFO).map(([k, t]) => `<li><span class="ico" style="background:${TILE_SKIN[k].color}">${TILE_SKIN[k].icon}</span><b>${t.name}</b> — ${t.desc}</li>`).join('')}</ul>
        <h3>Thẻ bài</h3><ul class="legend">${Object.entries(CARD_INFO).map(([k, c]) => `<li><span class="ico">${CARD_SKIN[k]}</span><b>${c.name}</b> — ${c.desc}</li>`).join('')}</ul>` : ''}
        <div class="row"><button class="btn" data-close>Đã hiểu!</button></div>
      </div>`;
    o.querySelector<HTMLButtonElement>('[data-close]')!.onclick = () => (o.hidden = true);
  }
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
