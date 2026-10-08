/* =====================================================================
 * Cottonfall FX — Visual Glitch filter
 * =====================================================================
 * A standalone PIXI post-process filter attached directly to the canvas
 * (no FXMaster compositor involved). Exported as `CottonfallGlitch` and
 * also exposed on globalThis for macro use.
 *
 *   CottonfallGlitch.enable();                 // on
 *   CottonfallGlitch.disable();                // off
 *   CottonfallGlitch.toggle();                 // flip
 *   CottonfallGlitch.setOptions({ speed: 3 }); // live-tune
 *   CottonfallGlitch.pulse(800);               // timed burst
 *
 * Options (0..1 unless noted): intensity, speed (0..5), rgbSplit,
 * blockiness (higher = thinner bands), scanlines, and
 * target ("primary" scene imagery | "stage" whole board | "environment").
 * --------------------------------------------------------------------- */

const LOG = "cottonfall-fx | glitch";

const DEFAULTS = Object.freeze({
  intensity: 0.35,
  speed: 0.8,
  rgbSplit: 0.3,
  blockiness: 0.5,
  scanlines: 0.2,
  // Which canvas layer the glitch is applied to:
  //   "background"  -> just the scene's background map image (default, like FXMaster's own filters)
  //   "primary"     -> the whole scene group (map + tiles + tokens)
  //   "environment" -> map + tiles (tokens stay crisp)
  //   "stage"       -> the entire board, including grid/overlays
  target: "background",
});

const VERTEX = `#version 300 es
precision highp float;

in vec2 aVertexPosition;

uniform mat3 projectionMatrix;
uniform vec4 inputSize;
uniform vec4 outputFrame;

out vec2 vTextureCoord;

void main(void) {
  vec2 position = aVertexPosition * max(outputFrame.zw, vec2(0.0)) + outputFrame.xy;
  gl_Position = vec4((projectionMatrix * vec3(position, 1.0)).xy, 0.0, 1.0);
  vTextureCoord = aVertexPosition * (outputFrame.zw * inputSize.zw);
}
`;

const FRAGMENT = `#version 300 es
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

in vec2 vTextureCoord;
out vec4 fragColor;

uniform sampler2D uSampler;
uniform vec4 inputSize;
uniform vec4 outputFrame;
uniform vec4 inputClamp;

uniform float uTime;
uniform float intensity;
uniform float speed;
uniform float rgbSplit;
uniform float blockiness;
uniform float scanlines;

float hash11(float n){ return fract(sin(n) * 43758.5453123); }
float hash21(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main(){
  vec2 uv = vTextureCoord;
  vec4 srcOrig = texture(uSampler, uv);

  float amt = clamp(intensity, 0.0, 1.0);
  if (amt <= 0.0) { fragColor = srcOrig; return; }

  vec2 screenPx = outputFrame.xy + vTextureCoord * outputFrame.zw;
  vec4 clampRect = (inputClamp.z > 0.0) ? inputClamp : vec4(0.0, 0.0, 1.0, 1.0);

  float rate = max(speed, 0.0) * 12.0 + 1.0;
  float gframe = floor(uTime * rate);

  float bandH = mix(80.0, 8.0, clamp(blockiness, 0.0, 1.0));
  float band = floor(screenPx.y / bandH);

  float r = hash21(vec2(band, gframe));
  float torn = step(1.0 - (0.2 + 0.6 * amt), r);
  float dir = (hash11(band * 7.0 + gframe * 3.0) < 0.5) ? -1.0 : 1.0;

  float shiftPx = torn * dir * hash21(vec2(band * 1.7, gframe * 2.3)) * (60.0 * amt);
  float shiftUV = shiftPx * inputSize.z;

  float split = (rgbSplit * 8.0 * amt + torn * 8.0 * amt) * inputSize.z;

  vec2 base = uv + vec2(shiftUV, 0.0);
  float rC = texture(uSampler, clamp(base + vec2(split, 0.0), clampRect.xy, clampRect.zw)).r;
  float gC = texture(uSampler, clamp(base,                    clampRect.xy, clampRect.zw)).g;
  float bC = texture(uSampler, clamp(base - vec2(split, 0.0), clampRect.xy, clampRect.zw)).b;
  vec3 col = vec3(rC, gC, bC);

  float lineRand = hash21(vec2(band * 3.3, gframe));
  float whiteLine = step(0.98 - 0.1 * amt, lineRand) * torn;
  col = mix(col, vec3(hash21(screenPx + gframe)), whiteLine * 0.6);

  float sl = sin(screenPx.y * 3.14159) * 0.5 + 0.5;
  col *= 1.0 - scanlines * amt * 0.3 * sl;

  fragColor = vec4(mix(srcOrig.rgb, col, amt), srcOrig.a);
}
`;

