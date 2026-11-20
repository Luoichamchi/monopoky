// Dice motion shared by every dice skin: shaking in the hand, the throw, bounces and a tumble that slows down.
// Pure math (no DOM, no three.js): a skin only draws the Pose it is given.
// The face it lands on is decided by the rules; the tumble is built backwards from that face,
// so the die always comes to rest showing the engine's value, on every skin and every screen.
import type { Toss } from '../../core/types.ts';

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number]; // x, y, z, w

/** Units are die edges. x → right, z → down the screen, y ↑ (y = REST when the die lies on the table). Home = (0, 0). */
export interface Pose {
  x: number;
  y: number;
  z: number;
  q: Quat;
}
/** Where the die's centre may go (die units, home = origin). */
export interface Table {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const REST = 0.5;
export const IDENTITY: Quat = [0, 0, 0, 1];
const TAU = Math.PI * 2;

// ---------- quaternions ----------

export function qAxis([x, y, z]: Vec3, angle: number): Quat {
  const l = Math.hypot(x, y, z) || 1, s = Math.sin(angle / 2) / l;
  return [x * s, y * s, z * s, Math.cos(angle / 2)];
}
export function qMul([ax, ay, az, aw]: Quat, [bx, by, bz, bw]: Quat): Quat {
  return [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz];
}
export function qRotate([qx, qy, qz, qw]: Quat, [vx, vy, vz]: Vec3): Vec3 {
  const tx = 2 * (qy * vz - qz * vy), ty = 2 * (qz * vx - qx * vz), tz = 2 * (qx * vy - qy * vx);
  return [vx + qw * tx + qy * tz - qz * ty, vy + qw * ty + qz * tx - qx * tz, vz + qw * tz + qx * ty - qy * tx];
}
export function qSlerp(a: Quat, b: Quat, t: number): Quat {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const s = d < 0 ? -1 : 1; // shortest way round
  d *= s;
  if (d > 0.9995) return norm(a.map((v, i) => v + (b[i] * s - v) * t) as Quat);
  const th = Math.acos(d), k = Math.sin(th);
  const wa = Math.sin((1 - t) * th) / k, wb = (Math.sin(t * th) / k) * s;
  return a.map((v, i) => v * wa + b[i] * wb) as Quat;
}
const norm = (q: Quat) => {
  const l = Math.hypot(...q);
  return q.map(v => v / l) as Quat;
};

// ---------- faces ----------

/** Body axis of each face and its value; opposite faces sum to 7 (same layout as the 3D die's materials: +X,-X,+Y,-Y,+Z,-Z). */
export const FACE_AXES: [Vec3, number][] = [[[1, 0, 0], 3], [[-1, 0, 0], 4], [[0, 1, 0], 1], [[0, -1, 0], 6], [[0, 0, 1], 2], [[0, 0, -1], 5]];
/** Orientation with `value` on top. */
const FACE_UP: Record<number, Quat> = {
  1: IDENTITY,
  6: qAxis([1, 0, 0], Math.PI),
  3: qAxis([0, 0, 1], Math.PI / 2),
  4: qAxis([0, 0, 1], -Math.PI / 2),
  2: qAxis([1, 0, 0], -Math.PI / 2),
  5: qAxis([1, 0, 0], Math.PI / 2),
};

/** The value currently facing up, and how flat it lies (1 = flat on the table). */
export function topFace(q: Quat): { value: number; flat: number } {
  let best = FACE_AXES[0], up = -2;
  for (const f of FACE_AXES) {
    const y = qRotate(q, f[0])[1];
    if (y > up) (up = y), (best = f);
  }
  return { value: best[1], flat: up };
}

/** Screen-plane turn of the top face (radians), for skins that draw the die from straight above. */
export function spinOf(q: Quat): number {
  const side = FACE_AXES.map(([a]) => qRotate(q, a)).reduce((b, v) => (Math.abs(v[1]) < Math.abs(b[1]) ? v : b));
  return Math.atan2(side[2], side[0]);
}

// ---------- motion ----------

const smooth = (u: number) => u * u * (3 - 2 * u);
/** Speed falls to zero at u = 1: the die slows down instead of stopping dead. */
const slowDown = (u: number) => 1 - (1 - u) ** 3;
/** Bouncing off the table edges = folding the straight path back into [lo, hi]. */
function fold(v: number, lo: number, hi: number) {
  const w = hi - lo;
  if (w <= 0) return (lo + hi) / 2;
  const m = (((v - lo) % (2 * w)) + 2 * w) % (2 * w);
  return lo + (m <= w ? m : 2 * w - m);
}
export function seeded(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

/** Holding the die grows the charge; a full second and a bit is a full-power throw. */
export const chargeOf = (heldMs: number) => Math.min(1, heldMs / 1200);

/** In the hand: lifted, rattling, spinning faster the longer it is held. `t` in seconds. */
export function shakePose(t: number, charge: number, base: Quat = IDENTITY): Pose {
  const a = 0.04 + 0.14 * charge;
  const spin = qAxis([Math.sin(t * 1.3), 1, Math.cos(t * 1.7)], t * (3 + 12 * charge));
  return {
    x: Math.sin(t * 37) * a,
    z: Math.cos(t * 29) * a,
    y: REST + 0.35 + 0.1 * Math.sin(t * 9),
    q: qMul(spin, base),
  };
}

/**
 * The throw: flies off in the toss direction, bounces lower and lower, rolls and slides to a stop showing `value`.
 * `aim` = direction (radians, screen plane) from home towards the board; the toss angle is relative to it,
 * so a throw replays sensibly on screens with a different layout. `start` = where the hand let go (continuity).
 * Returns pose(ms) for 0 ≤ ms ≤ duration.
 */
export function tossPath(toss: Toss, value: number, table: Table, aim: number, duration: number, start: Pose = restPose()) {
  const rnd = seeded(toss.seed);
  const power = Math.min(1, Math.max(0, toss.power));
  const dir = aim + toss.angle;
  const [dx, dz] = [Math.cos(dir), Math.sin(dir)];
  const span = Math.hypot(table.maxX - table.minX, table.maxZ - table.minZ);
  const dist = (0.3 + 0.55 * power) * span;
  const T = duration / 1000;
  const glide = 0.85 * T; // comes to rest a little before the end so the result can be read

  // hops: each one shorter and lower (restitution), all done in the first 60 %
  const r = 0.45, h0 = 0.7 + 1.3 * power, d0 = 0.6 * T * (1 - r);
  const height = (t: number) => {
    for (let k = 0, at = 0, d = d0, h = h0; k < 6; k++, at += d, d *= r, h *= r * r) {
      if (t < at + d) {
        const u = (t - at) / d;
        return REST + 4 * h * u * (1 - u);
      }
    }
    return REST;
  };

  // tumble: rolls about the axis across its path (a little off, per seed), turning more on a longer throw
  const axis: Vec3 = [dz, (rnd() - 0.5) * 0.8, -dx];
  const turns = Math.max(Math.PI * 1.5, dist * 1.6) + rnd() * Math.PI;
  const end = qMul(qAxis([0, 1, 0], rnd() * TAU), FACE_UP[value] ?? IDENTITY);
  const from = qMul(qAxis(axis, -turns), end); // so that rolling `turns` lands exactly on `end`

  return (ms: number): Pose => {
    const t = Math.min(T, Math.max(0, ms / 1000));
    const u = Math.min(1, t / glide), s = slowDown(u);
    const settle = smooth(Math.min(1, t / (0.3 * T))); // blend from the hand's orientation while spinning fast
    const off = 1 - smooth(Math.min(1, t / (0.2 * T))); // and from where the hand was
    return {
      x: fold(dx * dist * s + start.x * off, table.minX, table.maxX),
      z: fold(dz * dist * s + start.z * off, table.minZ, table.maxZ),
      y: height(t) + (start.y - REST) * off,
      q: qMul(qAxis(axis, turns * s), qSlerp(start.q, from, settle)),
    };
  };
}

export const restPose = (q: Quat = IDENTITY): Pose => ({ x: 0, y: REST, z: 0, q });

/** Back to the slot after the result was shown: a small hop, same face up, turning square again. u = 0..1. */
export function homePose(from: Pose, u: number): Pose {
  const e = smooth(Math.min(1, Math.max(0, u)));
  return { x: from.x * (1 - e), z: from.z * (1 - e), y: REST + 0.6 * Math.sin(Math.PI * e), q: qSlerp(from.q, FACE_UP[topFace(from.q).value], e) };
}
