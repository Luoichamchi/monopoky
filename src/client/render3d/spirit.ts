// "Spirit horse" decoration for the Tinh bàn Thiên Mã 3D pieces: swirling smoke ribbons + a shared smoke/star dust.
// Purely visual: it only reads where the horses are and whether they are pickable.
import * as THREE from 'three';
import { noOutline } from './toon.ts';
import { NOISE } from './noise.ts';


/** Funnel-shaped strip: starts wide at the pedestal top, spirals up and hugs the chest. Model units (piece ≈ 1.3 tall). */
function ribbonGeometry(turns: number, from: number, to: number) {
  const segs = 48;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const a = u * turns * Math.PI * 2;
    const r = THREE.MathUtils.lerp(0.42, 0.17, u);
    const y = THREE.MathUtils.lerp(from, to, u);
    const h = THREE.MathUtils.lerp(0.06, 0.16, Math.sin(u * Math.PI)); // fattest mid-way
    for (const v of [0, 1]) {
      pos.push(Math.cos(a) * r, y + (v - 0.5) * h, Math.sin(a) * r);
      uv.push(u, v);
    }
    if (i < segs) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
const RIBBONS = [ribbonGeometry(1.1, 0.2, 0.6), ribbonGeometry(0.9, 0.22, 0.52), ribbonGeometry(1.3, 0.18, 0.66)];

export const time = { value: 0 }; // shared by every smoke material

export interface Smoke {
  group: THREE.Group; // add to the piece, spins on its own
  material: THREE.ShaderMaterial;
}

export function smokeRibbons(color: THREE.ColorRepresentation, seed: number): Smoke {
  const material = noOutline(new THREE.ShaderMaterial({
    uniforms: { uTime: time, uColor: { value: new THREE.Color(color) }, uPower: { value: 0.6 }, uSeed: { value: seed } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uPower, uSeed;
      uniform vec3 uColor;
      varying vec2 vUv;
      ${NOISE}
      void main() {
        float flow = uTime * (0.6 + uPower);
        float n = noise(vec2(vUv.x * 7.0 - flow * 1.5 + uSeed, vUv.y * 2.5 + flow * 0.4));
        n = 0.5 * n + 0.5 * noise(vec2(vUv.x * 15.0 - flow * 2.3, vUv.y * 5.0 + uSeed));
        float edge = smoothstep(0.0, 0.4, vUv.y) * smoothstep(1.0, 0.6, vUv.y); // soft rim across the strip
        float ends = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.65, vUv.x); // fade at both ends
        float a = edge * ends * smoothstep(0.25, 0.85, n) * uPower;
        gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.25), a * 0.8);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  }));
  const group = new THREE.Group();
  RIBBONS.forEach((g, i) => {
    const m = new THREE.Mesh(g, material);
    m.rotation.y = (i / RIBBONS.length) * Math.PI * 2;
    m.renderOrder = 2;
    group.add(m);
  });
  return { group, material };
}

/** One particle system for the whole board: faint smoke puffs rising off each pedestal, plus a few gold sparkles. */
export class SpiritDust {
  readonly points: THREE.Points;
  private born: Float32Array; // world position each particle was emitted from
  private age: Float32Array;
  private life: Float32Array;
  private owner: Uint8Array;
  private geo = new THREE.BufferGeometry();

  constructor(colors: THREE.Color[], perHorse: number) {
    const n = colors.length * perHorse;
    this.born = new Float32Array(n * 3);
    this.age = new Float32Array(n).map(() => Math.random()); // desync from the start
    this.life = new Float32Array(n).map(() => 1.4 + Math.random() * 1.4);
    this.owner = new Uint8Array(n).map((_, i) => Math.floor(i / perHorse));
    const star = new Float32Array(n).map(() => (Math.random() < 0.2 ? 1 : 0));
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) (star[i] ? new THREE.Color('#ffe7a3') : colors[this.owner[i]]).toArray(col, i * 3);
    this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.geo.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(n), 1));
    this.geo.setAttribute('size', new THREE.BufferAttribute(new Float32Array(n), 1));
    this.geo.setAttribute('star', new THREE.BufferAttribute(star, 1));
    const material = noOutline(new THREE.ShaderMaterial({
      uniforms: { uTime: time, uScale: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute vec3 color; attribute float alpha, size, star;
        varying vec3 vColor; varying float vAlpha, vStar;
        uniform float uScale;
        void main() {
          vColor = color; vAlpha = alpha; vStar = star;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor; varying float vAlpha, vStar;
        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float d = length(p);
          float puff = smoothstep(0.5, 0.0, d);
          float sparkle = max(smoothstep(0.08, 0.0, abs(p.x)) , smoothstep(0.08, 0.0, abs(p.y))) * smoothstep(0.5, 0.1, d) + smoothstep(0.18, 0.0, d);
          float a = mix(puff * 0.45, sparkle, vStar) * vAlpha;
          gl_FragColor = vec4(vColor, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.points = new THREE.Points(this.geo, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
  }

  /** `emit(i)` = world position of horse i's pedestal top (or null to pause), `boost(i)` = 0..1 extra smoke. */
  update(dt: number, viewHeight: number, emit: (i: number) => THREE.Vector3 | null, boost: (i: number) => number) {
    (this.points.material as THREE.ShaderMaterial).uniforms.uScale.value = viewHeight * 0.9;
    const pos = this.geo.getAttribute('position') as THREE.BufferAttribute;
    const alpha = this.geo.getAttribute('alpha') as THREE.BufferAttribute;
    const size = this.geo.getAttribute('size') as THREE.BufferAttribute;
    const star = this.geo.getAttribute('star') as THREE.BufferAttribute;
    for (let i = 0; i < this.age.length; i++) {
      const o = this.owner[i];
      const b = boost(o);
      this.age[i] += (dt * (1 + b)) / this.life[i];
      if (this.age[i] >= 1) {
        const at = emit(o);
        if (!at) continue;
        this.age[i] -= 1;
        const a = Math.random() * Math.PI * 2, r = 0.12 + Math.random() * 0.22;
        this.born.set([at.x + Math.cos(a) * r, at.y, at.z + Math.sin(a) * r], i * 3);
      }
      const t = this.age[i];
      const swirl = t * 3 + i;
      pos.setXYZ(i,
        this.born[i * 3] + Math.cos(swirl) * 0.06 * t,
        this.born[i * 3 + 1] + t * (0.9 + 0.3 * b),
        this.born[i * 3 + 2] + Math.sin(swirl) * 0.06 * t);
      const isStar = star.getX(i) > 0;
      alpha.setX(i, Math.sin(t * Math.PI) * (isStar ? 0.5 + 0.5 * Math.sin(t * 40 + i) : 0.6 + 0.4 * b));
      size.setX(i, isStar ? 0.12 : 0.18 + t * 0.35);
    }
    pos.needsUpdate = alpha.needsUpdate = size.needsUpdate = true;
  }
}
