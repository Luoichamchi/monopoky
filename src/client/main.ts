// App shell: game mode → avatar → (offline game vs 3 bots | online lobby → online game).
import './style.css';
import './menu.css';
import type { Socket } from 'socket.io-client';
import type { BotLevel, PlayerConfig } from '../core/types.ts';
import { VARIANTS } from '../core/variants/index.ts';
import { assignAvatars, AVATARS, BOT_LABEL, BOT_NAMES, isAvatar, type RoomView, type SeatKind } from '../protocol.ts';
import { GameSession, type Update } from '../session.ts';
import { think } from './bots.ts';
import { ask, connect } from './net.ts';
import { seatColor } from './render/theme.ts';
import { unlock } from './audio/engine.ts';
import { sfx } from './audio/sfx.ts';
import { look, saveLook } from './look.ts';
import type { TemplateKind } from './render/renderer.ts';
import { GameScreen } from './ui/game.ts';
import { esc, save, store } from './ui/dom.ts';
import { icon } from './ui/icons.ts';

const app = document.getElementById('app')!;
const KINDS: SeatKind[] = ['human', 'easy', 'normal', 'hard', 'expert', 'off'];
const kindLabel = (k: SeatKind) => (k === 'human' ? 'Người chơi' : k === 'off' ? 'Trống' : `Bot ${BOT_LABEL[k]}`);

interface Prefs {
  name: string;
  variant: string;
  avatar: string;
}
const prefs: Prefs = { name: '', variant: 'classic', avatar: AVATARS[0].id, ...store<Partial<Prefs>>('ccn.prefs', {}) };
if (!isAvatar(prefs.avatar)) prefs.avatar = AVATARS[0].id;
const LEVELS: BotLevel[] = ['easy', 'normal', 'hard', 'expert'];
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

const LOGO = `<h1 class="logo"><span class="eyebrow">${icon('star')} Tinh bàn Thiên Mã</span>Cờ Cá Ngựa</h1>`;

