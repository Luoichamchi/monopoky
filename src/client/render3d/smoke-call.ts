// Spirit smoke around the turn notice: the same noise as the horses' smoke ribbons (render3d/spirit.ts),
// drawn on a small canvas behind the frame. Plain WebGL (no three.js) so the game screen stays light.
import { NOISE } from './noise.ts';

const VERT = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';
const FRAG = /* glsl */ `
  precision mediump float;
  uniform vec2 uRes, uBox; // canvas size, half size of the frame (device px)
  uniform float uTime, uPower;
  uniform vec3 uColor;
  ${NOISE}
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
    return v;
  }
  void main() {
    vec2 p = gl_FragCoord.xy - uRes * 0.5; // px from the centre, y up
    p.x -= p.y * 0.249;                    // undo the frame's CSS skewX(-14deg)
    vec2 q = p / uBox.y;                   // in half-heights of the frame
    float t = uTime;
    vec2 warp = vec2(fbm(q * 1.3 + vec2(0.0, -t * 0.6)), fbm(q * 1.3 + vec2(5.2, -t * 0.5))) - 0.5;
    vec2 out2 = abs(p + warp * uBox.y * 0.9) - uBox;
    float d = length(max(out2, 0.0)) / uBox.y; // distance outside the (breathing) frame
    float up = clamp(p.y / uBox.y, 0.0, 1.0);   // the smoke reaches higher above than below
    float halo = exp(-d * (2.0 - 1.0 * up));
    float n = fbm(q * 1.6 + vec2(t * 0.15, -t * 0.9));
    float n2 = fbm(q * 3.4 + vec2(-t * 0.3, -t * 1.5));
    float smoke = smoothstep(0.22, 0.78, n * 0.65 + n2 * 0.35);
    vec2 rim = min(gl_FragCoord.xy, uRes - gl_FragCoord.xy); // fade out before the canvas edge: no hard box
    float fade = smoothstep(0.0, uBox.y * 1.4, min(rim.x, rim.y));
    float a = clamp(smoke * halo * uPower, 0.0, 1.0) * fade;
    vec3 col = mix(uColor, vec3(1.0), 0.2 + 0.4 * smoothstep(0.55, 0.9, n));
    gl_FragColor = vec4(col * a, a); // premultiplied
  }`;

export class SmokeCall {
  private gl: WebGLRenderingContext;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private running = false;
  private t0 = performance.now();
  private still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private canvas: HTMLCanvasElement;

  /** Throws when WebGL is unavailable: the notice then simply has no smoke. */
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: false });
    if (!gl) throw new Error('no WebGL');
    this.gl = gl;
    const prog = gl.createProgram()!;
    for (const [type, src] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, FRAG]] as const) {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'shader');
      gl.attachShader(prog, sh);
    }
    gl.linkProgram(prog);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // one triangle covers the canvas
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    for (const k of ['uRes', 'uBox', 'uTime', 'uPower', 'uColor']) this.u[k] = gl.getUniformLocation(prog, k);
  }

  /** Wrap `box` (the frame) in smoke of `color`; `strong` for the player's own turn. */
  show(box: HTMLElement, color: string, strong: boolean) {
    const { gl, canvas } = this;
    const w = box.offsetWidth, h = box.offsetHeight, k = Math.min(devicePixelRatio, 1.5);
    const cw = w + h * 3, ch = h * 3.6; // room for the smoke to roll out
    Object.assign(canvas.style, { width: `${cw}px`, height: `${ch}px` });
    canvas.width = Math.round(cw * k);
    canvas.height = Math.round(ch * k);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(this.u.uRes, canvas.width, canvas.height);
    gl.uniform2f(this.u.uBox, (w / 2) * k, (h / 2) * k);
    gl.uniform1f(this.u.uPower, strong ? 1.6 : 1.1);
    const c = parseInt(color.slice(1), 16);
    gl.uniform3f(this.u.uColor, (c >> 16) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255);
    if (this.still) return this.draw();
    if (!this.running) (this.running = true), requestAnimationFrame(this.frame);
  }

  destroy() {
    this.running = false;
    this.gl.getExtension('WEBGL_lose_context')?.loseContext(); // browsers cap live contexts
  }

  private frame = () => {
    const hidden = !this.canvas.isConnected || !!this.canvas.closest('[hidden]');
    if (!this.running || hidden) return void (this.running = false); // show() starts it again
    this.draw();
    requestAnimationFrame(this.frame);
  };

  private draw() {
    this.gl.uniform1f(this.u.uTime, (performance.now() - this.t0) / 1000);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);
  }
}
