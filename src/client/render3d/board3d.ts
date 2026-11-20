// 3D board template (three.js): toon-shaded "anime 3D" look with ink outlines.
// Same contract as the 2D board (render/renderer.ts). Uses the same logical layout, effects and timing.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { GATE, HOME, STABLE, absOf, seatOf } from '../../core/board.ts';
import type { GameEvent, GameState } from '../../core/types.ts';
import { TIMING } from '../../session.ts';
import { animate, burst, done, explosion, iconPop, impact, sfxText, shake, svg, utils } from '../render/fx.ts';
import { CELL, TRACK_CELLS, horseXY } from '../render/layout.ts';
import type { BoardRenderer } from '../render/renderer.ts';
import { INK, disposeRenderer, noOutline, toon } from './toon.ts';
import { mergeStatic } from './merge.ts';
import { SpiritDust, smokeRibbons, time as smokeTime, type Smoke } from './spirit.ts';
import { TILE_SKIN } from '../render/skins.ts';
import { THEME, seatColor } from '../render/theme.ts';

// ---------- assets ----------

const ATLAS_URL = `${import.meta.env.BASE_URL}models/atlas-board.glb`; // built by tools/blender/atlas_board.py
let atlasAsset: GLTF | undefined;
const PIECE_URL = `${import.meta.env.BASE_URL}models/horse-piece.glb`; // built by tools/blender/horse_piece.py
let pieceAsset: GLTF | undefined;

export async function preload() {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder); // models are packed by `npm run models`
  atlasAsset ??= await loader.loadAsync(ATLAS_URL);
  pieceAsset ??= await loader.loadAsync(PIECE_URL);
  await document.fonts?.load('800 64px "Baloo 2"').catch(() => undefined); // labels are drawn on canvases
}

// ---------- helpers ----------

/** World units: 1 cell = 1 unit, board centered on the origin. */
const W = (px: number) => px / CELL - 7.5;
const H = { track: 0.08, lane: 0.22, stable: 0.36 }; // surface heights a horse stands on
function canvasTexture(size: number, draw: (c: CanvasRenderingContext2D) => void) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function emojiSprite(icon: string, size: number) {
  const map = canvasTexture(128, c => {
    c.font = '96px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(icon, 64, 72);
  });
  const s = new THREE.Sprite(noOutline(new THREE.SpriteMaterial({ map, depthWrite: false })));
  s.scale.setScalar(size);
  return s;
}

interface Horse3D {
  root: THREE.Group; // positioned on the board
  body: THREE.Group; // turned to face movement, scaled for kicks/teleports
  ring: THREE.Mesh;
  bubble: THREE.Mesh;
  ice: THREE.Mesh; // shown while the horse is frozen
  hit: THREE.Mesh;
  spirit: SpiritParts;
}

interface SpiritParts {
  head: THREE.Object3D; // horse_spirit node: floats above the pedestal
  headY: number; // its resting height (compressed models keep an offset on the node)
  smoke: Smoke;
  phase: number; // desyncs the bobbing between pieces
  power: number; // smoothed smoke strength (thicker while pickable)
  pedestal: number; // pedestal top in world units, where the dust rises from
  last: THREE.Vector3; // previous position, to notice movement
}

type GlowMaterial = THREE.MeshToonMaterial | THREE.MeshStandardMaterial;

export class Board3D implements BoardRenderer {
  onHop?: () => void;
  readonly el: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private effect: OutlineEffect;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  private controls: OrbitControls;
  private world = new THREE.Group();
  private overlay: SVGSVGElement;
  private fx: SVGGElement;
  private timer = new THREE.Timer();
  private ro: ResizeObserver;
  private raycaster = new THREE.Raycaster();

  private s!: GameState;
  private pos: number[] = [];
  private horses: Horse3D[] = [];
  private cells = new Map<number, THREE.Mesh>();
  private stables: GlowMaterial[][] = []; // per seat: what pulses when it is that seat's turn
  private tileSprites: THREE.Sprite[] = [];
  private dust?: SpiritDust;
  private merged: THREE.BufferGeometry[] = []; // atlas meshes merged per material (disposed on rebuild)
  private flag?: { geo: THREE.BufferGeometry; pos: THREE.BufferAttribute; rest: Float32Array; left: number; width: number; s: number; o: THREE.Vector3 };
  private wave = 0; // flag wave phase
  private gust = 0; // 1 right after a dice roll, fades back to a breeze
  private marker: THREE.Mesh;
  private turnSeat = -1;
  private pickable = new Set<number>();
  private onPick?: (id: number) => void;
  private preview?: (id: number) => number | null;
  private down?: [number, number];
  readonly fullTable = true; // the board fills the table; panels and the dice float above it

