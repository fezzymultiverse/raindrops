// Raindrops V1.2.1 - audio worklets for the Mixer (runs on the audio thread)
// rd-dyn  : noise gate + de-esser (high band only, so no pumping)
// rd-tune : autotune (YIN pitch detect -> snap to key/scale -> delay-line pitch shifter)
//           V1.9.1: more scales + custom note mask, Hold (note lock with hysteresis + 3-frame median, the hard-tune / T-Pain stepping)

class RdDyn extends AudioWorkletProcessor {
  constructor(o) {
    super();
    this.p = Object.assign({ gate: -80, ds: 0 }, (o && o.processorOptions) || {});
    this.port.onmessage = e => Object.assign(this.p, e.data);
    this.n = [];
    this.a = 1 - Math.exp(-2 * Math.PI * 5000 / sampleRate);
    this.er = Math.exp(-1 / (0.05 * sampleRate));
    this.sr = Math.exp(-1 / (0.01 * sampleRate));
    this.gA = Math.exp(-1 / (0.002 * sampleRate));
    this.gR = Math.exp(-1 / (0.08 * sampleRate));
    this.dA = Math.exp(-1 / (0.001 * sampleRate));
    this.dR = Math.exp(-1 / (0.03 * sampleRate));
    this.holdN = Math.round(0.08 * sampleRate);
  }
  st(i) {
    return this.n[i] || (this.n[i] = { lp: 0, env: 0, gg: 1, hold: 0, sib: 0, dg: 1 });
  }
  process(inputs, outputs) {
    const I = inputs[0], O = outputs[0];
    if (!I || !I.length) return true;
    const thr = Math.pow(10, this.p.gate / 20), open = this.p.gate > -79;
    const ds = Math.max(0, Math.min(1, this.p.ds / 100)), T = 0.5 * Math.pow(0.04, ds);
    for (let ch = 0; ch < I.length; ch++) {
      const x = I[ch], y = O[ch], s = this.st(ch);
      for (let i = 0; i < x.length; i++) {
        const v = x[i], av = v < 0 ? -v : v;
        s.env = av > s.env ? av : s.env * this.er;
        if (open) {
          if (s.env > thr) s.hold = this.holdN;
          const tg = s.hold > 0 ? 1 : 0;
          if (s.hold > 0) s.hold--;
          const k = tg > s.gg ? this.gA : this.gR;
          s.gg = tg + (s.gg - tg) * k;
        } else s.gg = 1;
        s.lp += this.a * (v - s.lp);
        const hp = v - s.lp, ah = hp < 0 ? -hp : hp;
        s.sib = ah > s.sib ? ah : s.sib * this.sr;
        let g = 1;
        if (ds > 0 && s.sib > T) g = Math.pow(T / s.sib, 0.8);
        const kd = g < s.dg ? this.dA : this.dR;
        s.dg = g + (s.dg - g) * kd;
        y[i] = (s.lp + hp * s.dg) * s.gg;
      }
    }
    return true;
  }
}
registerProcessor('rd-dyn', RdDyn);

const SCALES = {
  chrom: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pmin: [0, 3, 5, 7, 10],
  pmaj: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
  hmin: [0, 2, 3, 5, 7, 8, 11],
  dor: [0, 2, 3, 5, 7, 9, 10],
  phryg: [0, 1, 3, 5, 7, 8, 10]
};

