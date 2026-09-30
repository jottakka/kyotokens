/* feat_perf.js — general performance polish.
   · Shadow maps refresh every other frame once the frame rate dips below ~55 fps (characters move a few cm per frame, the eye can't tell,
     the shadow pass is a full extra scene render). Full-rate again when frames are fast or the game is paused.
   Resolution is handled by K.quality in core.js (DPR cap 1.5, faster step-down). */
(function (K) {
const r = K.renderer; if (!r || !K.render) return;
const base = K.render; let last = 0, ema = 1 / 60, n = 0;
K.render = function (t) {
  const now = performance.now(); if (last) { const dt = (now - last) / 1000; if (dt < .25) ema += (dt - ema) * .05; } last = now;
  const slow = ema > .0182 && !document.hidden && K.game && K.game.state !== 'paused';
  if (slow) { r.shadowMap.autoUpdate = false; r.shadowMap.needsUpdate = (n++ & 1) === 0; }
  else if (!r.shadowMap.autoUpdate) { r.shadowMap.autoUpdate = true; }
  base(t);
};
})(window.K);
