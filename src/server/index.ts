// Production server: serves the built client (dist/) and hosts online rooms over Socket.IO.
// The server is authoritative: clients only send actions, the GameSession validates and broadcasts results.
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { extname, resolve, sep } from 'node:path';
import { Server, type Socket } from 'socket.io';
import type { BotLevel, PlayerConfig } from '../core/types.ts';
import { VARIANTS } from '../core/variants/index.ts';
import { GameSession, type Update } from '../session.ts';
import { think } from './bots.ts';
import { assignAvatars, BOT_NAMES, isAvatar, type RoomView, type SeatKind } from '../protocol.ts';

const PORT = Number(process.env.PORT ?? 3000);
const DIST = resolve(import.meta.dirname, '../../dist');
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary', '.md': 'text/markdown; charset=utf-8',
};

const http = createServer(async (req, res) => {
  const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
  // LAN IPv4 of this machine, so a host on localhost can share a link friends can open
  if (path === '/lan') return void res.end(Object.values(networkInterfaces()).flat().find(n => n?.family === 'IPv4' && !n.internal)?.address ?? '');
  let file = resolve(DIST, '.' + path);
  if (file !== DIST && !file.startsWith(DIST + sep)) return void res.writeHead(403).end();
  let body: Buffer;
  try {
    body = await readFile(file);
  } catch {
    try {
      body = await readFile((file = resolve(DIST, 'index.html'))); // SPA fallback
    } catch {
      return void res.writeHead(404).end('Client not built. Run: npm run build');
    }
  }
  const immutable = file.includes(`${sep}assets${sep}`);
  res.writeHead(200, {
    'content-type': MIME[extname(file)] ?? 'application/octet-stream',
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  res.end(body);
});

// Vite dev server (port 5173) proxies /socket.io here, so CORS is not needed.
const io = new Server(http);

interface Seat {
  kind: SeatKind;
  name?: string;
  avatar?: string;
  token?: string; // secret per browser, identifies a human across reconnects
  connected?: boolean;
  dropTimer?: ReturnType<typeof setTimeout>;
}
interface Room {
  id: string;
  hostToken: string;
  variant: string;
  seats: Seat[];
  playerOf: number[]; // seat -> player index in the game (-1 = not playing)
  session?: GameSession;
  last?: Update;
  emptySince?: number;
}
const rooms = new Map<string, Room>();

const clean = (s: unknown, max = 16) => String(s ?? '').trim().slice(0, max);
const isToken = (t: unknown): t is string => typeof t === 'string' && /^[\w-]{8,64}$/.test(t);
const LEVELS: BotLevel[] = ['easy', 'normal', 'hard', 'expert'];

function newId() {
  let id;
  do id = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');
  while (rooms.has(id));
  return id;
}

function view(r: Room, token: string): RoomView {
  return {
    id: r.id,
    variant: r.variant,
    started: !!r.session,
    isHost: token === r.hostToken,
    mySeat: r.seats.findIndex(s => s.token === token),
    seats: r.seats.map(s => ({ kind: s.kind, name: s.name, avatar: s.avatar, connected: s.connected })),
    playerOf: r.playerOf,
  };
}

async function broadcastRoom(r: Room) {
  for (const sock of await io.in(r.id).fetchSockets()) sock.emit('room', view(r, sock.data.token));
}

function startGame(r: Room) {
  const players: PlayerConfig[] = [];
  r.playerOf = r.seats.map((s, seat) => {
    if (s.kind === 'off' || (s.kind === 'human' && !s.token)) return -1;
    const bot = s.kind === 'human' ? undefined : s.kind;
    players.push({ seat, bot, name: bot ? `${BOT_NAMES[seat]} (${bot})` : s.name!, avatar: s.avatar });
    return players.length - 1;
  });
  assignAvatars(players);
  if (players.length < 2) return false;
  r.session = new GameSession(
    r.variant,
    players,
    u => {
      r.last = u;
      io.to(r.id).emit('update', u);
    },
    Math.random,
    think, // expert bots search on worker threads
  );
  r.session.start();
  return true;
}

io.on('connection', (socket: Socket) => {
  let room: Room | undefined;
  const token = socket.handshake.auth?.token;
  if (!isToken(token)) return void socket.disconnect();
  socket.data.token = token;

  const enter = (r: Room, name: string, avatar: unknown) => {
    room = r;
    r.emptySince = undefined;
    socket.join(r.id);
    let seat = r.seats.find(s => s.token === token);
    if (!seat && !r.session) {
      seat = r.seats.find(s => s.kind === 'human' && !s.token);
      if (seat) seat.token = token;
    }
    if (seat) {
      const i = r.seats.indexOf(seat);
      const n = name || `Người chơi ${i + 1}`;
      // two players with the same name are indistinguishable in the sidebar
      seat.name = r.seats.some(s => s !== seat && s.name === n) ? `${n.slice(0, 13)} ${i + 1}` : n;
      if (isAvatar(avatar) && !r.seats.some(s => s !== seat && s.avatar === avatar)) seat.avatar = avatar; // taken: one is dealt at start
      seat.connected = true;
      clearTimeout(seat.dropTimer);
      const p = r.playerOf[r.seats.indexOf(seat)];
      if (r.session && p >= 0 && r.session.state.players[p].bot === 'normal' && seat.kind === 'human')
        r.session.setBot(p, undefined); // take the seat back from the stand-in bot
    }
    broadcastRoom(r);
    if (r.last) socket.emit('update', { state: r.last.state, events: [] });
  };

  socket.on('create', (msg, ack) => {
    if (typeof ack !== 'function') return;
    const r: Room = {
      id: newId(),
      hostToken: token,
      variant: VARIANTS.some(v => v.id === msg?.variant) ? msg.variant : 'classic',
      seats: [{ kind: 'human', token }, { kind: 'human' }, { kind: 'hard' }, { kind: 'off' }],
      playerOf: [-1, -1, -1, -1],
    };
    rooms.set(r.id, r);
    enter(r, clean(msg?.name), msg?.avatar);
    ack({ id: r.id });
  });

  socket.on('join', (msg, ack) => {
    if (typeof ack !== 'function') return;
    const r = rooms.get(String(msg?.id ?? '').toUpperCase());
    if (!r) return ack({ error: 'Không tìm thấy phòng' });
    enter(r, clean(msg?.name), msg?.avatar);
    ack({ id: r.id });
  });

  socket.on('config', msg => {
    if (!room || room.session || token !== room.hostToken) return;
    if (VARIANTS.some(v => v.id === msg?.variant)) room.variant = msg.variant;
    if (Array.isArray(msg?.seats))
      msg.seats.slice(0, 4).forEach((k: unknown, i: number) => {
        const seat = room!.seats[i];
        if (seat.token === room!.hostToken) return; // host keeps their seat
        if (k === 'human' || k === 'off' || LEVELS.includes(k as BotLevel)) {
          if (k !== 'human') Object.assign(seat, { token: undefined, name: undefined, avatar: undefined, connected: false });
          seat.kind = k as SeatKind;
        }
      });
    broadcastRoom(room);
  });

  socket.on('start', () => {
    if (!room || room.session || token !== room.hostToken) return;
    if (startGame(room)) broadcastRoom(room);
  });

  socket.on('act', action => {
    if (!room?.session) return;
    const seat = room.seats.findIndex(s => s.token === token);
    if (seat >= 0) room.session.act(room.playerOf[seat], action);
  });

  socket.on('restart', () => {
    if (!room?.session || token !== room.hostToken) return;
    room.session.stop();
    room.session = room.last = undefined;
    broadcastRoom(room);
  });

  socket.on('disconnect', () => {
    const r = room;
    if (!r) return;
    const seat = r.seats.find(s => s.token === token);
    if (seat) {
      seat.connected = false;
      const p = r.playerOf[r.seats.indexOf(seat)];
      // a bot stands in for a human who stays away for 20s, so the table never freezes
      if (r.session && p >= 0) seat.dropTimer = setTimeout(() => r.session?.setBot(p, 'normal'), 20_000);
    }
    if (!io.sockets.adapter.rooms.get(r.id)?.size) r.emptySince = Date.now();
    broadcastRoom(r);
  });
});

// drop rooms nobody has been in for 15 minutes
setInterval(() => {
  for (const [id, r] of rooms)
    if (r.emptySince && Date.now() - r.emptySince > 15 * 60_000) {
      r.session?.stop();
      rooms.delete(id);
    }
}, 60_000);

http.listen(PORT, () => console.log(`Cờ cá ngựa server on http://localhost:${PORT}`));
