/*
 * KYOTO(KENS) – Pacing the Frontier · procedural soundtrack
 * ----------------------------------------------------------------------------
 * Everything here is synthesized live with the Web Audio API: no samples, no
 * external files, no libraries. Load as a classic <script> or as a
 * side-effect ES module (`import './music.js'`); the API lands on
 * window.KyotoMusic (and module.exports under Node / CommonJS).
 *
 *   KyotoMusic.init(audioContext, destinationNode)
 *   KyotoMusic.play(trackIdOrIndex, { fade: seconds, loop: bool })
 *   KyotoMusic.next() / stop({ fade }) / setIntensity(0..1) / setVolume(0..1)
 *   KyotoMusic.stinger('letter' | 'caught' | 'win' | 'start')
 *   KyotoMusic.tracks / current / onTrack = fn(info)
 *
 * All melodies are original compositions, except the two folk medleys, which
 * arrange public-domain songs: "O du lieber Augustin" (Vienna, c. 1800),
 * "Kommt ein Vogel geflogen" (Austrian/German folk song, printed 1807),
 * "Ode an die Freude" (Beethoven, 9th Symphony, 1824), "Bruder Jakob"
 * (traditional round) and "Alle meine Entchen" (traditional German
 * children's song). The NDW/industrial/flower tracks are original tunes in
 * the spirit of famous German pop — never quotations of copyrighted songs.
 *
 * ── Pattern DSL (one step = one 16th note) ─────────────────────────────────
 *  Drum grid : 'X..x..o.'   X accent · x hit · O medium · o ghost · . rest
 *                           ('|' and spaces are ignored)
 *  Melodic   : 'C5:2 . E5!:2 G4+B4+D5:4 A3~m7:8 _:2'
 *                note[+note…] or root~quality (chord), ':n' = n steps (default 1)
 *                '.' rest · '_' tie (extends previous note) · 'x' default pitch
 *                flags  ! accent · ? soft · , muted/staccato · ^ scoop up · v fall
 *  Refs      : 'name', 'name@+5' (transpose), 'name/2' (twice as fast),
 *              'name*2' (half speed), '_' = one bar rest, or an inline pattern.
 *  Sections  : { bars, bpm?, beats?, tr?, swing?, <channel>: ref | [refs…] }
 *              A list of refs is played in order and cycled to fill the section.
 * ----------------------------------------------------------------------------
 */
