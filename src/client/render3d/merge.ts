// Draw-call saver for boards modelled in Blender: static meshes that share a material become one mesh.
// The .blend keeps every object separate; this runs on the loaded copy only.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Merge the meshes under `root` that `key` puts in the same group (same key = same material, same everything else).
 * `key` returns null for meshes the game changes on their own (recoloured, animated…): those stay separate.
 * Merged meshes are added to `root` with `userData` of the group's first mesh. Returns the new geometries (caller disposes).
 */
export function mergeStatic(root: THREE.Object3D, key: (m: THREE.Mesh) => string | null): THREE.BufferGeometry[] {
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert();
  const groups = new Map<string, THREE.Mesh[]>();
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material) || m.children.length) return;
    const k = key(m);
    if (k !== null) groups.set(k, [...(groups.get(k) ?? []), m]);
  });

  const made: THREE.BufferGeometry[] = [];
  for (const [k, meshes] of groups) {
    if (meshes.length < 2) continue;
    const parts = meshes.map(m => plain(m.geometry).applyMatrix4(new THREE.Matrix4().multiplyMatrices(toRoot, m.matrixWorld)));
    const geo = mergeGeometries(parts);
    parts.forEach(g => g.dispose());
    if (!geo) continue; // incompatible attributes: leave them as they are
    const merged = new THREE.Mesh(geo, meshes[0].material);
    merged.name = `merged:${k}`;
    Object.assign(merged.userData, meshes[0].userData);
    root.add(merged);
    meshes.forEach(m => m.removeFromParent());
    made.push(geo);
  }
  return made;
}

/** Float position + normal, always indexed: compressed (quantized) models mix integer types that can't be merged or moved. */
function plain(src: THREE.BufferGeometry) {
  const g = new THREE.BufferGeometry();
  for (const name of ['position', 'normal']) {
    const a = src.getAttribute(name);
    if (!a) continue;
    const out = new Float32Array(a.count * 3);
    for (let i = 0; i < a.count; i++) for (let c = 0; c < 3; c++) out[i * 3 + c] = a.getComponent(i, c);
    g.setAttribute(name, new THREE.BufferAttribute(out, 3));
  }
  const n = g.getAttribute('position').count;
  g.setIndex(src.index ? Array.from(src.index.array) : Array.from({ length: n }, (_, i) => i));
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  return g;
}