class RdTune extends AudioWorkletProcessor {
  constructor(o) {
    super();
    this.p = Object.assign({ on: 0, amt: 100, spd: 20, key: 0, scale: 'chrom', hold: 0, mask: 4095 }, (o && o.processorOptions) || {});
    this.port.onmessage = e => Object.assign(this.p, e.data);
    this.Wn = Math.round(sampleRate * 0.025);
    this.M = 8191;
    this.buf = [new Float32Array(this.M + 1), new Float32Array(this.M + 1)];
    this.w = 0; this.ph = 0; this.r = 1; this.rt = 1;
    this.fsD = sampleRate / 4;
    this.lagMin = Math.max(2, Math.floor(this.fsD / 700));
    this.lagMax = Math.ceil(this.fsD / 70);
    this.WIN = 256;
    this.D = new Float32Array(1024); this.dw = 0; this.acc = 0; this.ac = 0; this.cnt = 0;
    this.y = new Float32Array(this.WIN + this.lagMax + 2);
    this.c = new Float32Array(this.lagMax + 3);
    this.tn = null; this.mh = [];
  }
  uv() { this.rt = 1; this.tn = null; this.mh.length = 0; }
  inSc(n) {
    const sc = this.p.scale;
    if (sc === 'custom') { const mk = (this.p.mask | 0) & 4095; return !mk || ((mk >> (((n % 12) + 12) % 12)) & 1) === 1; }
    return (SCALES[sc] || SCALES.chrom).indexOf((((n - (this.p.key | 0)) % 12) + 12) % 12) >= 0;
  }
  analyze() {
    const WIN = this.WIN, lagMax = this.lagMax, L = WIN + lagMax, y = this.y, c = this.c, D = this.D;
    let e = 0;
    for (let j = 0; j < L; j++) y[j] = D[(this.dw - L + j) & 1023];
    for (let j = lagMax; j < L; j++) e += y[j] * y[j];
    if (Math.sqrt(e / WIN) < 0.008) { this.uv(); return; }
    let sum = 0;
    c[0] = 1;
    for (let t = 1; t <= lagMax; t++) {
      let d = 0;
      for (let j = 0; j < WIN; j++) { const q = y[lagMax + j] - y[lagMax + j - t]; d += q * q; }
      sum += d;
      c[t] = sum > 0 ? t * d / sum : 1;
    }
    let tau = -1;
    for (let t = this.lagMin; t < lagMax; t++) {
      if (c[t] < 0.15) { while (t + 1 < lagMax && c[t + 1] < c[t]) t++; tau = t; break; }
    }
    if (tau < 0) {
      let m = 9, mt = -1;
      for (let t = this.lagMin; t < lagMax; t++) if (c[t] < m) { m = c[t]; mt = t; }
      if (m > 0.35) { this.uv(); return; }
      tau = mt;
    }
    let tp = tau;
    if (tau > 1 && tau < lagMax) {
      const a = c[tau - 1], b = c[tau], d2 = c[tau + 1], den = 2 * (a - 2 * b + d2);
      if (Math.abs(den) > 1e-9) tp = tau + (a - d2) / den;
    }
    const f0 = this.fsD / tp;
    if (!(f0 > 60 && f0 < 800)) { this.uv(); return; }
    let midi = 69 + 12 * Math.log2(f0 / 440);
    const hold = Math.max(0, Math.min(100, this.p.hold | 0));
    if (hold > 0) {
      const h = this.mh; h.push(midi); if (h.length > 3) h.shift();
      if (h.length === 3) midi = h.slice().sort((a, b) => a - b)[1];
    } else this.mh.length = 0;
    let best = Math.round(midi), bd = 99;
    const r0 = Math.round(midi);
    for (let n = r0 - 7; n <= r0 + 7; n++) {
      if (!this.inSc(n)) continue;
      const dd = Math.abs(n - midi);
      if (dd < bd) { bd = dd; best = n; }
    }
    if (hold > 0 && this.tn !== null && this.tn !== best && this.inSc(this.tn) && Math.abs(midi - this.tn) < 1.2 && Math.abs(midi - this.tn) <= Math.abs(midi - best) + 0.45 * hold / 100) best = this.tn;
    this.tn = hold > 0 ? best : null;
    const err = (best - midi) * (this.p.amt / 100);
    this.rt = Math.max(0.7, Math.min(1.42, Math.pow(2, err / 12)));
  }
  process(inputs, outputs) {
    const I = inputs[0], O = outputs[0];
    if (!I || !I.length) return true;
    const on = this.p.on ? 1 : 0, Wn = this.Wn, M = this.M, nch = Math.min(I.length, 2);
    const kr = 0.02 * Math.pow(0.0025, Math.max(0, Math.min(100, this.p.spd)) / 100);
    const len = I[0].length;
    for (let i = 0; i < len; i++) {
      const w = this.w;
      for (let ch = 0; ch < nch; ch++) this.buf[ch][w] = I[ch][i];
      this.acc += I[0][i];
      if (++this.ac === 4) {
        this.D[this.dw] = this.acc / 4; this.dw = (this.dw + 1) & 1023; this.acc = 0; this.ac = 0;
        if (++this.cnt === 64) { this.cnt = 0; if (on) this.analyze(); else this.rt = 1; }
      }
      this.r += (this.rt - this.r) * kr;
      if (on) {
        this.ph += (1 - this.r) / Wn;
        this.ph -= Math.floor(this.ph);
        const p2 = (this.ph + 0.5) % 1;
        const d1 = 2 + this.ph * Wn, d2 = 2 + p2 * Wn;
        const s1 = Math.sin(Math.PI * this.ph), g1 = s1 * s1, g2 = 1 - g1;
        for (let ch = 0; ch < nch; ch++) {
          const b = this.buf[ch];
          let pos = w - d1, i0 = Math.floor(pos), f = pos - i0;
          const a1 = b[i0 & M] * (1 - f) + b[(i0 + 1) & M] * f;
          pos = w - d2; i0 = Math.floor(pos); f = pos - i0;
          const a2 = b[i0 & M] * (1 - f) + b[(i0 + 1) & M] * f;
          O[ch][i] = a1 * g1 + a2 * g2;
        }
      } else {
        for (let ch = 0; ch < nch; ch++) O[ch][i] = I[ch][i];
      }
      this.w = (w + 1) & M;
    }
    return true;
  }
}
registerProcessor('rd-tune', RdTune);
