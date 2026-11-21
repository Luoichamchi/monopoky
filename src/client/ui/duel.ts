// Duel mode on screen: the hand tray, building a play (cards → targets), the draft, reaction prompts and card casts.
// Reads state and legal actions only (CLAUDE.md rule 1): every choice offered comes from legalActions().
import { GATE, absOf, seatOf } from '../../core/board.ts';
import type { Action, GameEvent, GameState, Pick } from '../../core/types.ts';
import { DUEL_CARDS as C, type CardDef } from '../../core/variants/duel/cards.ts';
import { WAIT } from '../../session.ts';
import type { BoardRenderer } from '../render/renderer.ts';
import { DUEL_SKIN, KIND_COLOR, KIND_LABEL } from '../render/skins.ts';
import { esc } from './dom.ts';
import '../duel.css';

export interface DuelHost {
  me(): number; // the player this browser plays (-1 = watching)
  send(a: Action): void;
  say(html: string): void;
  board(): BoardRenderer;
  name(p: number): string;
  color(p: number): string;
  refresh(): void;
}

type Play = Extract<Action, { type: 'play' }>;
const sorted = (xs: string[]) => [...xs].sort().join();
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

/** One card as HTML on the Blender-rendered blank (public/art/card-front.webp). */
export function cardHtml(id: string, extra = '') {
  const c: CardDef | undefined = C[id];
  if (!c) return `<div class="dcard back ${extra}"></div>`;
  const pt = c.kind === 'trap' ? '✦' : c.point;
  return `<div class="dcard ${extra}" data-kind="${c.kind}" style="--k:${KIND_COLOR[c.kind]}" title="${esc(c.name)} — ${esc(c.desc)}">
    <span class="pt">${pt}</span><span class="art">${DUEL_SKIN[id] ?? '❔'}</span>
    <span class="nm">${esc(c.name)}</span><span class="ds">${esc(c.desc)}</span>
    <span class="kd">${KIND_LABEL[c.kind]}${c.combo ? ' ★' : ''}</span></div>`;
}

export class DuelUI {
  private tray: HTMLElement;
  private draftEl: HTMLElement;
  private reactEl: HTMLElement;
  private castEl: HTMLElement;
  private host: DuelHost;
  private s?: GameState;
  private acts: Action[] = [];
  private sel: number[] = []; // selected hand indices; -1 = the legend
  private aim?: { cands: Play[]; slots: [string, number][]; i: number; picked: Map<string, number[]> };
  private autoDraft = false;
  private focus = ''; // draft on a small screen: the card shown large before picking it

  constructor(root: HTMLElement, host: DuelHost) {
    this.host = host;
    const make = (cls: string) => Object.assign(document.createElement('div'), { className: cls, hidden: true });
    this.tray = make('duel-tray');
    this.draftEl = make('duel-draft');
    this.reactEl = make('duel-react');
    this.castEl = make('duel-cast');
    this.tray.classList.add('floating');
    root.append(this.tray, this.draftEl, this.reactEl, this.castEl);
  }

  /** The hand sits in the side rail of a layered board, or floats over a full-table (3D) board. */
  place(rail: HTMLElement | null) {
    if (rail) (rail.querySelector('.dock') ?? rail.lastElementChild!).after(this.tray); // right under the dice
    this.tray.classList.toggle('floating', !rail);
  }

  destroy() {
    [this.tray, this.draftEl, this.reactEl, this.castEl].forEach(e => e.remove());
  }

  get targeting() {
    return !!this.aim;
  }

  /** Redraw. `acts` = what this browser may do right now (empty when it's someone else's decision). */
  render(s: GameState, acts: Action[]) {
    this.s = s;
    this.acts = acts;
    if (!acts.some(a => a.type === 'play')) (this.sel = []), (this.aim = undefined);
    this.drawDraft();
    this.drawReact();
    this.drawTray();
  }