  constructor(host: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'board3d';
    host.appendChild(this.el);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.el.appendChild(this.renderer.domElement);
    this.effect = new OutlineEffect(this.renderer, { defaultThickness: 0.007, defaultColor: [INK.r, INK.g, INK.b] });

    this.overlay = svg('svg', { class: 'fx3d' }, this.el);
    this.fx = svg('g', {}, this.overlay);

    this.camera.position.set(0, 29, 19); // only the direction matters: fit() picks the distance
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    Object.assign(this.controls, {
      enablePan: false, enableDamping: true,
      minPolarAngle: 0.05, maxPolarAngle: 1.05, rotateSpeed: 0.6,
    });
    this.controls.target.set(0, 0, 0.6);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xcdbdff, 1.7));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-6, 16, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
    sun.shadow.bias = -0.0005;
    this.scene.add(sun, this.world);

    this.marker = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 8, 32), noOutline(new THREE.MeshBasicMaterial({ color: 0xffffff })));
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.visible = false;
    this.scene.add(this.marker);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', e => (this.down = [e.clientX, e.clientY]));
    canvas.addEventListener('pointerup', e => {
      if (this.down && Math.hypot(e.clientX - this.down[0], e.clientY - this.down[1]) < 6) {
        const id = this.pick(e);
        if (id !== undefined) this.onPick?.(id);
      }
      this.down = undefined;
    });
    canvas.addEventListener('pointermove', e => this.hover(e));

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.el);
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ---------- BoardRenderer ----------

  build(s: GameState) {
    this.s = s;
    this.world.clear();
    this.cells.clear();
    this.tileSprites = [];
    this.flag = undefined;
    this.drawBoard(s);
    this.horses = s.horses.map(h => this.makeHorse(seatOf(s, h.owner), h.id));
    const fewer = matchMedia('(pointer: coarse)').matches; // phones: half the particles
    this.dust = new SpiritDust(s.horses.map(h => new THREE.Color(seatColor(seatOf(s, h.owner)).main)), fewer ? 12 : 24);
    this.world.add(this.dust.points);
    this.pos = s.horses.map(() => STABLE);
    this.sync(s);
  }

  sync(s: GameState) {
    this.s = s;
    for (const h of s.horses) {
      this.pos[h.id] = h.pos;
      const hz = this.horses[h.id];
      hz.root.position.copy(this.at(h.id));
      hz.body.scale.setScalar(1);
      hz.body.rotation.set(0, h.pos === STABLE ? this.faceCenter(hz.root.position) : this.heading(h.id, h.pos), 0);
      hz.bubble.visible = h.shield > 0;
      hz.ice.visible = h.frozen > 0;
    }
    this.paintCells();
  }

  setPickable(ids: number[], onPick?: (id: number) => void, preview?: (id: number) => number | null) {
    this.pickable = new Set(ids);
    this.onPick = onPick;
    this.preview = preview;
    this.marker.visible = false;
    this.horses.forEach((h, id) => (h.ring.visible = this.pickable.has(id)));
  }

  async animate(e: GameEvent) {
    switch (e.t) {
      case 'move':
        if (e.jump) await this.teleport(e.horse, e.path[0]);
        else for (const p of e.path) await this.hop(e.horse, p);
        break;
      case 'kick':
        await this.kick(e.horse);
        break;
      case 'tile': {
        const [x, y] = this.screen(this.horses[e.horse].root.position, 0.8);
        if (e.tile === 'bomb') {
          shake(this.el, 14);
          explosion(this.fx, x, y);
          sfxText(this.fx, x, y, 'DOKAAN!', '#ff7a59');
        }
        await iconPop(this.fx, x, y, TILE_SKIN[e.tile].icon, TILE_SKIN[e.tile].color);
        break;
      }
      case 'shield':
        this.horses[e.horse].bubble.visible = e.on;
        if (e.on) await burst(this.fx, ...this.screen(this.horses[e.horse].root.position, 0.5), ['#7fd8ff', '#ffffff'], 10);
        break;
      case 'roll':
        this.gust = 1;
        break;
      case 'freeze':
        this.horses[e.horse].ice.visible = e.on;
        if (e.on) await burst(this.fx, ...this.screen(this.horses[e.horse].root.position, 0.5), ['#bdf0ff', '#ffffff'], 14);
        break;
    }
  }

  cheer(horse: number, icon: string, color: string) {
    return iconPop(this.fx, ...this.screen(this.horses[horse].root.position, 0.8), icon, color);
  }

  setTurn(seat: number) {
    this.turnSeat = seat;
  }

  destroy() {
    this.ro.disconnect();
    this.controls.dispose();
    disposeRenderer(this.renderer, this.scene);
    this.el.remove();
  }

  // ---------- frame / input ----------

  private frame() {
    this.timer.update();
    const dt = this.timer.getDelta();
    const t = this.timer.getElapsed();
    this.animateSpirits(dt, t);
    this.tileSprites.forEach((sp, i) => (sp.position.y = 0.62 + Math.sin(t * 2.2 + i) * 0.06));
    if (this.flag) this.waveFlag(dt);
    const glow = 0.25 + 0.25 * Math.sin(t * 5);
    this.stables.forEach((mats, seat) => mats.forEach(m => (m.emissiveIntensity = seat === this.turnSeat ? glow : 0)));
    const pulse = 1 + 0.12 * Math.sin(t * 8);
    this.horses.forEach(h => h.ring.visible && h.ring.scale.setScalar(pulse));
    this.marker.rotation.z = t * 2;
    this.controls.update();
    this.effect.render(this.scene, this.camera);
  }

  /** Atlas centre flag: a travelling wave pinned at the pole, stronger for a moment after each roll. */
  private waveFlag(dt: number) {
    const { geo, pos, rest, left, width, s, o } = this.flag!;
    this.gust = Math.max(0, this.gust - dt * 0.7);
    const amp = 0.09 * (1 + 1.6 * this.gust);
    this.wave += dt * 4.2 * (1 + 0.8 * this.gust); // integrate the speed so a gust never makes the wave jump
    for (let i = 0; i < pos.count; i++) {
      const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2];
      const k = (x - left) / width; // 0 at the pole → 1 at the free edge
      pos.setZ(i, (z + amp * k * Math.sin(x * 3.2 - this.wave + y * 0.8) - o.z) / s); // back to the node's (packed) units
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }

  /** Idle life of the atlas pieces: floating head, swirling smoke (thicker when pickable), rising dust. */
  private animateSpirits(dt: number, t: number) {
    if (!this.dust) return;
    smokeTime.value = t;
    const moving: boolean[] = [];
    this.horses.forEach((h, id) => {
      const sp = h.spirit;
      const picked = this.pickable.has(id);
      moving[id] = sp.last.distanceToSquared(h.root.position) > 1e-6;
      sp.last.copy(h.root.position);
      const target = picked || moving[id] ? 1 : 0.6;
      sp.power += (target - sp.power) * Math.min(1, dt * 4);
      sp.smoke.material.uniforms.uPower.value = sp.power;
      sp.smoke.group.rotation.y += dt * (0.6 + sp.power);
      const amp = picked ? 0.05 : 0.03;
      sp.head.position.y = sp.headY + 0.03 + amp + Math.sin(t * 1.6 + sp.phase) * amp; // never dips into the pedestal
      sp.head.rotation.z = Math.sin(t * 1.1 + sp.phase) * 0.04;
      sp.head.rotation.x = Math.sin(t * 0.9 + sp.phase * 1.3) * 0.03;
    });
    const at = new THREE.Vector3();
    this.dust.update(
      dt,
      this.renderer.domElement.height,
      i => {
        const h = this.horses[i];
        if (h.body.scale.x < 0.5) return null; // hidden mid kick / teleport
        return at.copy(h.root.position).setY(h.root.position.y + h.spirit.pedestal * 0.9);
      },
      i => (this.pickable.has(i) || moving[i] ? 1 : 0),
    );
  }

  private resize() {
    const w = this.el.clientWidth, h = this.el.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.overlay.setAttribute('viewBox', `0 0 ${w} ${h}`);
    this.fit();
  }

  /** Move the camera (along its current view direction) as close as possible while the whole board stays in frame. */
  private fit() {
    const target = this.controls.target;
    const dir = this.camera.position.clone().sub(target).normalize();
    const corners = [-8.3, 8.3].flatMap(x => [-8.3, 8.3].map(z => new THREE.Vector3(x, 0, z)));
    const fits = (d: number) => {
      this.camera.position.copy(target).addScaledVector(dir, d);
      this.camera.lookAt(target);
      this.camera.updateMatrixWorld();
      return corners.every(c => {
        const p = c.clone().project(this.camera);
        return Math.abs(p.x) < 0.97 && Math.abs(p.y) < 0.95;
      });
    };
    let [lo, hi] = [8, 120];
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      fits(mid) ? (hi = mid) : (lo = mid);
    }
    fits(hi);
    this.controls.minDistance = hi * 0.55; // zoom in up to ~2x
    this.controls.maxDistance = hi * 1.4;
    this.controls.update();
  }

  private aim(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
  }

  private pick(e: PointerEvent): number | undefined {
    this.aim(e);
    const targets = [...this.pickable].map(id => this.horses[id].hit);
    return this.raycaster.intersectObjects(targets, false)[0]?.object.userData.id;
  }

  private hover(e: PointerEvent) {
    const id = this.pick(e);
    this.renderer.domElement.style.cursor = id === undefined ? '' : 'pointer';
    const to = id === undefined ? null : (this.preview?.(id) ?? null);
    this.marker.visible = to !== null;
    if (to === null || id === undefined) return;
    const p = this.at(id, to);
    this.marker.position.set(p.x, p.y + 0.03, p.z);
    (this.marker.material as THREE.MeshBasicMaterial).color.set(seatColor(seatOf(this.s, this.s.horses[id].owner)).main);
  }

  // ---------- positions ----------

  private at(id: number, pos = this.pos[id]): THREE.Vector3 {
    const [px, py] = horseXY(seatOf(this.s, this.s.horses[id].owner), pos, id % 4);
    const y = pos === STABLE ? H.stable : pos >= GATE ? H.lane : H.track;
    return new THREE.Vector3(W(px), y, W(py));
  }

  private screen(v: THREE.Vector3, lift = 0): [number, number] {
    const p = v.clone().setY(v.y + lift).project(this.camera);
    return [((p.x + 1) / 2) * this.el.clientWidth, ((1 - p.y) / 2) * this.el.clientHeight];
  }

  private faceCenter(p: THREE.Vector3) {
    return Math.atan2(-p.x, -p.z);
  }

  /** Heading along the route at `pos` (track or home lane). The diagonal step at a corner keeps the incoming straight. */
  private heading(id: number, pos: number) {
    const seat = seatOf(this.s, this.s.horses[id].owner);
    const xy = (p: number) => horseXY(seat, p, 0);
    const from = Math.min(pos, GATE + HOME - 1); // last home step: keep the lane's direction
    let [a, b] = [xy(from), xy(from + 1)];
    if (a[0] !== b[0] && a[1] !== b[1] && from > 0) [a, b] = [xy(from - 1), a];
    return Math.atan2(b[0] - a[0], b[1] - a[1]);
  }

  /** Turn to `angle` the short way round. */
  private turn(h: Horse3D, angle: number, duration: number) {
    const cur = h.body.rotation.y;
    const to = cur + Math.atan2(Math.sin(angle - cur), Math.cos(angle - cur));
    return duration ? done(animate(h.body.rotation, { y: to, duration, ease: 'outQuad' })) : (h.body.rotation.y = to);
  }

  /** Light up track squares that hold a horse. */
  private paintCells() {
    const occ = new Map<number, string>();
    for (const h of this.s.horses) {
      const p = this.pos[h.id];
      const seat = seatOf(this.s, h.owner);
      if (p >= 0 && p <= GATE) occ.set(absOf(seat, p), seatColor(seat).main);
    }
    this.cells.forEach((m, abs) => {
      const col = occ.get(abs);
      (m.material as GlowMaterial).color.set(col ?? m.userData.base);
      // lift relative to the cell's own size and keep its bottom in place (compressed models put a scale + offset on the node)
      const u = m.userData;
      if (u.sy === undefined) Object.assign(u, { sy: m.scale.y, py: m.position.y, bottom: (m.geometry.boundingBox ?? (m.geometry.computeBoundingBox(), m.geometry.boundingBox!)).min.y });
      const k = col ? u.lift : 1;
      m.scale.y = u.sy * k;
      m.position.y = u.py + u.bottom * u.sy * (1 - k);
    });
  }

  // ---------- building ----------

  private add(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, shadow = true) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.receiveShadow = shadow;
    this.world.add(m);
    return m;
  }

  private drawBoard(s: GameState) {
    const used = new Set(s.players.map(p => p.seat));
    const cx = (c: number) => c + 0.5 - 7.5; // cell index -> world

    this.drawAtlas(used);

    // party tiles: colored disc + floating emoji
    for (const [abs, kind] of Object.entries(s.tiles)) {
      const [c, r] = TRACK_CELLS[+abs];
      this.add(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 24), toon(TILE_SKIN[kind].color), cx(c), 0.07, cx(r));
      const sp = emojiSprite(TILE_SKIN[kind].icon, 0.62);
      sp.position.set(cx(c), 0.62, cx(r));
      this.world.add(sp);
      this.tileSprites.push(sp);
    }
  }

  /**
   * "Tinh bàn Thiên Mã": the whole board is modelled in Blender (blender/atlas-board.blend), on the same grid
   * (1 unit = 1 cell). Code only recolours what the game state drives: track cells, the stable whose turn it is, unused seats.
   * Names it relies on: cell_<abs>, lane_<seat>_gate, lane_<seat>_step<i>, stable_<seat>, lane_<seat>, hub.
   */
  private drawAtlas(used: Set<number>) {
    const board = atlasAsset!.scene.clone();
    const starts = [0, 1, 2, 3].map(seat => absOf(seat, 0));
    const owner = (o: THREE.Object3D) => {
      for (let p: THREE.Object3D | null = o; p; p = p.parent) {
        const m = p.name.match(/^(?:stable|lane)_(\d)$/);
        if (m) return +m[1];
      }
      return -1;
    };
    board.traverse(o => Object.assign(o.userData, { seat: owner(o), cast: /mountains|foothills|hub_/.test(o.name) }));
    // ~700 meshes → one per material and seat. Kept apart: whatever the game changes on its own (see CLAUDE.md).
    const KEEP = /^(cell_\d+|stable_\d_(floor|glow|rim)|hub_flag)$/;
    this.merged.forEach(g => g.dispose());
    this.merged = mergeStatic(board, m => {
      const mat = m.material as GlowMaterial;
      return KEEP.test(m.name) || mat.transparent || mat.map ? null : `${mat.uuid}|${m.userData.seat}|${m.userData.cast}`;
    });
    const stables: GlowMaterial[][] = [[], [], [], []];
    board.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.receiveShadow = true;
      m.castShadow = m.userData.cast;
      const mat = noOutline((m.material as GlowMaterial).clone()); // own copy: cells and seats are recoloured
      const seat: number = m.userData.seat;
      if (seat >= 0 && !used.has(seat)) mat.color.lerp(new THREE.Color('#1b2130'), 0.55);
      if (/^stable_\d_(floor|glow|rim)$/.test(m.name))
        stables[seat].push(Object.assign(mat, { emissive: new THREE.Color(seatColor(seat).main), emissiveIntensity: 0 }));
      m.material = mat;
      const cell = m.name.match(/^cell_(\d+)$/);
      if (cell && !starts.includes(+cell[1])) {
        Object.assign(m.userData, { base: '#' + mat.color.getHexString(), lift: 1.15 });
        this.cells.set(+cell[1], m);
      }
    });
    this.stables = stables;
    this.world.add(board);
    const cloth = board.getObjectByName('hub_flag') as THREE.Mesh | undefined;
    if (cloth) {
      cloth.geometry = cloth.geometry.clone(); // the wave edits vertices: keep the cached asset flat
      const geo = cloth.geometry, pos = geo.getAttribute('position') as THREE.BufferAttribute;
      // compressed models store vertices in a unit box and put a uniform scale + offset on the node: work in Blender units
      const s = cloth.scale.x, o = cloth.position.clone();
      const rest = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) rest.set([pos.getX(i) * s + o.x, pos.getY(i) * s + o.y, pos.getZ(i) * s + o.z], i * 3);
      const xs = rest.filter((_, i) => i % 3 === 0);
      const left = Math.min(...xs);
      this.flag = { geo, pos, rest, left, width: Math.max(...xs) - left, s, o };
    }
  }

  /** Tinh bàn chess piece: pedestal + floating spirit head (two glTF nodes), mane and pedestal in the seat color. */
  private makePiece(seat: number) {
    const col = seatColor(seat);
    const model = pieceAsset!.scene.clone();
    model.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      const tint = (mat: THREE.Material) => {
        const c = noOutline(mat.clone()) as THREE.MeshStandardMaterial;
        if (mat.name === 'hp_mane') c.color.set(col.main), c.emissive.set(col.dark), (c.emissiveIntensity = 0.35);
        if (mat.name === 'hp_base') c.color.set(col.dark);
        return c;
      };
      m.material = Array.isArray(m.material) ? m.material.map(tint) : tint(m.material);
    });
    const base = model.getObjectByName('horse_base')!;
    const size = new THREE.Box3().setFromObject(base).getSize(new THREE.Vector3());
    const k = 0.82 / Math.max(size.x, size.z); // pedestal ≈ 0.82 cell wide
    model.scale.setScalar(k);
    const smoke = smokeRibbons(col.main, Math.random() * 10);
    model.add(smoke.group);
    const head = model.getObjectByName('horse_spirit')!;
    const spirit: SpiritParts = {
      head, headY: head.position.y, smoke, phase: Math.random() * Math.PI * 2,
      power: 0.6, pedestal: size.y * k, last: new THREE.Vector3(),
    };
    return { model, spirit };
  }

  private makeHorse(seat: number, id: number): Horse3D {
    const col = seatColor(seat);
    const { model, spirit } = this.makePiece(seat);

    const root = new THREE.Group();
    const body = new THREE.Group();
    body.add(model);
    root.add(body);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.05, 8, 32), noOutline(new THREE.MeshBasicMaterial({ color: col.main })));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    ring.visible = false;
    const bubble = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 24, 16),
      noOutline(new THREE.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.28, depthWrite: false })),
    );
    bubble.position.y = 0.45;
    bubble.visible = false;
    const ice = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 1, 0.8),
      noOutline(new THREE.MeshBasicMaterial({ color: 0xbdf0ff, transparent: true, opacity: 0.45, depthWrite: false })),
    );
    ice.position.y = 0.5;
    ice.visible = false;
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.1), noOutline(new THREE.MeshBasicMaterial({ visible: false })));
    hit.position.y = 0.5;
    hit.userData.id = id;
    root.add(ring, bubble, ice, hit);
    this.world.add(root);

    return { root, body, ring, bubble, ice, hit, spirit };
  }

  // ---------- animations ----------

  private async hop(id: number, to: number) {
    const h = this.horses[id];
    const p = this.at(id, to);
    this.pos[id] = to;
    this.paintCells();
    this.onHop?.();
    const y0 = Math.max(h.root.position.y, p.y);
    await Promise.all([
      this.turn(h, this.heading(id, to), TIMING.hop),
      done(animate(h.root.position, { x: p.x, z: p.z, duration: TIMING.hop, ease: 'inOutSine' })),
      done(animate(h.root.position, { y: [{ to: y0 + 0.45, ease: 'outQuad' }, { to: p.y, ease: 'inQuad' }], duration: TIMING.hop })),
    ]);
  }

  private async teleport(id: number, to: number) {
    const h = this.horses[id];
    burst(this.fx, ...this.screen(h.root.position, 0.4), ['#b28dff', '#ffffff', '#6ee7ff'], 12);
    await done(animate(h.body.scale, { x: 0, y: 0, z: 0, duration: 280, ease: 'inBack' }));
    this.pos[id] = to;
    this.paintCells();
    h.root.position.copy(this.at(id));
    this.turn(h, this.heading(id, to), 0);
    burst(this.fx, ...this.screen(h.root.position, 0.4), ['#b28dff', '#ffffff', '#6ee7ff'], 12);
    await done(animate(h.body.scale, { x: 1, y: 1, z: 1, duration: 320, ease: 'outBack(2)' }));
  }

  private async kick(id: number) {
    const h = this.horses[id];
    const [x, y] = this.screen(h.root.position, 0.5);
    const color = seatColor(seatOf(this.s, this.s.horses[id].owner)).main;
    shake(this.el, 10);
    impact(this.fx, x, y, color);
    burst(this.fx, x, y, [color, '#fff', '#ffe14d'], 16);
    sfxText(this.fx, x, y, THEME.sfx[Math.floor(Math.random() * THEME.sfx.length)], '#ffe14d');
    await Promise.all([
      done(animate(h.root.position, { y: h.root.position.y + 3.5, duration: 380, ease: 'outQuad' })),
      done(animate(h.body.rotation, { y: h.body.rotation.y + Math.PI * 4, x: 0.6, duration: 380, ease: 'outQuad' })),
    ]);
    await done(animate(h.body.scale, { x: 0, y: 0, z: 0, duration: 120 }));
    this.pos[id] = STABLE;
    this.paintCells();
    h.root.position.copy(this.at(id));
    utils.set(h.body.rotation, { x: 0, y: this.faceCenter(h.root.position) });
    await done(animate(h.body.scale, { x: 1, y: 1, z: 1, duration: 260, ease: 'outBack(3)' }));
  }
}
