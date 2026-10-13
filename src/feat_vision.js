/* Kyoto vision + HUD button polish — owner: vision.
 * Toggles K.post.dogVision (core.js post shader): a blue/yellow dichromat view of the 3D
 * scene only; HTML HUD and the 3D menu overlay render after post and stay full colour.
 * Preference persists in K.store('kyotokens-vision'); toggling never touches run state.
 * HUD buttons only gain icons, captions, focus and pressed styling; their handlers stay in main.js/ui.js.
 */
(function (K) {
  'use strict';
  const KEY = 'kyotokens-vision', FADE = .3;
  const $ = s => document.querySelector(s);
  let on = K.store.get(KEY) === '1', mix = on ? 1 : 0, raf = 0, shown = null, btn, chip;

  const css = `
    #kvBtn{position:absolute;z-index:9;right:calc(14px + env(safe-area-inset-right,0px));top:calc(240px + env(safe-area-inset-top,0px));display:flex;align-items:center;gap:7px;box-sizing:border-box;min-height:44px;padding:4px 6px 4px 8px;border:3px solid var(--ink);border-radius:999px;background:var(--paper);color:var(--ink);box-shadow:3px 3px 0 var(--ink);font:400 16px/1 var(--comic);letter-spacing:.06em;white-space:nowrap;cursor:pointer;pointer-events:auto;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
    #kvBtn[hidden]{display:none}
    #kvBtn svg{width:24px;height:24px;flex:none;fill:none;stroke:var(--ink);stroke-width:2.2;stroke-linejoin:round}
    #kvBtn .kv-y{fill:#ffd84a;stroke:none}#kvBtn .kv-b{fill:#3d6ff0;stroke:none}
    #kvBtn b{min-width:34px;padding:5px 7px 4px;border-radius:999px;background:#e8dccb;color:var(--ink);font:800 12px/1 var(--round);letter-spacing:.04em;text-align:center}
    #kvBtn[aria-pressed="true"]{background:var(--gold)}#kvBtn[aria-pressed="true"] b{background:#3d6ff0;color:#fff}
    #kvBtn:hover{filter:brightness(1.05)}
    #kvBtn:active{transform:translate(2px,2px);box-shadow:1px 1px 0 var(--ink)}
    /* gold ring sandwiched in ink reads on bright sky and dark streets alike */
    #kvBtn:focus-visible,#hud #hudBtns button:focus-visible,#albumBtn:focus-visible,#tBtns button:focus-visible,.touch-button:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
    #kvBtn:focus-visible,#hud #hudBtns button:focus-visible{box-shadow:3px 3px 0 var(--ink),0 0 0 8px var(--ink)}
    #albumBtn:focus-visible,#tBtns button:focus-visible{box-shadow:4px 4px 0 var(--ink),0 0 0 8px var(--ink)}
    .touch-button:focus-visible{box-shadow:0 6px 0 var(--ink),0 0 0 8px var(--ink)}

    #hud #hudBtns button{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;box-sizing:border-box;width:auto;min-width:50px;height:44px;padding:3px 5px;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
    #hudBtns svg{width:18px;height:18px;flex:none;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
    #hudBtns .kv-l{font:800 9px/1 var(--round);letter-spacing:.05em;pointer-events:none}
    #hudBtns button:hover{background:#fff9e8}
    #hud #hudBtns button:active{transform:translate(2px,2px);box-shadow:1px 1px 0 var(--ink);background:var(--gold)}
    #hud #hudBtns #muteBtn.off{opacity:1;background:#e8dccb}
    #muteBtn .kv-off,#muteBtn.off .kv-on{display:none}#muteBtn.off .kv-off{display:inline}#muteBtn.off .kv-off.kv-l{display:block}

    #albumBtn:active{transform:rotate(-2deg) translate(2px,2px);box-shadow:2px 2px 0 var(--ink)}
    #tBtns button{touch-action:manipulation}
    #tBtns button:active{transform:translate(3px,3px);box-shadow:1px 1px 0 var(--ink);filter:brightness(1.1)}

    @media (prefers-reduced-motion:no-preference){#kvBtn,#hud #hudBtns button,#tBtns button{transition:transform .08s,box-shadow .08s,background-color .15s}}
    @media (max-width:640px){#kvBtn{top:calc(216px + env(safe-area-inset-top,0px));font-size:14px}}
    .touch-mobile #kvBtn{top:calc(126px + env(safe-area-inset-top,0px))}
    @media (max-width:600px){.touch-mobile #kvBtn{top:calc(238px + env(safe-area-inset-top,0px))}}
    @media (orientation:landscape) and (max-height:600px){.touch-mobile #kvBtn{top:calc(124px + env(safe-area-inset-top,0px));font-size:13px}}
  `;

  const svg = (body, cls) => '<svg viewBox="0 0 24 24" aria-hidden="true"' + (cls ? ' class="' + cls + '"' : '') + '>' + body + '</svg>';
  function hudIcons() {
    const mute = $('#muteBtn'), fm = $('#fmBtn'), pause = $('#pauseBtn');
    if (mute) {
      mute.innerHTML = svg('<path d="M4 9h4l5-4v14l-5-4H4z"/><path class="kv-on" d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/><path class="kv-off" d="m16 9 5 6m0-6-5 6"/>') +
        '<span class="kv-l kv-on">SOUND</span><span class="kv-l kv-off">MUTED</span>';
      mute.title = 'Mute (M)'; mute.setAttribute('aria-keyshortcuts', 'M');
      const sync = () => mute.setAttribute('aria-pressed', String(mute.classList.contains('off')));
      sync(); new MutationObserver(sync).observe(mute, { attributes: true, attributeFilter: ['class'] });
    }
    if (fm) { fm.innerHTML = svg('<path d="M9 17V5l10-2v12"/><circle cx="6.5" cy="17" r="2.5"/><circle cx="16.5" cy="15" r="2.5"/>') + '<span class="kv-l">SONG</span>'; fm.title = 'Next song (N)'; fm.setAttribute('aria-keyshortcuts', 'N'); }
    if (pause) { pause.innerHTML = svg('<path d="M8.5 5v14M15.5 5v14"/>') + '<span class="kv-l">PAUSE</span>'; pause.title = 'Pause (P / Esc)'; pause.setAttribute('aria-keyshortcuts', 'P Escape'); }
  }

  function tween() {
    raf = 0;
    const target = on ? 1 : 0, step = 1 / 60 / FADE;
    mix = K.reduceMotion ? target : mix + Math.max(-step, Math.min(step, target - mix));
    if (K.post && K.post.dogVision) K.post.dogVision.value = mix;
    if (mix !== target) raf = requestAnimationFrame(tween);
  }
  function set(v) {
    on = !!v; K.store.set(KEY, on ? '1' : '0');
    if (btn) { btn.setAttribute('aria-pressed', String(on)); chip.textContent = on ? 'ON' : 'OFF'; }
    if (!raf) tween();
  }
  K.vision = { get on() { return on; }, set };

  function blocked() {
    const open = id => { const e = document.getElementById(id); return !!(e && !e.hidden); };
    return open('album') || open('lf-album') || !!(K.UI && K.UI.mapOpen) || !!(K.agent && K.agent.open) || document.body.classList.contains('kyoto-wheel');
  }
  const available = () => !!K.game && (K.game.state === 'play' || K.game.state === 'paused') && !blocked();

  function mount() {
    const style = document.createElement('style'); style.id = 'kv-style'; style.textContent = css; document.head.appendChild(style);
    hudIcons();
    btn = document.createElement('button'); btn.id = 'kvBtn'; btn.type = 'button'; btn.hidden = true;
    btn.setAttribute('aria-label', 'Kyoto vision: dog colour view'); btn.setAttribute('aria-keyshortcuts', 'V'); btn.title = 'Kyoto vision — see SF in dog colours (V)';
    btn.innerHTML = svg('<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><path class="kv-y" d="M12 8.2a3.8 3.8 0 0 0 0 7.6z"/><path class="kv-b" d="M12 8.2a3.8 3.8 0 0 1 0 7.6z"/><circle cx="12" cy="12" r="3.8"/>') +
      '<span>KYOTO VISION</span><b aria-hidden="true"></b>';
    chip = btn.querySelector('b');
    btn.addEventListener('click', e => { set(!on); if (e.detail) btn.blur(); if (K.sfx && K.sfx.click) try { K.sfx.click(); } catch (_) {} });
    // Keyboard activation must not leak Space/Enter into jump/act on the window listener.
    btn.addEventListener('keydown', e => { if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') e.stopPropagation(); });
    (document.getElementById('app') || document.body).appendChild(btn);
    set(on);
  }

  addEventListener('keydown', e => {
    if (e.code !== 'KeyV' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (available()) set(!on);
  });
  K.on('ui', () => { const v = available(); if (btn && v !== shown) { shown = v; btn.hidden = !v; } });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})(window.K);