  /** Board picking while a play is being aimed (called by the screen's input refresh). */
  applyTargeting() {
    if (!this.aim || !this.s) return;
    const s = this.s;
    const board = this.host.board();
    board.setPickable([]);
    board.setSquares([]);
    const { cands, slots, i, picked } = this.aim;
    const [name, j] = slots[i];
    const left = cands.filter(c => this.fits(c, picked));
    const values = [...new Set(left.map(c => c.picks.find(p => p.card === name)!.t[j]))];
    if (values.length === 1) return this.choose(values[0]);
    const aim = C[name].aim;
    const card = `<b>${esc(C[name].name)}</b>`;
    const horseSlot = (aim !== 'square' && aim !== 'trap' && aim !== 'player' && j === 0) || aim === 'ownFoe' || aim === 'any2';
    if (horseSlot) {
      this.host.say(`${DUEL_SKIN[name]} ${card}: chọn ngựa ${aim === 'ownFoe' && j === 1 ? 'địch' : ''} (Esc để huỷ)`);
      board.setPickable(values, v => this.choose(v));
    } else if (aim === 'player') {
      this.host.say(`${DUEL_SKIN[name]} ${card}: chọn đối thủ ${values.map(q => `<button class="btn ghost duel-who" data-q="${q}" style="--c:${this.host.color(q)}">${this.host.name(q)}</button>`).join(' ')}`);
      document.querySelectorAll<HTMLButtonElement>('.duel-who').forEach(b => (b.onclick = () => this.choose(+b.dataset.q!)));
    } else {
      // squares: traps, Lốc Xoáy, Dò Bẫy, or a distance / destination shown as the square it leads to
      const h = s.horses[picked.get(name)?.[0] ?? -1];
      const toAbs = (v: number) => {
        if (aim === 'ownN') return absOf(seatOf(s, h.owner), h.pos - v);
        if (aim === 'anyN') return absOf(seatOf(s, h.owner), Math.min(GATE, h.pos + v));
        if (aim === 'ownDest') return absOf(seatOf(s, h.owner), v);
        return v;
      };
      const back = new Map(values.map(v => [toAbs(v), v]));
      this.host.say(`${DUEL_SKIN[name]} ${card}: chọn ô ${C[name].kind === 'trap' ? 'đặt bẫy' : ''} (Esc để huỷ)`);
      board.setSquares([...back.keys()], a => this.choose(back.get(a)!));
    }
  }

  cancel() {
    this.sel = [];
    this.aim = undefined;
    this.host.board().setSquares([]);
    this.host.refresh();
  }

  private fits(c: Play, picked: Map<string, number[]>) {
    for (const [name, t] of picked) {
      const p = c.picks.find(x => x.card === name)!;
      if (t.some((v, j) => p.t[j] !== v)) return false;
    }
    return true;
  }

  private choose(v: number) {
    const a = this.aim!;
    const [name] = a.slots[a.i];
    a.picked.set(name, [...(a.picked.get(name) ?? []), v]);
    a.i++;
    if (a.i < a.slots.length) return this.host.refresh();
    const play = a.cands.find(c => this.fits(c, a.picked))!;
    this.aim = undefined;
    this.sel = [];
    this.host.board().setSquares([]);
    this.host.send(play);
  }

  // ---------- tray ----------

  private hand(): string[] {
    const s = this.s!, me = this.host.me();
    return me >= 0 ? s.players[me].cards : [];
  }

  private selectedCards(): string[] {
    const s = this.s!, me = this.host.me();
    return this.sel.map(i => (i < 0 ? s.duel!.legend[me] : this.hand()[i]));
  }

  private matches(): Play[] {
    const want = sorted(this.selectedCards());
    return this.acts.filter((a): a is Play => a.type === 'play' && sorted(a.picks.map(p => p.card)) === want);
  }

