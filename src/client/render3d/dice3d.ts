// 3D dice template: a rounded toon die in its own small WebGL view, works with any board template.
import * as THREE from 'three';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Toss } from '../../core/types.ts';
import { TIMING } from '../../session.ts';
import { DiceDriver } from '../dice/driver.ts';
import { tableFor } from '../dice/input.ts';
import { FACE_AXES } from '../dice/motion.ts';
import type { DiceRenderer } from '../render/renderer.ts';
import { THEME } from '../render/theme.ts';
import { GRADIENT, INK, disposeRenderer } from './toon.ts';

const DIE = 1; // edge length
// BoxGeometry face order (+X, -X, +Y, -Y, +Z, -Z) is the order of the shared motion's FACE_AXES.
const FACE_VALUE = FACE_AXES.map(([, v]) => v);
const TILT = THREE.MathUtils.degToRad(40); // camera tilt from straight down
const UNIT = 0.5; // die edge as a share of the dice button's width
const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  6: [[0.27, 0.25], [0.73, 0.25], [0.27, 0.5], [0.73, 0.5], [0.27, 0.75], [0.73, 0.75]],
};
const TAU = Math.PI * 2;
const skins = new Map<string, THREE.Material[]>();

/** Six face materials with pips in `color` (cached per color). */
function skin(color: string): THREE.Material[] {
  let mats = skins.get(color);
  if (mats) return mats;
  mats = FACE_VALUE.map(v => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const c = cv.getContext('2d')!;
    c.fillStyle = '#fffaf3';
    c.fillRect(0, 0, 128, 128);
    for (const [x, y] of PIPS[v]) {
      c.beginPath();
      c.arc(x * 128, y * 128, v === 1 ? 17 : 12, 0, TAU);
      c.fillStyle = color;
      c.fill();
      c.lineWidth = 4;
      c.strokeStyle = THEME.ink;
      c.stroke();
    }
    const map = new THREE.CanvasTexture(cv);
    map.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshToonMaterial({ map, gradientMap: GRADIENT });
  });
  skins.set(color, mats);
  return mats;
}

export class DiceView3D implements DiceRenderer {
  private el: HTMLButtonElement;
  private arena: () => DOMRect;
  private renderer: THREE.WebGLRenderer;
  private effect: OutlineEffect;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera();
  private sun = new THREE.DirectionalLight(0xffffff, 2);
  private die: THREE.Mesh;
  private timer = new THREE.Timer();
  private ro: ResizeObserver;
  private driver: DiceDriver;
  private size = '';
  private drawn = ''; // what the last frame showed: a still die is not re-rendered

  constructor(host: HTMLElement, arena: () => DOMRect) {
    this.arena = arena;
    this.el = document.createElement('button');
    this.el.className = 'dice3d';
    this.el.setAttribute('aria-label', 'Đổ xúc xắc (nhấn giữ để lắc mạnh hơn, vuốt để quăng)');
    this.el.disabled = true;
    host.appendChild(this.el);

    // the canvas covers the whole board so the die can be thrown across it; the button stays the grip
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.el.appendChild(this.renderer.domElement);
    this.effect = new OutlineEffect(this.renderer, { defaultThickness: 0.012, defaultColor: [INK.r, INK.g, INK.b] });

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xcdbdff, 1.8));
    this.scene.add(this.sun, this.sun.target);

    this.die = new THREE.Mesh(new RoundedBoxGeometry(DIE, DIE, DIE, 4, 0.16), skin(THEME.seats[0].main));
    this.scene.add(this.die);

    this.driver = new DiceDriver(
      this.el,
      () => tableFor(this.el.getBoundingClientRect(), this.arena(), this.unitPx),
      () => {},
    );
    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(this.el);
    this.ro.observe(host.closest('.table') ?? host);
    this.renderer.setAnimationLoop(() => this.frame());
  }

  set onRoll(fn: ((toss: Toss) => void) | undefined) {
    this.driver.onRoll = fn;
  }

  set onShake(fn: ((on: boolean) => void) | undefined) {
    this.driver.onShake = fn;
  }

  private get unitPx() {
    return (this.el.clientWidth || 120) * UNIT;
  }

  /** Canvas over board + button; orthographic camera so 1 unit = one die edge = unitPx on screen, like the 2D die. */
  private layout() {
    const k = this.unitPx, me = this.el.getBoundingClientRect(), a = this.arena();
    if (!me.width || !a.width) return;
    const [cx, cy] = [me.left + me.width / 2, me.top + me.height / 2];
    const pad = 2 * k; // room for the hop
    const left = Math.min(a.left, me.left) - pad, top = Math.min(a.top, me.top) - pad;
    const w = Math.max(a.right, me.right) + pad - left, h = Math.max(a.bottom, me.bottom) + pad - top;
    const key = [left - me.left, top - me.top, w, h, k].map(Math.round).join();
    if (key === this.size) return;
    this.size = key;
    Object.assign(this.renderer.domElement.style, { left: `${left - me.left}px`, top: `${top - me.top}px`, width: `${w}px`, height: `${h}px` });
    this.renderer.setSize(w, h, false);
    Object.assign(this.camera, { left: (left - cx) / k, right: (left + w - cx) / k, top: -(top - cy) / k, bottom: -(top + h - cy) / k, near: 0.1, far: 100 });
    this.camera.position.set(0, 0.5 + 30 * Math.cos(TILT), 30 * Math.sin(TILT));
    this.camera.lookAt(0, 0.5, 0);
    this.camera.updateProjectionMatrix();
  }

  private frame() {
    this.timer.update();
    const t = this.timer.getElapsed();
    const p = this.driver.pose;
    const shown = `${this.size}|${this.driver.ready}|${p.x},${p.y},${p.z},${p.q}|${(this.die.material as THREE.Material[])[0].uuid}`;
    if (!this.driver.ready && shown === this.drawn) return;
    this.drawn = shown;
    this.die.position.set(p.x, p.y, p.z / Math.cos(TILT)); // z stretched so the tilted view maps it 1:1 like the 2D die
    this.die.quaternion.set(...p.q);
    if (this.driver.ready && this.driver.home) {
      this.die.position.y += 0.3 + Math.sin(t * 4) * 0.1; // hovering: grab me
      this.die.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP, t * 1.2));
    }
    this.sun.position.set(this.die.position.x - 2, 6, this.die.position.z + 3);
    this.sun.target.position.copy(this.die.position);
    this.effect.render(this.scene, this.camera);
  }

  setReady(on: boolean, color: string) {
    this.el.disabled = !on;
    this.el.classList.toggle('ready', on);
    if (color) {
      this.el.style.setProperty('--c', color);
      this.die.material = skin(color);
    }
    if (on) this.layout();
    this.driver.setReady(on);
  }

  /** Replay the throw (shared motion), landing with `value` on top. */
  async roll(value: number, color: string, toss: Toss) {
    this.setReady(false, color);
    this.layout();
    await this.driver.roll(value, toss, TIMING.roll);
  }

  destroy() {
    this.driver.destroy();
    this.ro.disconnect();
    disposeRenderer(this.renderer, this.scene);
    this.el.remove();
  }
}
