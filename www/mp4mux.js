// Raindrops V1.3.0 - tiny MP4 muxer (H.264 + AAC). Pure JS, no libs. Used by the fast video export (WebCodecs).
// RdMP4.mux({video:{chunks:[{d,k}],w,h,fps,desc},audio:{chunks:[{d}],sr,ch,asc}}) -> Blob (video/mp4, moov first)
(() => {
const u32 = n => [n >>> 24 & 255, n >>> 16 & 255, n >>> 8 & 255, n & 255];
const u16 = n => [n >> 8 & 255, n & 255];
const str = s => [...s].map(c => c.charCodeAt(0));
const U8 = x => x instanceof Uint8Array ? x : Uint8Array.from(x);
const cat = (...a) => { a = a.map(U8); let n = 0; for (const x of a) n += x.length; const o = new Uint8Array(n); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };
const box = (t, ...c) => { const b = cat(...c); return cat(u32(b.length + 8), str(t), b); };
const full = (t, v, f, ...c) => box(t, [v, f >> 16 & 255, f >> 8 & 255, f & 255], ...c);
const zeros = n => new Uint8Array(n);
const MATRIX = [].concat(u32(0x10000), u32(0), u32(0), u32(0), u32(0x10000), u32(0), u32(0), u32(0), u32(0x40000000));

const mvhd = (ts, dur) => full('mvhd', 0, 0, u32(0), u32(0), u32(ts), u32(dur), u32(0x10000), u16(0x100), zeros(10), MATRIX, zeros(24), u32(3));
const tkhd = (id, dur, vol, w, h) => full('tkhd', 0, 3, u32(0), u32(0), u32(id), u32(0), u32(dur), zeros(8), u16(0), u16(0), u16(vol), u16(0), MATRIX, u32(w << 16), u32(h << 16));
const mdhd = (ts, dur) => full('mdhd', 0, 0, u32(0), u32(0), u32(ts), u32(dur), u16(0x55C4), u16(0));
const hdlr = (type, name) => full('hdlr', 0, 0, u32(0), str(type), zeros(12), str(name), [0]);
const dinf = () => box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1)));
const stts = (count, delta) => full('stts', 0, 0, u32(1), u32(count), u32(delta));
const stsc = n => full('stsc', 0, 0, u32(1), u32(1), u32(n), u32(1));
const stsz = sizes => { const a = new Uint8Array(12 + sizes.length * 4), v = new DataView(a.buffer); v.setUint32(4, 0); v.setUint32(8, sizes.length); sizes.forEach((s, i) => v.setUint32(12 + i * 4, s)); return box('stsz', a.slice(0)); };
const stco = off => full('stco', 0, 0, u32(1), u32(off));
const stss = idx => { const a = new Uint8Array(8 + idx.length * 4), v = new DataView(a.buffer); v.setUint32(4, idx.length); idx.forEach((s, i) => v.setUint32(8 + i * 4, s)); return box('stss', a); };
const len = n => (n < 128 ? [n] : [0x80 | n >> 7, n & 127]);
const esds = asc => {
  const dsi = cat([5], len(asc.length), asc);
  const dcd = cat([4], len(13 + dsi.length), [0x40, 0x15, 0, 0, 0], u32(0), u32(0), dsi);
  const sl = [6, 1, 2];
  const es = cat([3], len(3 + dcd.length + sl.length), u16(1), [0], dcd, sl);
  return full('esds', 0, 0, es);
};

function moov(V, A, vOff, aOff) {
  const VTS = 90000, vdelta = Math.round(VTS / V.fps), vn = V.chunks.length, vdur = vn * vdelta;
  const an = A ? A.chunks.length : 0, adur = A ? an * 1024 : 0;
  const mdur = Math.max(Math.round(vdur / VTS * 1000), A ? Math.round(adur / A.sr * 1000) : 0);
  const sync = []; V.chunks.forEach((c, i) => { if (c.k) sync.push(i + 1); });
  const avc1 = box('avc1', zeros(6), u16(1), zeros(16), u16(V.w), u16(V.h), u32(0x480000), u32(0x480000), u32(0), u16(1), zeros(32), u16(0x18), u16(0xFFFF), box('avcC', V.desc));
  const vtrak = box('trak', tkhd(1, Math.round(vdur / VTS * 1000), 0, V.w, V.h),
    box('mdia', mdhd(VTS, vdur), hdlr('vide', 'VideoHandler'),
      box('minf', full('vmhd', 0, 1, zeros(8)), dinf(),
        box('stbl', full('stsd', 0, 0, u32(1), avc1), stts(vn, vdelta), stss(sync), stsc(vn), stsz(V.chunks.map(c => c.d.length)), stco(vOff)))));
  let atrak = new Uint8Array(0);
  if (A) {
    const mp4a = box('mp4a', zeros(6), u16(1), zeros(8), u16(A.ch), u16(16), u16(0), u16(0), u32(A.sr * 65536), esds(A.asc));
    atrak = box('trak', tkhd(2, Math.round(adur / A.sr * 1000), 0x100, 0, 0),
      box('mdia', mdhd(A.sr, adur), hdlr('soun', 'SoundHandler'),
        box('minf', full('smhd', 0, 0, zeros(4)), dinf(),
          box('stbl', full('stsd', 0, 0, u32(1), mp4a), stts(an, 1024), stsc(an), stsz(A.chunks.map(c => c.d.length)), stco(aOff)))));
  }
  return box('moov', mvhd(1000, mdur), vtrak, atrak);
}

// AAC from some encoders comes as ADTS: strip headers and build the AudioSpecificConfig
function fixAac(A) {
  const c0 = A.chunks[0] && A.chunks[0].d;
  if (!c0 || !(c0[0] === 0xFF && (c0[1] & 0xF0) === 0xF0)) return;
  const sfi = (c0[2] >> 2) & 15, ch = ((c0[2] & 1) << 2) | (c0[3] >> 6), obj = (c0[2] >> 6) + 1;
  if (!A.asc || !A.asc.length) A.asc = Uint8Array.from([(obj << 3 | sfi >> 1) & 255, ((sfi & 1) << 7 | ch << 3) & 255]);
  A.chunks = A.chunks.map(c => ({ d: c.d.subarray((c.d[1] & 1) ? 7 : 9) }));
}

function mux(o) {
  const V = o.video, A = o.audio && o.audio.chunks.length ? o.audio : null;
  if (!V || !V.chunks.length || !V.desc) throw new Error('no video data');
  if (A) { fixAac(A); if (!A.asc || !A.asc.length) throw new Error('no AAC config'); }
  const ftyp = box('ftyp', str('isom'), u32(512), str('isom'), str('iso2'), str('avc1'), str('mp41'));
  const vBytes = V.chunks.reduce((n, c) => n + c.d.length, 0), aBytes = A ? A.chunks.reduce((n, c) => n + c.d.length, 0) : 0;
  const m0 = moov(V, A, 0, 0), start = ftyp.length + m0.length + 8;
  const m = moov(V, A, start, start + vBytes);
  const parts = [ftyp, m, cat(u32(8 + vBytes + aBytes), str('mdat'))];
  V.chunks.forEach(c => parts.push(c.d)); if (A) A.chunks.forEach(c => parts.push(c.d));
  return new Blob(parts, { type: 'video/mp4' });
}
if (typeof window !== "undefined") window.RdMP4 = { mux };
if (typeof module !== 'undefined') module.exports = { mux };
})();
