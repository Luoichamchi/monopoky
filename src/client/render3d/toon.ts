// Shared "anime 3D" material helpers for the 3D templates.
import * as THREE from 'three';
import { THEME } from '../render/theme.ts';

export const INK = new THREE.Color(THEME.ink);

/** 3-step cel shading ramp. */
export const GRADIENT = (() => {
  const t = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

export const toon = (color: THREE.ColorRepresentation, extra: THREE.MeshToonMaterialParameters = {}) =>
  new THREE.MeshToonMaterial({ color, gradientMap: GRADIENT, ...extra });

/** Exclude a material from the ink outline pass (decals, sprites, helpers). */
export function noOutline<T extends THREE.Material>(m: T): T {
  m.userData.outlineParameters = { visible: false };
  return m;
}

/** Free a WebGL renderer right away: browsers cap live contexts (~16), and templates can be swapped often. */
export function disposeRenderer(r: THREE.WebGLRenderer, scene: THREE.Object3D) {
  r.setAnimationLoop(null);
  scene.traverse(o => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    (Array.isArray(m.material) ? m.material : m.material ? [m.material] : []).forEach(x => x.dispose());
  });
  r.dispose();
  r.forceContextLoss();
}