const variantPicker = (current: string, disabled = false) =>
  `<div class="variants">${VARIANTS.map(
    v => `<label class="variant ${v.id === current ? 'on' : ''}" title="${esc(v.desc)}">
      <input type="radio" name="variant" value="${v.id}" ${v.id === current ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
      <b>${icon(v.id === 'party' ? 'star' : 'hoof')}${esc(v.name)}</b><small>${esc(v.desc)}</small></label>`,
  ).join('')}</div>`;

// ---------------- menu: 1. game mode ----------------

function menu() {
  screen(() => {
    app.innerHTML = `
      <main class="menu"><div class="menu-grid">
        <div class="menu-side">
          ${LOGO}
          <p class="tagline">Phiên bản anime — đổ xúc xắc, đá ngựa, phá đảo!</p>
        </div>
        <section class="card">
          <div class="h-row"><span class="eyebrow">Bước 1 / 2</span>
            <span class="seg" role="radiogroup" aria-label="Giao diện" title="Bản đồ 2D hoặc 3D. Trong ván bấm ⚙ để đổi.">${(['2d', '3d'] as const)
              .map(k => `<label><input type="radio" name="look" value="${k}" ${look.board === k ? 'checked' : ''}>${k.toUpperCase()}</label>`)
              .join('')}</span></div>
          <h3>Chọn kiểu chơi</h3>${variantPicker(prefs.variant)}
          <button class="btn big" id="next">Tiếp: chọn avatar →</button>
        </section>
      </div></main>`;
    app.querySelectorAll<HTMLInputElement>('input[name=variant]').forEach(r =>
      (r.onchange = () => {
        prefs.variant = r.value;
        persist();
        app.querySelectorAll('.variant').forEach(l => l.classList.toggle('on', l.contains(r)));
      }),
    );
    app.querySelectorAll<HTMLInputElement>('input[name=look]').forEach(r =>
      (r.onchange = () => {
        look.board = r.value as TemplateKind;
        saveLook();
      }),
    );
    app.querySelector<HTMLButtonElement>('#next')!.onclick = () => pickAvatar();
    return () => {};
  });
}

// ---------------- menu: 2. avatar (then play offline, or online) ----------------

/** `joinId`: opened from a room link, the only way on is that room. */
function pickAvatar(joinId?: string) {
  screen(() => {
    app.innerHTML = `
      <main class="menu"><section class="card avatar-pick">
        <div class="avatar-stage" aria-hidden="true"><strong class="stage-cap"></strong></div>
        <div class="avatar-side">
        <span class="eyebrow">${joinId ? `Phòng ${esc(joinId)}` : 'Bước 2 / 2'}</span>
        <h3>Chọn avatar</h3>
        <div class="avatar-list" role="radiogroup" aria-label="Avatar">${AVATARS.map(a => `
          <label class="variant avatar-opt ${a.id === prefs.avatar ? 'on' : ''}">
            <input type="radio" name="avatar" value="${a.id}" ${a.id === prefs.avatar ? 'checked' : ''}><b>${a.name}</b>
          </label>`).join('')}</div>
        <label class="field">Tên của bạn <input id="name" maxlength="16" placeholder="Sakura" value="${esc(prefs.name)}"></label>
        ${joinId
          ? `<button class="btn big" id="join">▶ Vào phòng ${esc(joinId)}</button>`
          : `<button class="btn big" id="offline">▶ Chơi với máy</button>
        <p class="or">hoặc chơi online với bạn bè</p>
        <div class="row">
          <button class="btn" id="create">Tạo phòng</button>
          <input id="code" maxlength="4" placeholder="MÃ PHÒNG" class="code" aria-label="Mã phòng">
          <button class="btn ghost" id="join">Vào</button>
        </div>`}
        <div class="row" style="margin-top:10px"><button class="btn ghost" id="back">← ${joinId ? 'Menu' : 'Kiểu chơi'}</button></div>
        </div>
      </section></main>`;
    const $ = <T extends HTMLElement>(sel: string) => app.querySelector<T>(sel)!;
    let preview: { show(id: string): unknown; destroy(): void } | undefined;
    let gone = false;
    const caption = (id: string) => ($('.stage-cap').textContent = AVATARS.find(a => a.id === id)!.name);
    caption(prefs.avatar);
    import('./render3d/avatar-preview.ts')
      .then(({ AvatarPreview }) => {
        if (gone) return;
        preview = new AvatarPreview($('.avatar-stage'));
        preview.show(prefs.avatar);
      })
      .catch(e => console.warn('avatar preview unavailable (WebGL?)', e)); // the list still works
    app.querySelectorAll<HTMLInputElement>('input[name=avatar]').forEach(r =>
      (r.onchange = () => {
        prefs.avatar = r.value;
        persist();
        app.querySelectorAll('.avatar-opt').forEach(l => l.classList.toggle('on', l.contains(r)));
        caption(r.value);
        preview?.show(r.value);
      }),
    );
    $<HTMLInputElement>('#name').oninput = e => ((prefs.name = (e.target as HTMLInputElement).value), persist());
    if (joinId) $('#join').onclick = () => online(joinId);
    else {
      $('#offline').onclick = () => offline();
      $('#create').onclick = () => online();
      $('#join').onclick = () => online($<HTMLInputElement>('#code').value.trim().toUpperCase());
    }
    $('#back').onclick = () => (history.replaceState(null, '', location.pathname), menu());
    return () => ((gone = true), preview?.destroy());
  });
}

// ---------------- offline: you + 3 bots, random levels and avatars ----------------

function offline() {
  screen(() => {
    const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
    const players: PlayerConfig[] = assignAvatars([
      { seat: 0, name: prefs.name || 'Bạn', avatar: prefs.avatar },
      ...[1, 2, 3].map(seat => ({ seat, bot: pick(LEVELS), name: BOT_NAMES[seat] })),
    ]);
    let session: GameSession;
    const view = new GameScreen(app, {
      send: a => session.act(session.state.turn, a),
      controls: () => true, // only the human seat ever waits for input
      leave: () => menu(),
      restart: () => offline(),
    });
    session = new GameSession(prefs.variant, players, u => view.update(u), Math.random, think);
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
    const name = prefs.name; // empty → server picks a unique "Người chơi N"
    app.innerHTML = `<main class="menu"><section class="card lobby"><p>Đang kết nối…</p></section></main>`;

    const enter = async () => {
      const res = await (joinId
        ? ask<{ id?: string; error?: string }>(sock, 'join', { id: joinId, name, avatar: prefs.avatar })
        : ask<{ id?: string; error?: string }>(sock, 'create', { name, avatar: prefs.avatar, variant: prefs.variant }));
      if (res.error || !res.id) {
        alert(res.error ?? 'Lỗi kết nối');
        return menu();
      }
      joinId = res.id; // reconnects re-join the same room
      try { sessionStorage.setItem('ccn.room', res.id); } catch {} // F5 in this tab goes straight back in
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
  let link = `${location.origin}${location.pathname}#room=${r.id}`;
  const names = (i: number) => {
    const s = r.seats[i];
    if (s.kind !== 'human') return '';
    if (!s.name) return '<i>đang chờ…</i>';
    const avatar = AVATARS.find(a => a.id === s.avatar)?.name ?? '';
    return `${esc(s.name)} ${avatar && `· ${avatar}`} ${s.connected ? '🟢' : '⚪'} ${i === r.mySeat ? '(bạn)' : ''}`;
  };
  app.innerHTML = `
    <main class="menu"><div class="menu-grid">
      <div class="menu-side">
        ${LOGO}
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
  // localhost links only work on this machine: swap in the server's LAN IP
  if (/^(localhost|127\.|\[::1\])/.test(location.hostname))
    fetch('/lan').then(r => r.text()).then(ip => {
      if (!ip) return;
      const u = new URL(link);
      u.hostname = ip;
      link = u.href;
      app.querySelector<HTMLInputElement>('.link')!.value = link;
    }).catch(() => {});
  app.querySelector<HTMLButtonElement>('#copy')!.onclick = () => navigator.clipboard?.writeText(link);
  app.querySelector<HTMLButtonElement>('#back')!.onclick = () => (history.replaceState(null, '', location.pathname), menu());
}

// UI click blip + unlock audio on the first gesture anywhere
document.addEventListener('pointerdown', e => {
  unlock();
  if ((e.target as Element).closest?.('.btn, .variant, .card-chip')) sfx.play('click');
});

const hashRoom = location.hash.match(/room=([A-Z]{4})/)?.[1];
const rejoin = (() => { try { return sessionStorage.getItem('ccn.room'); } catch { return null; } })();
if (!hashRoom) menu();
else if (hashRoom === rejoin) online(hashRoom); // reload: we already have a seat there
else pickAvatar(hashRoom); // a friend's link: pick an avatar first