const KyotoMusic = (function (global) {
  'use strict';

  // ════════════════════════════ theory helpers ════════════════════════════
  const PITCH = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const CHORD = {
    '': [0, 4, 7], maj: [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10],
    maj7: [0, 4, 7, 11], sus2: [0, 2, 7], sus4: [0, 5, 7], '7sus4': [0, 5, 7, 10],
    dim: [0, 3, 6], dim7: [0, 3, 6, 9], aug: [0, 4, 8], 5: [0, 7, 12], 6: [0, 4, 7, 9],
    m6: [0, 3, 7, 9], add9: [0, 4, 7, 14],
  };
  const NOTE_RE = /^([A-G])(#|b)?(-?\d)$/;
  function midiOf(name, where) {
    const m = NOTE_RE.exec(name);
    if (!m) throw new Error(`KyotoMusic: bad note "${name}" in ${where}`);
    return 12 * (Number(m[3]) + 1) + PITCH[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  }
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const clampF = (f) => Math.min(18000, Math.max(20, f));
  const TAU = (x) => Math.max(0.001, x);

  // deterministic PRNG (mulberry32): humanize + noise are reproducible
  function rng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

  // ════════════════════════════ pattern DSL ═══════════════════════════════
  const DRUM_RE = /^[xXoO.\-|\s]+$/;
  const DRUM_VEL = { X: 1, x: 0.8, O: 0.62, o: 0.45 };
  const REF_RE = /^([A-Za-z][\w]*)(?:@([+-]?\d+))?(?:([/*])(\d+))?$/;

  function parseNotes(body, where) {
    const t = body.indexOf('~');
    if (t >= 0) {
      const q = CHORD[body.slice(t + 1)];
      if (!q) throw new Error(`KyotoMusic: unknown chord quality "${body}" in ${where}`);
      const root = midiOf(body.slice(0, t), where);
      return q.map((i) => root + i);
    }
    return body.split('+').map((n) => midiOf(n, where));
  }

  function parsePattern(src, where) {
    const s = String(src).trim();
    const ev = [];
    if (DRUM_RE.test(s)) {
      let pos = 0;
      for (const ch of s) {
        if (ch === '|' || /\s/.test(ch)) continue;
        if (DRUM_VEL[ch]) ev.push({ pos, dur: 1, notes: null, vel: DRUM_VEL[ch], fl: {} });
        pos++;
      }
      return { len: pos, ev };
    }
    let pos = 0;
    let last = null;
    for (const tok of s.split(/\s+/)) {
      if (!tok || tok === '|') continue;
      const ci = tok.lastIndexOf(':');
      let body = ci >= 0 ? tok.slice(0, ci) : tok;
      const dur = ci >= 0 ? Number(tok.slice(ci + 1)) : 1;
      if (!(dur > 0)) throw new Error(`KyotoMusic: bad duration "${tok}" in ${where}`);
      const fl = {};
      let vel = 0.8;
      while (body.length > 1 && /[!?,^v]$/.test(body)) {
        const f = body[body.length - 1];
        body = body.slice(0, -1);
        if (f === '!') vel = 1; else if (f === '?') vel = 0.5; else if (f === ',') fl.mute = true;
        else if (f === '^') fl.up = true; else fl.fall = true;
      }
      if (body === '.') last = null;
      else if (body === '_') { if (last) last.dur += dur; }
      else if (body === 'x' || body === 'X' || body === 'o') {
        last = { pos, dur, notes: null, vel: body === 'X' ? 1 : body === 'o' ? 0.45 : vel, fl };
        ev.push(last);
      } else {
        last = { pos, dur, notes: parseNotes(body, where), vel, fl };
        ev.push(last);
      }
      pos += dur;
    }
    return { len: pos, ev };
  }

  function resolveRef(def, ref, spb, where, cache) {
    if (ref === '_') return { len: spb, ev: [] };
    const s = String(ref).trim();
    if (DRUM_RE.test(s)) return parsePattern(s, where);
    const m = REF_RE.exec(s);
    if (m && def.pat[m[1]] == null && !NOTE_RE.test(s)) throw new Error(`KyotoMusic: unknown pattern "${m[1]}" in ${where}`);
    if (m && def.pat[m[1]] != null) {
      if (!cache[m[1]]) cache[m[1]] = parsePattern(def.pat[m[1]], `${def.id}.pat.${m[1]}`);
      const base = cache[m[1]];
      const tr = m[2] ? Number(m[2]) : 0;
      const k = m[3] === '/' ? 1 / Number(m[4]) : m[3] === '*' ? Number(m[4]) : 1;
      if (!tr && k === 1) return base;
      return {
        len: base.len * k,
        ev: base.ev.map((e) => ({ pos: e.pos * k, dur: e.dur * k, notes: e.notes && e.notes.map((n) => n + tr), vel: e.vel, fl: e.fl })),
      };
    }
    return parsePattern(s, where);
  }

  const RESERVED = new Set(['bars', 'bpm', 'beats', 'tr', 'swing']);
  function compileSection(def, name, sd, cache) {
    const beats = sd.beats || def.beats || 4;
    const bpm = sd.bpm || def.bpm;
    const spb = beats * 4;
    const L = sd.bars * spb;
    const tr = sd.tr || 0;
    const steps = Array.from({ length: L }, () => []);
    for (const ch of Object.keys(sd)) {
      if (RESERVED.has(ch)) continue;
      const chDef = def.ch[ch];
      if (!chDef) throw new Error(`KyotoMusic: unknown channel "${ch}" in ${def.id}.${name}`);
      const inst = INST[chDef.i];
      if (!inst) throw new Error(`KyotoMusic: unknown instrument "${chDef.i}" in ${def.id}.ch.${ch}`);
      const where = `${def.id}.${name}.${ch}`;
      const list = (Array.isArray(sd[ch]) ? sd[ch] : [sd[ch]]).map((r) => resolveRef(def, r, spb, where, cache));
      const cycle = list.reduce((a, p) => a + p.len, 0);
      if (list.some((p) => !(p.len > 0)) || Math.abs(cycle / spb - Math.round(cycle / spb)) > 1e-9) {
        throw new Error(`KyotoMusic: ${where}: pattern cycle is ${cycle} steps, not a whole number of ${spb}-step bars`);
      }
      let pos = 0;
      for (let k = 0; pos < L; k++) {
        const p = list[k % list.length];
        for (const e of p.ev) {
          const at = pos + e.pos;
          if (at >= L - 1e-9) break;
          const i = Math.floor(at + 1e-9);
          const notes = e.notes ? (inst.perc ? e.notes : e.notes.map((n) => n + tr)) : null;
          steps[i].push({ ch, off: at - i, dur: e.dur, notes, vel: e.vel, fl: e.fl });
        }
        pos += p.len;
      }
    }
    for (const st of steps) st.sort((a, b) => a.off - b.off);
    return { name, bars: sd.bars, beats, bpm, spb, L, steps, swing: sd.swing != null ? sd.swing : def.swing || 0, seconds: (sd.bars * beats * 60) / bpm };
  }

  function compileSong(def) {
    for (const k of Object.keys(def.pat)) {
      if (DRUM_RE.test(k) || !REF_RE.test(k)) throw new Error(`KyotoMusic: pattern name "${k}" in ${def.id} is ambiguous or invalid`);
    }
    const cache = {};
    const secs = {};
    for (const name of Object.keys(def.sec)) secs[name] = compileSection(def, name, def.sec[name], cache);
    const order = def.arr.map((n) => {
      if (!secs[n]) throw new Error(`KyotoMusic: arrangement of ${def.id} references unknown section "${n}"`);
      return secs[n];
    });
    const seconds = order.reduce((a, s) => a + s.seconds, 0);
    return { id: def.id, def, order, seconds };
  }

  // ════════════════════════════ synthesis helpers ═════════════════════════
  function biq(c, type, f, q, g) {
    const b = c.createBiquadFilter();
    b.type = type;
    b.frequency.value = clampF(f);
    if (q != null) b.Q.value = q;
    if (g != null) b.gain.value = g;
    return b;
  }
  function gainNode(c, v) { const g = c.createGain(); g.gain.value = v; return g; }
  function panner(c, pan) {
    if (typeof c.createStereoPanner === 'function') { const p = c.createStereoPanner(); p.pan.value = pan; return p; }
    return c.createGain();
  }
  function osc(c, type, t) {
    const o = c.createOscillator();
    if (typeof type === 'string') o.type = type; else o.setPeriodicWave(type);
    o.start(t);
    return o;
  }
  // percussive envelope: 0 → peak (attack a) → exponential decay; returns end time
  function perc(p, t, peak, dec, a) {
    a = a || 0.001;
    peak = Math.max(peak, 0.002);
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(peak, t + a);
    p.exponentialRampToValueAtTime(0.0005, t + a + dec);
    return t + a + dec + 0.01;
  }
  // ADSR on a gain param; returns the time the voice may be stopped
  function adsr(p, t, dur, a, d, s, r, peak) {
    peak = Math.max(peak, 0.002);
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(peak, t + a);
    if (s < 1) p.setTargetAtTime(peak * s, t + a, TAU(d / 3));
    const tr = t + Math.max(dur, a + 0.002);
    p.setTargetAtTime(0, tr, TAU(r / 4));
    return tr + r * 1.5 + 0.03;
  }
  // pitch articulation shared by melodic voices (glide, scoop, fall)
  function pitch(p, v, f, scoopCents) {
    const t = v.t;
    if (v.glideFrom) { p.setValueAtTime(v.glideFrom, t); p.exponentialRampToValueAtTime(f, t + 0.06); }
    else if (v.fl.up) { p.setValueAtTime(f * 0.84, t); p.exponentialRampToValueAtTime(f, t + 0.07); }
    else if (scoopCents) { p.setValueAtTime(f * Math.pow(2, -scoopCents / 1200), t); p.exponentialRampToValueAtTime(f, t + 0.045); }
    else p.setValueAtTime(f, t);
    if (v.fl.fall) {
      const ts = t + Math.max(0.08, v.dur * 0.35);
      p.setValueAtTime(f, ts);
      p.exponentialRampToValueAtTime(f * 0.7, t + Math.max(v.dur, 0.12) + 0.15);
    }
  }
  function vibrato(v, param, f, depth, rate, delay, end) {
    if (v.dur < delay + 0.12) return;
    const c = v.c;
    const lfo = osc(c, 'sine', v.t);
    lfo.frequency.value = rate;
    const lg = c.createGain();
    lg.gain.setValueAtTime(0, v.t);
    lg.gain.setValueAtTime(0, v.t + delay);
    lg.gain.linearRampToValueAtTime(f * depth, v.t + delay + 0.25);
    lfo.connect(lg).connect(param);
    lfo.stop(end);
  }
  function noiseSrc(v, loop) {
    const s = v.c.createBufferSource();
    s.buffer = v.E.noise;
    s.loop = !!loop;
    s.start(v.t, v.rnd() * 1.4);
    return s;
  }
  function fin(src, node) { src.onended = () => { try { node.disconnect(); } catch (e) { /* already gone */ } }; }
  const hz = (v) => mtof(v.m) * Math.pow(2, (v.det || 0) / 1200);

  // ════════════════════════════ instruments ═══════════════════════════════
  // Each instrument gets a voice object v = { c, t, dur, m, notes, vel, o, fl,
  // out, st, E, I, det, rnd, n } and builds its own short-lived node graph.
  const INST = {
    kick(v) {
      const { c, t, vel, o, out } = v;
      const s = osc(c, o.wave || 'sine', t);
      s.frequency.setValueAtTime(o.f0 || 150, t);
      s.frequency.exponentialRampToValueAtTime(o.f1 || 46, t + (o.pd || 0.075));
      const g = c.createGain();
      const end = perc(g.gain, t, vel, o.dec || 0.42, 0.0015);
      s.connect(g).connect(out); s.stop(end); fin(s, g);
      const ck = o.click == null ? 0.35 : o.click;
      if (ck > 0) {
        const n = noiseSrc(v), hp = biq(c, 'highpass', o.clickF || 2800, 0.7), ng = c.createGain();
        const e2 = perc(ng.gain, t, vel * ck, 0.012);
        n.connect(hp).connect(ng).connect(out); n.stop(e2); fin(n, ng);
      }
    },
    snare(v) {
      const { c, t, vel, o, out } = v;
      if (o.tone !== 0) {
        const f = o.tone || 185;
        const s = osc(c, 'triangle', t);
        s.frequency.setValueAtTime(f * 1.35, t);
        s.frequency.exponentialRampToValueAtTime(f, t + 0.03);
        const g = c.createGain();
        const e = perc(g.gain, t, vel * 0.42, 0.09);
        s.connect(g).connect(out); s.stop(e); fin(s, g);
      }
      const n = noiseSrc(v), hp = biq(c, 'highpass', o.hp || 1400, 0.7), lp = biq(c, 'lowpass', o.lp || 9000, 0.5), g = c.createGain();
      let end;
      if (o.gate) { // 80s gated snare: fat body that holds, then slams shut
        const p = g.gain;
        p.setValueAtTime(0, t); p.linearRampToValueAtTime(vel, t + 0.002);
        p.setTargetAtTime(vel * 0.55, t + 0.002, 0.035);
        p.setTargetAtTime(0, t + o.gate, 0.01);
        end = t + o.gate + 0.08;
      } else end = perc(g.gain, t, vel, o.dec || 0.17);
      n.connect(hp).connect(lp).connect(g).connect(out); n.stop(end); fin(n, g);
    },
    clap(v) {
      const { c, t, vel, o, out } = v;
      const n = noiseSrc(v), bp = biq(c, 'bandpass', o.f || 1150, 1.4), hp = biq(c, 'highpass', 450, 0.7), g = c.createGain(), p = g.gain;
      p.setValueAtTime(0, t);
      for (let i = 0; i < 3; i++) {
        const ti = t + i * 0.0105;
        p.setValueAtTime(vel * (1 - i * 0.1), ti);
        p.exponentialRampToValueAtTime(vel * 0.06, ti + 0.009);
      }
      p.setValueAtTime(vel * 0.8, t + 0.032);
      p.exponentialRampToValueAtTime(0.0005, t + 0.032 + (o.dec || 0.16));
      n.connect(bp).connect(hp).connect(g).connect(out);
      n.stop(t + 0.05 + (o.dec || 0.16)); fin(n, g);
    },
    hat(v) {
      const { c, t, vel, o, out } = v;
      const n = noiseSrc(v), hp = biq(c, 'highpass', o.open ? 6500 : 7800, 0.8), pk = biq(c, 'peaking', 10500, 1, 5), g = c.createGain();
      const end = perc(g.gain, t, vel * (o.open ? 0.55 : 0.7), o.dec || (o.open ? 0.3 : 0.045));
      n.connect(hp).connect(pk).connect(g).connect(out); n.stop(end); fin(n, g);
    },
    shaker(v) {
      const { c, t, vel, out } = v;
      const n = noiseSrc(v), bp = biq(c, 'bandpass', 6200, 1.6), g = c.createGain();
      const end = perc(g.gain, t, vel * 0.8, 0.06, 0.014);
      n.connect(bp).connect(g).connect(out); n.stop(end); fin(n, g);
    },
    tom(v) {
      const { c, t, vel, o, out } = v;
      const f = v.m != null ? hz(v) : o.f || 110;
      const dec = o.dec || 0.38;
      const s = osc(c, 'sine', t);
      if (o.syn) { s.frequency.setValueAtTime(f * 1.8, t); s.frequency.exponentialRampToValueAtTime(f * 0.5, t + dec); }
      else { s.frequency.setValueAtTime(f * 1.5, t); s.frequency.exponentialRampToValueAtTime(f, t + 0.06); }
      const g = c.createGain();
      const end = perc(g.gain, t, vel, dec);
      s.connect(g).connect(out); s.stop(end); fin(s, g);
      const n = noiseSrc(v), lp = biq(c, 'lowpass', 1200, 0.7), ng = c.createGain();
      const e2 = perc(ng.gain, t, vel * 0.25, 0.04);
      n.connect(lp).connect(ng).connect(out); n.stop(e2); fin(n, ng);
    },
    crash(v) {
      const { c, t, vel, o, out } = v;
      const dec = o.dec || 1.9;
      const n = noiseSrc(v), hp = biq(c, 'highpass', o.hp || 3200, 0.6), g = c.createGain();
      const end = perc(g.gain, t, vel * 0.6, dec, 0.002);
      n.connect(hp).connect(g).connect(out); n.stop(end); fin(n, g);
      const mg = c.createGain(), mh = biq(c, 'highpass', 5500, 0.7);
      perc(mg.gain, t, vel * 0.1, dec * 0.7, 0.002);
      mh.connect(mg).connect(out);
      for (const r of [1, 1.42, 1.79, 2.37, 2.93]) {
        const s = osc(c, 'square', t);
        s.frequency.value = (o.f || 420) * r;
        s.connect(mh); s.stop(end);
      }
    },
    stomp(v) {
      const { c, t, vel, out } = v;
      const s = osc(c, 'sine', t);
      s.frequency.setValueAtTime(100, t);
      s.frequency.exponentialRampToValueAtTime(44, t + 0.07);
      const g = c.createGain();
      const end = perc(g.gain, t, vel, 0.32, 0.002);
      s.connect(g).connect(out); s.stop(end); fin(s, g);
      const n = noiseSrc(v), lp = biq(c, 'lowpass', 380, 0.8), ng = c.createGain();
      const e2 = perc(ng.gain, t, vel * 0.7, 0.09);
      n.connect(lp).connect(ng).connect(out); n.stop(e2); fin(n, ng);
      const n2 = noiseSrc(v), bp = biq(c, 'bandpass', 2400, 1), sg = c.createGain();
      const e3 = perc(sg.gain, t, vel * 0.08, 0.02);
      n2.connect(bp).connect(sg).connect(out); n2.stop(e3); fin(n2, sg);
    },
    nes(v) { // 8-bit LFSR noise drum
      const { c, t, vel, o, out } = v;
      const s = c.createBufferSource();
      s.buffer = v.E.lfsr(!!o.short);
      s.loop = true;
      s.playbackRate.setValueAtTime(o.rate || 1, t);
      if (o.sweep) s.playbackRate.exponentialRampToValueAtTime((o.rate || 1) * 0.4, t + (o.dec || 0.12));
      const g = c.createGain();
      const end = perc(g.gain, t, vel * 0.6, o.dec || 0.12);
      s.connect(g).connect(out); s.start(t, v.rnd() * 0.5); s.stop(end); fin(s, g);
    },
    bass(v) {
      const { c, t, dur, vel, o, out, I, fl } = v;
      const f = hz(v);
      const s = osc(c, o.wave || 'sawtooth', t);
      pitch(s.frequency, v, f, 0);
      const cut = (o.cut || 420) * (1 + 0.6 * I);
      const lp = biq(c, 'lowpass', cut, o.q == null ? 5 : o.q);
      lp.frequency.setValueAtTime(clampF(cut + (o.env == null ? 1600 : o.env) * vel), t);
      lp.frequency.setTargetAtTime(clampF(cut), t + 0.002, TAU((o.fdec || 0.12) / 3));
      const g = c.createGain();
      const len = fl.mute ? Math.min(dur, 0.09) : dur * (o.gate || 0.92);
      const end = adsr(g.gain, t, len, o.a || 0.004, o.d || 0.25, o.s == null ? 0.75 : o.s, fl.mute ? 0.02 : o.r || 0.05, vel * 0.9);
      s.connect(lp).connect(g).connect(out); s.stop(end); fin(s, g);
      if (o.sub) {
        const sb = osc(c, 'sine', t);
        sb.frequency.setValueAtTime(f / 2, t);
        const sg = gainNode(c, o.sub);
        sb.connect(sg).connect(g); sb.stop(end);
      }
    },
    tuba(v) {
      const { c, t, dur, vel, o, out } = v;
      const f = hz(v);
      const s = osc(c, 'square', t), b = osc(c, 'sine', t);
      pitch(s.frequency, v, f, 30); pitch(b.frequency, v, f, 30);
      const lp = biq(c, 'lowpass', 400, 1.2);
      lp.frequency.setValueAtTime(clampF((o.cut || 480) + 500 * vel), t);
      lp.frequency.setTargetAtTime(clampF(o.cut || 480), t + 0.02, 0.08);
      const bg = gainNode(c, 0.6), g = c.createGain();
      const end = adsr(g.gain, t, dur * 0.9, 0.022, 0.2, 0.8, 0.07, vel * 0.55);
      s.connect(lp).connect(g); b.connect(bg).connect(g); g.connect(out);
      s.stop(end); b.stop(end); fin(s, g);
    },
    reed(v) { // accordion: three wet-tuned reeds + a low reed
      const { c, t, dur, vel, o, out, I } = v;
      const f = hz(v);
      const hp = biq(c, 'highpass', 160, 0.7), lp = biq(c, 'lowpass', (o.cut || 3200) * (1 + 0.3 * I), 0.7), pk = biq(c, 'peaking', 1300, 1.5, 5), g = c.createGain();
      const end = adsr(g.gain, t, v.fl.mute ? Math.min(dur, 0.14) : dur * 0.95, 0.02, 0.1, 0.9, 0.06, vel * 0.26);
      for (const cents of [-11, 0, 11]) {
        const s = osc(c, 'sawtooth', t);
        s.frequency.setValueAtTime(f * Math.pow(2, cents / 1200), t);
        s.connect(panner(c, cents / 30)).connect(hp); s.stop(end);
      }
      const lo = osc(c, 'square', t);
      lo.frequency.setValueAtTime(f / 2, t);
      const lg = gainNode(c, o.low == null ? 0.25 : o.low);
      lo.connect(lg).connect(hp); lo.stop(end);
      hp.connect(lp).connect(pk).connect(g).connect(out); fin(lo, g);
    },
    clar(v) { // clarinet-ish: odd harmonics (square), soft attack, breath, vibrato
      const { c, t, dur, vel, out, I } = v;
      const f = hz(v);
      const s = osc(c, 'square', t);
      pitch(s.frequency, v, f, 20);
      const lp = biq(c, 'lowpass', (1500 + 1400 * vel) * (1 + 0.3 * I), 0.9), g = c.createGain();
      const end = adsr(g.gain, t, v.fl.mute ? Math.min(dur, 0.1) : dur * 0.94, 0.03, 0.15, 0.85, 0.07, vel * 0.42);
      s.connect(lp).connect(g).connect(out); s.stop(end); fin(s, g);
      vibrato(v, s.frequency, f, 0.007, 5.4, 0.18, end);
      const n = noiseSrc(v), bp = biq(c, 'bandpass', clampF(f * 1.5), 2), ng = gainNode(c, vel * 0.035);
      n.connect(bp).connect(ng).connect(g); n.stop(end);
    },
    pluck(v) { // Karplus-Strong string (buffer rendered once per pitch)
      const { c, t, dur, vel, o, out, fl } = v;
      const buf = v.E.ks(v.m, o.bright == null ? 0.6 : o.bright, o.decay || 1.6);
      const s = c.createBufferSource();
      s.buffer = buf;
      if (v.det) s.playbackRate.value = Math.pow(2, v.det / 1200);
      const g = c.createGain(), hp = biq(c, 'highpass', 70, 0.7);
      g.gain.setValueAtTime(vel * (o.lvl || 0.9), t);
      const rel = fl.mute ? t + Math.max(0.05, dur * 0.8) : t + dur + (o.ring == null ? 0.3 : o.ring);
      g.gain.setTargetAtTime(0, rel, fl.mute ? 0.02 : 0.07);
      const end = Math.min(t + buf.duration, rel + 0.5);
      s.connect(hp).connect(g).connect(out); s.start(t); s.stop(end); fin(s, g);
    },
    dist(v) { // raw note for the distorted guitar (the channel carries the amp)
      const { c, t, dur, vel, out, I, fl } = v;
      const f = hz(v);
      const a = osc(c, 'sawtooth', t), b = osc(c, 'sawtooth', t);
      a.frequency.setValueAtTime(f, t);
      b.frequency.setValueAtTime(f * 1.0045, t);
      const lp = biq(c, 'lowpass', 3800, 0.8), g = c.createGain();
      let end;
      if (fl.mute) { // palm mute: dark, short chug
        lp.frequency.setValueAtTime(clampF(1100 * (1 + 0.4 * I)), t);
        lp.frequency.setTargetAtTime(420, t + 0.002, 0.05);
        end = adsr(g.gain, t, Math.min(dur, 0.12), 0.002, 0.09, 0.35, 0.03, vel * 0.5);
      } else {
        lp.frequency.setValueAtTime(clampF(3800 * (1 + 0.2 * I)), t);
        end = adsr(g.gain, t, dur * 0.95, 0.003, 0.3, 0.85, 0.08, vel * 0.45);
      }
      a.connect(lp); b.connect(lp); lp.connect(g).connect(out);
      a.stop(end); b.stop(end); fin(a, g);
    },
    pad(v) {
      const { c, t, dur, vel, o, out, I } = v;
      const f = hz(v);
      const lp = biq(c, 'lowpass', (o.cut || 1500) * (1 + 0.5 * I), 0.6), g = c.createGain();
      const end = adsr(g.gain, t, dur, o.a || 0.4, 0.5, 0.85, o.r || 0.9, vel * 0.11);
      let first = null;
      for (const cents of [-9, 0, 9]) {
        const s = osc(c, 'sawtooth', t);
        s.frequency.setValueAtTime(f, t);
        s.detune.setValueAtTime(cents, t);
        s.connect(panner(c, cents / 15)).connect(lp); s.stop(end); first = first || s;
      }
      lp.connect(g).connect(out); fin(first, g);
    },
    lead(v) {
      const { c, t, dur, vel, o, out, I, st } = v;
      const f = hz(v);
      if (o.glide && st.lastF && st.lastEnd > t - 0.03 && Math.abs(st.lastF / f - 1) > 0.001) v.glideFrom = st.lastF;
      st.lastF = f; st.lastEnd = t + dur;
      const s1 = osc(c, 'sawtooth', t), s2 = osc(c, 'square', t);
      pitch(s1.frequency, v, f, 0); pitch(s2.frequency, v, f * 1.004, 0);
      const base = (o.cut || 1200) * (1 + 0.6 * I);
      const lp = biq(c, 'lowpass', base, o.q || 2.5);
      lp.frequency.setValueAtTime(clampF(base + (o.env || 2800) * vel), t);
      lp.frequency.setTargetAtTime(clampF(base + 400), t + 0.005, 0.08);
      const g = c.createGain(), g2 = gainNode(c, 0.45);
      const end = adsr(g.gain, t, dur * 0.95, 0.006, 0.3, 0.75, 0.12, vel * 0.3);
      s1.connect(lp); s2.connect(g2).connect(lp); lp.connect(g).connect(out);
      s1.stop(end); s2.stop(end); fin(s1, g);
      vibrato(v, s1.frequency, f, 0.005, 5.6, 0.2, end);
    },
    plead(v) { // bright plucky synth (80s)
      const { c, t, dur, vel, o, out, I } = v;
      const f = hz(v);
      const s1 = osc(c, 'square', t), s2 = osc(c, 'sawtooth', t);
      pitch(s1.frequency, v, f, 0); pitch(s2.frequency, v, f * 1.006, 0);
      const cut = (o.cut || 600) * (1 + 0.6 * I);
      const lp = biq(c, 'lowpass', cut, o.q || 6);
      lp.frequency.setValueAtTime(clampF(cut + 5200 * vel), t);
      lp.frequency.setTargetAtTime(clampF(cut), t + 0.002, TAU((o.fdec || 0.14) / 3));
      const g = c.createGain();
      const end = adsr(g.gain, t, dur * 0.9, 0.002, 0.25, o.s == null ? 0.25 : o.s, 0.06, vel * 0.3);
      s1.connect(lp); s2.connect(lp); lp.connect(g).connect(out);
      s1.stop(end); s2.stop(end); fin(s1, g);
    },
    brass(v) {
      const { c, t, dur, vel, o, out, I } = v;
      const f = hz(v);
      const base = (o.cut || 900) * (1 + 0.5 * I);
      const lp = biq(c, 'lowpass', 400, 1.2);
      lp.frequency.setValueAtTime(400, t);
      lp.frequency.exponentialRampToValueAtTime(clampF(base + 3000 * vel), t + 0.045);
      lp.frequency.setTargetAtTime(clampF(base + 700), t + 0.045, 0.12);
      const g = c.createGain();
      const end = adsr(g.gain, t, v.fl.mute ? Math.min(dur, 0.12) : dur * 0.92, 0.012, 0.22, 0.7, 0.12, vel * 0.19);
      let first = null;
      for (const cents of [-7, 0, 7]) {
        const s = osc(c, 'sawtooth', t);
        pitch(s.frequency, v, f * Math.pow(2, cents / 1200), 25);
        s.connect(panner(c, cents / 18)).connect(lp); s.stop(end); first = first || s;
      }
      lp.connect(g).connect(out); fin(first, g);
    },
    hey(v) { // "hey!"-style formant stab — a synth, not a voice
      const { c, t, vel, out } = v;
      const f = hz(v);
      const s1 = osc(c, 'sawtooth', t), s2 = osc(c, 'square', t);
      for (const [s, k] of [[s1, 1], [s2, 1.003]]) {
        s.frequency.setValueAtTime(f * k * 0.97, t);
        s.frequency.exponentialRampToValueAtTime(f * k * 1.02, t + 0.04);
        s.frequency.exponentialRampToValueAtTime(f * k * 0.9, t + 0.24);
      }
      const mix = c.createGain(), g = c.createGain();
      s1.connect(mix); s2.connect(mix);
      const f1 = biq(c, 'bandpass', 720, 3.5), f2 = biq(c, 'bandpass', 1850, 5), f3 = biq(c, 'lowpass', 500, 0.7);
      const g2 = gainNode(c, 0.55), g3 = gainNode(c, 0.3);
      mix.connect(f1).connect(g); mix.connect(f2).connect(g2).connect(g); mix.connect(f3).connect(g3).connect(g);
      const p = g.gain;
      p.setValueAtTime(0, t); p.linearRampToValueAtTime(vel * 0.7, t + 0.01);
      p.setTargetAtTime(0, t + 0.06, 0.06);
      g.connect(out);
      s1.stop(t + 0.45); s2.stop(t + 0.45); fin(s1, g);
      const n = noiseSrc(v), hp = biq(c, 'highpass', 1800, 0.7), ng = c.createGain();
      const e = perc(ng.gain, t, (vel * 0.2) / (v.n || 1), 0.035);
      n.connect(hp).connect(ng).connect(out); n.stop(e); fin(n, ng);
    },
    bell(v) { // 2-operator FM bell / glockenspiel / anvil
      const { c, t, dur, vel, o, out } = v;
      const f = hz(v);
      const ratio = o.ratio || 3, idx = o.idx || 1.6, dec = Math.max(o.dec || 1.2, Math.min(dur, 3));
      const car = osc(c, 'sine', t), mod = osc(c, 'sine', t);
      car.frequency.setValueAtTime(f, t);
      mod.frequency.setValueAtTime(f * ratio, t);
      const mg = c.createGain();
      mg.gain.setValueAtTime(f * idx * vel, t);
      mg.gain.setTargetAtTime(f * idx * 0.08, t, dec * 0.18);
      mod.connect(mg).connect(car.frequency);
      const g = c.createGain();
      const end = perc(g.gain, t, vel * 0.3, dec, 0.002);
      car.connect(g).connect(out); car.stop(end); mod.stop(end); fin(car, g);
      const p2 = osc(c, 'sine', t);
      p2.frequency.setValueAtTime(f * 2, t);
      const pg = c.createGain();
      const e2 = perc(pg.gain, t, vel * 0.07, dec * 0.4, 0.002);
      p2.connect(pg).connect(out); p2.stop(e2); fin(p2, pg);
      if (o.noise) {
        const n = noiseSrc(v), bp = biq(c, 'bandpass', 3000, 0.8), ng = c.createGain();
        const e3 = perc(ng.gain, t, vel * o.noise, 0.03);
        n.connect(bp).connect(ng).connect(out); n.stop(e3); fin(n, ng);
      }
    },
    whistle(v) {
      const { c, t, dur, vel, o, out, st } = v;
      const f = hz(v);
      if (o.glide && st.lastF && st.lastEnd > t - 0.03 && Math.abs(st.lastF / f - 1) > 0.001) v.glideFrom = st.lastF;
      st.lastF = f; st.lastEnd = t + dur;
      const s = osc(c, 'sine', t), h = osc(c, 'sine', t);
      pitch(s.frequency, v, f, 70); pitch(h.frequency, v, f * 2, 70);
      const g = c.createGain(), hg = gainNode(c, 0.06);
      const end = adsr(g.gain, t, dur * 0.93, 0.035, 0.2, 0.85, 0.07, vel * 0.34);
      s.connect(g); h.connect(hg).connect(g); g.connect(out);
      s.stop(end); h.stop(end); fin(s, g);
      vibrato(v, s.frequency, f, 0.011, 5.8, 0.12, end);
      const n = noiseSrc(v), bp = biq(c, 'bandpass', clampF(f), 10), ng = gainNode(c, vel * 0.12);
      n.connect(bp).connect(ng).connect(g); n.stop(end);
    },
    chip(v) { // pulse-wave chiptune voice with optional fast chord arpeggio
      const { c, t, dur, vel, o, out } = v;
      const notes = v.notes;
      const arp = o.arp && notes.length > 1;
      const voices = arp ? [notes] : notes.map((m) => [m]);
      for (const vn of voices) {
        const s = osc(c, v.E.pulse(o.duty || 0.25), t);
        const det = Math.pow(2, (v.det || 0) / 1200);
        if (arp) {
          const rate = o.arpRate || 0.045;
          for (let k = 0, tt = t; tt < t + dur; k++, tt += rate) s.frequency.setValueAtTime(mtof(vn[k % vn.length]) * det, tt);
        } else pitch(s.frequency, v, mtof(vn[0]) * det, 0);
        const g = c.createGain(), p = g.gain;
        const pk = (vel * 0.28) / Math.sqrt(voices.length);
        p.setValueAtTime(0, t); p.linearRampToValueAtTime(pk, t + 0.003);
        p.setTargetAtTime(pk * (o.s == null ? 0.7 : o.s), t + 0.003, 0.04);
        const tr = t + Math.max(0.01, dur * (o.gate || 0.9));
        p.setTargetAtTime(0, tr, 0.012);
        const end = tr + 0.08;
        const lp = biq(c, 'lowpass', 9000, 0.5);
        s.connect(lp).connect(g).connect(out); s.stop(end); fin(s, g);
        if (!arp && o.vib) vibrato(v, s.frequency, mtof(vn[0]), 0.008, 6, 0.16, end);
      }
    },
    clav(v) {
      const { c, t, dur, vel, out, I, fl } = v;
      const f = hz(v);
      const s = osc(c, v.E.pulse(0.12), t);
      s.frequency.setValueAtTime(f, t);
      const hp = biq(c, 'highpass', 220, 0.7), pk = biq(c, 'peaking', 1500, 1.8, 7), lp = biq(c, 'lowpass', 4800 * (1 + 0.3 * I), 0.7), g = c.createGain(), p = g.gain;
      p.setValueAtTime(0, t); p.linearRampToValueAtTime(vel * 0.28, t + 0.0015);
      p.setTargetAtTime(vel * 0.09, t + 0.0015, 0.05);
      const tr = t + Math.max(0.03, dur * 0.8);
      p.setTargetAtTime(0, tr, fl.mute ? 0.008 : 0.03);
      s.connect(hp).connect(pk).connect(lp).connect(g).connect(out); s.stop(tr + 0.15); fin(s, g);
    },
    riser(v) {
      const { c, t, dur, vel, out } = v;
      const n = noiseSrc(v, true), bp = biq(c, 'bandpass', 300, 2.5), g = c.createGain();
      bp.frequency.setValueAtTime(300, t);
      bp.frequency.exponentialRampToValueAtTime(7000, t + dur);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.45, t + dur);
      g.gain.setTargetAtTime(0, t + dur, 0.03);
      n.connect(bp).connect(g).connect(out); n.stop(t + dur + 0.25); fin(n, g);
      const s = osc(c, 'sawtooth', t), lp = biq(c, 'lowpass', 2200, 0.7), sg = c.createGain();
      s.frequency.setValueAtTime(110, t); s.frequency.exponentialRampToValueAtTime(880, t + dur);
      sg.gain.setValueAtTime(0, t); sg.gain.linearRampToValueAtTime(vel * 0.05, t + dur);
      sg.gain.setTargetAtTime(0, t + dur, 0.03);
      s.connect(lp).connect(sg).connect(out); s.stop(t + dur + 0.25); fin(s, sg);
    },
    swell(v) { // reverse-cymbal swell into a downbeat
      const { c, t, dur, vel, out } = v;
      const n = noiseSrc(v, true), hp = biq(c, 'highpass', 2500, 0.7), pk = biq(c, 'peaking', 8000, 1, 4), g = c.createGain();
      g.gain.setValueAtTime(0.0005, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.002, vel * 0.35), t + dur);
      g.gain.linearRampToValueAtTime(0, t + dur + 0.03);
      n.connect(hp).connect(pk).connect(g).connect(out); n.stop(t + dur + 0.06); fin(n, g);
    },
  };
  for (const k of ['kick', 'snare', 'clap', 'hat', 'shaker', 'tom', 'crash', 'stomp', 'nes', 'riser', 'swell']) INST[k].perc = true;
  INST.chip.poly = true;

  // distorted-guitar amp: HP → waveshaper → scooped mids → cabinet lowpass
  function distInsert(E, input, o) {
    const c = E.ctx;
    const hp = biq(c, 'highpass', 90, 0.7);
    const sh = c.createWaveShaper();
    sh.curve = E.curve(o.drive || 8);
    sh.oversample = '4x';
    const scoop = biq(c, 'peaking', 800, 1, -5), thump = biq(c, 'peaking', 140, 1, 3);
    const cab = biq(c, 'lowpass', 3600, 0.9), cab2 = biq(c, 'lowpass', 6000, 0.5);
    const post = gainNode(c, o.post || 0.3);
    input.connect(hp).connect(sh).connect(scoop).connect(thump).connect(cab).connect(cab2).connect(post);
    return post;
  }

  // ════════════════════════════ songs (data) ══════════════════════════════
  const rep = (s, n) => Array(n).fill(s).join(' ');
  const pick = (notes, len = 2) => notes.trim().split(/\s+/).map((n) => `${n}:${len}`).join(' ');
  const arp16 = (notes) => { const a = notes.trim().split(/\s+/); return Array.from({ length: 16 }, (_, i) => a[i % a.length]).join(' '); };
  const pah = (ch) => `.:4 ${ch},:2 .:6 ${ch},:2 .:2`;
  const pahT = (ch) => `.:2 ${ch},:2 .:2 ${ch},:2`;
  const R = (n) => Array(n).fill('_');
  const cyc = (list, n) => Array.from({ length: n }, (_, i) => list[i % list.length]);

  // ───────────────────────── 1. Kyoto(kens) Theme ─────────────────────────
  const HK = ['hk1', 'hk2', 'hk3', 'hk4', 'hk1', 'hk2', 'hk7', 'hk8'];
  const HKB = ['hbG', 'hbFC', 'hbG', 'hbG@-5', 'hbG', 'hbFC', 'hbEC', 'hbG@-5'];
  const HKS = ['stG', 'stFC', 'stG', 'stD', 'stG', 'stFC', 'stEC', 'stDx'];
  const PRE = ['pre1', 'pre2', 'pre3', 'pre4', 'pre1', 'pre2', 'pre3', 'pre4b'];
  const THEME = {
    id: 'theme', title: 'Kyoto(kens) Theme', bpm: 124, swing: 0.1,
    delay: { beats: 0.75, fb: 0.32 },
    ch: {
      kick: { i: 'kick', g: 0.85, sc: true, o: { f0: 160, f1: 48, dec: 0.4 } },
      snare: { i: 'snare', g: 0.5, pan: 0.04, rev: 0.14, o: { tone: 200, dec: 0.16 } },
      clap: { i: 'clap', g: 0.3, pan: -0.06, rev: 0.2 },
      hat: { i: 'hat', g: 0.24, pan: 0.28 },
      ohat: { i: 'hat', g: 0.2, pan: 0.28, o: { open: true, dec: 0.28 } },
      crash: { i: 'crash', g: 0.24, pan: -0.25, rev: 0.2 },
      tom: { i: 'tom', g: 0.42, pan: 0.1, rev: 0.12 },
      bass: { i: 'bass', g: 0.5, duck: 0.45, o: { wave: 'sawtooth', cut: 380, env: 1900, q: 7, fdec: 0.14, sub: 0.55 } },
      clav: { i: 'clav', g: 0.32, pan: -0.38, duck: 0.25, rev: 0.06 },
      pad: { i: 'pad', g: 0.3, duck: 0.6, rev: 0.4, o: { cut: 1600 } },
      stab: { i: 'brass', g: 0.36, pan: 0.18, rev: 0.18 },
      lead: { i: 'lead', g: 0.44, pan: -0.08, rev: 0.2, dly: 0.24, o: { glide: true } },
      bell: { i: 'bell', g: 0.3, pan: 0.34, rev: 0.3, dly: 0.28 },
      fx: { i: 'riser', g: 0.3, rev: 0.4 },
      rev: { i: 'swell', g: 0.3, rev: 0.3 },
    },
    pat: {
      kA: 'X..x..x...X.....', kB: 'X..x......X..x..', kF: 'X.........X.....', k4: 'X...X...X...X...',
      kH: 'X.........x.....', kStop: 'X...X...X.......',
      sA: '....X..o.o..X..o', sB: '....X..o.o..X.oX', sF: '....X..o........', s4: '....X.......X...', sH: '........X.......',
      roll: 'o...o...o...o... o.o.o.o.x.x.x.x. xxxxxxxxxxxxxxxx XXXXXXXXXXXX....',
      hA: 'x.xox.x.x.xox...', h8: 'x.x.x.x.x.x.x.x.', h16: 'xoxoxoxoxoxoxoxo', oA: '..............x.', o8: '..x...x...x...x.',
      cr: 'X...............',
      tF: '.:8 A3 A3 F3 F3 D3 D3 A2:2', tF2: '.:4 A3 . A3 A3 F3 . F3 F3 D3 D3 A2 A2',
      // bass
      bA: 'G2:2 . G3 .:2 F3 G3 .:2 D3:2 F2 F#2 G2:2',
      bA2: 'G2:2 . G3 . Bb2 B2 G2 D3:2 . F3 E3 D3 C3 B2',
      bT: 'G2:2 . G3 . G2 . F2 .:2 F2 F#2 G2 A2 B2 D3',
      hbG: 'G2:2 . G2 G3 . G2:2 . G2 G3 . F3 D3 . B2',
      hbFC: 'F2:2 . F2 F3 . F2 . C3:2 . C3 C4 . A2 F#2',
      hbEC: 'E2:2 . E2 E3 . E2 . C3:2 . C3 C4 . B1 C#2',
      pbE: 'E2:2 E3:2 E2:2 E3:2 E2:2 E3:2 D3:2 B2:2', pbC: 'C2:2 C3:2 C2:2 C3:2 C2:2 C3:2 D3:2 E3:2',
      pbG: 'G2:2 G3:2 G2:2 G3:2 G2:2 G3:2 F#3:2 D3:2', pbD: 'D2:2 D3:2 D2:2 D3:2 D2:2 D3:2 E3:2 F#3:2',
      brB: 'C3:8 C3:6 G2:2 B2:8 B2:6 F#2:2 A2:8 A2:6 E2:2 D2:8 D3:4 C3:2 A2:2',
      bld: rep('D2:2', 8), bldE: 'D2:2 D2:2 D2:2 D2:2 D3:2 D3:2 .:4',
      // funk clav
      cv: '. . F4+G4+B4, . F4+G4+B4 . . F4+G4+B4, . . F4+G4+B4, . F4+G4+B4 . . F4+G4+B4,',
      // brass stabs
      sIn: 'G3+B3+D4+G4!:4 .:12',
      sAns: '.:10 B4+D5+G5, . B4+D5+G5!:2 .:2',
      stG: 'G4+B4+D5!:2 .:4 G4+B4+D5:2 .:8',
      stFC: 'F4+A4+C5!:2 .:4 F4+A4+C5:2 E4+G4+C5!:2 .:6',
      stD: 'F#4+A4+D5!:2 .:4 F#4+A4+D5:2 .:8',
      stEC: 'E4+G4+B4!:2 .:4 E4+G4+B4:2 E4+G4+C5!:2 .:6',
      stDx: 'F#4+A4+D5!:2 .:4 F#4+A4+D5:2 .:4 F#4+A4+D5:2 F#4+A4+D5!:2',
      stGx: 'G4+B4+D5!:2 .:4 G4+B4+D5:2 .:4 G4+B4+D5:2 G4+B4+D5!:2',
      // lead: verse calls, hook, pre-hook, bridge, build
      vA: '.:4 B4 D5 . F5:2 G5 .:2 F5 D5:3',
      vB: '.:4 D5 E5 G5:2 A5 B5 .:2 A5 G5:3',
      vC: '.:4 G5 A5 B5:2 D6 . B5 A5 G5:4',
      hk1: 'D5:2 G5:2 . G5 A5:2 B5:4 A5:2 G5:2',
      hk2: 'F5:3 G5:3 A5:2 G5:4 E5:2 C5:2',
      hk3: 'D5:2 G5:2 . G5 A5:2 B5:3 D6:3 B5:2',
      hk4: 'A5:4 F#5:2 D5:2 E5:2 F#5:2 A5:4',
      hk7: 'G5:3 B5:3 E6:2 E6:2 D6:2 C6:2 B5:2',
      hk8: 'A5:6 B5:2 A5:2 F#5:2 D5:4',
      hk8e: 'B5:4 A5:2 B5:2 G5:8',
      pre1: 'E5:3 F#5:3 G5:2 B5:4 A5:2 G5:2',
      pre2: 'E5:3 F#5:3 G5:2 C6:4 B5:2 G5:2',
      pre3: 'D5:3 E5:3 G5:2 D6:4 C6:2 B5:2',
      pre4: 'A5:8 .:2 D5 E5 F#5:2 A5:2',
      pre4b: 'A5:4 B5:2 C6:2 D6:6 .:2',
      br: 'E5:6 D5:2 B4:8 | D5:6 F#5:2 A5:8 | G5:6 E5:2 C5:8 | D5:4 G5:4 F#5:8',
      br2: 'E5:6 G5:2 B5:8 | A5:6 F#5:2 D5:8 | C6:6 B5:2 A5:4 G5:4 | A5:8 .:8',
      bu: 'D5:4 E5:4 F#5:4 G5:4 | A5:4 B5:4 C6:4 C#6:4 | D6:2 A5:2 D6:2 A5:2 D6:2 A5:2 D6:2 A5:2 | D6:12 .:4',
      // pads
      pHk: 'G3+B3+D4:16 F3+A3+C4:8 E3+G3+C4:8 G3+B3+D4:16 F#3+A3+D4:16 G3+B3+D4:16 F3+A3+C4:8 E3+G3+C4:8 E3+G3+B3:8 E3+G3+C4:8 F#3+A3+D4:16',
      pHkE: 'G3+B3+D4:16 F3+A3+C4:8 E3+G3+C4:8 G3+B3+D4:16 F#3+A3+D4:16 G3+B3+D4:16 F3+A3+C4:8 E3+G3+C4:8 E3+G3+B3:8 E3+G3+C4:8 G3+B3+D4:16',
      pPre: 'E3+G3+B3:16 E3+G3+C4:16 D3+G3+B3:16 D3+F#3+A3:16',
      pBr: 'C4+E4+G4+B4:16 B3+D4+F#4+A4:16 A3+C4+E4+G4:16 D4+G4+A4+C5:8 D4+F#4+A4+C5:8',
      pBu: 'D3+G3+A3:32 D3+F#3+A3:32',
      pV: 'G3+B3+F4:32 C4+E4+Bb4:16 G3+B3+F4:16 F#3+A3+C4:16 C4+E4+Bb4:16 G3+B3+F4:32',
      // bells
      bAns: '.:8 D6 . B5 . G5 . D5 .',
      brArp: pick('C5 E5 G5 B5 C6 B5 G5 E5 B4 D5 F#5 A5 B5 A5 F#5 D5 A4 C5 E5 G5 A5 G5 E5 C5 A4 D5 G5 C6 A4 D5 F#5 C6'),
    },
    sec: {
      intro: { bars: 4, kick: ['kA', 'kA', 'kA', 'kF'], snare: ['sA', 'sA', 'sA', 'sF'], hat: 'hA', ohat: ['oA', 'oA', 'oA', '_'], crash: ['cr', ...R(3)], stab: ['sIn', ...R(3)], bass: ['_', '_', 'bA', 'bT'], bell: ['_', '_', 'hk1', 'hk4'], tom: [...R(3), 'tF'], rev: [...R(3), 'x:16'] },
      verse1: { bars: 8, kick: ['kA', 'kA', 'kA', 'kB', 'kA', 'kA', 'kA', 'kF'], snare: ['sA', 'sA', 'sA', 'sB', 'sA', 'sA', 'sA', 'sF'], hat: 'hA', ohat: 'oA', crash: ['cr', ...R(7)], bass: ['bA', 'bA2', 'bA@+5', 'bA', 'bA@-5', 'bA@+5', 'bA', 'bT'], lead: ['vA', '_', 'vA@+5', '_', 'vA@-5', '_', 'vB', '_'], stab: ['_', 'sAns', '_', 'sAns', '_', 'sAns@+5', '_', 'sAns'], tom: [...R(7), 'tF2'] },
      pre1: { bars: 8, kick: 'k4', snare: [...cyc(['s4'], 7), 'sF'], clap: 's4', hat: 'h16', ohat: 'o8', crash: ['cr', ...R(7)], bass: ['pbE', 'pbC', 'pbG', 'pbD'], pad: 'pPre', lead: PRE, tom: [...R(7), 'tF'], rev: [...R(7), 'x:16'] },
      hook1: { bars: 8, kick: ['kA', 'kA', 'kA', 'kB'], snare: 'sA', clap: 's4', hat: 'h8', ohat: 'oA', crash: ['cr', ...R(3)], bass: HKB, pad: 'pHk', stab: HKS, lead: HK },
      brk: { bars: 4, kick: ['kA', 'kA', 'kA', 'kF'], snare: ['sA', 'sA', 'sA', 'sF'], hat: 'hA', ohat: 'oA', crash: ['cr', ...R(3)], stab: ['sIn', ...R(3)], bass: ['_', '_', 'bA', 'bT'], clav: ['_', 'cv', 'cv', 'cv'], tom: [...R(3), 'tF2'] },
      verse2: { bars: 8, kick: ['kA', 'kA', 'kA', 'kB', 'kA', 'kA', 'kA', 'kF'], snare: ['sA', 'sA', 'sA', 'sB', 'sA', 'sA', 'sA', 'sF'], hat: 'hA', ohat: 'oA', crash: ['cr', ...R(7)], bass: ['bA', 'bA2', 'bA@+5', 'bA', 'bA@-5', 'bA@+5', 'bA', 'bT'], clav: ['cv', 'cv', 'cv@+5', 'cv', 'cv@-5', 'cv@+5', 'cv', 'cv'], pad: 'pV', lead: ['vA', '_', 'vA@+5', '_', 'vA@-5', '_', 'vC', '_'], bell: ['_', 'bAns', '_', 'bAns', '_', 'bAns@+5', '_', 'bAns'], tom: [...R(7), 'tF2'] },
      pre2: { bars: 8, kick: 'k4', snare: [...cyc(['s4'], 7), 'sF'], clap: 's4', hat: 'h16', ohat: 'o8', crash: ['cr', ...R(7)], bass: ['pbE', 'pbC', 'pbG', 'pbD'], pad: 'pPre', lead: PRE, bell: PRE, tom: [...R(7), 'tF'], rev: [...R(7), 'x:16'] },
      hook2: { bars: 8, kick: ['kA', 'kA', 'kA', 'kB'], snare: 'sA', clap: 's4', hat: 'h16', ohat: 'o8', crash: ['cr', ...R(3)], bass: HKB, pad: 'pHk', stab: HKS, lead: HK, bell: HK },
      bridge: { bars: 8, kick: 'kH', snare: 'sH', clap: 'sH', hat: 'h8', crash: ['cr', ...R(7)], bass: 'brB', pad: 'pBr', bell: 'brArp', lead: ['br', 'br2'] },
      build: { bars: 4, tr: 2, kick: ['k4', 'k4', 'k4', 'kStop'], snare: 'roll', hat: 'h16', crash: ['cr', ...R(3)], bass: ['bld', 'bld', 'bld', 'bldE'], pad: 'pBu', lead: 'bu', fx: 'x:64' },
      hookF: { bars: 8, tr: 2, kick: ['kA', 'kA', 'kA', 'kB'], snare: 'sA', clap: 's4', hat: 'h16', ohat: 'o8', crash: ['cr', '_'], bass: [...HKB.slice(0, 7), 'hbG'], pad: 'pHkE', stab: [...HKS.slice(0, 7), 'stGx'], lead: [...HK.slice(0, 7), 'hk8e'], bell: [...HK.slice(0, 7), 'hk8e'] },
      outro: { bars: 4, kick: ['kA', 'kA', 'kA', 'kF'], snare: ['sA', 'sA', 'sA', 'sF'], hat: 'hA', ohat: 'oA', crash: ['cr', ...R(3)], bass: ['bA', 'bA2', 'bA', 'bT'], clav: 'cv', stab: ['sIn', 'sAns', '_', 'sAns'], lead: ['vB', ...R(3)], tom: [...R(3), 'tF'], rev: [...R(3), 'x:16'] },
    },
    arr: ['verse1', 'pre1', 'hook1', 'brk', 'verse2', 'pre2', 'hook2', 'bridge', 'build', 'hookF', 'outro'],   // the drums-only 4-bar 'intro' (bare hats + stab looping) is what played on title/intro/pause and sounded like a short noise in loop
  };

  // ─────────────────────── 2. Neue Welle Neunundneunzig ───────────────────────
  const offb = (ch) => `.:2 ${ch},:2 .:2 ${ch},:2 .:2 ${ch},:2 .:2 ${ch},:2`;
  const NDW_VB = ['obD', 'obD', 'obD@-4', 'obD@-2', 'obD', 'obD', 'obD@-4', 'obD@-5'];
  const NDW_VA = ['aDm', 'aDm', 'aBb', 'aC', 'aDm', 'aDm', 'aBb', 'aA'];
  const NDW_V = ['v1', 'v2', 'v3', 'v4', 'v1', 'v2', 'v7', 'v8'];
  const NDW_CB = ['obD@+3', 'obD@-2', 'obD', 'obD@-4', 'obD@+3', 'obD@-2', 'obD@-4', 'obD@-2'];
  const NDW_CA = ['aF', 'aC', 'aDm', 'aBb', 'aF', 'aC', 'aBb', 'aC'];
  const NDW_C = ['c1', 'c2', 'c3', 'c4', 'c1', 'c2', 'c7', 'c8'];
  const NDW_CH = ['c1h', 'c2h', 'c3h', 'c4h', 'c1h', 'c2h', 'c7h', 'c8h'];
  const NDW_OFF = ['oDm', 'oDm', 'oBb', 'oC', 'oDm', 'oDm', 'oBb', 'oA'];
  const NDW = {
    id: 'ndw', title: 'Neue Welle Neunundneunzig', bpm: 138,
    delay: { beats: 0.75, fb: 0.3 },
    ch: {
      kick: { i: 'kick', g: 0.8, sc: true, o: { f0: 140, f1: 50, dec: 0.32 } },
      snare: { i: 'snare', g: 0.5, rev: 0.45, o: { gate: 0.2, tone: 210, hp: 900 } },
      clap: { i: 'clap', g: 0.26, pan: -0.05, rev: 0.3 },
      hat: { i: 'hat', g: 0.22, pan: 0.3 },
      ohat: { i: 'hat', g: 0.16, pan: 0.3, o: { open: true, dec: 0.2 } },
      crash: { i: 'crash', g: 0.24, pan: -0.25, rev: 0.25 },
      tom: { i: 'tom', g: 0.34, rev: 0.35, o: { syn: true, dec: 0.45 } },
      bass: { i: 'bass', g: 0.5, duck: 0.4, o: { wave: 'square', cut: 520, env: 1400, q: 4, fdec: 0.1, sub: 0.3, gate: 0.7 } },
      arp: { i: 'plead', g: 0.2, pan: -0.32, dly: 0.2, rev: 0.1, duck: 0.2, o: { cut: 500, fdec: 0.1 } },
      riff: { i: 'plead', g: 0.36, pan: 0.12, dly: 0.22, rev: 0.18, o: { cut: 800, s: 0.35 } },
      solo: { i: 'chip', g: 0.3, pan: -0.06, dly: 0.25, rev: 0.18, o: { duty: 0.25, vib: true, gate: 0.85 } },
      lead: { i: 'lead', g: 0.42, pan: 0.05, dly: 0.22, rev: 0.22, o: { cut: 1500, glide: true } },
      glock: { i: 'bell', g: 0.22, pan: 0.36, rev: 0.3, dly: 0.2, o: { ratio: 3.5, idx: 1.2, dec: 0.9 } },
      pad: { i: 'pad', g: 0.26, duck: 0.5, rev: 0.35 },
      brass: { i: 'brass', g: 0.3, pan: -0.18, rev: 0.2 },
      fx: { i: 'riser', g: 0.28, rev: 0.4 },
      rev: { i: 'swell', g: 0.3, rev: 0.3 },
    },
    pat: {
      kF: 'X...X...X...X...', k2: 'X.......X.......',
      sG: '....X.......X...', sFill: '....X.......X.XX', s16: 'x.x.x.x.xxxxXXXX',
      hO: 'x.X.x.X.x.X.x.X.', h16: 'xxXxxxXxxxXxxxXx', ohOff: '..x...x...x...x.', cr: 'X...............',
      tSyn: '.:8 C4 . A3 . F3 . D3 .',
      obD: 'D2 . D3 . D2 . D3 . D2 . D3 . D2 . D3 .',
      bBr: 'Bb1:16 C2:16 A1:16 D2:16 G1:16 Bb1:16 C2:16 C2:8 C3:2 C3:2 C3:2 C3:2',
      aDm: arp16('D4 F4 A4 D5'), aBb: arp16('D4 F4 Bb4 D5'), aC: arp16('C4 E4 G4 C5'), aA: arp16('C#4 E4 A4 C#5'),
      aF: arp16('C4 F4 A4 C5'), aGm: arp16('D4 G4 Bb4 D5'),
      riff1: 'D5 . A4 . D5 F5 . E5 . D5 . A4 C5 . D5 .',
      riff2: 'D5 . Bb4 . D5 F5 . E5 . D5 . Bb4 C5 . D5 .',
      riff3: 'E5 . C5 . E5 G5 . F5 . E5 . C5 D5 . E5 .',
      riff4: 'F5 . E5 . D5 . C#5 . D5 . E5 . F5 . A5 .',
      v1: 'A4:2 A4 . D5:2 A4:2 G4 . F4:2 E4:2 F4:2',
      v2: 'A4:2 A4 . D5:2 E5:2 F5 . E5:2 D5:4',
      v3: 'D5:2 D5 . F5:2 D5:2 C5 . Bb4:2 A4:2 Bb4:2',
      v4: 'C5:2 C5 . E5:2 G5:2 F5 . E5:2 C5:4',
      v7: 'D5:2 F5 . Bb5:2 A5:2 G5 . F5:2 D5:2 F5:2',
      v8: 'E5:4 C#5:2 A4:2 E5:3 F5 . E5:2 .',
      pr: 'G5:4 F5:2 D5:2 Bb4:8 | F5:4 D5:2 Bb4:2 F5:8 | G5:4 E5:2 C5:2 G5:8 | C6:2 Bb5:2 A5:2 G5:2 A5:2 Bb5:2 C6:4',
      c1: 'A5:3 A5:3 G5:2 F5:2 G5:2 A5:4', c2: 'G5:3 G5:3 F5:2 E5:2 F5:2 G5:4',
      c3: 'F5:3 F5:3 E5:2 D5:2 E5:2 F5:2 A5:2', c4: 'Bb5:4 A5:2 G5:2 F5:4 D5:4',
      c7: 'F5:3 F5:3 G5:2 A5:2 Bb5:2 C6:4', c8: 'C6:4 Bb5:2 A5:2 G5:4 E5:4',
      c1h: 'F5:3 F5:3 E5:2 D5:2 E5:2 F5:4', c2h: 'E5:3 E5:3 D5:2 C5:2 D5:2 E5:4',
      c3h: 'D5:3 D5:3 C5:2 Bb4:2 C5:2 D5:2 F5:2', c4h: 'G5:4 F5:2 E5:2 D5:4 Bb4:4',
      c7h: 'D5:3 D5:3 E5:2 F5:2 G5:2 A5:4', c8h: 'A5:4 G5:2 F5:2 E5:4 C5:4',
      s1: 'D6:2 C6 A5 . A5 C6 D6 F6:2 E6 D6 C6:2 A5:2', s2: 'D6:3 E6:3 F6:2 E6 D6 C6 D6 A5:4',
      s3: 'F6:2 D6 Bb5 . Bb5 D6 F6 G6:2 F6 D6 C6:2 Bb5:2', s4: 'C6:3 D6:3 E6:2 G6:4 E6:2 C6:2',
      s6: 'A6:4 G6:2 F6:2 E6:2 D6:2 C6:2 A5:2', s7: 'Bb5:2 D6:2 F6:2 Bb6:2 A6:2 F6:2 D6:2 Bb5:2',
      s8: 'A5:2 C#6:2 E6:2 A6:2 G6:2 E6:2 C#6:2 E6:2',
      glBr: 'D6:8 C6:4 Bb5:4 | E6:8 D6:4 C6:4 | C6:8 B5:4 A5:4 | A5:12 .:4 | Bb5:8 A5:4 G5:4 | D6:8 C6:4 Bb5:4 | C6:4 D6:4 E6:4 G6:4 | G6:8 .:8',
      pPre: 'D4+G4+Bb4:16 D4+F4+Bb4:16 E4+G4+C5:32',
      pCh: 'F3+A3+C4:16 E3+G3+C4:16 D3+F3+A3:16 D3+F3+Bb3:16 F3+A3+C4:16 E3+G3+C4:16 D3+F3+Bb3:16 E3+G3+C4:16',
      pBr: 'D4+F4+Bb4:16 E4+G4+C5:16 C4+E4+A4:16 D4+F4+A4:16 D4+G4+Bb4:16 D4+F4+Bb4:16 E4+G4+C5:16 E4+G4+C5:16',
      oDm: offb('D4+F4+A4'), oBb: offb('D4+F4+Bb4'), oC: offb('C4+E4+G4'), oA: offb('C#4+E4+A4'),
    },
    sec: {
      intro: { bars: 8, arp: ['aDm', 'aBb', 'aC', 'aA'], kick: 'kF', bass: [...R(4), 'obD', 'obD@-4', 'obD@-2', 'obD@-5'], snare: [...R(4), 'sG', 'sG', 'sG', 'sFill'], hat: [...R(4), 'hO', 'hO', 'hO', 'hO'], riff: [...R(4), 'riff1', 'riff2', 'riff3', 'riff4'], crash: [...R(4), 'cr', ...R(3)], rev: [...R(3), 'x:16', ...R(4)], tom: [...R(7), 'tSyn'] },
      verse1: { bars: 8, kick: 'kF', snare: [...cyc(['sG'], 7), 'sFill'], hat: 'hO', bass: NDW_VB, arp: NDW_VA, solo: NDW_V, crash: ['cr', ...R(7)] },
      pre1: { bars: 4, kick: 'kF', snare: ['sG', 'sG', 'sG', 's16'], hat: 'h16', bass: ['obD@+5', 'obD@-4', 'obD@-2', 'obD@-2'], pad: 'pPre', lead: 'pr', arp: ['aGm', 'aBb', 'aC', 'aC'], rev: [...R(3), 'x:16'], tom: [...R(3), 'tSyn'] },
      chorus1: { bars: 8, kick: 'kF', snare: 'sG', clap: 'sG', hat: 'hO', ohat: 'ohOff', crash: ['cr', ...R(3)], bass: NDW_CB, arp: NDW_CA, pad: 'pCh', lead: NDW_C, glock: NDW_C },
      riff: { bars: 4, kick: 'kF', snare: ['sG', 'sG', 'sG', 'sFill'], hat: 'hO', ohat: 'ohOff', crash: ['cr', ...R(3)], bass: ['obD', 'obD@-4', 'obD@-2', 'obD@-5'], arp: ['aDm', 'aBb', 'aC', 'aA'], riff: ['riff1', 'riff2', 'riff3', 'riff4'], tom: [...R(3), 'tSyn'] },
      verse2: { bars: 8, kick: 'kF', snare: [...cyc(['sG'], 7), 'sFill'], hat: 'hO', ohat: 'ohOff', bass: NDW_VB, arp: NDW_VA, solo: NDW_V, brass: NDW_OFF, glock: ['_', 'riff1', '_', 'riff3', '_', 'riff1', '_', 'riff4'], crash: ['cr', ...R(7)] },
      pre2: { bars: 4, kick: 'kF', snare: ['sG', 'sG', 'sG', 's16'], hat: 'h16', bass: ['obD@+5', 'obD@-4', 'obD@-2', 'obD@-2'], pad: 'pPre', lead: 'pr', glock: 'pr', arp: ['aGm', 'aBb', 'aC', 'aC'], rev: [...R(3), 'x:16'], tom: [...R(3), 'tSyn'] },
      chorus2: { bars: 8, kick: 'kF', snare: 'sG', clap: 'sG', hat: 'h16', ohat: 'ohOff', crash: ['cr', ...R(3)], bass: NDW_CB, arp: NDW_CA, pad: 'pCh', lead: NDW_C, glock: NDW_C, brass: ['oF', 'oC', 'oDm', 'oBb', 'oF', 'oC', 'oBb', 'oC'] },
      solo: { bars: 8, kick: 'kF', snare: [...cyc(['sG'], 7), 's16'], clap: 'sG', hat: 'h16', ohat: 'ohOff', crash: ['cr', ...R(3)], bass: NDW_VB, arp: NDW_VA, brass: NDW_OFF, solo: ['s1@-12', 's2@-12', 's3@-12', 's4@-12', 's1@-12', 's6@-12', 's7@-12', 's8@-12'], tom: [...R(7), 'tSyn'] },
      bridge: { bars: 8, kick: [...cyc(['k2'], 6), 'kF', 'kF'], clap: [...cyc(['sG'], 6), '_', '_'], snare: [...R(6), 'sG', 's16'], hat: [...R(4), 'hO', 'hO', 'h16', 'h16'], crash: ['cr', ...R(7)], glock: 'glBr', pad: 'pBr', bass: 'bBr', arp: [...R(4), 'aGm', 'aBb', 'aC', 'aC'], fx: [...R(6), 'x:32'] },
      chorus3: { bars: 8, kick: 'kF', snare: 'sG', clap: 'sG', hat: 'h16', ohat: 'ohOff', crash: ['cr', '_'], bass: NDW_CB, arp: NDW_CA, pad: 'pCh', lead: NDW_C, glock: NDW_C, solo: NDW_CH, brass: ['oF', 'oC', 'oDm', 'oBb', 'oF', 'oC', 'oBb', 'oC'] },
      outro: { bars: 8, kick: 'kF', snare: [...cyc(['sG'], 7), 'sFill'], hat: 'hO', ohat: [...R(4), 'ohOff', 'ohOff', 'ohOff', 'ohOff'], crash: ['cr', ...R(7)], bass: ['obD', 'obD@-4', 'obD@-2', 'obD@-5'], arp: ['aDm', 'aBb', 'aC', 'aA'], riff: ['riff1', 'riff2', 'riff3', 'riff4', ...R(4)], glock: ['riff1', 'riff2', 'riff3', 'riff4', ...R(4)], tom: [...R(7), 'tSyn'] },
    },
    arr: ['intro', 'verse1', 'pre1', 'chorus1', 'riff', 'verse2', 'pre2', 'chorus2', 'solo', 'bridge', 'chorus3', 'outro'],
  };
  Object.assign(NDW.pat, { oF: offb('C4+F4+A4') });

  // ────────────────────────── 3. Autobahn Stahl ──────────────────────────
  const PE = 'E2+B2+E3', PF = 'F2+C3+F3', PG = 'G2+D3+G3', PC = 'C3+G3+C4', PD = 'D3+A3+D4', PB = 'B2+F#3+B3';
  const AB_VG = ['gV', 'gV', 'gV@-4', 'gV@-2', 'gV', 'gV', 'gV@-4', 'gV@-5'];
  const AB_VB = ['bV', 'bV', 'bV@-4', 'bV@-2', 'bV', 'bV', 'bV@-4', 'bV@-5'];
  const AB_VS = ['sqE', 'sqE', 'sqC', 'sqD', 'sqE', 'sqE', 'sqC', 'sqB'];
  const AB_VM = ['vA', 'vB', 'vC', 'vD', 'vA', 'vF', 'vG', 'vH'];
  const AB_CG = ['gC', 'gC@-4', 'gC@+3', 'gC@-2', 'gC', 'gC@-4', 'gC@+5', 'gC@+7'];
  const AB_CB = ['bC', 'bC@-4', 'bC@+3', 'bC@-2', 'bC', 'bC@-4', 'bC@+5', 'bC@-5'];
  const AB_CS = ['sqE', 'sqC', 'sqG', 'sqD', 'sqE', 'sqC', 'sqA', 'sqB'];
  const AB_CM = ['ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6', 'ch7', 'ch8'];
  const AUTOBAHN = {
    id: 'autobahn', title: 'Autobahn Stahl', bpm: 112,
    delay: { beats: 0.5, fb: 0.28 },
    ch: {
      kick: { i: 'kick', g: 0.75, sc: true, o: { f0: 130, f1: 44, dec: 0.38, click: 0.5 } },
      snare: { i: 'snare', g: 0.55, rev: 0.3, o: { tone: 180, hp: 1100, dec: 0.22 } },
      hat: { i: 'hat', g: 0.2, pan: 0.3 },
      crash: { i: 'crash', g: 0.28, pan: -0.3, rev: 0.25 },
      tom: { i: 'tom', g: 0.5, rev: 0.2 },
      gtr: { i: 'dist', g: 0.85, fx: 'dist', twin: { pan: 0.75, det: 9, lag: 0.007 }, o: { drive: 9, post: 0.15 } },
      bass: { i: 'bass', g: 0.42, duck: 0.35, o: { wave: 'sawtooth', cut: 300, env: 900, q: 3, sub: 0.5 } },
      seq: { i: 'bass', g: 0.2, pan: -0.2, duck: 0.3, dly: 0.15, o: { wave: 'square', cut: 700, env: 2600, q: 9, fdec: 0.09, gate: 0.5 } },
      pad: { i: 'pad', g: 0.26, duck: 0.5, rev: 0.45, o: { cut: 1100 } },
      lead: { i: 'lead', g: 0.4, pan: 0.1, rev: 0.25, dly: 0.22, o: { cut: 1000, env: 2200, glide: true } },
      bell: { i: 'bell', g: 0.24, pan: -0.3, rev: 0.35, dly: 0.2, o: { ratio: 3.5, idx: 1.4, dec: 1.4 } },
      anvil: { i: 'bell', g: 0.2, pan: 0.4, rev: 0.3, o: { ratio: 1.414, idx: 7, dec: 0.5, noise: 0.4 } },
      boom: { i: 'kick', g: 0.7, rev: 0.3, o: { f0: 90, f1: 28, pd: 0.4, dec: 1.8, click: 0 } },
      fx: { i: 'riser', g: 0.3, rev: 0.4 },
    },
    pat: {
      kR1: 'XX.XX.X.X..XX.XX', kR2: 'XX.XX.X.X..XX...', kC: 'X..X..X.X..X..X.', kV: 'X.....X...X.....',
      kBd: 'X.........X.....', k8: 'X.X.X.X.X.X.X.X.', k16: 'XXXXXXXXXXXXXXXX', kEnd: 'X...............',
      s24: '....X.......X...', sHalf: '........X.......', sFill: '....X.......XXXX', r8: 'x.x.x.x.x.x.x.x.', r16: 'xxxxxxxxxxxxxxxx', R16: 'XXXXXXXXXXXXXXXX', sEnd: 'X...............',
      h8: 'x.x.x.x.x.x.x.x.', h16: 'oooooooooooooooo', cr: 'X...............',
      gR1: `E2, E2, . E2, E2, . E2, . ${PG}!:2 . E2, ${PF}!:2 E2, E2,`,
      gR2: `E2, E2, . E2, E2, . E2, . ${PD}!:2 . E2, ${PC}!:3 .`,
      gV: 'E2,:2 .:6 E2, E2, .:6',
      gV2: 'E2,:2 . E2, .:4 E2,:2 . E2, E2, .:3',
      gP: rep('E2,:2', 8),
      gC: `${PE}!:3 ${PE}:3 ${PE}:2 ${PE}!:3 ${PE}:3 ${PE}:2`,
      gBd: `${PE}!:12 E2, E2, E2, E2,`,
      gBu: rep('E2,', 16), gBuB: rep(`${PB}!:2`, 8), gEnd: `${PE}!:8 .:8`,
      bR1: 'E2:2 . E2:2 . E2 . G2:2 . E2 F2:2 E2:2',
      bR2: 'E2:2 . E2:2 . E2 . D2:2 . E2 C2:3 .',
      bV: 'E2:12 E2:2 E2:2', bP: rep('E2:2', 8), bC: 'E2:3 E2:3 E2:2 E2:3 E2:3 E2:2', bBd: 'E2:16', bBu: rep('E2:2', 8), bEnd: 'E2:8 .:8',
      sqE: 'E3 E3 E4 E3 B3 E3 D4 E3 E3 G3 E4 E3 B3 E3 F4 E3',
      sqC: 'C3 C3 C4 C3 G3 C3 B3 C3 C3 E3 C4 C3 G3 C3 D4 C3',
      sqD: 'D3 D3 D4 D3 A3 D3 C4 D3 D3 F#3 D4 D3 A3 D3 E4 D3',
      sqB: 'B2 B2 B3 B2 F#3 B2 A3 B2 B2 D#3 B3 B2 F#3 B2 C4 B2',
      sqG: 'G2 G2 G3 G2 D3 G2 F#3 G2 G2 B2 G3 G2 D3 G2 A3 G2',
      sqA: 'A2 A2 A3 A2 E3 A2 G3 A2 A2 C3 A3 A2 E3 A2 B3 A2',
      vA: 'E4:4 G4:2 F#4:2 E4:4 B3:4', vB: 'E4:4 G4:2 A4:2 B4:6 A4:2', vC: 'G4:4 E4:2 F#4:2 G4:4 C5:4',
      vD: 'F#4:4 A4:2 G4:2 F#4:4 D4:4', vF: 'B4:4 C5:2 B4:2 G4:4 E4:4', vG: 'C5:4 B4:2 A4:2 G4:4 E4:4',
      vH: 'F#4:4 D#4:2 E4:2 F#4:8',
      preL: 'A4:4 C5:4 E5:8 | G5:4 E5:4 C5:8 | B4:4 D#5:4 F#5:8 | B5:12 .:4',
      ch1: 'E5:6 D5:2 E5:4 G5:4', ch2: 'G5:6 F#5:2 E5:4 C5:4', ch3: 'D5:6 E5:2 G5:4 B5:4', ch4: 'A5:8 F#5:4 D5:4',
      ch5: 'E5:6 D5:2 E5:4 G5:4', ch6: 'G5:6 A5:2 B5:4 C6:4', ch7: 'C6:6 B5:2 A5:4 E5:4', ch8: 'F#5:8 D#5:4 B4:4',
      bdL: 'B4:16 C5:16 B4:8 G4:8 A4:16 B4:16 C5:16 D5:16 C5:8 .:8',
      buL: 'E4:4 F#4:4 G4:4 A4:4 | B4:4 C5:4 D5:4 D#5:4 | E5:16 | F#5:8 .:8',
      pIntro: 'E3+G3+B3:64',
      pVerse: 'E3+G3+B3:32 C3+E3+G3:16 D3+F#3+A3:16 E3+G3+B3:32 C3+E3+G3:16 B2+D#3+F#3:16',
      pPre: 'A3+C4+E4:16 G3+C4+E4:16 B3+D#4+F#4:32',
      pCh: 'E3+G3+B3:16 E3+G3+C4:16 D3+G3+B3:16 D3+F#3+A3:16 E3+G3+B3:16 E3+G3+C4:16 E3+A3+C4:16 D#3+F#3+B3:16',
      pBd: 'E3+G3+B3:16 F3+A3+C4:16 E3+G3+B3:16 F3+A3+C4:16 E3+G3+B3:16 F3+A3+C4:16 G3+B3+D4:16 F3+A3+C4:16',
      anv: '.:4 E6 .:7 E6 .:3', anvI: 'E6 .:15', tomF: '.:8 E3 E3 C3 C3 A2 A2 E2:2',
    },
    sec: {
      intro: { bars: 4, seq: 'sqE', pad: 'pIntro', anvil: ['anvI', '_'], boom: ['x:16', ...R(3)], hat: ['_', '_', 'h16', 'h16'], snare: [...R(3), 'r16'], fx: ['_', '_', 'x:32'], kick: [...R(3), 'X.......X.X.X.X.'] },
      iriff: { bars: 4, gtr: ['gR1', 'gR2'], kick: ['kR1', 'kR2'], snare: 's24', hat: 'h8', bass: ['bR1', 'bR2'], crash: ['cr', ...R(3)], seq: 'sqE', anvil: 'anv' },
      verse1: { bars: 8, gtr: AB_VG, kick: 'kV', snare: 's24', hat: 'h8', bass: AB_VB, seq: AB_VS, bell: AB_VM.map((p) => p + '@+12'), pad: 'pVerse', crash: ['cr', ...R(7)] },
      pre1: { bars: 4, gtr: ['gP@+5', 'gP@+8', 'gP@+7', 'gP@+7'], kick: 'k8', snare: ['s24', 's24', 'r8', 'r16'], hat: 'h8', bass: ['bP@-7', 'bP@-4', 'bP@-5', 'bP@-5'], pad: 'pPre', lead: 'preL', fx: ['_', '_', 'x:32'], seq: ['sqA', 'sqC', 'sqB', 'sqB'] },
      chorus1: { bars: 8, gtr: AB_CG, kick: 'kC', snare: 's24', hat: 'h8', crash: ['cr', ...R(3)], bass: AB_CB, pad: 'pCh', lead: AB_CM, seq: AB_CS },
      riff: { bars: 4, gtr: ['gR1', 'gR2'], kick: ['kR1', 'kR2'], snare: ['s24', 's24', 's24', 'sFill'], hat: 'h8', bass: ['bR1', 'bR2'], anvil: 'anv', seq: 'sqE', crash: ['cr', ...R(3)] },
      verse2: { bars: 8, gtr: AB_VG.map((p) => p.replace('gV', 'gV2')), kick: 'kV', snare: 's24', hat: 'h16', bass: AB_VB, seq: AB_VS, bell: AB_VM.map((p) => p + '@+12'), lead: AB_VM, pad: 'pVerse', anvil: 'anv', crash: ['cr', ...R(7)] },
      pre2: { bars: 4, gtr: ['gP@+5', 'gP@+8', 'gP@+7', 'gP@+7'], kick: 'k8', snare: ['s24', 's24', 'r8', 'r16'], hat: 'h8', bass: ['bP@-7', 'bP@-4', 'bP@-5', 'bP@-5'], pad: 'pPre', lead: 'preL', fx: ['_', '_', 'x:32'], seq: ['sqA', 'sqC', 'sqB', 'sqB'] },
      chorus2: { bars: 8, gtr: AB_CG, kick: 'kC', snare: 's24', hat: 'h8', crash: ['cr', ...R(3)], bass: AB_CB, pad: 'pCh', lead: AB_CM, bell: AB_CM.map((p) => p + '@+12'), seq: AB_CS, anvil: 'anv' },
      breakdown: { bars: 8, gtr: ['gBd', 'gBd@+1', 'gBd', 'gBd@+1', 'gBd', 'gBd@+1', 'gBd@+3', 'gBd@+1'], kick: 'kBd', snare: 'sHalf', hat: [...R(4), 'h8', 'h8', 'h8', 'h8'], bass: ['bBd', 'bBd@+1', 'bBd', 'bBd@+1', 'bBd', 'bBd@+1', 'bBd@+3', 'bBd@+1'], boom: ['x:16', ...R(3)], pad: 'pBd', lead: 'bdL', anvil: ['anvI', ...R(3)], crash: ['cr', ...R(7)], tom: [...R(7), 'tomF'] },
      build: { bars: 4, gtr: ['gBu', 'gBu', 'gBu', 'gBuB'], kick: ['k8', 'k8', 'k8', 'k16'], snare: ['r8', 'r8', 'r16', 'R16'], hat: 'h8', bass: ['bBu', 'bBu', 'bBu', 'bBu@-5'], lead: 'buL', fx: 'x:64', seq: ['sqE', 'sqE', 'sqE', 'sqB'] },
      chorus3: { bars: 8, gtr: AB_CG, kick: 'kC', snare: 's24', hat: 'h8', crash: ['cr', '_'], bass: AB_CB, pad: 'pCh', lead: AB_CM, bell: AB_CM.map((p) => p + '@+12'), seq: AB_CS, anvil: 'anv' },
      outro: { bars: 4, gtr: ['gR1', 'gR2', 'gR1', 'gEnd'], kick: ['kR1', 'kR2', 'kR1', 'kEnd'], snare: ['s24', 's24', 's24', 'sEnd'], hat: ['h8', 'h8', 'h8', '_'], bass: ['bR1', 'bR2', 'bR1', 'bEnd'], crash: ['cr', '_', '_', 'cr'], anvil: 'anv', seq: ['sqE', 'sqE', 'sqE', '_'] },
    },
    arr: ['intro', 'iriff', 'verse1', 'pre1', 'chorus1', 'riff', 'verse2', 'pre2', 'chorus2', 'breakdown', 'build', 'chorus3', 'outro'],
  };

  // ─────────────────────────── 4. Fog City Stomp ───────────────────────────
  const GC = 'C3+E3+G3+C4+E4', GF = 'F2+C3+F3+A3+C4', GG = 'G2+B2+D3+G3+B3', GAm = 'A2+E3+A3+C4+E4';
  const strum = (c) => `${c}!:4 ${c}:2 ${c}?:4 ${c}:2 ${c}:2 ${c}?:2`;
  const strumH = (a, b) => `${a}!:4 ${a}:2 ${a}?:2 ${b}!:4 ${b}:2 ${b}?:2`;
  const qstrum = (c) => `${c}:4 ${c}?:4 ${c}:4 ${c}?:4`;
  const FC_VG = ['sC', 'sAm', 'sF', 'sC', 'sC', 'sAm', 'sFG', 'sC'];
  const FC_CG = ['sF', 'sC', 'sG', 'sAm', 'sF', 'sC', 'sG', 'sC'];
  const FC_CB = ['bC@+5', 'bC', 'bC@-5', 'bC@-3', 'bC@+5', 'bC', 'bC@-5', 'bC'];
  const FC_W = ['w1', 'w2', 'w3', 'w4', 'w1', 'w2', 'w7', 'w8'];
  const FC_M = ['m1', 'm2', 'm3', 'm4', 'm1', 'm2', 'm7', 'm8'];
  const FC_CP = ['pF', 'pC', 'pG', 'pAm', 'pF', 'pC', 'pG', 'pC'];
  const FOG = {
    id: 'fogcity', title: 'Fog City Stomp', bpm: 100,
    delay: { beats: 0.75, fb: 0.28 },
    ch: {
      stomp: { i: 'stomp', g: 0.95, sc: true, rev: 0.2 },
      clap: { i: 'clap', g: 0.42, pan: 0.06, rev: 0.32, o: { dec: 0.18 } },
      tamb: { i: 'shaker', g: 0.24, pan: 0.42 },
      crash: { i: 'crash', g: 0.2, pan: -0.3, rev: 0.3 },
      gtr: { i: 'pluck', g: 0.7, pan: -0.28, rev: 0.18, strum: 0.011, duck: 0.15, o: { bright: 0.55, decay: 1.8 } },
      gtr2: { i: 'pluck', g: 0.4, pan: 0.32, rev: 0.22, dly: 0.12, o: { bright: 0.7, decay: 1.4 } },
      mando: { i: 'pluck', g: 0.5, pan: 0.2, rev: 0.22, dly: 0.12, o: { bright: 0.85, decay: 1.0, ring: 0.15 } },
      bass: { i: 'bass', g: 0.55, duck: 0.35, o: { wave: 'triangle', cut: 900, env: 600, q: 1, sub: 0.4, gate: 0.8 } },
      whistle: { i: 'whistle', g: 0.42, pan: 0.06, rev: 0.3, dly: 0.18, o: { glide: true } },
      hey: { i: 'hey', g: 0.42, rev: 0.35 },
      pad: { i: 'pad', g: 0.18, duck: 0.4, rev: 0.4, o: { cut: 1100, a: 0.6 } },
      bell: { i: 'bell', g: 0.16, pan: -0.32, rev: 0.3, o: { ratio: 3.5, idx: 1, dec: 0.9 } },
    },
    pat: {
      sC: strum(GC), sAm: strum(GAm), sF: strum(GF), sG: strum(GG), sFG: strumH(GF, GG),
      qC: qstrum(GC), qAm: qstrum(GAm), qF: qstrum(GF), qG: qstrum(GG),
      pC: pick('C3 G3 C4 E4 G4 E4 C4 G3'), pAm: pick('A2 E3 A3 C4 E4 C4 A3 E3'),
      pF: pick('F2 C3 F3 A3 C4 A3 F3 C3'), pG: pick('G2 D3 G3 B3 D4 B3 G3 D3'), pFG: pick('F2 C3 F3 A3 G2 D3 G3 B3'),
      stV: 'X.......X.......', stC: 'X.......X.....x.', stQ: 'X...X...X...X...', st8: 'X.X.X.X.X.X.X.X.',
      cl: '....X.......X...', cl3: '........X.......', tb: 'x.X.x.X.x.X.x.X.', tbs: '..x...x...x...x.', tb16: 'xoXoxoXoxoXoxoXo',
      cr: 'X...............',
      bC: 'C2:4 G2:4 C2:4 G2:4', bFG: 'F2:4 C3:4 G1:4 D2:4',
      m1: 'E4:2 G4:2 G4:2 A4:2 G4:4 E4:4', m2: 'E4:2 A4:2 A4:2 B4:2 C5:4 A4:4',
      m3: 'A4:2 C5:2 C5:2 D5:2 C5:4 A4:2 F4:2', m4: 'G4:4 E4:4 C4:8',
      m7: 'A4:2 C5:2 A4:2 F4:2 B4:2 D5:2 B4:2 G4:2', m8: 'C5:4 G4:4 C5:8',
      w1: 'A5:2 C6:2 C6:4 C6:2 A5:2 C6:2 D6:2', w2: 'E6:4 D6:2 C6:2 C6:8',
      w3: 'B5:2 D6:2 D6:4 D6:2 B5:2 D6:2 E6:2', w4: 'E6:4 D6:2 C6:2 A5:8',
      w7: 'D6:2 E6:2 G6:4 E6:2 D6:2 C6:2 B5:2', w8: 'C6:12 .:4',
      wCnt: 'E5?:8 G5?:8 | E5?:16 | F5?:8 A5?:8 | G5?:16 | E5?:8 G5?:8 | E5?:16 | C5?:8 D5?:8 | E5?:16',
      wBr1: 'C6:8 B5:4 A5:4 | A5:8 G5:4 F5:4 | G5:8 E5:4 C5:4 | D5:8 G5:8',
      wBr2: 'E6:8 D6:4 C6:4 | C6:8 A5:4 F5:4 | E6:8 G6:4 E6:4 | D6:12 .:4',
      hC: '.:12 C4+E4+G4!:4', hA: '.:12 A3+C4+E4!:4', hC2: '.:8 C4+E4+G4!:4 C4+E4+G4!:4', hG: '.:12 B3+D4+G4!:4',
      padCh: 'F3+A3+C4:16 E3+G3+C4:16 D3+G3+B3:16 E3+A3+C4:16 F3+A3+C4:16 E3+G3+C4:16 D3+G3+B3:16 E3+G3+C4:16',
      padBr: 'A3+C4+E4:16 A3+C4+F4:16 G3+C4+E4:16 G3+B3+D4:16',
    },
    sec: {
      intro: { bars: 4, gtr: ['qC', 'qAm', 'qF', 'qG'], whistle: ['_', '_', 'w1', 'w7'], stomp: ['_', '_', 'stQ', 'stQ'], hey: [...R(3), 'hG'] },
      verse1: { bars: 8, gtr: FC_VG, stomp: 'stV', mando: FC_M, tamb: [...R(4), 'tbs', 'tbs', 'tbs', 'tbs'] },
      chorus1: { bars: 8, gtr: FC_CG, stomp: 'stC', clap: 'cl', tamb: 'tb', bass: FC_CB, whistle: FC_W, hey: ['_', 'hC', '_', 'hA', '_', 'hC', '_', 'hC2'], pad: 'padCh', crash: ['cr', ...R(7)] },
      inter: { bars: 4, gtr2: ['pF', 'pC', 'pG', 'pC'], gtr: ['sF', 'sC', 'sG', 'sC'], whistle: ['w1', 'w2', 'w7', 'w8'], stomp: 'stV', clap: 'cl', bass: ['bC@+5', 'bC', 'bC@-5', 'bC'], hey: [...R(3), 'hC2'] },
      verse2: { bars: 8, gtr: FC_VG, gtr2: ['pC', 'pAm', 'pF', 'pC', 'pC', 'pAm', 'pFG', 'pC'], stomp: 'stC', clap: 'cl', tamb: 'tbs', bass: ['bC', 'bC@-3', 'bC@+5', 'bC', 'bC', 'bC@-3', 'bFG', 'bC'], mando: FC_M, whistle: 'wCnt', crash: ['cr', ...R(7)] },
      chorus2: { bars: 8, gtr: FC_CG, gtr2: FC_CP, stomp: 'stC', clap: 'cl', tamb: 'tb16', bass: FC_CB, whistle: FC_W, bell: FC_W.map((p) => p + '@-12'), hey: ['_', 'hC', '_', 'hA', '_', 'hC', '_', 'hC2'], pad: 'padCh', crash: ['cr', ...R(7)] },
      bridge: { bars: 8, gtr2: ['pAm', 'pF', 'pC', 'pG'], clap: [...cyc(['cl3'], 4), 'cl', 'cl', 'cl', 'cl'], stomp: [...R(4), 'stV', 'stV', 'stQ', 'st8'], whistle: ['wBr1', 'wBr2'], pad: 'padBr', bass: [...R(4), 'bC@-3', 'bC@+5', 'bC', 'bC@-5'], hey: [...R(7), 'hG'], gtr: [...R(4), 'sAm', 'sF', 'sC', 'sG'], tamb: [...R(6), 'tbs', 'tb'] },
      chorus3: { bars: 8, gtr: FC_CG, gtr2: FC_CP, stomp: 'stC', clap: 'cl', tamb: 'tb16', bass: FC_CB, whistle: FC_W, bell: FC_W, hey: ['_', 'hC', '_', 'hA', '_', 'hC', '_', 'hC2'], mando: FC_M.map((p) => p + '@+12'), pad: 'padCh', crash: ['cr', ...R(3)] },
      outro: { bars: 4, gtr: ['sF', 'sC', 'sG', 'sC'], gtr2: ['pF', 'pC', 'pG', 'pC'], whistle: ['w1', 'w2', 'w7', 'w8'], stomp: ['stC', 'stC', 'stV', 'stV'], clap: ['cl', 'cl', 'cl', '_'], bass: ['bC@+5', 'bC', 'bC@-5', 'bC'], hey: ['_', 'hC', '_', '_'] },
    },
    arr: ['intro', 'verse1', 'chorus1', 'inter', 'verse2', 'chorus2', 'bridge', 'chorus3', 'outro'],
  };

  // ──────────────────────── 5. Lederhosen Turbo Polka ────────────────────────
  const CF = 'A3+C4+F4', CC7 = 'G3+Bb3+E4', CBb = 'Bb3+D4+F4', CEb = 'G3+Bb3+Eb4', CF7 = 'A3+C4+Eb4', CBb7 = 'Ab3+D4+F4';
  const PK_A = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A1', 'A2', 'A11', 'A12', 'A13', 'A14', 'A15', 'A16'];
  const PK_H = ['F', 'F', 'C', 'C', 'C', 'C', 'F', 'F', 'F', 'F', 'Bb', 'Bb', 'C', 'C', 'F', 'F'];
  const PK_B = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8'];
  const PK_BH = ['Bb', 'F', 'C', 'F', 'Bb', 'F', 'C', 'F'];
  const PK_T = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T1', 'T10', 'T11', 'T12', 'T13', 'T14', 'T15', 'T16'];
  const PK_TH = ['Bb', 'Bb', 'F7', 'F7', 'F7', 'F7', 'Bb', 'Bb', 'Bb', 'Bb7', 'Eb', 'Eb', 'Bb', 'F7', 'Bb', 'Bb'];
  const oom = (h) => ({ F: 'oF', C: 'oC', Bb: 'oBb', Eb: 'oEb', F7: 'oF', Bb7: 'oBb' }[h]);
  const pahN = (h) => 'p' + h;
  const POLKA = {
    id: 'polka', title: 'Lederhosen Turbo Polka', bpm: 130,
    delay: { beats: 0.5, fb: 0.25 },
    ch: {
      kick: { i: 'kick', g: 0.7, sc: true, o: { f0: 120, f1: 55, dec: 0.25, click: 0.2 } },
      snare: { i: 'snare', g: 0.36, pan: 0.1, rev: 0.15, o: { tone: 220, dec: 0.1, hp: 1800 } },
      clap: { i: 'clap', g: 0.3, rev: 0.25 },
      hat: { i: 'hat', g: 0.2, pan: 0.25 },
      ohat: { i: 'hat', g: 0.17, pan: 0.25, o: { open: true, dec: 0.16 } },
      crash: { i: 'crash', g: 0.22, pan: -0.3, rev: 0.2 },
      tom: { i: 'tom', g: 0.4, rev: 0.2 },
      tuba: { i: 'tuba', g: 0.62, duck: 0.2, rev: 0.12 },
      acc: { i: 'reed', g: 0.34, pan: -0.3, rev: 0.18, trem: { rate: 6.2, depth: 0.12 } },
      accL: { i: 'reed', g: 0.34, pan: -0.14, rev: 0.2, dly: 0.08, trem: { rate: 5.5, depth: 0.1 } },
      clar: { i: 'clar', g: 0.44, pan: 0.2, rev: 0.22, dly: 0.12 },
      glock: { i: 'bell', g: 0.18, pan: 0.36, rev: 0.25, o: { ratio: 3.5, idx: 1.1, dec: 0.8 } },
      sbass: { i: 'bass', g: 0.34, duck: 0.5, o: { wave: 'sawtooth', cut: 500, env: 1800, q: 6, gate: 0.6 } },
      lead: { i: 'plead', g: 0.24, pan: -0.1, dly: 0.2, rev: 0.15, o: { s: 0.4 } },
      hey: { i: 'hey', g: 0.38, rev: 0.3 },
      fx: { i: 'riser', g: 0.28, rev: 0.4 },
    },
    pat: {
      kP: 'x.......x.......', sP: '....x.......x...', hP: '....X.......X...', k4: 'X...X...X...X...', s4: '....X.......X...',
      o8: '..x...x...x...x.', h16: 'xoxoxoxoxoxoxoxo', cr: 'X...............', tomF: '.:8 C3 C3 A2 A2 F2 F2 C2:2',
      oF: 'F2:3 .:5 C2:3 .:5', oC: 'C2:3 .:5 G2:3 .:5', oBb: 'Bb1:3 .:5 F2:3 .:5', oEb: 'Eb2:3 .:5 Bb1:3 .:5',
      tF: 'F2:2 .:2 C2:2 .:2', tC: 'C2:2 .:2 G2:2 .:2', tBb: 'Bb1:2 .:2 F2:2 .:2',
      sbF: 'F2:2 F3:2 F2:2 F3:2', sbC: 'C2:2 C3:2 C2:2 C3:2', sbBb: 'Bb1:2 Bb2:2 Bb1:2 Bb2:2',
      pF: pah(CF), pC: pah(CC7), pBb: pah(CBb), pEb: pah(CEb), pF7: pah(CF7), pBb7: pah(CBb7),
      qF: pahT(CF), qC: pahT(CC7), qBb: pahT(CBb),
      A1: 'C5:2 A4:2 C5:2 F5:2 A5:4 G5:2 F5:2', A2: 'E5:2 F5:2 G5:2 A5:2 C5:8',
      A3: 'Bb4:2 G4:2 Bb4:2 E5:2 G5:4 F5:2 E5:2', A4: 'D5:2 E5:2 F5:2 G5:2 Bb4:8',
      A5: 'C5 D5 C5 Bb4 A4:2 G4:2 C5:4 E5:4', A6: 'G5:2 F5:2 E5:2 D5:2 C5:2 Bb4:2 G4:4',
      A7: 'A4:2 C5:2 F5:2 A5:2 G5 A5 G5 F5 E5:2 G5:2', A8: 'F5:4 C5:2 A4:2 F4:4 .:4',
      A11: 'D5:2 Bb4:2 D5:2 F5:2 Bb5:4 A5:2 G5:2', A12: 'F5:2 G5:2 F5:2 D5:2 Bb4:8',
      A13: 'C5:2 E5:2 G5:2 C6:2 Bb5:4 G5:2 E5:2', A14: 'F5:2 E5:2 D5:2 E5:2 G5:4 E5:4',
      A15: 'F5:2 A5:2 C6:4 A5:2 F5:2 G5:2 E5:2', A16: 'F5:4 A4:2 C5:2 F5:4 .:4',
      B1: 'D5:6 F5:2 Bb5:4 F5:4', B2: 'A5:6 G5:2 F5:4 C5:4', B3: 'E5:4 G5:4 Bb5:4 G5:4', B4: 'A5:2 G5:2 F5:2 E5:2 F5:8',
      B5: 'D5:6 F5:2 Bb5:4 D6:4', B6: 'C6:6 A5:2 F5:4 A5:4', B7: 'G5:2 A5:2 Bb5:2 G5:2 E5:2 G5:2 C5:4', B8: 'F5:8 .:8',
      cf1: '.:8 C6 A5 F5 C5 A4 C5 F5 A5', cf2: '.:8 C6 Bb5 A5 G5 F5 E5 D5 Db5',
      T1: 'D5:6 C5:2 Bb4:4 D5:4', T2: 'F5:8 D5:8', T3: 'C5:6 Bb4:2 A4:4 C5:4', T4: 'Eb5:8 C5:8',
      T5: 'Eb5:6 D5:2 C5:4 A4:4', T6: 'F4:4 A4:4 C5:4 Eb5:4', T7: 'D5:4 F5:4 Bb5:4 A5:2 G5:2', T8: 'F5:12 .:4',
      T10: 'F5:8 Ab5:8', T11: 'G5:6 F5:2 Eb5:4 G5:4', T12: 'Bb5:8 G5:8', T13: 'F5:6 D5:2 Bb4:4 D5:4',
      T14: 'C5:4 Eb5:4 A5:4 C6:4', T15: 'Bb5:4 F5:4 D5:4 C5:4', T16: 'Bb4:8 .:4 F4 G4 A4 C5',
      trill: rep('G5 A5', 8), clPick: '.:8 G4:2 A4:2 Bb4:2 B4:2', eTrill: rep('F5 G5', 16),
      hF: '.:12 A3+C4+F4!:4', hF2: '.:8 A3+C4+F4!:4 A3+C4+F4!:4',
      eAcc: `${CF}!:2 .:2 ${CF}!:2 .:2 ${CC7}!:2 .:2 ${CF}!:4 | ${CF}:32 | ${CF}!:4 .:12`,
      eTuba: 'F2!:2 .:2 F2!:2 .:2 C2!:2 .:2 F2!:4 | F2:32 | F2!:4 .:12',
      eClar: 'C6!:2 .:2 C6!:2 .:2 Bb5!:2 .:2 A5!:4',
      eHit: 'X...X...X...X...', eRoll: 'xxxxxxxxxxxxxxxx', eLast: 'X...............',
    },
    sec: {
      intro: { bars: 4, acc: [`${CC7}:32`, 'pC', 'pC'], clar: ['trill', 'trill', '_', 'clPick'], tuba: ['C2:32', 'oC', 'oC'], kick: ['_', '_', 'kP', 'kP'], snare: ['_', 'o.o.o.o.xxxxXXXX', 'sP', 'sP'], hat: ['_', '_', 'hP', 'hP'], crash: ['_', '_', 'cr', '_'] },
      A: { bars: 16, clar: PK_A, tuba: PK_H.map(oom), acc: PK_H.map(pahN), kick: 'kP', snare: 'sP', hat: 'hP', crash: ['cr', ...R(15)], glock: [...R(8), ...PK_A.slice(8)] },
      B: { bars: 8, accL: PK_B, tom: [...R(7), 'tomF'], clar: [...R(3), 'cf1', ...R(3), 'cf2'], tuba: PK_BH.map(oom), acc: PK_BH.map(pahN), kick: 'kP', snare: 'sP', hat: 'hP', crash: ['cr', ...R(7)] },
      A2: { bars: 8, clar: PK_A.slice(0, 8), glock: PK_A.slice(0, 8), accL: PK_A.slice(0, 8).map((p) => p + '@-12'), tuba: PK_H.slice(0, 8).map(oom), acc: PK_H.slice(0, 8).map(pahN), kick: 'kP', snare: 'sP', hat: 'hP', crash: ['cr', ...R(7)] },
      trio: { bars: 16, clar: PK_T, glock: [...R(8), ...PK_T.slice(8)], tuba: PK_TH.map(oom), acc: PK_TH.map(pahN), kick: 'kP', snare: 'sP', hat: 'hP', crash: ['cr', ...R(7)] },
      turbo1: { bars: 8, clar: PK_A.map((p) => p + '/2'), lead: PK_A.map((p) => p + '/2'), tuba: PK_H.map((h) => 't' + (h === 'Bb' ? 'Bb' : h)), acc: PK_H.map((h) => 'q' + h), sbass: PK_H.map((h) => 'sb' + h), kick: 'k4', clap: 's4', snare: 's4', ohat: 'o8', hat: 'h16', crash: ['cr', ...R(3)], hey: [...R(3), 'hF'] },
      turbo2: { bars: 8, accL: [...PK_B.map((p) => p + '/2'), ...PK_B.map((p) => p + '/2')], clar: [...R(4), ...PK_B.map((p) => p + '/2')], lead: [...R(4), ...PK_B.map((p) => p + '/2')], tuba: PK_BH.map((h) => 't' + h), acc: PK_BH.map((h) => 'q' + h), sbass: PK_BH.map((h) => 'sb' + h), kick: 'k4', clap: 's4', snare: 's4', ohat: 'o8', hat: 'h16', crash: ['cr', ...R(3)], hey: ['_', 'hF'] },
      brk: { bars: 4, tuba: ['tF', 'tF', 'tF', 'tF', 'tC', 'tC', 'tC', 'tC'], clap: ['....X.......X...', '..X...X...X...X.', 'X.X.X.X.X.X.X.X.', 'XXXXXXXXXXXXXXXX'], acc: [`${CF}:32`, `${CC7}:32`], fx: 'x:64', kick: ['kP', 'kP', 'k4', 'k4'], clar: ['_', '_', 'trill', 'trill'] },
      turboF: { bars: 8, clar: PK_A.map((p) => p + '/2'), lead: PK_A.map((p) => p + '/2'), glock: PK_A.map((p) => p + '/2'), accL: PK_A.map((p) => p + '@-12/2'), tuba: PK_H.map((h) => 't' + h), acc: PK_H.map((h) => 'q' + h), sbass: PK_H.map((h) => 'sb' + h), kick: 'k4', clap: 's4', snare: 's4', ohat: 'o8', hat: 'h16', crash: ['cr', '_'], hey: ['_', 'hF', '_', 'hF2'] },
      ending: { bars: 4, acc: 'eAcc', tuba: 'eTuba', clar: ['eClar', 'eTrill', 'F5!:4 .:12'], glock: [...R(3), 'F6:4 .:12'], kick: ['eHit', 'eLast', '_', 'eLast'], snare: ['eHit', 'eRoll', 'eRoll', '_'], crash: ['_', 'cr', '_', 'cr'] },
    },
    arr: ['intro', 'A', 'B', 'A2', 'trio', 'turbo1', 'turbo2', 'brk', 'turboF', 'ending'],
  };

  // ─────── 6. Luftballons über Kyoto (original NDW homage, 99-Luftballons spirit) ───────
  // Original D-minor synth-pop melody: driving bass, marching snare, anthemic
  // chip hook. Same era and energy as "99 Luftballons" (Nena, copyrighted) —
  // deliberately a new tune, not a quotation.
  const LB_V = ['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8'];
  const LB_C = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'];
  const LB_CH = ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'F', 'C'];
  const LUFTBALLON = {
    id: 'luftballon', title: 'Luftballons über Kyoto', bpm: 132,
    delay: { beats: 0.75, fb: 0.3 },
    ch: {
      kick: { i: 'kick', g: 0.8, sc: true, o: { f0: 150, f1: 50, dec: 0.3 } },
      snare: { i: 'snare', g: 0.5, rev: 0.4, o: { gate: 0.2, tone: 205, hp: 1000 } },
      clap: { i: 'clap', g: 0.26, pan: -0.05, rev: 0.3 },
      hat: { i: 'hat', g: 0.22, pan: 0.3 },
      ohat: { i: 'hat', g: 0.15, pan: 0.3, o: { open: true, dec: 0.2 } },
      crash: { i: 'crash', g: 0.24, pan: -0.26, rev: 0.25 },
      tom: { i: 'tom', g: 0.34, rev: 0.3, o: { syn: true, dec: 0.4 } },
      bass: { i: 'bass', g: 0.5, duck: 0.42, o: { wave: 'square', cut: 540, env: 1500, q: 4, fdec: 0.1, sub: 0.32, gate: 0.72 } },
      arp: { i: 'plead', g: 0.2, pan: -0.32, dly: 0.22, rev: 0.12, duck: 0.2, o: { cut: 560, fdec: 0.1 } },
      riff: { i: 'plead', g: 0.34, pan: 0.14, dly: 0.22, rev: 0.18, o: { cut: 800, s: 0.35 } },
      lead: { i: 'lead', g: 0.42, pan: 0.04, dly: 0.22, rev: 0.22, o: { cut: 1600, glide: true } },
      glock: { i: 'bell', g: 0.22, pan: 0.36, rev: 0.3, dly: 0.2, o: { ratio: 3.5, idx: 1.2, dec: 0.9 } },
      pad: { i: 'pad', g: 0.24, duck: 0.5, rev: 0.36 },
      brass: { i: 'brass', g: 0.28, pan: -0.18, rev: 0.2 },
      rev: { i: 'swell', g: 0.3, rev: 0.3 },
    },
    pat: {
      kL: 'X...X...X...X...', k2: 'X.......X.......',
      sL: '....X.......X...', sF: '....X.......X.XX', s16: 'x.x.x.x.xxxxXXXX',
      hL: 'x.X.x.X.x.X.x.X.', h16: 'xxXxxxXxxxXxxxXx', oh: '..x...x...x...x.', cr: 'X...............',
      tF: '.:8 D4 D4 A3 A3 F3 F3 D3:2',
      bDm: 'D2 D2 D3 D2 D2 D2 D3 D2 D2 D2 D3 D2 D2 D3 D2 D3',
      bBb: 'Bb1 Bb1 Bb2 Bb1 Bb1 Bb1 Bb2 Bb1 Bb1 Bb1 Bb2 Bb1 Bb1 Bb2 Bb1 Bb2',
      bF: 'F2 F2 F3 F2 F2 F2 F3 F2 F2 F2 F3 F2 F2 F3 F2 F3',
      bC: 'C2 C2 C3 C2 C2 C2 C3 C2 C2 C2 C3 C2 C2 C3 C2 C3',
      bA: 'A1 A1 A2 A1 A1 A1 A2 A1 A1 A1 A2 A1 A1 A2 A1 A2',
      aDm: arp16('D4 F4 A4 D5'), aBb: arp16('D4 F4 Bb4 D5'), aF: arp16('C4 F4 A4 C5'), aC: arp16('C4 E4 G4 C5'), aA: arp16('A3 C#4 E4 A4'),
      r1: 'D5 . A4 . D5 F5 . E5 . D5 . A4 C5 . D5 .',
      r2: 'D5 . Bb4 . D5 F5 . E5 . D5 . Bb4 C5 . D5 .',
      r3: 'C5 . A4 . C5 F5 . E5 . C5 . A4 G4 . A4 .',
      r4: 'D5 . C5 . Bb4 . A4 . G4 . F4 . E4 . D4 .',
      v1: 'A4:2 A4 . D5:2 A4:2 G4 . F4:2 E4:2 F4:2',
      v2: 'A4:2 A4:2 D5:2 E5:2 F5:2 E5:2 D5:4',
      v3: 'D5:2 D5:2 F5:2 D5:2 C5:2 Bb4:2 A4:2 Bb4:2',
      v4: 'C5:2 C5:2 E5:2 G5:2 F5:2 E5:2 C5:4',
      v5: 'D5:2 F5:2 A5:2 G5:2 F5:2 E5:2 D5:4',
      v6: 'E5:2 D5:2 C5:2 D5:2 E5:2 F5:2 E5:4',
      v7: 'F5:2 E5:2 D5:2 C5:2 D5:2 C5:2 Bb4:4',
      v8: 'A4:4 G4:2 A4:2 Bb4:4 A4:4',
      p1: 'A4:2 B4:2 C5:2 D5:2 E5:4 D5:4',
      p2: 'D5:2 E5:2 F5:2 G5:2 A5:4 G5:4',
      p3: 'A5:2 B5:2 C6:2 B5:2 A5:4 G5:4',
      p4: 'B5:2 C6:2 D6:2 C6:2 B5:8',
      c1: 'E5:2 E5:2 D5:2 C5:2 D5:4 E5:4',
      c2: 'C5:2 D5:2 E5:2 F5:2 E5:4 C5:4',
      c3: 'D5:2 E5:2 F5:2 G5:2 F5:4 E5:4',
      c4: 'A5:4 G5:2 E5:2 D5:4 C5:4',
      c5: 'E5:2 F5:2 G5:2 A5:2 G5:4 F5:4',
      c6: 'E5:2 D5:2 C5:2 B4:2 A4:4 E5:4',
      c7: 'F5:2 E5:2 D5:2 C5:2 B4:4 G4:4',
      c8: 'D5:8 C5:4 A4:4',
      b1: 'A4:8 G4:8', b2: 'F4:8 E4:8', b3: 'D4:8 C4:8', b4: 'Bb3:8 A3:8',
      b5: 'A4:4 G4:4 F4:4 E4:4', b6: 'D4:4 E4:4 F4:4 G4:4', b7: 'A4:8 G4:4 F4:4', b8: 'E4:12 D4:4',
      pDm: 'D3+F3+A3:16', pBb: 'Bb2+D3+F3:16', pF: 'F2+A2+C3:16', pC: 'C3+E3+G3:16', pA: 'A2+C#3+E3:16',
      oDm: offb('D4+F4+A4'), oBb: offb('Bb3+D3+F3'), oF: offb('C4+F4+A4'), oC: offb('C4+E4+G4'),
    },
    sec: {
      intro: { bars: 8, arp: ['aDm', 'aBb', 'aF', 'aC', 'aDm', 'aBb', 'aF', 'aC'], kick: [...R(4), 'kL', 'kL', 'kL', 'kL'], snare: [...R(4), 'sL', 'sL', 'sL', 'sL'], hat: [...R(4), 'hL', 'hL', 'hL', 'hL'], bass: [...R(4), 'bDm', 'bBb', 'bF', 'bC'], glock: [...R(4), 'v1', 'v2', 'v3', 'v4'], crash: [...R(7), 'cr'] },
      verse1: { bars: 8, kick: 'kL', snare: [...cyc(['sL'], 7), 'sF'], hat: 'hL', bass: ['bDm', 'bBb', 'bF', 'bC', 'bDm', 'bBb', 'bF', 'bC'], arp: ['aDm', 'aBb', 'aF', 'aC', 'aDm', 'aBb', 'aF', 'aC'], lead: LB_V, crash: ['cr', ...R(7)] },
      pre1: { bars: 4, kick: 'kL', snare: ['sL', 'sL', 'sL', 's16'], hat: 'h16', bass: ['bDm', 'bBb', 'bF', 'bA'], pad: ['pDm', 'pBb', 'pF', 'pA'], lead: ['p1', 'p2', 'p3', 'p4'], rev: [...R(3), 'x:16'], tom: [...R(3), 'tF'] },
      chorus1: { bars: 8, kick: 'kL', snare: 'sL', clap: 'sL', hat: 'hL', ohat: 'oh', crash: ['cr', ...R(7)], bass: ['bDm', 'bBb', 'bF', 'bC', 'bDm', 'bBb', 'bF', 'bC'], arp: ['aDm', 'aBb', 'aF', 'aC', 'aDm', 'aBb', 'aF', 'aC'], pad: ['pDm', 'pBb', 'pF', 'pC', 'pDm', 'pBb', 'pF', 'pC'], lead: LB_C, glock: LB_C, brass: ['oDm', 'oBb', 'oF', 'oC', 'oDm', 'oBb', 'oF', 'oC'] },
      riff: { bars: 4, kick: 'kL', snare: ['sL', 'sL', 'sL', 'sF'], hat: 'hL', ohat: 'oh', crash: ['cr', ...R(3)], bass: ['bDm', 'bBb', 'bF', 'bC'], arp: ['aDm', 'aBb', 'aF', 'aC'], riff: ['r1', 'r2', 'r3', 'r4'], tom: [...R(3), 'tF'] },
      verse2: { bars: 8, kick: 'kL', snare: [...cyc(['sL'], 7), 'sF'], hat: 'hL', ohat: 'oh', bass: ['bDm', 'bBb', 'bF', 'bC', 'bDm', 'bBb', 'bF', 'bC'], arp: ['aDm', 'aBb', 'aF', 'aC', 'aDm', 'aBb', 'aF', 'aC'], lead: LB_V, brass: ['oDm', 'oBb', 'oF', 'oC', 'oDm', 'oBb', 'oF', 'oC'], crash: ['cr', ...R(7)] },
      chorus2: { bars: 8, kick: 'kL', snare: 'sL', clap: 'sL', hat: 'h16', ohat: 'oh', crash: ['cr', ...R(7)], bass: ['bDm', 'bBb', 'bF', 'bC', 'bDm', 'bBb', 'bF', 'bC'], arp: ['aDm', 'aBb', 'aF', 'aC', 'aDm', 'aBb', 'aF', 'aC'], pad: ['pDm', 'pBb', 'pF', 'pC', 'pDm', 'pBb', 'pF', 'pC'], lead: LB_C, glock: LB_C, brass: ['oDm', 'oBb', 'oF', 'oC', 'oDm', 'oBb', 'oF', 'oC'] },
      bridge: { bars: 8, kick: [...R(4), 'kL', 'kL', 'kL', 'kL'], snare: [...R(4), 'sL', 'sL', 'sL', 'sF'], hat: [...R(4), 'hL', 'hL', 'hL', 'hL'], bass: ['bDm', 'bDm', 'bBb', 'bBb', 'bF', 'bF', 'bC', 'bA'], lead: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8'], pad: ['pDm', 'pDm', 'pBb', 'pBb', 'pF', 'pF', 'pC', 'pA'], rev: [...R(7), 'x:16'] },
      chorus3: { bars: 8, kick: 'kL', snare: 'sL', clap: 'sL', hat: 'h16', ohat: 'oh', crash: ['cr', ...R(7)], bass: ['bDm', 'bBb', 'bF', 'bC', 'bDm', 'bBb', 'bF', 'bC'], arp: ['aDm', 'aBb', 'aF', 'aC', 'aDm', 'aBb', 'aF', 'aC'], pad: ['pDm', 'pBb', 'pF', 'pC', 'pDm', 'pBb', 'pF', 'pC'], lead: LB_C, glock: LB_C.map((p) => p + '@+12'), brass: ['oDm', 'oBb', 'oF', 'oC', 'oDm', 'oBb', 'oF', 'oC'] },
      outro: { bars: 8, kick: ['kL', 'kL', 'kL', 'kL', ...R(4)], snare: ['sL', 'sL', 'sL', 'sF', ...R(4)], hat: ['hL', 'hL', 'hL', 'hL', ...R(4)], crash: ['cr', ...R(7)], bass: ['bDm', 'bBb', 'bF', 'bC', ...R(4)], arp: ['aDm', 'aBb', 'aF', 'aC', ...R(4)], lead: ['c1', 'c2', 'c7', 'c8', ...R(4)], pad: ['pDm', 'pBb', 'pF', 'pC', ...R(4)], glock: [...R(4)], brass: [...R(8)], rev: [...R(8)], tom: [...R(8)], riff: [...R(8)], clap: [...R(8)], ohat: [...R(8)] },
    },
    arr: ['intro', 'verse1', 'pre1', 'chorus1', 'riff', 'verse2', 'chorus2', 'bridge', 'chorus3', 'outro'],
  };

  // ─────── 7. Amerika Stahl (original industrial march, Amerika spirit) ───────
  // Original E-minor stomp: half-time kick, marching snare, distorted power
  // chords, chant stabs. Same stadium-march energy as "Amerika" (Rammstein,
  // copyrighted) — new riff, new chant, no quotation.
  const AM_V = ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8'];
  const AM_C = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8'];
  const AMERIKA = {
    id: 'amerika', title: 'Amerika Stahl', bpm: 100,
    delay: { beats: 0.5, fb: 0.28 },
    ch: {
      kick: { i: 'kick', g: 0.85, sc: true, o: { f0: 120, f1: 42, dec: 0.4, click: 0.5 } },
      snare: { i: 'snare', g: 0.55, rev: 0.3, o: { tone: 180, hp: 1100, dec: 0.22 } },
      hat: { i: 'hat', g: 0.2, pan: 0.3 },
      crash: { i: 'crash', g: 0.28, pan: -0.3, rev: 0.25 },
      tom: { i: 'tom', g: 0.5, rev: 0.2 },
      gtr: { i: 'dist', g: 0.85, fx: 'dist', twin: { pan: 0.75, det: 9, lag: 0.007 }, o: { drive: 9, post: 0.15 } },
      bass: { i: 'bass', g: 0.45, duck: 0.35, o: { wave: 'sawtooth', cut: 300, env: 900, q: 3, sub: 0.5 } },
      pad: { i: 'pad', g: 0.26, duck: 0.5, rev: 0.45, o: { cut: 1100 } },
      lead: { i: 'lead', g: 0.4, pan: 0.1, rev: 0.25, dly: 0.22, o: { cut: 1000, env: 2200, glide: true } },
      chant: { i: 'brass', g: 0.4, pan: -0.1, rev: 0.22 },
      bell: { i: 'bell', g: 0.22, pan: -0.3, rev: 0.35, dly: 0.2, o: { ratio: 3.5, idx: 1.4, dec: 1.4 } },
      hey: { i: 'hey', g: 0.4, rev: 0.3 },
      fx: { i: 'riser', g: 0.3, rev: 0.4 },
    },
    pat: {
      kM: 'X...X...X...X...', kD: 'X.X.X.X.X.X.X.X.', kH: 'X.......X.......',
      sM: '....X.......X...', sR: 'xxxxxxxxxxxxxxxx', sH: '........X.......',
      hM: 'x.x.x.x.x.x.x.x.', cr: 'X...............',
      tM: '.:8 E3 E3 C3 C3 A2 A2 E2:2',
      gE: 'E2,:2 .:6 E2, E2, .:6', gC: 'C2,:2 .:6 C2, C2, .:6', gD: 'D2,:2 .:6 D2, D2, .:6',
      gG: 'G2,:2 .:6 G2, G2, .:6', gB: 'B1,:2 .:6 B1, B1, .:6', gA: 'A1,:2 .:6 A1, A1, .:6',
      bE: 'E2:4 E2:4 E2:4 E2:4', bC: 'C2:4 C2:4 C2:4 C2:4', bD: 'D2:4 D2:4 D2:4 D2:4',
      bG: 'G2:4 G2:4 G2:4 G2:4', bA: 'A1:4 A1:4 A1:4 A1:4', bB: 'B1:4 B1:4 B1:4 B1:4',
      w1: 'E3:2 E3:2 . E3 . E3:2 . E3:2 E3:4',
      w2: 'G3:2 G3:2 . G3 . G3:2 . A3:2 G3:4',
      w3: 'A3:2 A3:2 . A3 . A3:2 . B3:2 A3:4',
      w4: 'G3:2 F#3:2 E3:2 D3:2 E3:8',
      w5: 'E3:2 E3:2 . E3 . G3:2 . B3:2 A3:4',
      w6: 'G3:2 A3:2 B3:2 C4:2 D4:2 C4:2 B3:4',
      w7: 'A3:2 B3:2 C4:2 B3:2 A3:2 G3:2 F#3:4',
      w8: 'E3:8 .:8',
      m1: 'E4:4 G4:4 B4:4 E5:4',
      m2: 'E5:4 D5:4 B4:8',
      m3: 'C5:4 E5:4 G5:4 E5:4',
      m4: 'D5:4 C5:4 B4:8',
      m5: 'G4:4 B4:4 D5:4 G5:4',
      m6: 'A5:4 G5:4 F#5:8',
      m7: 'F#5:4 E5:4 D5:4 B4:4',
      m8: 'E5:8 B4:8',
      hE: '.:4 E3!:4 E3!:4 .:4', hE2: 'E3!:2 E3!:2 .:4 E3!:4 .:4',
      qEm: 'E3+G3+B3+E4!:4 .:4 E3+G3+B3+E4!:4 .:4',
      qC: 'C3+E3+G3+C4!:4 .:4 C3+E3+G3+C4!:4 .:4',
      qG: 'G2+B2+D3+G4!:4 .:4 G2+B2+D3+G4!:4 .:4',
      qD: 'D3+F#3+A3+D4!:4 .:4 D3+F#3+A3+D4!:4 .:4',
      pEm: 'E3+G3+B3:16', pC: 'C3+E3+G3:16', pG: 'G2+B2+D3:16', pD: 'D3+F#3+A3:16', pAm: 'A2+C3+E3:16', pB: 'B2+D#3+F#3:16',
    },
    sec: {
      intro: { bars: 4, kick: ['kH', 'kH', 'kH', 'kH'], snare: ['sH', 'sH', 'sH', 'sH'], hat: [...R(2), 'hM', 'hM'], pad: ['pEm', 'pEm', 'pEm', 'pEm'], gtr: ['gE', 'gE', 'gE', 'gE'], bass: ['bE', 'bE', 'bE', 'bE'], fx: ['x:32', '_', '_', '_'] },
      riff: { bars: 8, kick: 'kM', snare: 'sM', hat: 'hM', crash: ['cr', ...R(7)], gtr: ['gE', 'gE', 'gC', 'gD', 'gE', 'gE', 'gB', 'gE'], bass: ['bE', 'bE', 'bC', 'bD', 'bE', 'bE', 'bB', 'bE'], pad: ['pEm', 'pEm', 'pC', 'pD', 'pEm', 'pEm', 'pB', 'pEm'] },
      verse: { bars: 8, kick: 'kM', snare: 'sM', hat: 'hM', gtr: ['gE', '_', 'gE', '_', 'gC', '_', 'gD', '_'], bass: ['bE', '_', 'bE', '_', 'bC', '_', 'bD', '_'], lead: AM_V, pad: ['pEm', 'pEm', 'pEm', 'pEm', 'pC', 'pC', 'pD', 'pD'], crash: ['cr', ...R(7)], tom: [...R(7), 'tM'] },
      pre: { bars: 4, kick: 'kD', snare: ['sM', 'sM', 'sM', 'sR'], hat: 'hM', gtr: ['gA', 'gA', 'gB', 'gB'], bass: ['bA', 'bA', 'bB', 'bB'], pad: ['pAm', 'pAm', 'pB', 'pB'], hey: ['hE', 'hE', 'hE2', 'hE2'], fx: [...R(3), 'x:16'], crash: [...R(3), 'cr'] },
      chorus: { bars: 8, kick: 'kD', snare: 'sM', hat: 'hM', crash: ['cr', ...R(7)], gtr: ['gE', 'gE', 'gC', 'gC', 'gG', 'gG', 'gD', 'gD'], bass: ['bE', 'bE', 'bC', 'bC', 'bG', 'bG', 'bD', 'bD'], pad: ['pEm', 'pEm', 'pC', 'pC', 'pG', 'pG', 'pD', 'pD'], lead: AM_C, chant: ['qEm', 'qEm', 'qC', 'qC', 'qG', 'qG', 'qD', 'qD'], bell: ['m1@+12', 'm2@+12', 'm3@+12', 'm4@+12', 'm5@+12', 'm6@+12', 'm7@+12', 'm8@+12'] },
      riff2: { bars: 4, kick: 'kM', snare: ['sM', 'sM', 'sM', 'sR'], hat: 'hM', gtr: ['gE', 'gC', 'gD', 'gE'], bass: ['bE', 'bC', 'bD', 'bE'], pad: ['pEm', 'pC', 'pD', 'pEm'], crash: ['cr', ...R(3)], tom: [...R(3), 'tM'] },
      verse2: { bars: 8, kick: 'kM', snare: 'sM', hat: 'hM', gtr: ['gE', '_', 'gE', '_', 'gC', '_', 'gD', '_'], bass: ['bE', '_', 'bE', '_', 'bC', '_', 'bD', '_'], lead: AM_V, pad: ['pEm', 'pEm', 'pEm', 'pEm', 'pC', 'pC', 'pD', 'pD'], bell: ['w1@+12', 'w2@+12', 'w3@+12', 'w4@+12', 'w5@+12', 'w6@+12', 'w7@+12', 'w8@+12'], crash: ['cr', ...R(7)] },
      chorus2: { bars: 8, kick: 'kD', snare: 'sM', hat: 'hM', crash: ['cr', ...R(7)], gtr: ['gE', 'gE', 'gC', 'gC', 'gG', 'gG', 'gD', 'gB'], bass: ['bE', 'bE', 'bC', 'bC', 'bG', 'bG', 'bD', 'bB'], pad: ['pEm', 'pEm', 'pC', 'pC', 'pG', 'pG', 'pD', 'pB'], lead: AM_C, chant: ['qEm', 'qEm', 'qC', 'qC', 'qG', 'qG', 'qD', 'qD'], bell: ['m1@+12', 'm2@+12', 'm3@+12', 'm4@+12', 'm5@+12', 'm6@+12', 'm7@+12', 'm8@+12'] },
      brk: { bars: 4, kick: ['kH', 'kH', 'kH', 'kH'], snare: ['sH', 'sH', 'sH', 'sR'], tom: ['tM', 'tM', 'tM', 'tM'], chant: ['hE', 'hE', 'hE2', 'hE2'], pad: ['pEm', 'pEm', 'pC', 'pD'], crash: [...R(3), 'cr'] },
      final: { bars: 8, kick: 'kD', snare: 'sM', hat: 'hM', crash: ['cr', ...R(7)], gtr: ['gE', 'gE', 'gC', 'gC', 'gG', 'gG', 'gD', 'gD'], bass: ['bE', 'bE', 'bC', 'bC', 'bG', 'bG', 'bD', 'bD'], pad: ['pEm', 'pEm', 'pC', 'pC', 'pG', 'pG', 'pD', 'pD'], lead: AM_C, chant: ['qEm', 'qEm', 'qC', 'qC', 'qG', 'qG', 'qD', 'qD'], bell: ['m1@+12', 'm2@+12', 'm3@+12', 'm4@+12', 'm5@+12', 'm6@+12', 'm7@+12', 'm8@+12'], hey: [...R(7), 'hE2'] },
      outro: { bars: 4, kick: ['kM', 'kM', 'kM', 'kH'], snare: ['sM', 'sM', 'sM', 'sH'], crash: ['cr', '_', '_', 'cr'], gtr: ['gE', 'gE', 'gE', 'gE'], bass: ['bE', 'bE', 'bE', 'bE'], pad: ['pEm', 'pEm', 'pEm', 'pEm'], lead: ['m1', 'm2', 'm7', 'm8'] },
    },
    arr: ['intro', 'riff', 'verse', 'pre', 'chorus', 'riff2', 'verse2', 'chorus2', 'brk', 'final', 'outro'],
  };

  // ─────── 8. Blumen im Kopf (original flower ballad, dreamy German pop) ───────
  // Original G-major melody for the "flowers in your head" request: soft plucked
  // arps, accordion counter-line, glockenspiel chorus. New tune, flower-power mood.
  const BL_V = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8'];
  const BL_C = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8'];
  const BLUMEN = {
    id: 'blumen', title: 'Blumen im Kopf', bpm: 96,
    delay: { beats: 0.75, fb: 0.3 },
    ch: {
      kick: { i: 'kick', g: 0.55, o: { f0: 120, f1: 50, dec: 0.3, click: 0.1 } },
      snare: { i: 'snare', g: 0.3, rev: 0.3, o: { tone: 200, dec: 0.12, hp: 1800 } },
      shaker: { i: 'shaker', g: 0.2, pan: 0.35 },
      hat: { i: 'hat', g: 0.14, pan: 0.3 },
      crash: { i: 'crash', g: 0.2, pan: -0.3, rev: 0.35 },
      gtr: { i: 'pluck', g: 0.55, pan: -0.25, rev: 0.2, dly: 0.12, o: { bright: 0.6, decay: 1.8 } },
      gtr2: { i: 'pluck', g: 0.35, pan: 0.28, rev: 0.25, dly: 0.15, o: { bright: 0.75, decay: 1.4 } },
      acc: { i: 'reed', g: 0.32, pan: -0.1, rev: 0.2, trem: { rate: 5.5, depth: 0.1 } },
      clar: { i: 'clar', g: 0.4, pan: 0.12, rev: 0.25, dly: 0.12 },
      bass: { i: 'bass', g: 0.5, duck: 0.3, o: { wave: 'triangle', cut: 900, env: 600, q: 1, sub: 0.4, gate: 0.8 } },
      bell: { i: 'bell', g: 0.2, pan: -0.3, rev: 0.35, o: { ratio: 3.5, idx: 1, dec: 1 } },
      pad: { i: 'pad', g: 0.22, duck: 0.4, rev: 0.4, o: { cut: 1200 } },
      rev: { i: 'swell', g: 0.28, rev: 0.3 },
    },
    pat: {
      kS: 'X.......X.......', sS: '........X.......', sh: 'x.x.x.x.x.x.x.x.', hS: '..x...x...x...x.', cr: 'X...............',
      pG: 'G3:2 B3:2 D4:2 G4:2 D4:2 B3:2 D4:2 G4:2',
      pEm: 'E3:2 G3:2 B3:2 E4:2 B3:2 G3:2 B3:2 E4:2',
      pC: 'C3:2 E3:2 G3:2 C4:2 G3:2 E3:2 G3:2 C4:2',
      pD: 'D3:2 F#3:2 A3:2 D4:2 A3:2 F#3:2 A3:2 D4:2',
      pAm: 'A2:2 C3:2 E3:2 A3:2 E3:2 C3:2 E3:2 A3:2',
      f1: 'D5:4 G5:4 B5:4 A5:4',
      f2: 'G5:4 E5:4 D5:8',
      f3: 'C5:4 E5:4 G5:4 E5:4',
      f4: 'D5:4 F#5:4 A5:8',
      f5: 'B4:4 D5:4 G5:4 F#5:4',
      f6: 'E5:4 D5:4 B4:8',
      f7: 'C5:4 D5:4 E5:4 F#5:4',
      f8: 'G5:6 D5:2 G4:8',
      g1: 'G5:4 B5:4 D6:4 B5:4',
      g2: 'A5:4 G5:4 E5:8',
      g3: 'E5:4 G5:4 A5:4 C6:4',
      g4: 'B5:4 A5:4 G5:8',
      g5: 'D6:4 C6:4 B5:4 A5:4',
      g6: 'G5:4 E5:4 D5:8',
      g7: 'E5:4 F#5:4 G5:4 A5:4',
      g8: 'B5:6 A5:2 G5:8',
      a1: 'G4:8 D5:8', a2: 'E5:8 C5:8', a3: 'E5:8 G5:8', a4: 'D5:8 A4:8',
      a5: 'B4:8 G4:8', a6: 'A4:8 E4:8', a7: 'G4:8 E4:8', a8: 'G4:16',
      e1: 'E5:4 G5:4 B5:8', e2: 'A5:4 G5:4 E5:8', e3: 'D5:4 E5:4 G5:4 A5:4', e4: 'A5:4 G5:4 E5:4 D5:4',
      wG: 'G3+B3+D4:16', wEm: 'E3+G3+B3:16', wC: 'C3+E3+G3:16', wD: 'D3+F#3+A3:16',
      tG: 'G2:8 D3:8', tEm: 'E2:8 B2:8', tC: 'C2:8 G2:8', tD: 'D2:8 A2:8',
    },
    sec: {
      intro: { bars: 4, gtr: ['pG', 'pEm', 'pC', 'pD'], gtr2: ['pG', 'pEm', 'pC', 'pD'], bell: [...R(2), 'f1', 'f2'], shaker: [...R(2), 'sh', 'sh'], pad: ['wG', 'wEm', 'wC', 'wD'], crash: [...R(3), 'cr'] },
      verse1: { bars: 8, kick: 'kS', snare: 'sS', shaker: 'sh', hat: 'hS', gtr: ['pG', 'pEm', 'pC', 'pD', 'pG', 'pEm', 'pC', 'pD'], clar: BL_V, acc: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'], bass: ['tG', 'tEm', 'tC', 'tD', 'tG', 'tEm', 'tC', 'tD'], pad: ['wG', 'wEm', 'wC', 'wD', 'wG', 'wEm', 'wC', 'wD'], crash: ['cr', ...R(7)] },
      chorus1: { bars: 8, kick: 'kS', snare: 'sS', shaker: 'sh', hat: 'hS', crash: ['cr', ...R(7)], gtr: ['pG', 'pEm', 'pC', 'pG', 'pD', 'pEm', 'pD', 'pG'], clar: BL_C, bell: BL_C, acc: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'], bass: ['tG', 'tEm', 'tC', 'tG', 'tD', 'tEm', 'tD', 'tG'], pad: ['wG', 'wEm', 'wC', 'wG', 'wD', 'wEm', 'wD', 'wG'] },
      verse2: { bars: 8, kick: 'kS', snare: 'sS', shaker: 'sh', hat: 'hS', gtr: ['pG', 'pEm', 'pC', 'pD', 'pG', 'pEm', 'pC', 'pD'], clar: BL_V, acc: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'], bell: BL_V, bass: ['tG', 'tEm', 'tC', 'tD', 'tG', 'tEm', 'tC', 'tD'], pad: ['wG', 'wEm', 'wC', 'wD', 'wG', 'wEm', 'wC', 'wD'], crash: ['cr', ...R(7)] },
      chorus2: { bars: 8, kick: 'kS', snare: 'sS', shaker: 'sh', hat: 'hS', crash: ['cr', ...R(7)], gtr: ['pG', 'pEm', 'pC', 'pG', 'pD', 'pEm', 'pD', 'pG'], clar: BL_C, bell: BL_C, acc: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'], bass: ['tG', 'tEm', 'tC', 'tG', 'tD', 'tEm', 'tD', 'tG'], pad: ['wG', 'wEm', 'wC', 'wG', 'wD', 'wEm', 'wD', 'wG'] },
      brk: { bars: 4, kick: [...R(2), 'kS', 'kS'], snare: [...R(4)], gtr: ['pEm', 'pEm', 'pC', 'pD'], clar: ['e1', 'e2', 'e3', 'e4'], pad: ['wEm', 'wEm', 'wC', 'wD'], bell: [...R(2), 'e3', 'e4'], rev: [...R(3), 'x:16'] },
      chorus3: { bars: 8, kick: 'kS', snare: 'sS', shaker: 'sh', hat: 'hS', crash: ['cr', ...R(7)], gtr: ['pG', 'pEm', 'pC', 'pG', 'pD', 'pEm', 'pD', 'pG'], clar: BL_C, bell: BL_C.map((p) => p + '@+12'), acc: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'], bass: ['tG', 'tEm', 'tC', 'tG', 'tD', 'tEm', 'tD', 'tG'], pad: ['wG', 'wEm', 'wC', 'wG', 'wD', 'wEm', 'wD', 'wG'] },
      outro: { bars: 8, kick: ['kS', 'kS', 'kS', 'kS', ...R(4)], snare: ['sS', 'sS', 'sS', 'sS', ...R(4)], gtr: ['pG', 'pEm', 'pC', 'pD', ...R(4)], clar: ['f1', 'f2', 'f7', 'f8', ...R(4)], pad: ['wG', 'wEm', 'wC', 'wD', ...R(4)], bell: [...R(6), 'B5:8', 'G5:8'], crash: ['cr', ...R(7)] },
    },
    arr: ['intro', 'verse1', 'chorus1', 'verse2', 'chorus2', 'brk', 'chorus3', 'outro'],
  };

  // ─────── 9. Heimat Melodie (public-domain German classics) ───────
  // Famous German tunes, all public domain: "Ode an die Freude" (Beethoven,
  // 9th Symphony, 1824), "Bruder Jakob" (traditional round) and "Alle meine
  // Entchen" (traditional German children's song). Arranged as an alpine
  // brass march with glockenspiel, accordion and tuba.
  const ODE = ['o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7', 'o8'];
  const ODE_H = ['C', 'G', 'C', 'G', 'C', 'G', 'C', 'C'];
  const JAK = ['j1', 'j2', 'j3', 'j4', 'j5', 'j6', 'j7', 'j8'];
  const JAK_H = ['C', 'C', 'F', 'F', 'C', 'C', 'G', 'C'];
  const ENT = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8'];
  const ENT_H = ['C', 'G', 'F', 'C', 'F', 'C', 'G', 'C'];
  const HEIMAT = {
    id: 'heimat', title: 'Heimat Melodie (Freude · Jakob · Entchen)', bpm: 120,
    delay: { beats: 0.5, fb: 0.25 },
    ch: {
      kick: { i: 'kick', g: 0.7, sc: true, o: { f0: 120, f1: 55, dec: 0.25, click: 0.2 } },
      snare: { i: 'snare', g: 0.4, pan: 0.1, rev: 0.18, o: { tone: 220, dec: 0.12, hp: 1800 } },
      hat: { i: 'hat', g: 0.18, pan: 0.25 },
      crash: { i: 'crash', g: 0.24, pan: -0.3, rev: 0.25 },
      tuba: { i: 'tuba', g: 0.6, duck: 0.2, rev: 0.1 },
      horn: { i: 'brass', g: 0.36, pan: -0.1, rev: 0.2 },
      brass: { i: 'brass', g: 0.26, pan: -0.25, rev: 0.22 },
      glock: { i: 'bell', g: 0.22, pan: 0.36, rev: 0.28, o: { ratio: 3.5, idx: 1.1, dec: 0.8 } },
      pic: { i: 'whistle', g: 0.26, pan: 0.28, rev: 0.22 },
      acc: { i: 'reed', g: 0.32, pan: -0.2, rev: 0.2, trem: { rate: 6, depth: 0.1 } },
      clar: { i: 'clar', g: 0.4, pan: 0.15, rev: 0.22 },
      pad: { i: 'pad', g: 0.2, duck: 0.4, rev: 0.4, o: { cut: 1400 } },
    },
    pat: {
      kM: 'X...X...X...X...', sM: '....X.......X...', sR: 'xxxxxxxxxxxxxxxx', hM: 'x.x.x.x.x.x.x.x.', cr: 'X...............',
      o1: 'E4:4 E4:4 F4:4 G4:4', o2: 'G4:4 F4:4 E4:4 D4:4', o3: 'C4:4 C4:4 D4:4 E4:4', o4: 'E4:6 D4:2 D4:8',
      o5: 'E4:4 E4:4 F4:4 G4:4', o6: 'G4:4 F4:4 E4:4 D4:4', o7: 'C4:4 C4:4 D4:4 E4:4', o8: 'D4:6 C4:2 C4:8',
      j1: 'C4:4 D4:4 E4:4 C4:4', j2: 'C4:4 D4:4 E4:4 C4:4', j3: 'E4:4 F4:4 G4:8', j4: 'E4:4 F4:4 G4:8',
      j5: 'G4:2 A4:2 G4:2 F4:2 E4:4 C4:4', j6: 'G4:2 A4:2 G4:2 F4:2 E4:4 C4:4', j7: 'C4:4 G3:4 C4:8', j8: 'C4:4 G3:4 C4:8',
      e1: 'C4:4 D4:4 E4:4 F4:4', e2: 'G4:8 G4:8', e3: 'A4:8 A4:8', e4: 'G4:8 G4:8',
      e5: 'F4:8 F4:8', e6: 'E4:8 E4:8', e7: 'D4:8 D4:8', e8: 'C4:16',
      sC: 'C3+E3+G3:16', sG: 'G3+B3+D4:16', sF: 'F3+A3+C4:16',
      tC: 'C2:4 G2:4 C2:4 G2:4', tG: 'G1:4 D2:4 G1:4 D2:4', tF: 'F2:4 C3:4 F2:4 C3:4',
      obC: offb('C4+E4+G4'), obG: offb('G3+B3+D4'), obF: offb('F3+A3+C4'),
      cd1: 'C5:8 G4:8', cd2: 'C5:8 G4:8', cd3: 'F5:8 E5:8', cd4: 'D5:8 C5:8', cd5: 'C5:16',
    },
    sec: {
      intro: { bars: 4, glock: ['o1@+12', 'o2@+12', 'o3@+12', 'o4@+12'], pad: ['sC', 'sG', 'sC', 'sG'], tuba: ['tC', 'tG', 'tC', 'tG'], snare: [...R(3), 'sR'], crash: [...R(3), 'cr'] },
      ode1: { bars: 8, horn: ODE, tuba: ODE_H.map((h) => 't' + h), pad: ODE_H.map((h) => 's' + h), kick: 'kM', snare: 'sM', hat: 'hM', crash: ['cr', ...R(7)] },
      ode2: { bars: 8, horn: ODE, pic: ODE.map((p) => p + '@+12'), glock: [...R(4), 'o5@+12', 'o6@+12', 'o7@+12', 'o8@+12'], tuba: ODE_H.map((h) => 't' + h), pad: ODE_H.map((h) => 's' + h), brass: ODE_H.map((h) => 'ob' + h), kick: 'kM', snare: 'sM', hat: 'hM', crash: ['cr', ...R(7)] },
      jak1: { bars: 8, clar: JAK, tuba: JAK_H.map((h) => 't' + h), pad: JAK_H.map((h) => 's' + h), kick: 'kM', snare: 'sM', hat: 'hM', crash: ['cr', ...R(7)] },
      jak2: { bars: 8, clar: JAK, pic: ['_', '_', 'j1@+12', 'j2@+12', 'j3@+12', 'j4@+12', 'j5@+12', 'j6@+12'], glock: JAK, tuba: JAK_H.map((h) => 't' + h), pad: JAK_H.map((h) => 's' + h), brass: JAK_H.map((h) => 'ob' + h), kick: 'kM', snare: 'sM', hat: 'hM', crash: ['cr', ...R(7)] },
      ent: { bars: 8, clar: ENT, acc: ENT, tuba: ENT_H.map((h) => 't' + h), pad: ENT_H.map((h) => 's' + h), kick: 'kM', snare: 'sM', hat: 'hM', crash: ['cr', ...R(7)] },
      fin: { bars: 8, horn: ODE, pic: ODE.map((p) => p + '@+12'), glock: ODE, brass: ODE_H.map((h) => 'ob' + h), tuba: ODE_H.map((h) => 't' + h), pad: ODE_H.map((h) => 's' + h), kick: 'kM', snare: ['sM', 'sM', 'sM', 'sM', 'sM', 'sM', 'sM', 'sR'], hat: 'hM', crash: ['cr', ...R(7)] },
      coda: { bars: 8, horn: ['o7', 'o8', 'cd3', 'cd4', 'cd5', 'cd5', '_', '_'], tuba: ['tC', 'tC', 'tF', 'tG', 'tC', 'tC', 'C2!:16', '_'], pad: ['sC', 'sC', 'sF', 'sG', 'sC', 'sC', 'sC', '_'], kick: ['kM', 'kM', 'kM', 'kM', 'kM', 'kM', 'kM', 'X...............'], snare: ['sM', 'sM', 'sM', 'sM', 'sM', 'sM', 'sM', 'sR'], crash: ['cr', '_', '_', '_', '_', '_', '_', 'cr'] },
    },
    arr: ['intro', 'ode1', 'ode2', 'jak1', 'jak2', 'ent', 'fin', 'coda'],
  };

  // ───────── 10. Kommt ein Vogel geflogen / Augustin Medley (public domain) ─────────
  // "O du lieber Augustin" (Vienna, c. 1800) and "Kommt ein Vogel geflogen"
  // (folk song, printed 1807), both public domain, arranged as a chiptune
  // waltz (3/4) that turns into a 2/4 street march.
  const AUG_H = ['F', 'F', 'C', 'F', 'F', 'F', 'C', 'F', 'C', 'F', 'C', 'F', 'F', 'F', 'C', 'F'];
  const VOG_H = ['F', 'C', 'C', 'F', 'F', 'C', 'C', 'F'];
  const AUG_W = ['au1', 'au2', 'au3', 'au2', 'au1', 'au2', 'au3', 'au8', 'au3', 'au2', 'au3', 'au2', 'au1', 'au2', 'au3', 'au16'];
  const VOG_W = ['vo1', 'vo2', 'vo3', 'vo4', 'vo1', 'vo2', 'vo7', 'vo8p'];
  const AUG_M = ['ma1', 'ma2', 'ma3', 'ma2', 'ma1', 'ma2', 'ma3', 'ma8', 'ma3', 'ma2', 'ma3', 'ma2', 'ma1', 'ma2', 'ma3', 'ma16'];
  const VOG_M = ['mv1', 'mv2', 'mv3', 'mv4', 'mv1', 'mv2', 'mv7', 'mv8p'];
  const up12 = (l) => l.map((p) => (p === '_' ? p : p + '@+12'));
  const MEDLEY = {
    id: 'medley', title: 'Kommt ein Vogel geflogen / Augustin Medley', bpm: 162, beats: 3,
    delay: { beats: 0.5, fb: 0.25 },
    ch: {
      sq1: { i: 'chip', g: 0.8, pan: -0.12, dly: 0.18, rev: 0.12, o: { duty: 0.25, vib: true } },
      mq: { i: 'chip', g: 0.45, pan: -0.12, dly: 0.15, rev: 0.12, o: { duty: 0.25, vib: true } },
      sq2: { i: 'chip', g: 0.45, pan: 0.25, rev: 0.1, o: { duty: 0.125, arp: true, arpRate: 0.042, gate: 0.85 } },
      tri: { i: 'bass', g: 0.75, duck: 0.15, o: { wave: 'triangle', cut: 8000, env: 0, q: 0.5, gate: 0.9, a: 0.002 } },
      nk: { i: 'kick', g: 1.0, sc: true, o: { wave: 'triangle', f0: 180, f1: 55, pd: 0.05, dec: 0.18, click: 0 } },
      ns: { i: 'nes', g: 0.55, rev: 0.1, o: { rate: 1, dec: 0.14 } },
      nh: { i: 'nes', g: 0.26, pan: 0.3, o: { rate: 3.2, dec: 0.03 } },
      bell: { i: 'bell', g: 0.34, pan: 0.3, rev: 0.3, dly: 0.15, o: { ratio: 4, idx: 1, dec: 1 } },
      snare: { i: 'snare', g: 0.38, pan: 0.1, rev: 0.18, o: { tone: 230, dec: 0.12, hp: 2000 } },
      bd: { i: 'kick', g: 0.55, sc: true, o: { f0: 90, f1: 50, dec: 0.35, click: 0.1 } },
      cym: { i: 'crash', g: 0.16, pan: -0.3, rev: 0.2, o: { dec: 0.9 } },
      tuba: { i: 'tuba', g: 0.45, duck: 0.1 },
      horn: { i: 'brass', g: 0.3, pan: -0.08, rev: 0.2 },
      brass: { i: 'brass', g: 0.2, pan: -0.25, rev: 0.2 },
      glock: { i: 'bell', g: 0.2, pan: 0.36, rev: 0.2, o: { ratio: 3.5, idx: 1.2, dec: 0.7 } },
      pic: { i: 'whistle', g: 0.24, pan: 0.3, rev: 0.2 },
    },
    pat: {
      // waltz (12 steps per bar)
      au1: 'C5:6 D5:2 C5:2 Bb4:2', au2: 'A4:4 F4:4 F4:4', au3: 'G4:4 C4:4 C4:4', au8: 'F4:8 .:4', au16: 'F4:12', au16p: 'F4:8 A4:2 Bb4:2',
      au1m: 'C5:6 Db5:2 C5:2 Bb4:2', au2m: 'Ab4:4 F4:4 F4:4',
      vo1: 'C5:4 A4:4 A4:4', vo2: 'A4:4 G4:4 G4:2 A4:2', vo3: 'Bb4:4 G4:4 G4:2 D5:2', vo4: 'C5:4 .:4 A4:2 Bb4:2',
      vo7: 'Bb4:4 E4:4 E4:4', vo8p: 'F4:4 .:4 A4:2 Bb4:2', vo8: 'F4:4 .:8',
      wF: '.:4 A4+C5+F5:3 . A4+C5+F5:3 .', wC: '.:4 G4+Bb4+E5:3 . G4+Bb4+E5:3 .', wFm: '.:4 Ab4+C5+F5:3 . Ab4+C5+F5:3 .',
      bF: 'F2:4 .:8', bC: 'C2:4 .:8', bFw: 'F2:4 A2?:4 C3?:4', bCw: 'C2:4 E2?:4 G2?:4', bFmw: 'F2:4 Ab2?:4 C3?:4',
      ctF: pick('F4? A4? C5? A4? C5? A4?'), ctC: pick('E4? G4? C5? G4? Bb4? G4?'),
      nk3: 'X...........', nh3: '....x...x...', ns3: '....o...o...', nsF: '....o...xxXX', nsR: 'xxxxxxXXXXXX',
      // march (8 steps per bar)
      ma1: 'C5:3 D5 C5:2 Bb4:2', ma2: 'A4:4 F4:2 F4:2', ma3: 'G4:4 C4:2 C4:2', ma8: 'F4:4 .:4', ma16: 'F4:6 .:2', ma16p: 'F4:4 D5:2 Eb5:2',
      mv1: 'C5:4 A4:2 A4:2', mv2: 'A4:3 G4 G4:2 A4:2', mv3: 'Bb4:3 G4 G4:2 D5:2', mv4: 'C5:4 A4:2 Bb4:2',
      mv7: 'Bb4:4 E4:2 E4:2', mv8p: 'F4:4 A4:2 Bb4:2', mv8: 'F4:6 .:2',
      mtF: 'F2:2 .:2 C2:2 .:2', mtC: 'C2:2 .:2 G2:2 .:2',
      mpF: '.:2 A3+C4+F4,:2 .:2 A3+C4+F4,:2', mpC: '.:2 G3+Bb3+E4,:2 .:2 G3+Bb3+E4,:2',
      mS: 'X.xoX.xo', mSF: 'X.xoXxXX', mS2: 'x.o.x.o.', mBd: 'X...X...', mCym: 'X.......',
      picL: 'G5:4 E5:4 | A5:4 F5:4 | G5:4 Bb5:4 | A5:8 | C6:4 A5:4 | C6:4 F6:4 | Bb5:2 A5:2 G5:2 E5:2 | F5:8',
      picV: 'A5:4 C6:4 | G5:4 E5:4 | Bb5:4 G5:4 | A5:8 | C6:4 A5:4 | G5:4 C6:4 | Bb5:2 G5:2 E5:2 G5:2 | F5:8',
      coH: 'F4:2 A4:2 C5:2 F5:2 | A5:3 F5 C5:2 A4:2 | F4+A4+C5+F5!:8 | .:8',
    },
    sec: {
      wIntro: { bars: 8, bell: ['au1@+12', 'au2@+12', 'au3@+12', 'au8@+12', ...R(4)], sq2: ['wF', 'wF', 'wC', 'wF', 'wF', 'wF', 'wC', 'wF'], tri: ['bF', 'bF', 'bC', 'bF', 'bF', 'bF', 'bC', 'bF'], nk: [...R(4), 'nk3', 'nk3', 'nk3', 'nk3'], nh: [...R(4), 'nh3', 'nh3', 'nh3', 'nh3'], ns: [...R(7), 'nsF'] },
      aug1: { bars: 16, sq1: up12([...AUG_W.slice(0, 15), 'au16p']), sq2: AUG_H.map((h) => 'w' + h), tri: AUG_H.map((h) => 'b' + h), nk: 'nk3', nh: 'nh3', ns: [...cyc(['ns3'], 7), 'nsF'] },
      vog1: { bars: 16, sq1: up12([...VOG_W, ...VOG_W.slice(0, 7), 'vo8']), bell: [...R(8), ...up12([...VOG_W.slice(0, 7), 'vo8'])], sq2: [...VOG_H, ...VOG_H].map((h) => 'w' + h), tri: [...VOG_H.map((h) => 'b' + h), ...VOG_H.map((h) => 'b' + h + 'w')], nk: 'nk3', nh: 'nh3', ns: [...cyc(['ns3'], 7), 'nsF'] },
      aug2: { bars: 16, bell: up12(AUG_W), sq1: AUG_H.map((h) => 'ct' + h), sq2: AUG_H.map((h) => 'w' + h), tri: AUG_H.map((h) => 'b' + h + 'w'), nk: 'nk3', nh: 'nh3', ns: [...cyc(['ns3'], 3), 'nsF'] },
      wMin: { bars: 8, bell: up12(['au1m', 'au2m', 'au3', 'au2m', 'au1m', 'au2m', 'au3', 'au8']), sq2: ['wFm', 'wFm', 'wC', 'wFm', 'wFm', 'wFm', 'wC', 'wFm'], tri: ['bFmw', 'bFmw', 'bCw', 'bFmw', 'bFmw', 'bFmw', 'bCw', 'bF'], nk: 'nk3', ns: [...R(7), 'nsR'] },
      mRoll: { bars: 2, beats: 2, bpm: 120, snare: ['ooooxxxx', 'xxxxXXXX'], horn: ['_', '.:4 A4:2 Bb4:2'], mq: ['_', '.:4 A5:2 Bb5:2'], brass: ['G3+Bb3+E4:8', '_'], bd: ['X.......', 'X.......'], tuba: ['C2:8', 'C2:4 .:4'], cym: ['_', 'X.......'] },
      mVog: { bars: 16, beats: 2, bpm: 120, horn: [...VOG_M, ...VOG_M.slice(0, 7), 'mv8'], mq: up12([...VOG_M, ...VOG_M.slice(0, 7), 'mv8']), tuba: [...VOG_H, ...VOG_H].map((h) => 'mt' + h), brass: [...VOG_H, ...VOG_H].map((h) => 'mp' + h), snare: ['mS', 'mS', 'mS', 'mSF'], bd: 'mBd', cym: ['mCym', '_'] },
      mAug: { bars: 16, beats: 2, bpm: 120, horn: [...AUG_M.slice(0, 15), 'ma16p'], mq: up12([...AUG_M.slice(0, 15), 'ma16p']), glock: [...R(8), ...up12(AUG_M.slice(8, 15)), 'ma16p@+12'], pic: [...R(8), 'picL'], tuba: AUG_H.map((h) => 'mt' + h), brass: AUG_H.map((h) => 'mp' + h), snare: ['mS', 'mS', 'mS', 'mSF'], bd: 'mBd', cym: ['mCym', '_', '_', '_'] },
      mTrio: { bars: 16, beats: 2, bpm: 120, tr: 5, glock: up12([...VOG_M, ...VOG_M.slice(0, 7), 'mv8']), mq: [...VOG_M, ...VOG_M.slice(0, 7), 'mv8'], pic: [...R(8), 'picV'], tuba: [...VOG_H, ...VOG_H].map((h) => 'mt' + h), brass: [...VOG_H, ...VOG_H].map((h) => 'mp' + h), snare: 'mS2', bd: 'mBd', cym: ['mCym', ...R(7)] },
      mFinal: { bars: 16, beats: 2, bpm: 120, horn: AUG_M, mq: up12(AUG_M), glock: up12(AUG_M), pic: [...R(8), 'picL'], tuba: AUG_H.map((h) => 'mt' + h), brass: AUG_H.map((h) => 'mp' + h), snare: ['mS', 'mS', 'mS', 'mSF'], bd: 'mBd', cym: ['mCym', '_'] },
      coda: { bars: 4, beats: 2, bpm: 120, horn: 'coH', mq: 'coH@+12', snare: ['X.xoX.xo', 'xxxxxxxx', 'X.......', '_'], bd: ['mBd', 'mBd', 'X.......', '_'], cym: ['_', '_', 'mCym', '_'], tuba: ['mtF', 'mtF', 'F2!:8', '_'], glock: ['_', '_', 'F6:8', '_'] },
    },
    arr: ['wIntro', 'aug1', 'vog1', 'aug2', 'wMin', 'mRoll', 'mVog', 'mAug', 'mTrio', 'mFinal', 'coda'],
  };

  // ─────────────────────────── 11. Pascal is Coming ───────────────────────────
  const st4 = (ch) => `${ch}!,:2 . ${ch}, .:2 ${ch},:2 .:2 ${ch}!,:2 .:4`;
  const ostn = (a, b) => rep(`${a} ${b}`, 8);
  const PS_BA = ['bC', 'bC', 'bC@-4', 'bC@-5', 'bC', 'bC', 'bC@+1', 'bC@-5'];
  const PS_BB = ['bC', 'bC', 'bC', 'bC@-5', 'bC', 'bC', 'bC@-4', 'bC@-5'];
  const PS_M = ['pm1', 'pm2', 'pm1', 'pm3', 'pm1', 'pm2', 'pm4', 'pm3'];
  const PASCAL = {
    id: 'pascal', title: 'Pascal is Coming', bpm: 144, loop: true,
    delay: { beats: 0.5, fb: 0.3 },
    ch: {
      kick: { i: 'kick', g: 0.85, sc: true, o: { f0: 150, f1: 48, dec: 0.3 } },
      snare: { i: 'snare', g: 0.5, rev: 0.2, o: { tone: 200, dec: 0.14 } },
      clap: { i: 'clap', g: 0.26, rev: 0.25 },
      hat: { i: 'hat', g: 0.22, pan: 0.3 },
      crash: { i: 'crash', g: 0.24, pan: -0.3, rev: 0.2 },
      tom: { i: 'tom', g: 0.44, rev: 0.15 },
      bass: { i: 'bass', g: 0.48, duck: 0.4, o: { wave: 'sawtooth', cut: 450, env: 2200, q: 8, fdec: 0.08, gate: 0.6 } },
      stab: { i: 'brass', g: 0.34, pan: -0.2, rev: 0.15 },
      lead: { i: 'plead', g: 0.22, pan: 0.25, dly: 0.18, rev: 0.15, o: { s: 0.4 } },
      acc: { i: 'reed', g: 0.34, pan: -0.1, rev: 0.18, trem: { rate: 7, depth: 0.12 } },
      clar: { i: 'clar', g: 0.3, pan: 0.18, rev: 0.2 },
      tuba: { i: 'tuba', g: 0.55, duck: 0.2 },
      fx: { i: 'riser', g: 0.3, rev: 0.4 },
    },
    pat: {
      kC: 'X...X...X...X.X.', sC: '....X.......X...', sR: 'xxxxxxxxXXXXXXXX', hC: 'xxXxxxXxxxXxxxXx', cr: 'X...............',
      bC: 'C2 C2 C3 C2 C2 C3 C2 C3 C2 C2 C3 C2 C2 C3 C2 C3',
      stCm: st4('C4+Eb4+G4'), stAb: st4('C4+Eb4+Ab4'), stG: st4('B3+D4+G4'), stDb: st4('Db4+F4+Ab4'),
      oC: ostn('G5', 'Ab5'), oAb: ostn('Ab5', 'Bb5'), oG: ostn('G5', 'F#5'), oDb: ostn('Ab5', 'F5'),
      pm1: 'C5 . Eb5 . G5 . Eb5 . Ab5:2 G5:2 F#5 G5 .:2',
      pm2: 'C5 . Eb5 . G5 . C6 . Bb5:2 Ab5:2 G5:4',
      pm3: 'Ab5 . G5 . F5 . Eb5 . D5:2 C5:2 B4:4',
      pm4: 'C5:2 G4:2 C5:2 D5:2 Eb5:2 F5:2 F#5:2 G5:2',
      tuC: 'C2:3 .:5 G1:3 .:5', tuG: 'G1:3 .:5 D2:3 .:5', tuAb: 'Ab1:3 .:5 Eb2:3 .:5',
      tF: '.:8 G3 G3 Eb3 Eb3 C3 C3 G2:2',
    },
    sec: {
      pA: { bars: 8, kick: 'kC', snare: [...cyc(['sC'], 7), 'sR'], hat: 'hC', crash: ['cr', ...R(7)], bass: PS_BA, stab: ['stCm', 'stCm', 'stAb', 'stG', 'stCm', 'stCm', 'stDb', 'stG'], lead: ['oC', 'oC', 'oAb', 'oG', 'oC', 'oC', 'oDb', 'oG'] },
      pB: { bars: 8, kick: 'kC', snare: 'sC', clap: 'sC', hat: 'hC', crash: ['cr', ...R(7)], bass: PS_BB, acc: PS_M, clar: PS_M, tuba: ['tuC', 'tuC', 'tuC', 'tuG', 'tuC', 'tuC', 'tuAb', 'tuG'], tom: [...R(7), 'tF'] },
      pC: { bars: 8, tr: 1, kick: 'kC', snare: [...cyc(['sC'], 7), 'sR'], clap: 'sC', hat: 'hC', crash: ['cr', '_'], bass: PS_BB, stab: ['stCm', 'stCm', 'stCm', 'stG', 'stCm', 'stCm', 'stAb', 'stG'], lead: ['oC', 'oC', 'oC', 'oG', 'oC', 'oC', 'oAb', 'oG'], acc: PS_M, tuba: ['tuC', 'tuC', 'tuC', 'tuG', 'tuC', 'tuC', 'tuAb', 'tuG'], fx: [...R(7), 'x:16'] },
    },
    arr: ['pA', 'pB', 'pC'],
  };

  // ──────────────────────────────── stingers ────────────────────────────────
  const STINGER_DEFS = {
    start: {
      id: 'start', title: 'Start', bpm: 120, duck: 0.35,
      ch: {
        beep: { i: 'chip', g: 0.85, rev: 0.15, o: { duty: 0.5 } },
        hit: { i: 'brass', g: 0.55, rev: 0.25 },
        kick: { i: 'kick', g: 0.8 },
        snare: { i: 'snare', g: 0.4, rev: 0.2 },
        crash: { i: 'crash', g: 0.3, rev: 0.25 },
      },
      pat: {},
      sec: { a: { bars: 1, beep: 'G4:2 .:2 G4:2 .:2 G4:2 .:2 C6!:4', hit: '.:12 C4+E4+G4+C5!:4', kick: 'X...X...X...X...', snare: '........o.o.xxXX', crash: '............X...' } },
      arr: ['a'],
    },
    letter: {
      id: 'letter', title: 'Letter', bpm: 120, duck: 0.3,
      ch: {
        bell: { i: 'bell', g: 0.85, rev: 0.35, pan: 0.2 },
        brass: { i: 'brass', g: 0.7, rev: 0.25, pan: -0.15 },
        spark: { i: 'chip', g: 0.3, rev: 0.3, pan: 0.3, o: { duty: 0.125, arp: true, arpRate: 0.04 } },
        crash: { i: 'crash', g: 0.26, rev: 0.25 },
        kick: { i: 'kick', g: 0.7 },
      },
      pat: {},
      sec: { a: { bars: 1, bell: 'C5 E5 G5 C6 E6 G6 C7:10', brass: '.:6 C4+E4+G4+C5!:10', spark: '.:6 C6+E6+G6:10', crash: '......X.........', kick: '......X.........' } },
      arr: ['a'],
    },
    caught: {
      id: 'caught', title: 'Caught', bpm: 96, duck: 0.3,
      ch: {
        chip: { i: 'chip', g: 0.9, rev: 0.2, o: { duty: 0.25 } },
        tuba: { i: 'tuba', g: 0.5, rev: 0.2 },
        bell: { i: 'bell', g: 0.28, rev: 0.3, o: { ratio: 4, idx: 1 } },
        tom: { i: 'tom', g: 0.4, rev: 0.2, o: { syn: true, dec: 0.5 } },
      },
      pat: {},
      sec: { a: { bars: 1, chip: 'G5:2 E5:2 C5:3 .:9', tuba: '.:7 C3v:7 .:2', bell: '.:14 C6:2', tom: '.:7 G3:9' } },
      arr: ['a'],
    },
    win: {
      id: 'win', title: 'Win', bpm: 120, duck: 0.2,
      ch: {
        horn: { i: 'brass', g: 0.42, rev: 0.25, pan: -0.1 },
        chords: { i: 'brass', g: 0.28, rev: 0.3, pan: 0.15 },
        tuba: { i: 'tuba', g: 0.55 },
        timp: { i: 'tom', g: 0.55, rev: 0.25, o: { dec: 0.7 } },
        snare: { i: 'snare', g: 0.4, rev: 0.2 },
        crash: { i: 'crash', g: 0.3, rev: 0.25 },
        bell: { i: 'bell', g: 0.26, rev: 0.35, pan: 0.3 },
        kick: { i: 'kick', g: 0.75 },
      },
      pat: {},
      sec: {
        a: {
          bars: 3,
          horn: 'C5:3 C5 C5:2 C5:2 E5:6 .:2 | D5:3 D5 D5:2 D5:2 F5:4 E5:2 D5:2 | G5!:4 E5:2 G5:2 C6!:8',
          chords: 'C4+E4+G4:16 G3+B3+D4+F4:16 C4+E4+G4+C5!:16',
          tuba: 'C2:4 G2:4 C2:4 G2:4 | G1:4 D2:4 G2:4 B1:4 | C2!:16',
          timp: 'C2:4 .:12 | G1:4 .:8 G1 G1 G1 G1 | C2!:16',
          snare: '................ ........oooooooo X...............',
          crash: 'X............... ................ X...............',
          bell: '.:32 G5 C6 E6 G6 C7:12',
          kick: 'X.......X....... X.......X....... X...............',
        },
      },
      arr: ['a'],
    },
  };

  // ════════════════════════════ compile everything ════════════════════════
  const SONG_DEFS = [THEME, NDW, AUTOBAHN, FOG, POLKA, LUFTBALLON, AMERIKA, BLUMEN, HEIMAT, MEDLEY, PASCAL];
  const SONGS = SONG_DEFS.map(compileSong);
  const STINGERS = {};
  for (const k of Object.keys(STINGER_DEFS)) STINGERS[k] = compileSong(STINGER_DEFS[k]);
  const TRACKS = SONGS.map((s, index) => ({ id: s.id, title: s.def.title, bpm: s.def.bpm, seconds: Math.round(s.seconds * 10) / 10, index, loop: !!s.def.loop }));
  const PLAYLIST = TRACKS.filter((t) => !t.loop).map((t) => t.index);

  // extra percussion layered on top of any song as intensity rises
  const XCH = {
    __xsh: { i: 'shaker', g: 0.3, pan: -0.35 },
    __xk: { i: 'kick', g: 0.42, o: { f0: 130, f1: 50, dec: 0.25, click: 0.2 } },
    __xt: { i: 'tom', g: 0.36, pan: 0.2, rev: 0.15 },
    __xoh: { i: 'hat', g: 0.12, pan: 0.4, o: { open: true, dec: 0.18 } },
  };

  // ════════════════════════════ engine ════════════════════════════════════
  const LOOKAHEAD = 0.6;   // was .15: any main-thread stall over ~150 ms (opening the pause menu, starting a run, shader compiles) starved the scheduler and crackled
  const TICK_MS = 25;
  const E = {
    ctx: null, players: [], cur: null, intensity: 0, horizon: 0, lastPlaylist: -1,
    noise: null, _lfsr: {}, _pulse: {}, _curve: {}, _ks: {},
    lfsr(short) {
      const key = short ? 's' : 'l';
      if (!this._lfsr[key]) {
        const c = this.ctx, len = c.sampleRate, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
        let reg = 1, bit = 0;
        for (let i = 0; i < len; i++) {
          if (i % 3 === 0) { const fb = (reg ^ (reg >> (short ? 6 : 1))) & 1; reg = (reg >> 1) | (fb << 14); bit = reg & 1; }
          d[i] = bit ? 0.8 : -0.8;
        }
        this._lfsr[key] = b;
      }
      return this._lfsr[key];
    },
    pulse(duty) {
      if (!this._pulse[duty]) {
        const n = 64, re = new Float32Array(n), im = new Float32Array(n);
        for (let k = 1; k < n; k++) { re[k] = Math.sin(2 * Math.PI * k * duty) / (Math.PI * k); im[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (Math.PI * k); }
        this._pulse[duty] = this.ctx.createPeriodicWave(re, im);
      }
      return this._pulse[duty];
    },
    curve(k) {
      if (!this._curve[k]) {
        const n = 2048, cv = new Float32Array(n), norm = Math.tanh(k);
        for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; cv[i] = Math.tanh(k * x) / norm; }
        this._curve[k] = cv;
      }
      return this._curve[k];
    },
    // Karplus-Strong plucked string rendered into a buffer (exact tuning via allpass)
    ks(m, bright, T60) {
      const key = `${m}|${bright}|${T60}`;
      if (this._ks[key]) return this._ks[key];
      const c = this.ctx, sr = c.sampleRate, f = mtof(m), P = sr / f;
      const N = Math.max(2, Math.floor(P - 0.6));
      const frac = P - 0.5 - N, C = (1 - frac) / (1 + frac);
      const len = Math.floor(sr * Math.min(2.2, T60 + 0.3));
      const out = new Float32Array(len), line = new Float32Array(N), r = rng(m * 7919 + 13);
      let lpS = 0, mean = 0;
      const a = 0.15 + 0.8 * bright;
      for (let i = 0; i < N; i++) { lpS += a * (r() * 2 - 1 - lpS); line[i] = lpS; mean += lpS; }
      mean /= N;
      for (let i = 0; i < N; i++) line[i] -= mean;
      const loss = Math.pow(0.001, 1 / (f * T60));
      let idx = 0, prev = 0, apX = 0, apY = 0, peak = 1e-9;
      for (let n = 0; n < len; n++) {
        const cur = line[idx];
        out[n] = cur;
        const avg = 0.5 * (cur + prev) * loss;
        prev = cur;
        const y = C * avg + apX - C * apY;
        apX = avg; apY = y;
        line[idx] = y;
        idx = idx + 1 === N ? 0 : idx + 1;
        const ab = cur < 0 ? -cur : cur;
        if (ab > peak) peak = ab;
      }
      const fade = Math.floor(sr * 0.05);
      for (let n = 0; n < len; n++) { out[n] *= 0.9 / peak; if (n > len - fade) out[n] *= (len - n) / fade; }
      const buf = c.createBuffer(1, len, sr);
      buf.getChannelData(0).set(out);
      this._ks[key] = buf;
      return buf;
    },
  };

  function makeIR(c, secs, decay) {
    const sr = c.sampleRate, len = Math.floor(sr * secs), buf = c.createBuffer(2, len, sr), r = rng(4242);
    const pre = Math.floor(sr * 0.012);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = pre; i < len; i++) {
        const x = (i - pre) / (len - pre);
        lp += (0.65 - 0.5 * x) * (r() * 2 - 1 - lp);
        d[i] = lp * Math.pow(1 - x, decay);
      }
      for (let k = 0; k < 10; k++) {
        const at = pre + Math.floor(sr * (0.004 + r() * 0.07));
        if (at < len) d[at] += (r() * 2 - 1) * 0.5 * (1 - k / 12);
      }
    }
    return buf;
  }

  class Player {
    constructor(song, t0, opts) {
      const c = E.ctx;
      this.c = c; this.song = song; this.t0 = t0;
      this.loop = !!opts.loop; this.isStinger = !!opts.stinger;
      this.rand = rng(hash(song.id) ^ Math.floor(t0 * 1000));
      this.lfos = []; this.duckers = []; this.lastDuck = -1;
      this.out = c.createGain(); this.revOut = c.createGain();
      this.out.connect(this.isStinger ? E.stingerIn : E.musicIn);
      this.revOut.connect(E.revIn);
      this.dry = c.createGain(); this.dry.connect(this.out);
      this.revBus = c.createGain(); this.revBus.connect(this.revOut);
      // tempo-synced ping-pong delay
      const dl = song.def.delay || {};
      this.dlyBeats = dl.beats || 0.75;
      this.dlyIn = c.createGain();
      const hp = biq(c, 'highpass', 280, 0.5), lp = biq(c, 'lowpass', 5000, 0.5);
      this.dA = c.createDelay(2.5); this.dB = c.createDelay(2.5);
      const fbA = gainNode(c, dl.fb == null ? 0.35 : dl.fb), fbB = gainNode(c, dl.fb == null ? 0.35 : dl.fb), loopLp = biq(c, 'lowpass', 4200, 0.5);
      const pA = panner(c, -0.8), pB = panner(c, 0.8), dOut = c.createGain(), dRev = gainNode(c, 0.25);
      this.dlyIn.connect(hp).connect(lp).connect(this.dA);
      this.dA.connect(pA).connect(dOut); this.dA.connect(fbA).connect(this.dB);
      this.dB.connect(pB).connect(dOut); this.dB.connect(fbB).connect(loopLp).connect(this.dA);
      dOut.connect(this.out); dOut.connect(dRev).connect(this.revBus);
      this.curBpm = 0;
      // channels
      this.chans = {};
      const defs = Object.assign({}, song.def.ch, this.isStinger ? {} : XCH);
      for (const name of Object.keys(defs)) this.chans[name] = this.buildChannel(name, defs[name]);
      // position
      this.secIdx = 0; this.step = 0; this.next = t0; this.state = 'play';
      this.stopAt = null; this.retireAt = null; this.endTime = null; this.secStart = t0;
    }
    buildChannel(name, def) {
      const c = this.c;
      const strip = (pan) => {
        const inp = gainNode(c, def.g == null ? 0.5 : def.g);
        let node = inp;
        if (def.fx === 'dist') node = distInsert(E, node, def.o || {});
        if (def.trem) {
          const tg = gainNode(c, 1 - def.trem.depth), lfo = osc(c, 'sine', this.t0), lg = gainNode(c, def.trem.depth);
          lfo.frequency.value = def.trem.rate;
          lfo.connect(lg).connect(tg.gain);
          this.lfos.push(lfo);
          node.connect(tg); node = tg;
        }
        const pn = panner(c, pan);
        node.connect(pn);
        let post = pn;
        if (def.duck) { const dg = c.createGain(); pn.connect(dg); post = dg; this.duckers.push({ p: dg.gain, depth: def.duck }); }
        post.connect(this.dry);
        if (def.rev) pn.connect(gainNode(c, def.rev)).connect(this.revBus);
        if (def.dly) pn.connect(gainNode(c, def.dly)).connect(this.dlyIn);
        return inp;
      };
      const outs = def.twin ? [strip(-def.twin.pan), strip(def.twin.pan)] : [strip(def.pan || 0)];
      return { name, def, inst: INST[def.i], outs, st: {}, o: Object.assign({}, def.o) };
    }
    setDelay(t, bpm) {
      const dt = Math.min(2.4, (this.dlyBeats * 60) / bpm);
      this.dA.delayTime.setValueAtTime(dt, t);
      this.dB.delayTime.setValueAtTime(dt, t);
      this.curBpm = bpm;
    }
    fadeIn(t, dur) {
      for (const p of [this.out.gain, this.revOut.gain]) {
        if (dur > 0.01) { p.setValueAtTime(0, t); p.linearRampToValueAtTime(1, t + dur); } else p.setValueAtTime(1, t);
      }
    }
    fadeOut(t, dur) {
      dur = Math.max(0.05, dur);
      for (const p of [this.out.gain, this.revOut.gain]) {
        const v = p.value;
        p.cancelScheduledValues(t);
        p.setValueAtTime(v, t);
        p.linearRampToValueAtTime(0, t + dur);
      }
      this.stopAt = t + dur;
      this.retireAt = t + dur + 4;
    }
    get section() { const s = this.song.order[this.secIdx]; return s ? s.name : null; }
    schedule(until) {
      const order = this.song.order;
      while (this.state === 'play' && this.next < until) {
        if (this.stopAt != null && this.next >= this.stopAt) { this.state = 'stopped'; break; }
        const sec = order[this.secIdx];
        const sd = 60 / sec.bpm / 4;
        if (this.step === 0) { this.secStart = this.next; if (sec.bpm !== this.curBpm) this.setDelay(this.next, sec.bpm); }
        if (this.next >= E.ctx.currentTime - 0.02) this.playStep(sec, this.step, this.next, sd);
        this.next += sd;
        this.step++;
        if (this.step >= sec.L) {
          this.step = 0;
          this.secIdx++;
          if (this.secIdx >= order.length) {
            if (this.loop) this.secIdx = 0;
            else { this.state = 'ended'; this.endTime = this.next; onPlayerEnded(this); }
          }
        }
      }
    }
    playStep(sec, step, t, sd) {
      const tt = step % 2 === 1 ? t + sec.swing * sd : t;
      for (const e of sec.steps[step]) this.playEvent(this.chans[e.ch], tt + e.off * sd, e.dur * sd, e.notes, e.vel, e.fl, step);
      if (!this.isStinger) this.intensityLayer(sec, step, tt, sd);
    }
    playEvent(ch, t, dur, notes, vel, fl, step) {
      const def = ch.def, inst = ch.inst;
      vel = Math.min(1.1, Math.max(0.05, vel * (1 + (this.rand() - 0.5) * 0.12)));
      t += (this.rand() - 0.5) * 0.003;
      if (t < E.ctx.currentTime) t = E.ctx.currentTime;
      const list = notes || [null];
      const outs = ch.outs;
      for (let k = 0; k < outs.length; k++) {
        const det = def.twin ? (k ? def.twin.det : -def.twin.det) / 2 : 0;
        const lag = def.twin && k ? def.twin.lag : 0;
        const base = { c: this.c, dur, vel, o: ch.o, fl, out: outs[k], st: ch.st, E, I: E.intensity, det, rnd: this.rand, n: list.length };
        if (inst.poly) { inst(Object.assign({ t: t + lag, m: list[0], notes: list }, base)); continue; }
        const up = def.strum && list.length > 1 && step % 4 === 2;
        for (let i = 0; i < list.length; i++) {
          const m = up ? list[list.length - 1 - i] : list[i];
          const off = def.strum ? i * def.strum : 0;
          const vv = def.strum ? base.vel * (up ? 0.75 : 1) * (1 - i * 0.04) : base.vel;
          inst(Object.assign({}, base, { t: t + lag + off, m, notes: list, vel: vv }));
        }
      }
      if (def.sc) this.duck(t);
      if (API._debug.onNote) API._debug.onNote({ song: this.song.id, ch: ch.name, t, dur, notes: list, vel });
    }
    duck(t) {
      if (t < this.lastDuck + 0.06) return;
      this.lastDuck = t;
      for (const d of this.duckers) {
        d.p.setTargetAtTime(1 - d.depth, t, 0.004);
        d.p.setTargetAtTime(1, t + 0.05, 0.075);
      }
    }
    fire(name, t, sd, notes, vel) { this.playEvent(this.chans[name], t, sd, notes, vel, {}, -1); }
    intensityLayer(sec, step, t, sd) {
      const I = E.intensity;
      if (I < 0.3) return;
      const sb = step % sec.spb, bar = Math.floor(step / sec.spb);
      const acc = sb % 4 === 2 ? 1 : sb % 2 ? 0.55 : 0.7;
      this.fire('__xsh', t, sd, null, (0.3 + 0.6 * (I - 0.3)) * acc);
      if (I > 0.55) {
        if (sb === sec.spb - 2) this.fire('__xk', t, sd, null, 0.7);
        if (bar % 4 === 3 && sb >= sec.spb - 4) this.fire('__xt', t, sd, [50 - (sb - (sec.spb - 4)) * 3], 0.75);
      }
      if (I > 0.8 && sb % 4 === 2) this.fire('__xoh', t, sd, null, 0.4);
    }
    dispose() {
      const now = E.ctx.currentTime;
      for (const l of this.lfos) { try { l.stop(now + 0.05); } catch (e) { /* already stopped */ } }
      try { this.out.disconnect(); this.revOut.disconnect(); } catch (e) { /* ignore */ }
      this.state = 'disposed';
    }
  }

  function info(p) {
    if (!p) return null;
    const t = TRACKS.find((x) => x.id === p.song.id);
    return Object.assign({}, t, { section: p.section, position: Math.max(0, (E.ctx ? E.ctx.currentTime : 0) - p.t0) });
  }
  function notify() {
    if (typeof API.onTrack === 'function') { try { API.onTrack(info(E.cur)); } catch (e) { if (global.console) global.console.error(e); } }
  }
  function findTrack(x) {
    if (typeof x === 'number') return TRACKS[((x % TRACKS.length) + TRACKS.length) % TRACKS.length];
    return TRACKS.find((t) => t.id === x || t.title === x) || null;
  }
  function startPlayer(track, t0, fade, loop) {
    const p = new Player(SONGS[track.index], t0, { loop });
    p.track = track;
    E.players.push(p);
    p.fadeIn(t0, fade);
    if (!track.loop) E.lastPlaylist = track.index;
    return p;
  }
  function nextPlaylistIndex() {
    const i = PLAYLIST.indexOf(E.lastPlaylist);
    return PLAYLIST[(i + 1) % PLAYLIST.length];
  }
  function onPlayerEnded(p) {
    p.retireAt = p.endTime + (p.isStinger ? 3 : 6);
    if (p.isStinger || p !== E.cur) return;
    if (!API.autoAdvance) { E.cur = null; notify(); return; }
    const np = startPlayer(TRACKS[nextPlaylistIndex()], p.endTime, 0, false);
    E.cur = np;
    np.schedule(E.horizon);
    notify();
  }
  function tick() {
    const c = E.ctx;
    if (!c) return;
    const now = c.currentTime;
    const doc = global.document;
    E.horizon = now + (doc && doc.hidden ? 1.0 : LOOKAHEAD);
    for (const p of E.players.slice()) {
      if (p.state === 'play') p.schedule(E.horizon);
      if (p.retireAt != null && now >= p.retireAt) {
        p.dispose();
        E.players.splice(E.players.indexOf(p), 1);
      }
    }
  }
  function needCtx() { if (!E.ctx) throw new Error('KyotoMusic: call init(audioContext, destination) first'); }

  // ════════════════════════════ public API ════════════════════════════════
  const API = {
    tracks: TRACKS,
    playlist: PLAYLIST.map((i) => TRACKS[i].id),
    stingers: Object.keys(STINGERS),
    autoAdvance: true,
    onTrack: null,
    get current() { return info(E.cur); },
    get intensity() { return E.intensity; },

    init(audioContext, destinationNode) {
      if (E.ctx) return API;
      const c = audioContext || new (global.AudioContext || global.webkitAudioContext)();
      E.ctx = c;
      const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), nd = nb.getChannelData(0), r = rng(99);
      for (let i = 0; i < nd.length; i++) nd[i] = r() * 2 - 1;
      E.noise = nb;
      E.musicIn = gainNode(c, 1);
      E.musicDuck = gainNode(c, 1);
      E.shelf = biq(c, 'highshelf', 3200, null, -2);
      E.air = biq(c, 'lowpass', 12000, 0.5);
      E.stingerIn = gainNode(c, 1);
      E.revIn = gainNode(c, 1);
      E.conv = c.createConvolver();
      E.conv.buffer = makeIR(c, 2.6, 2.8);
      E.revRet = gainNode(c, 0.62);
      E.pre = gainNode(c, 0.6);
      E.comp = c.createDynamicsCompressor();
      E.comp.threshold.value = -18; E.comp.knee.value = 12; E.comp.ratio.value = 3;
      E.comp.attack.value = 0.006; E.comp.release.value = 0.2;
      E.makeup = gainNode(c, 1.35);
      E.lim = c.createDynamicsCompressor();
      E.lim.threshold.value = -2; E.lim.knee.value = 0; E.lim.ratio.value = 20;
      E.lim.attack.value = 0.0015; E.lim.release.value = 0.09;
      E.vol = gainNode(c, 0.8);
      E.musicIn.connect(E.musicDuck).connect(E.shelf).connect(E.air).connect(E.pre);
      E.stingerIn.connect(E.pre);
      E.revIn.connect(E.conv).connect(E.revRet).connect(E.pre);
      E.pre.connect(E.comp).connect(E.makeup).connect(E.lim).connect(E.vol).connect(destinationNode || c.destination);
      E.timer = global.setInterval(tick, TICK_MS);
      return API;
    },

    play(trackIdOrIndex, opts) {
      needCtx();
      opts = opts || {};
      const tr = findTrack(trackIdOrIndex);
      if (!tr) throw new Error(`KyotoMusic: unknown track "${trackIdOrIndex}"`);
      if (E.cur && E.cur.track === tr && E.cur.state === 'play' && E.cur.stopAt == null) {
        if (opts.loop != null) E.cur.loop = !!opts.loop;
        return info(E.cur);
      }
      const now = E.ctx.currentTime;
      const fade = opts.fade == null ? 1.2 : Math.max(0, opts.fade);
      if (E.cur) E.cur.fadeOut(now, Math.max(0.08, fade));
      const p = startPlayer(tr, now + 0.06, fade, opts.loop != null ? !!opts.loop : tr.loop);
      E.cur = p;
      E.horizon = now + LOOKAHEAD;
      p.schedule(E.horizon);
      notify();
      return info(p);
    },

    next(opts) {
      needCtx();
      return API.play(nextPlaylistIndex(), Object.assign({ fade: 1.5 }, opts));
    },

    stop(opts) {
      if (!E.ctx || !E.cur) return;
      const fade = opts && opts.fade != null ? opts.fade : 1;
      E.cur.fadeOut(E.ctx.currentTime, fade);
      E.cur = null;
      notify();
    },

    setIntensity(x) {
      x = Math.min(1, Math.max(0, Number(x) || 0));
      E.intensity = x;
      if (!E.ctx) return;
      const now = E.ctx.currentTime;
      E.shelf.gain.setTargetAtTime(-2 + 5 * x, now, 0.25);
      E.air.frequency.setTargetAtTime(12000 + 8000 * x, now, 0.25);
    },

    setVolume(v) {
      v = Math.min(1, Math.max(0, Number(v) || 0));
      if (E.ctx) E.vol.gain.setTargetAtTime(v, E.ctx.currentTime, 0.05);
      else API._pendingVolume = v;
    },

    stinger(name) {
      needCtx();
      const s = STINGERS[name];
      if (!s) throw new Error(`KyotoMusic: unknown stinger "${name}"`);
      const now = E.ctx.currentTime;
      const p = new Player(s, now + 0.02, { stinger: true });
      E.players.push(p);
      p.fadeIn(now + 0.02, 0);
      const d = E.musicDuck.gain;
      d.cancelScheduledValues(now);
      d.setTargetAtTime(s.def.duck == null ? 0.4 : s.def.duck, now, 0.03);
      d.setTargetAtTime(1, now + s.seconds, 0.35);
      p.schedule(now + LOOKAHEAD);
      return s.seconds;
    },

    resume() { return E.ctx && E.ctx.resume ? E.ctx.resume() : Promise.resolve(); },

    _debug: {
      songs: SONGS, stingers: STINGERS, onNote: null, tick,
      get players() { return E.players; }, engine: E, parsePattern,
    },
  };
  const origInit = API.init;
  API.init = function (ctx, dest) {
    const r = origInit(ctx, dest);
    if (API._pendingVolume != null) { E.vol.gain.value = API._pendingVolume; delete API._pendingVolume; }
    return r;
  };

  global.KyotoMusic = API;
  if (typeof module === 'object' && module && module.exports) module.exports = API;
  return API;
})(typeof window !== 'undefined' ? window : globalThis);