  private drawTray() {
    const s = this.s!, d = s.duel!, me = this.host.me();
    if (me < 0 || s.phase === 'draft') return void (this.tray.hidden = true);
    this.tray.hidden = false;
    const plays = this.acts.filter((a): a is Play => a.type === 'play');
    const usable = new Set(plays.flatMap(a => a.picks.map(p => p.card)));
    const discarding = this.acts[0]?.type === 'discard';
    const myMove = s.phase === 'move' && s.turn === me && this.acts.length > 0;
    const cards = this.hand().map((c, i) => cardHtml(c, `${this.sel.includes(i) ? 'sel' : ''} ${usable.has(c) || discarding ? 'can' : ''}`).replace('<div class="dcard', `<div data-i="${i}" class="dcard`));
    if (d.legend[me]) cards.push(cardHtml(d.legend[me], `legend ${this.sel.includes(-1) ? 'sel' : ''} ${usable.has(d.legend[me]) ? 'can' : ''}`).replace('<div class="dcard', '<div data-i="-1" class="dcard'));
    const matches = this.sel.length ? this.matches() : [];
    let hint = '';
    if (discarding) hint = 'Quá 6 lá: chọn 1 lá để bỏ';
    else if (this.sel.length === 1) {
      const c = C[this.selectedCards()[0]];
      hint = `<b>${esc(c.name)}</b> — ${esc(c.desc)}`;
    } else if (this.sel.length > 1) hint = matches.length ? `Combo ${this.sel.length} lá` : `Combo ${this.sel.length} lá cần đổ ra ${this.sel.length}, gồm lá ★ (Mở Rộng ghép được 1 lá có số ô)`;
    else if (myMove && d.plays > 0 && !d.sealed[me]) hint = plays.length ? `Mặt <b>${s.dice}</b>: chọn lá sáng để đánh, hoặc đi ngựa` : `Mặt <b>${s.dice}</b>: không có lá đánh được`;
    else if (d.sealed[me]) hint = '🔒 Bị Phong Ấn: chưa được đánh bài';
    this.tray.innerHTML = `
      <div class="duel-info"><span title="Bộ bài">🂠 ${d.decks[me].length}</span><span title="Đã bỏ">♻ ${d.discards[me].length}</span>
        <span class="duel-hint" title="${esc(hint.replace(/<[^>]+>/g, ''))}">${hint}</span>
        ${matches.length && !this.aim ? '<button class="btn" data-go>Đánh</button>' : ''}${this.sel.length ? '<button class="btn ghost" data-x>Huỷ</button>' : ''}</div>
      <div class="duel-hand">${cards.join('')}</div>`;
    this.tray.querySelectorAll<HTMLElement>('.dcard').forEach(el => {
      const i = +el.dataset.i!;
      el.onclick = () => {
        if (discarding) return this.host.send({ type: 'discard', card: this.hand()[i] });
        if (!myMove || !plays.length) return;
        this.aim = undefined;
        this.host.board().setSquares([]);
        this.sel = this.sel.includes(i) ? this.sel.filter(x => x !== i) : [...this.sel, i];
        // a single card that is legal on its own: start aiming right away
        if (this.sel.length === 1 && this.matches().length && !this.comboPossible()) return this.start();
        this.host.refresh();
      };
    });
    this.tray.querySelector<HTMLButtonElement>('[data-go]')?.addEventListener('click', () => this.start());
    this.tray.querySelector<HTMLButtonElement>('[data-x]')?.addEventListener('click', () => this.cancel());
  }

  /** Could more cards join the current selection into a legal combo? */
  private comboPossible() {
    const have = this.selectedCards();
    return this.acts.some(a => a.type === 'play' && a.picks.length > have.length && have.every(c => a.picks.some(p => p.card === c)));
  }

  private start() {
    const cands = this.matches();
    if (!cands.length) return;
    const first = cands[0];
    const names = [...new Set(first.picks.map(p => p.card))];
    const slots: [string, number][] = names.flatMap(n => first.picks.find(p => p.card === n)!.t.map((_, j) => [n, j] as [string, number]));
    if (!slots.length) return this.host.send(first);
    this.aim = { cands, slots, i: 0, picked: new Map() };
    this.host.refresh();
  }

  // ---------- draft ----------

