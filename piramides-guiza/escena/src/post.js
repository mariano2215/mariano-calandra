// Posproducción: profundidad de campo (CoC por profundidad), rayos de sol (dispersión radial),
// bloom, salida ACES/sRGB y etalonaje cinematográfico (split-toning, viñeta, grano, flash).
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const DOF = {
  uniforms: {
    tDiffuse: { value: null }, tDepth: { value: null },
    resolucion: { value: new THREE.Vector2(1080, 1920) },
    cerca: { value: 0.1 }, lejos: { value: 10000 },
    foco: { value: 10 }, apertura: { value: 0.0 }, maxDesenfoque: { value: 14 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    #include <packing>
    uniform sampler2D tDiffuse; uniform sampler2D tDepth;
    uniform vec2 resolucion; uniform float cerca, lejos, foco, apertura, maxDesenfoque;
    varying vec2 vUv;
    float linZ(vec2 uv){ float d = texture2D(tDepth, uv).x; float vz = perspectiveDepthToViewZ(d, cerca, lejos); return -vz; }
    float coc(float z){ return clamp(abs(1.0/foco - 1.0/z) * apertura * foco, 0.0, 1.0) * maxDesenfoque; }
    void main(){
      vec4 c0 = texture2D(tDiffuse, vUv);
      if (apertura <= 0.0) { gl_FragColor = c0; return; }
      float z0 = linZ(vUv); float r0 = coc(z0);
      if (r0 < 0.6) { gl_FragColor = c0; return; }
      vec3 acc = c0.rgb; float wsum = 1.0;
      const int N = 28;
      for (int i = 0; i < N; i++) {
        float fi = float(i) + 0.5;
        float rr = sqrt(fi / float(N));
        float th = fi * 2.39996323;
        vec2 off = vec2(cos(th), sin(th)) * rr * r0 / resolucion;
        vec2 uv = vUv + off;
        float zi = linZ(uv); float ri = coc(zi);
        // evitar que lo enfocado delante se desangre sobre el fondo
        float w = (zi < z0) ? smoothstep(0.0, 1.0, ri / max(r0, 0.001)) : 1.0;
        acc += texture2D(tDiffuse, uv).rgb * w; wsum += w;
      }
      gl_FragColor = vec4(acc / wsum, c0.a);
    }`,
};

const RAYOS = {
  uniforms: {
    tDiffuse: { value: null }, tDepth: { value: null },
    sol: { value: new THREE.Vector2(0.5, 0.8) }, intensidad: { value: 0.0 }, decaimiento: { value: 0.965 },
    color: { value: new THREE.Color(1.0, 0.82, 0.55) }, aspecto: { value: 1080 / 1920 },
  },
  vertexShader: DOF.vertexShader,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform vec2 sol; uniform float intensidad, decaimiento, aspecto; uniform vec3 color;
    varying vec2 vUv;
    void main(){
      vec4 base = texture2D(tDiffuse, vUv);
      if (intensidad <= 0.0) { gl_FragColor = base; return; }
      vec2 d = (vUv - sol) / 48.0;
      vec2 uv = vUv; float ilum = 1.0; float acc = 0.0;
      for (int i = 0; i < 48; i++) {
        uv -= d;
        float cielo = step(0.99995, texture2D(tDepth, uv).x);
        vec3 c = texture2D(tDiffuse, uv).rgb;
        float l = max(0.0, dot(c, vec3(0.3, 0.5, 0.2)) - 0.9);
        acc += cielo * l * ilum;
        ilum *= decaimiento;
      }
      vec2 dd = (vUv - sol) * vec2(1.0, 1.0 / aspecto);
      float halo = exp(-dot(dd, dd) * 3.0);
      gl_FragColor = vec4(base.rgb + color * acc / 48.0 * intensidad * (0.4 + halo), base.a);
    }`,
};

const ETALON = {
  uniforms: {
    tDiffuse: { value: null }, tiempo: { value: 0 }, resolucion: { value: new THREE.Vector2(1080, 1920) },
    vineta: { value: 0.32 }, grano: { value: 0.035 }, flash: { value: 0 }, negro: { value: 0 },
    calido: { value: 1.0 }, saturacion: { value: 1.05 }, contraste: { value: 1.06 }, aberracion: { value: 0.0012 },
    sepia: { value: 0.0 },
  },
  vertexShader: DOF.vertexShader,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float tiempo, vineta, grano, flash, negro, calido, saturacion, contraste, aberracion, sepia;
    uniform vec2 resolucion; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + tiempo * 37.0) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5;
      float r2 = dot(c * vec2(1.0, 0.75), c * vec2(1.0, 0.75));
      vec2 off = c * aberracion * (1.0 + r2 * 4.0);
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      // contraste en torno al gris medio
      col = clamp((col - 0.5) * contraste + 0.5, 0.0, 1.0);
      // split-toning: sombras frías (verde-azulado), luces cálidas
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      vec3 sombra = vec3(-0.012, 0.012, 0.03) * calido;
      vec3 luz = vec3(0.04, 0.016, -0.03) * calido;
      col += sombra * (1.0 - smoothstep(0.0, 0.5, l)) + luz * smoothstep(0.45, 1.0, l);
      // saturación
      col = mix(vec3(l), col, saturacion);
      col = mix(col, vec3(l) * vec3(1.07, 0.98, 0.82), sepia);
      // viñeta
      col *= 1.0 - vineta * smoothstep(0.08, 0.55, r2);
      // grano de película
      float g = (h(vUv * resolucion) - 0.5) * grano;
      col += g * (1.0 - l * 0.6);
      col = mix(col, vec3(1.0, 0.95, 0.86), flash);
      col *= 1.0 - negro;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export class Post {
  constructor(renderer, ancho, alto, muestras = 4) {
    this.renderer = renderer;
    const opt = { type: THREE.HalfFloatType };
    this.rtEscena = new THREE.WebGLRenderTarget(ancho, alto, { ...opt, samples: muestras });
    this.rtEscena.depthTexture = new THREE.DepthTexture(ancho, alto);
    this.rtEscena.depthTexture.type = THREE.UnsignedIntType;
    this.rtA = new THREE.WebGLRenderTarget(ancho, alto, opt);
    this.rtB = new THREE.WebGLRenderTarget(ancho, alto, opt);
    const mat = (def) => new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.clone(def.uniforms), vertexShader: def.vertexShader,
      fragmentShader: def.fragmentShader, depthTest: false, depthWrite: false });
    this.mDof = mat(DOF); this.mRayos = mat(RAYOS); this.mEtalon = mat(ETALON);
    this.quad = new FullScreenQuad(this.mDof);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(ancho / 2, alto / 2), 0.35, 0.6, 0.86);
    this.bloom.setSize(ancho, alto);
    this.salida = new OutputPass();
    this.mDof.uniforms.resolucion.value.set(ancho, alto);
    this.mEtalon.uniforms.resolucion.value.set(ancho, alto);
    this.mRayos.uniforms.aspecto.value = ancho / alto;
  }
  _pase(mat, destino) { this.quad.material = mat; this.renderer.setRenderTarget(destino); this.quad.render(this.renderer); }
  render(escena, camara, o = {}) {
    const { foco = 10, apertura = 0, maxDesenfoque = 14, rayos = 0, bloom = 0.35, tiempo = 0, vineta = 0.32, grano = 0.035,
      flash = 0, negro = 0, calido = 1, saturacion = 1.05, contraste = 1.06, sepia = 0 } = o;
    const r = this.renderer;
    r.setRenderTarget(this.rtEscena); r.clear(); r.render(escena, camara);
    let lectura = this.rtEscena, libre = [this.rtA, this.rtB];
    const sig = () => { const d = libre.find((x) => x !== lectura); return d; };
    if (apertura > 0) {
      const u = this.mDof.uniforms;
      u.tDiffuse.value = lectura.texture; u.tDepth.value = this.rtEscena.depthTexture;
      u.cerca.value = camara.near; u.lejos.value = camara.far; u.foco.value = foco; u.apertura.value = apertura; u.maxDesenfoque.value = maxDesenfoque;
      const d = sig(); this._pase(this.mDof, d); lectura = d;
    }
    if (rayos > 0 && o.solMundo) {
      const p = o.solMundo.clone().project(camara);
      const fuera = Math.max(Math.abs(p.x), Math.abs(p.y));
      const inten = p.z < 1 ? rayos * Math.max(0, 1 - Math.max(0, fuera - 1) * 0.8) : 0;
      if (inten > 0) {
        const u = this.mRayos.uniforms;
        u.tDiffuse.value = lectura.texture; u.tDepth.value = this.rtEscena.depthTexture;
        u.sol.value.set(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5); u.intensidad.value = inten;
        const d = sig(); this._pase(this.mRayos, d); lectura = d;
      }
    }
    if (lectura === this.rtEscena) {
      // copiar a un buffer sin MSAA para bloom
      const u = this.mDof.uniforms; u.tDiffuse.value = lectura.texture; u.apertura.value = 0;
      const d = this.rtA; this._pase(this.mDof, d); lectura = d;
    }
    if (bloom > 0) { this.bloom.strength = bloom; this.bloom.render(r, null, lectura, 0, false); }
    const dSalida = lectura === this.rtA ? this.rtB : this.rtA;
    this.salida.render(r, dSalida, lectura);
    const ue = this.mEtalon.uniforms;
    ue.tDiffuse.value = dSalida.texture; ue.tiempo.value = tiempo; ue.vineta.value = vineta; ue.grano.value = grano; ue.flash.value = flash;
    ue.negro.value = negro; ue.calido.value = calido; ue.saturacion.value = saturacion; ue.contraste.value = contraste; ue.sepia.value = sepia;
    this._pase(this.mEtalon, null);
  }
}
