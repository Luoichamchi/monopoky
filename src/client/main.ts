// App shell: menu → (offline game | online lobby → online game).
import './style.css';
import type { Socket } from 'socket.io-client';
import type { BotLevel, PlayerConfig } from '../core/types.ts';
import { VARIANTS } from '../core/variants/index.ts';
import { BOT_LABEL, BOT_NAMES, type RoomView, type SeatKind } from '../protocol.ts';
import { GameSession, type Update } from '../session.ts';
import { ask, connect } from './net.ts';
import { seatColor } from './render/theme.ts';
import { unlock } from './audio/engine.ts';
import { sfx } from './audio/sfx.ts';
import { look, saveLook, themeSelect } from './look.ts';
import { isBoardTheme } from './render/board-themes.ts';
import type { TemplateKind } from './render/renderer.ts';
import { GameScreen } from './ui/game.ts';
import { esc, save, store } from './ui/dom.ts';

const app = document.getElementById('app')!;
const KINDS: SeatKind[] = ['human', 'easy', 'normal', 'hard', 'expert', 'off'];
const kindLabel = (k: SeatKind) => (k === 'human' ? 'Người chơi' : k === 'off' ? 'Trống' : `Bot ${BOT_LABEL[k]}`);

interface Prefs {
  name: string;
  variant: string;
  seats: SeatKind[];
}
const prefs: Prefs = store('ccn.prefs', { name: '', variant: 'party', seats: ['human', 'hard', 'normal', 'expert'] });
const persist = () => save('ccn.prefs', prefs);

let cleanup: () => void = () => {};
function screen(fn: () => () => void) {
  cleanup();
  app.innerHTML = '';
  cleanup = fn();
}

function seatEditor(seats: SeatKind[], editable: (i: number) => boolean, names: (i: number) => string = () => '') {
  return seats
    .map((k, i) => {
      const c = seatColor(i);
      const opts = KINDS.map(o => `<option value="${o}" ${o === k ? 'selected' : ''}>${kindLabel(o)}</option>`).join('');
      return `<div class="seat" style="--c:${c.main};--l:${c.light}">
        <span class="seat-dot">♞</span><b>${c.name}</b>
        <span class="seat-name">${names(i)}</span>
        <select data-seat="${i}" ${editable(i) ? '' : 'disabled'}>${opts}</select>
      </div>`;
    })
    .join('');
}

