// Turntable view of one avatar for the menu's avatar picker. Drag to turn it; it spins slowly on its own.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { disposeRenderer } from './toon.ts';

export const avatarUrl = (id: string) => `${import.meta.env.BASE_URL}models/avatars/${id}.glb`;

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map<string, Promise<GLTF>>();
/** One download per avatar, shared by the menu preview and the 3D board. A failed load is retried next time. */
export function loadAvatar(id: string) {
  if (!cache.has(id)) cache.set(id, loader.loadAsync(avatarUrl(id)).catch(e => (cache.delete(id), Promise.reject(e))));
  return cache.get(id)!;
}

export class AvatarPreview {
  private renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
  private controls: OrbitControls;
  private model?: THREE.Object3D;
  private ro: ResizeObserver;
  private wanted = '';

  constructor(host: HTMLElement) {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    host.appendChild(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xcdbdff, 1.7));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-2, 4, 3);
    this.scene.add(sun);
    this.camera.position.set(0, 0.7, 2.5);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    Object.assign(this.controls, { enableZoom: false, enablePan: false, autoRotate: true, autoRotateSpeed: 1.5, enableDamping: true });
    this.controls.target.set(0, 0.5, 0);
    this.ro = new ResizeObserver(() => {
      const { clientWidth: w, clientHeight: h } = host;
      this.renderer.setSize(w, h, false); // CSS sizes the canvas: an inline px width would stop the card from shrinking
      this.camera.aspect = w / h || 1;
      this.camera.updateProjectionMatrix();
    });
    this.ro.observe(host);
    this.renderer.setAnimationLoop(() => (this.controls.update(), this.renderer.render(this.scene, this.camera)));
  }

  async show(id: string) {
    this.wanted = id;
    const gltf = await loadAvatar(id);
    if (this.wanted !== id) return; // the player clicked on: a newer pick wins
    if (this.model) this.scene.remove(this.model);
    this.model = gltf.scene.clone();
    const box = new THREE.Box3().setFromObject(this.model);
    this.model.scale.multiplyScalar(1 / (box.max.y - box.min.y)); // 1 unit tall, feet on the floor
    this.model.position.y = -box.min.y / (box.max.y - box.min.y);
    this.scene.add(this.model);
  }

  destroy() {
    this.ro.disconnect();
    this.controls.dispose();
    disposeRenderer(this.renderer, this.scene);
    this.renderer.domElement.remove();
  }
}