  private drawDraft() {
    const s = this.s!, d = s.duel!, me = this.host.me();
    this.draftEl.hidden = s.phase !== 'draft';
    if (this.draftEl.hidden) return;
    const mine = this.acts[0]?.type === 'pick';
    if (mine && this.autoDraft) return void setTimeout(() => this.host.send({ type: 'pick', card: '' }), 150);
    const groups = [1, 2, 3, 4, 5, 6, 0].map(f => {
      const ids = Object.keys(C).filter(id => C[id].copies > 0 && C[id].point === f);
      return `<section><h4>${f ? `Mặt ${f}` : 'Bẫy (mọi mặt)'}</h4><div class="row">${ids
        .map(id => cardHtml(id, `${d.pool[id] ? '' : 'gone'} ${mine && d.pool[id] ? 'can' : ''}`).replace('<div class="dcard', `<div data-id="${id}" class="dcard`).replace(/<\/div>$/, `<b class="left">×${d.pool[id] ?? 0}</b></div>`))
        .join('')}</div></section>`;
    });
    const lists = s.players
      .map((p, i) => `<li style="--c:${this.host.color(i)}" class="${s.turn === i ? 'now' : ''}"><b>${esc(p.name)}</b> ${d.lists[i].length}/12 <span>${d.lists[i].map(c => DUEL_SKIN[c]).join('')}</span></li>`)
      .join('');
    this.draftEl.innerHTML = `
      <div class="draft-box">
        <header><h2>Chọn bài</h2><p>${mine ? `Tới lượt bạn chọn (${Math.round(WAIT.pick / 1000)} giây)` : `${this.host.name(s.turn)} đang chọn…`}</p>
          ${me >= 0 ? `<button class="btn ghost" data-auto>${this.autoDraft ? 'Tự chọn: bật' : 'Tự chọn phần còn lại'}</button>` : ''}</header>
        <ul class="draft-lists">${lists}</ul>
        <div class="draft-pool">${groups.join('')}</div>
        ${this.focus ? `<div class="draft-focus">${cardHtml(this.focus, 'big')}<div class="row">
          ${mine && d.pool[this.focus] ? '<button class="btn" data-take>Chọn lá này</button>' : ''}<button class="btn ghost" data-close>Đóng</button></div></div>` : ''}
      </div>`;
    const small = matchMedia('(max-width: 760px)').matches; // card texts are too small to read there: preview first
    this.draftEl.querySelectorAll<HTMLElement>('.draft-pool .dcard').forEach(el => {
      const id = el.dataset.id!;
      el.onclick = () => {
        if (small) return (this.focus = id), this.drawDraft();
        if (mine && d.pool[id] > 0) this.host.send({ type: 'pick', card: id });
      };
    });
    this.draftEl.querySelector<HTMLButtonElement>('[data-take]')?.addEventListener('click', () => {
      const id = this.focus;
      this.focus = '';
      this.host.send({ type: 'pick', card: id });
    });
    this.draftEl.querySelector<HTMLButtonElement>('[data-close]')?.addEventListener('click', () => ((this.focus = ''), this.drawDraft()));
    this.draftEl.querySelector<HTMLButtonElement>('[data-auto]')?.addEventListener('click', () => {
      this.autoDraft = !this.autoDraft;
      this.host.refresh();
    });
  }

  // ---------- reactions ----------

  private drawReact() {
    const s = this.s!, d = s.duel!;
    const mine = this.acts[0]?.type === 'react';
    this.reactEl.hidden = !(s.phase === 'react' && d.pending);
    if (this.reactEl.hidden) return;
    const p = d.pending!;
    const shown = p.picks.map(pk => cardHtml(pk.card, 'small')).join('');
    const opts = this.acts.filter(a => a.type === 'react' && a.card) as { type: 'react'; card: string }[];
    this.reactEl.innerHTML = `
      <div class="react-box" style="--c:${this.host.color(p.by)}">
        <p><b>${this.host.name(p.by)}</b> đánh vào ${mine ? 'bạn' : this.host.name(s.turn)} (mặt ${p.face})</p>
        <div class="row">${shown}</div>
        ${mine ? `<p>Phản đòn?</p><div class="row">${opts.map(o => cardHtml(o.card, 'can').replace('<div class="dcard', `<div data-c="${o.card}" class="dcard`)).join('')}</div>
        <button class="btn ghost" data-skip>Bỏ qua</button><div class="timer" style="--t:${WAIT.react}ms"></div>` : `<p>Chờ ${this.host.name(s.turn)} phản…</p>`}
      </div>`;
    this.reactEl.querySelectorAll<HTMLElement>('[data-c]').forEach(el => (el.onclick = () => this.host.send({ type: 'react', card: el.dataset.c! })));
    this.reactEl.querySelector<HTMLButtonElement>('[data-skip]')?.addEventListener('click', () => this.host.send({ type: 'react', card: '' }));
  }

  // ---------- casts ----------

  /** Big cards flying to the middle of the screen for a play, a reaction or a new legend. */
  async cast(picks: Pick[] | string[], who: number, label: string) {
    const ids = picks.map(p => (typeof p === 'string' ? p : p.card));
    this.castEl.hidden = false;
    this.castEl.style.setProperty('--c', this.host.color(who));
    this.castEl.innerHTML = `<p>${label}</p><div class="row">${ids.map(id => cardHtml(id, 'big')).join('')}</div>`;
    this.castEl.classList.remove('go');
    void this.castEl.offsetWidth;
    this.castEl.classList.add('go');
    await wait(matchMedia('(prefers-reduced-motion: reduce)').matches ? 500 : 1100);
    this.castEl.hidden = true;
  }

  /** Visual side of duel events (sounds and texts are the screen's job). */
  async play(e: GameEvent) {
    switch (e.t) {
      case 'play': {
        const legend = C[e.picks[0].card]?.kind === 'legend';
        const what = e.picks.length > 1 ? `combo ${e.picks.length} lá` : legend ? 'lá huyền thoại' : 'lá bài';
        await this.cast(e.picks, e.player, `${this.host.name(e.player)} đánh ${what} · mặt ${e.face}`);
        break;
      }
      case 'react':
        await this.cast([e.card], e.player, `${this.host.name(e.player)} phản đòn!`);
        break;
      case 'legend':
        await this.cast([e.card], e.player, `${this.host.name(e.player)} nhận lá huyền thoại!`);
        break;
    }
  }
}