const variantPicker = (current: string, disabled = false) =>
  `<div class="variants">${VARIANTS.map(
    v => `<label class="variant ${v.id === current ? 'on' : ''}" title="${esc(v.desc)}">
      <input type="radio" name="variant" value="${v.id}" ${v.id === current ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
      <b>${v.id === 'party' ? '🎉 ' : '🐎 '}${esc(v.name)}</b><small>${esc(v.desc)}</small></label>`,
  ).join('')}</div>`;

// ---------------- menu ----------------

function menu() {
  screen(() => {
    app.innerHTML = `
      <main class="menu"><div class="menu-grid">
        <div class="menu-side">
          <h1 class="logo"><span>CỜ</span><span>CÁ</span><span>NGỰA</span></h1>
          <p class="tagline">Phiên bản anime — đổ xúc xắc, đá ngựa, phá đảo!</p>
          <section class="card">
            <h3>Chơi online với bạn bè</h3>
            <div class="row">
              <button class="btn" id="create">Tạo phòng</button>
              <input id="code" maxlength="4" placeholder="MÃ PHÒNG" class="code" aria-label="Mã phòng">
              <button class="btn ghost" id="join">Vào</button>
            </div>
          </section>
        </div>
        <section class="card">
          <label class="field">Tên của bạn <input id="name" maxlength="16" placeholder="Sakura" value="${esc(prefs.name)}"></label>
          <h3 class="h-row">Chế độ
            <span class="seg" role="radiogroup" aria-label="Giao diện" title="Đặt cả bản đồ và xúc xắc. Trong ván bấm 🎨 để chỉnh riêng từng phần.">${(['2d', '3d'] as const)
              .map(k => `<label><input type="radio" name="look" value="${k}" ${look.board === k && look.dice === k ? 'checked' : ''}>${k.toUpperCase()}</label>`)
              .join('')}</span></h3>${variantPicker(prefs.variant)}
          ${themeSelect()}
          <h3>Ghế ngồi</h3>
          <div class="seats">${seatEditor(prefs.seats, () => true)}</div>
          <p class="err" id="err" hidden></p>
          <button class="btn big" id="offline">▶ Chơi ngay</button>
        </section>
      </div></main>`;
    const $ = <T extends HTMLElement>(sel: string) => app.querySelector<T>(sel)!;
    $<HTMLInputElement>('#name').oninput = e => ((prefs.name = (e.target as HTMLInputElement).value), persist());
    app.querySelectorAll<HTMLInputElement>('input[name=variant]').forEach(r =>
      (r.onchange = () => {
        prefs.variant = r.value;
        persist();
        app.querySelectorAll('.variant').forEach(l => l.classList.toggle('on', l.contains(r)));
      }),
    );
    app.querySelectorAll<HTMLSelectElement>('select[data-seat]').forEach(sel =>
      (sel.onchange = () => ((prefs.seats[+sel.dataset.seat!] = sel.value as SeatKind), persist())),
    );
    app.querySelectorAll<HTMLInputElement>('input[name=look]').forEach(r =>
      (r.onchange = () => {
        look.board = look.dice = r.value as TemplateKind; // preset; mix-and-match lives in the in-game 🎨 panel
        $<HTMLElement>('.theme-choice').hidden = look.board !== '2d';
        saveLook();
      }),
    );
    $<HTMLSelectElement>('[data-theme-select]').onchange = e => {
      const value = (e.currentTarget as HTMLSelectElement).value;
      if (isBoardTheme(value)) { look.theme = value; saveLook(); }
    };
    $('#offline').onclick = () => {
      if (prefs.seats.filter(k => k !== 'off').length < 2) return void Object.assign($('#err'), { hidden: false, textContent: 'Cần ít nhất 2 ghế.' });
      offline();
    };
    $('#create').onclick = () => online();
    $('#join').onclick = () => online($<HTMLInputElement>('#code').value.trim().toUpperCase());
    return () => {};
  });
}

// ---------------- offline ----------------

function offline() {
  screen(() => {
    let humans = 0;
    const players: PlayerConfig[] = [];
    prefs.seats.forEach((k, seat) => {
      if (k === 'off') return;
      if (k === 'human') players.push({ seat, name: humans++ === 0 ? prefs.name || 'Bạn' : `Người chơi ${humans}` });
      else players.push({ seat, bot: k as BotLevel, name: `${BOT_NAMES[seat]}` });
    });
    let session: GameSession;
    const view = new GameScreen(app, {
      send: a => session.act(session.state.turn, a),
      controls: () => true, // hot-seat: every human seat plays from this screen
      leave: () => menu(),
      restart: () => offline(),
    });
    session = new GameSession(prefs.variant, players, u => view.update(u));
    session.start();
    return () => (session.stop(), view.destroy());
  });
}

// ---------------- online ----------------

function online(joinId?: string) {
  screen(() => {
    const sock: Socket = connect();
    let view: GameScreen | undefined;
    let room: RoomView | undefined;
    let early: Update[] = []; // updates that arrive before the 'room started' message
    const name = prefs.name || 'Bạn';
    app.innerHTML = `<main class="menu"><section class="card lobby"><p>Đang kết nối…</p></section></main>`;

    const enter = async () => {
      const res = await (joinId
        ? ask<{ id?: string; error?: string }>(sock, 'join', { id: joinId, name })
        : ask<{ id?: string; error?: string }>(sock, 'create', { name }));
      if (res.error || !res.id) {
        alert(res.error ?? 'Lỗi kết nối');
        return menu();
      }
      joinId = res.id; // reconnects re-join the same room
      history.replaceState(null, '', `#room=${res.id}`);
    };
    sock.on('connect', enter);
    sock.on('connect_error', () => (app.querySelector('.lobby')!.innerHTML = '<p>Không kết nối được máy chủ. Đang thử lại…</p>'));

    sock.on('room', (r: RoomView) => {
      room = r;
      if (r.started) {
        if (!view) {
          app.innerHTML = '';
          view = new GameScreen(app, {
            send: a => sock.emit('act', a),
            controls: p => r.mySeat >= 0 && room!.playerOf[r.mySeat] === p,
            leave: () => (history.replaceState(null, '', location.pathname), menu()),
            restart: r.isHost ? () => sock.emit('restart') : undefined,
            restartLabel: 'Về phòng chờ',
          });
          early.forEach(u => view!.update(u));
          early = [];
        }
      } else {
        view?.destroy();
        view = undefined;
        early = [];
        lobby(sock, r);
      }
    });
    sock.on('update', (u: Update) => (view ? view.update(u) : early.push(u)));
    return () => (sock.disconnect(), view?.destroy());
  });
}

function lobby(sock: Socket, r: RoomView) {
  const link = `${location.origin}${location.pathname}#room=${r.id}`;
  const names = (i: number) => {
    const s = r.seats[i];
    if (s.kind !== 'human') return '';
    if (!s.name) return '<i>đang chờ…</i>';
    return `${esc(s.name)} ${s.connected ? '🟢' : '⚪'} ${i === r.mySeat ? '(bạn)' : ''}`;
  };
  app.innerHTML = `
    <main class="menu"><div class="menu-grid">
      <div class="menu-side">
        <h1 class="logo"><span>CỜ</span><span>CÁ</span><span>NGỰA</span></h1>
        <section class="card lobby">
          <h3>Phòng <span class="room-code">${r.id}</span></h3>
          <p class="hint">Gửi link này cho bạn bè:</p>
          <div class="row"><input readonly value="${link}" class="link" aria-label="Link phòng"><button class="btn ghost" id="copy">Sao chép</button></div>
          <div class="row" style="margin-top:10px"><button class="btn ghost" id="back">← Rời phòng</button></div>
        </section>
      </div>
      <section class="card">
        <h3>Chế độ</h3>${variantPicker(r.variant, !r.isHost)}
        <h3>Ghế ngồi</h3>
        <div class="seats">${seatEditor(r.seats.map(s => s.kind), i => r.isHost && i !== r.mySeat, names)}</div>
        ${r.isHost ? '<button class="btn big" id="start">▶ Bắt đầu</button>' : '<p>Chờ chủ phòng bắt đầu…</p>'}
      </section>
    </div></main>`;
  const send = () =>
    sock.emit('config', {
      variant: app.querySelector<HTMLInputElement>('input[name=variant]:checked')?.value,
      seats: [...app.querySelectorAll<HTMLSelectElement>('select[data-seat]')].map(s => s.value),
    });
  if (r.isHost) {
    app.querySelectorAll<HTMLInputElement>('input[name=variant]').forEach(i => (i.onchange = send));
    app.querySelectorAll<HTMLSelectElement>('select[data-seat]').forEach(s => (s.onchange = send));
    app.querySelector<HTMLButtonElement>('#start')!.onclick = () => sock.emit('start');
  }
  app.querySelector<HTMLButtonElement>('#copy')!.onclick = () => navigator.clipboard?.writeText(link);
  app.querySelector<HTMLButtonElement>('#back')!.onclick = () => (history.replaceState(null, '', location.pathname), menu());
}

// UI click blip + unlock audio on the first gesture anywhere
document.addEventListener('pointerdown', e => {
  unlock();
  if ((e.target as Element).closest?.('.btn, .variant, .card-chip')) sfx.play('click');
});

const hashRoom = location.hash.match(/room=([A-Z]{4})/)?.[1];
hashRoom ? online(hashRoom) : menu();