class GlitchController {
  constructor() {
    this.filter = null;
    this.tickerFn = null;
    this.active = false;
    this._layer = null;
    this.opts = { ...DEFAULTS };
  }

  _resolveLayer() {
    const map = {
      stage: canvas?.stage,
      primary: canvas?.primary,
      environment: canvas?.environment,
      background: canvas?.primary?.background,
    };
    return map[this.opts.target]
      ?? canvas?.primary?.background
      ?? canvas?.primary
      ?? canvas?.stage
      ?? null;
  }

  _makeFilter() {
    return new PIXI.Filter(VERTEX, FRAGMENT, {
      uTime: 0,
      intensity: this.opts.intensity,
      speed: this.opts.speed,
      rgbSplit: this.opts.rgbSplit,
      blockiness: this.opts.blockiness,
      scanlines: this.opts.scanlines,
    });
  }

  _applyOpts() {
    if (!this.filter) return;
    const u = this.filter.uniforms;
    u.intensity = this.opts.intensity;
    u.speed = this.opts.speed;
    u.rgbSplit = this.opts.rgbSplit;
    u.blockiness = this.opts.blockiness;
    u.scanlines = this.opts.scanlines;
  }

  _attach() {
    if (!canvas?.ready || !globalThis.PIXI) return false;
    const layer = this._resolveLayer();
    if (!layer) return false;

    if (!this.filter) this.filter = this._makeFilter();
    this._applyOpts();

    const current = Array.isArray(layer.filters) ? [...layer.filters] : [];
    if (!current.includes(this.filter)) current.push(this.filter);
    layer.filters = current;
    this._layer = layer;

    if (!this.tickerFn) {
      this.tickerFn = () => {
        if (this.filter) this.filter.uniforms.uTime = (this.filter.uniforms.uTime + (canvas.app.ticker.deltaMS / 1000)) % 1e6;
      };
      canvas.app.ticker.add(this.tickerFn);
    }
    return true;
  }

  _detach() {
    const layer = this._layer ?? canvas?.primary ?? canvas?.stage;
    if (layer && Array.isArray(layer.filters) && this.filter) {
      const next = layer.filters.filter((f) => f !== this.filter);
      layer.filters = next.length ? next : null;
    }
    this._layer = null;
    if (this.tickerFn) {
      try { canvas?.app?.ticker?.remove(this.tickerFn); } catch (e) { /* noop */ }
      this.tickerFn = null;
    }
  }

  enable(opts = {}) {
    this.opts = { ...this.opts, ...opts };
    this.active = true;
    const ok = this._attach();
    if (!ok) ui?.notifications?.warn?.("Cottonfall Glitch: canvas isn't ready yet — it will apply when the scene loads.");
    return this;
  }

  disable() {
    this.active = false;
    this._detach();
    return this;
  }

  toggle(opts = {}) {
    return this.active ? this.disable() : this.enable(opts);
  }

  setOptions(opts = {}) {
    const prevTarget = this.opts.target;
    this.opts = { ...this.opts, ...opts };
    this._applyOpts();
    if (this.active && opts.target && opts.target !== prevTarget) {
      this._detach();
      this._attach();
    }
    return this;
  }

  async pulse(ms = 800, opts = {}) {
    const wasActive = this.active;
    const prev = { ...this.opts };
    this.enable(opts);
    await new Promise((res) => setTimeout(res, Math.max(0, ms)));
    if (wasActive) this.enable(prev);
    else this.disable();
    return this;
  }

  reattachIfActive() {
    if (!this.active) return;
    this.filter = null;
    this.tickerFn = null;
    this._attach();
  }
}

export const CottonfallGlitch = new GlitchController();

globalThis.CottonfallGlitch = CottonfallGlitch;

Hooks.on("canvasReady", () => CottonfallGlitch.reattachIfActive());
Hooks.on("canvasTearDown", () => {
  if (CottonfallGlitch.tickerFn) {
    try { canvas?.app?.ticker?.remove(CottonfallGlitch.tickerFn); } catch (e) { /* noop */ }
    CottonfallGlitch.tickerFn = null;
  }
});

console.log(`${LOG} | loaded`);
