// 3D dice template: a rounded toon die in its own small WebGL view, works with any board template.
import * as THREE from 'three';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TIMING } from '../../session.ts';
import { animate, done } from '../render/fx.ts';
import type { DiceRenderer } from '../render/renderer.ts';
import { THEME } from '../render/theme.ts';
import { GRADIENT, INK, disposeRenderer, noOutline } from './toon.ts';

const DIE = 1; // edge length
// BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z. Opposite faces sum to 7 like a real die.
const FACE_VALUE = [3, 4, 1, 6, 2, 5];
// rotation that brings each value's face to the top (+Y)
const FACE_UP: Record<number, [number, number, number]> = {
  1: [0, 0, 0], 6: [Math.PI, 0, 0], 3: [0, 0, Math.PI / 2], 4: [0, 0, -Math.PI / 2], 2: [-Math.PI / 2, 0, 0], 5: [Math.PI / 2, 0, 0],
};
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
  onRoll?: () => void;
  private el: HTMLButtonElement;
  private renderer: THREE.WebGLRenderer;
  private effect: OutlineEffect;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  private die: THREE.Mesh;
  private timer = new THREE.Timer();
  private ro: ResizeObserver;
  private waiting = false;

  constructor(host: HTMLElement) {
    this.el = document.createElement('button');
    this.el.className = 'dice3d';
    this.el.setAttribute('aria-label', 'Đổ xúc xắc');
    this.el.disabled = true;
    this.el.onclick = () => this.waiting && this.onRoll?.();
    host.appendChild(this.el);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.el.appendChild(this.renderer.domElement);
    this.effect = new OutlineEffect(this.renderer, { defaultThickness: 0.012, defaultColor: [INK.r, INK.g, INK.b] });

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xcdbdff, 1.8));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(-2, 6, 3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(512, 512);
    Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3 });
    this.scene.add(sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), noOutline(new THREE.ShadowMaterial({ opacity: 0.22 })));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.die = new THREE.Mesh(new RoundedBoxGeometry(DIE, DIE, DIE, 4, 0.16), skin(THEME.seats[0].main));
    this.die.castShadow = true;
    this.die.position.y = DIE / 2;
    this.die.rotation.set(-0.35, 0.6, 0.1); // a little turned so it reads as 3D
    this.scene.add(this.die);

    this.camera.position.set(0, 3.6, 3.4);
    this.camera.lookAt(0, 0.9, 0);
    this.ro = new ResizeObserver(() => {
      const w = this.el.clientWidth, h = this.el.clientHeight;
      if (!w || !h) return;
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    });
    this.ro.observe(this.el);
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private frame() {
    this.timer.update();
    if (this.waiting) {
      const t = this.timer.getElapsed();
      this.die.position.y = DIE / 2 + 0.35 + Math.sin(t * 4) * 0.12;
      this.die.rotation.y += 0.02;
    }
    this.effect.render(this.scene, this.camera);
  }

  setReady(on: boolean, color: string) {
    this.waiting = on;
    this.el.disabled = !on;
    this.el.classList.toggle('ready', on);
    if (color) {
      this.el.style.setProperty('--c', color);
      this.die.material = skin(color);
    }
  }

  /** Toss, tumble, bounce, and land with `value` on top. */
  async roll(value: number, color: string) {
    this.setReady(false, color);
    const ground = DIE / 2;
    const q = new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 1.2) // keep the top face readable
      .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...FACE_UP[value])));
    const end = new THREE.Euler().setFromQuaternion(q);
    // whole extra turns: it visibly tumbles but ends exactly on `end`
    const spin = (a: number) => a + TAU * (1 + Math.floor(Math.random() * 2)) * (Math.random() < 0.5 ? -1 : 1);
    const d = TIMING.roll - 120;
    const p = this.die.position;
    await Promise.all([
      done(animate(p, {
        y: [
          { to: ground + 1.3, duration: d * 0.35, ease: 'outQuad' },
          { to: ground, duration: d * 0.35, ease: 'inQuad' },
          { to: ground + 0.25, duration: d * 0.15, ease: 'outQuad' },
          { to: ground, duration: d * 0.15, ease: 'inQuad' },
        ],
      })),
      done(animate(this.die.rotation, { x: spin(end.x), y: spin(end.y), z: spin(end.z), duration: d * 0.85, ease: 'outCubic' })),
    ]);
    this.die.rotation.copy(end);
  }

  destroy() {
    this.ro.disconnect();
    disposeRenderer(this.renderer, this.scene);
    this.el.remove();
  }
}
