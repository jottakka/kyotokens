/* Mobile controls — owner: touch.
 * Runtime wrappers: UI.buildTouch calls the original, then replaces its visible UI;
 * UI.showPause/showEnd/album/bigMap call their originals, then sync frozen review states.
 * UI.update calls the original, then synchronizes mobile menus (including paused
 * states, where the frame hook does not run). K.resetTouch chains the old reset.
 * No movement override, synthetic DOM keys, renderer changes, or external assets.
 */
(function (K) {
  'use strict';
  const UI = K.UI, clamp = K.U.clamp;
  let root, playUI, toolbar, menu, primary, restart, home, stick, knob, hint, pee;
  let active = false, lastState = '', lastAlbum = false, lastWheel = false, joy = null, look = null, pinch = null;
  let ox = 0, oy = 0, pinchDistance = 0, pinchZoom = 1, proximityT = 0;
  const pointers = new Map(), held = new Map();
  const radius = 52;
  let menuArmedUntil = 0;
  const icons = {
    jump: '<path d="M8 18 16 8l8 10M16 9v18M7 28h18"/>',
    bark: '<path d="m5 14 8-2 9-6v22l-9-6-8-2zM26 12l3-3M27 17h4M26 22l3 3"/>',
    act: '<path d="M18 6h9v23h-9M4 17h17m-6-6 6 6-6 6"/>',
    agent: '<rect x="5" y="10" width="24" height="18" rx="6"/><path d="M17 10V5M14 5h6M11 18h1m10 0h1M12 23h10"/>',
    pee: '<path d="M12 11h10v18H12zM10 11h14M14 7h6M8 17h4m10 0h4M8 15v6m18-6v6M9 29h16"/>',
    map: '<path d="m4 7 8-3 10 3 8-3v23l-8 3-10-3-8 3zM12 4v23m10-20v23"/>',
    album: '<rect x="3" y="9" width="28" height="21" rx="4"/><path d="m10 9 2-5h10l2 5"/><circle cx="17" cy="19" r="6"/>',
    pause: '<path d="M11 7v22M23 7v22"/>'
  };
  function button(label, icon, code, cls) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'touch-button ' + (cls || '');
    b.setAttribute('aria-label', label); b.dataset.code = code;
    b.innerHTML = (icon ? '<svg viewBox="0 0 34 34" aria-hidden="true">' + icons[icon] + '</svg>' : '') + '<span>' + label + '</span>';
    b.addEventListener('pointerdown', e => {
      if (e.button !== 0 || held.has(e.pointerId)) return;
      e.preventDefault(); e.stopPropagation();
      if (b.hidden || root.hidden) return;
      held.set(e.pointerId, { b, code: b.dataset.code }); b.classList.add('down');
      b.setPointerCapture(e.pointerId); press(b.dataset.code);
      if (code === 'Space' || code === 'KeyB') vibrate(code === 'Space' ? 12 : 22);
    });
    const release = e => {
      const h = held.get(e.pointerId); if (!h || h.b !== b) return;
      held.delete(e.pointerId); b.classList.remove('down');
      let stillHeld = false; for (const v of held.values()) if (v.code === h.code) stillHeld = true;
      if (!stillHeld) K.keys[h.code] = false;
    };
    b.addEventListener('pointerup', release); b.addEventListener('pointercancel', release); b.addEventListener('lostpointercapture', release);
    // Keyboard/assistive-technology activation has no preceding pointerdown.
    b.addEventListener('click', e => { e.preventDefault(); if (e.detail === 0) { press(b.dataset.code); K.keys[b.dataset.code] = false; } b.blur(); });
    return b;
  }
  function press(code) {
    if (code === 'menu') {
      if (menuArmedUntil > performance.now()) { location.reload(); return; }
      menuArmedUntil = performance.now() + 3000; home.querySelector('span').textContent = 'LEAVE RUN?'; home.setAttribute('aria-label', 'Tap again within three seconds to leave this run'); return;
    }
    K.testKey(code);
    if (K.sfx) { K.sfx.init(); K.sfx.resume(); }
  }
  function vibrate(ms) { if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (_) {} } }
  function reset() {
    pointers.clear(); joy = look = pinch = null; pinchDistance = 0;
    for (const h of held.values()) { K.keys[h.code] = false; h.b.classList.remove('down'); } held.clear();
    if (K.touch) { K.touch.x = K.touch.z = 0; K.touch.sprint = false; }
    if (stick) { stick.hidden = true; stick.classList.remove('sprint'); knob.style.transform = ''; hint.hidden = false; }
  }
  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function moveStick(p) {
    const dx = p.x - ox, dy = p.y - oy, d = Math.hypot(dx, dy), length = Math.min(d, radius);
    const amount = clamp((length - 7) / (radius - 7), 0, 1), scale = d ? amount / d : 0;
    K.touch.x = dx * scale; K.touch.z = -dy * scale;
    K.touch.sprint = amount > (K.touch.sprint ? .78 : .9);
    knob.style.transform = 'translate(' + (d ? dx * length / d : 0) + 'px,' + (d ? dy * length / d : 0) + 'px)';
    stick.classList.toggle('sprint', K.touch.sprint);
  }
  function down(e) {
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
    if (K.game.state !== 'play') return;
    e.preventDefault();
    const p = { x: e.clientX, y: e.clientY }; pointers.set(e.pointerId, p);
    e.currentTarget.setPointerCapture(e.pointerId);
    if (p.x < innerWidth / 2 && joy === null) {
      joy = e.pointerId; ox = p.x; oy = p.y;
      stick.style.left = ox + 'px'; stick.style.top = oy + 'px'; stick.hidden = false; hint.hidden = true; moveStick(p);
    } else if (look === null) look = e.pointerId;
    else if (pinch === null) {
      pinch = e.pointerId; pinchDistance = distance(pointers.get(look), p); pinchZoom = K.zoom || 1;
    }
  }
  function move(e) {
    const p = pointers.get(e.pointerId); if (!p) return;
    e.preventDefault(); const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (e.pointerId === joy) moveStick(p);
    else if (pinch !== null && (e.pointerId === look || e.pointerId === pinch)) {
      const d = distance(pointers.get(look), pointers.get(pinch));
      if (d > 4 && pinchDistance > 4) K.zoom = clamp(pinchZoom * pinchDistance / d, .7, 1.5);
      K.inp.lastManual = performance.now();
    } else if (e.pointerId === look) {
      K.inp.camYaw -= dx * .006; K.inp.camPitch = clamp(K.inp.camPitch + dy * .004, -.5, .7); K.inp.lastManual = performance.now();
    }
  }
  function up(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (e.pointerId === joy) { joy = null; K.touch.x = K.touch.z = 0; K.touch.sprint = false; stick.hidden = true; hint.hidden = false; }
    if (e.pointerId === look) { look = pinch; pinch = null; }
    else if (e.pointerId === pinch) pinch = null;
  }
  function sync() {
    if (!root || !active || !K.game) return;
    if (UI.cam && UI.cam.position) UI.cam.position.z = -12 * (Math.max(1, 1.55 / (innerWidth / innerHeight)) - 1);
    const familyAlbum = document.getElementById('lf-album');
    if (menuArmedUntil && (performance.now() >= menuArmedUntil || K.game.state !== 'paused')) { menuArmedUntil = 0; home.querySelector('span').textContent = 'MENU'; home.setAttribute('aria-label', 'Return to menu'); }
    const state = K.game.state, album = !document.getElementById('album').hidden || !!UI.mapOpen || !!(familyAlbum && !familyAlbum.hidden), wheel = !!(K.agent && K.agent.open);
    if (state !== lastState || album !== lastAlbum || wheel !== lastWheel) {
      reset(); lastState = state; lastAlbum = album; lastWheel = wheel;
      root.hidden = !['title', 'intro', 'play', 'paused', 'end'].includes(state) || album || wheel;
      playUI.hidden = state !== 'play'; toolbar.hidden = state !== 'play' && state !== 'intro';
      menu.hidden = !['title', 'paused', 'end'].includes(state) || album || wheel;
      primary.querySelector('span').textContent = state === 'title' ? 'LET’S GO!' : state === 'end' ? 'AGAIN!' : 'KEEP RUNNING';
      primary.setAttribute('aria-label', state === 'title' ? 'Start game' : state === 'end' ? 'Play again' : 'Resume game');
      primary.dataset.code = state === 'paused' ? 'KeyP' : 'Enter';
      restart.hidden = home.hidden = state !== 'paused';
      document.body.dataset.touchState = state;
    }
  }
  function mount() {
    if (root) return;
    const style = document.createElement('style'); style.textContent = `
      body.touch-mobile,body.touch-mobile #app{overscroll-behavior:none;touch-action:pan-y;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
      .touch-mobile #stage{touch-action:none}
      .touch-mobile #kt-toggle,.touch-mobile #touch,.touch-mobile #albumBtn,.touch-mobile #pauseBtn,.touch-mobile #help{display:none!important}
      #touch-controls{position:fixed;inset:0;z-index:8;pointer-events:none;touch-action:none;color:var(--ink)}
      #touch-play{position:absolute;inset:0} .touch-zone{position:absolute;top:0;bottom:0;width:50%;pointer-events:auto;touch-action:none}.touch-left{left:0}.touch-right{right:0}
      .touch-button{box-sizing:border-box;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:2px;border:3px solid var(--ink);border-radius:22px;background:var(--paper);color:var(--ink);box-shadow:0 6px 0 var(--ink),inset 0 3px 0 #ffffff9c;font:400 14px/1 var(--round);padding:8px;pointer-events:auto;touch-action:none;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .08s,box-shadow .08s}
      .touch-button svg{width:28px;height:28px;fill:none;stroke:currentColor;stroke-width:2.8;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}.touch-button span{pointer-events:none}
      .touch-button.down,.touch-button:active{transform:translateY(5px) scale(.96)!important;box-shadow:0 1px 0 var(--ink),inset 0 3px 0 #0002;filter:brightness(1.13)}
      #touch-actions{position:absolute;right:calc(16px + env(safe-area-inset-right,0px));bottom:calc(26px + env(safe-area-inset-bottom,0px));display:grid;grid-template-columns:70px 78px;grid-template-rows:58px 70px 78px;gap:12px}
      .touch-jump{grid-column:2;grid-row:3;background:var(--gold);border-radius:50%;font-size:16px;transform:rotate(5deg)}
      .touch-bark{grid-column:1;grid-row:2;background:var(--orange);transform:rotate(-6deg)}
      .touch-act{grid-column:2;grid-row:2;background:var(--teal);font-size:12px;transform:rotate(4deg)}
      .touch-agent{grid-column:2;grid-row:1;background:#c4afff;font-size:12px;border-radius:18px}
      .touch-pee{grid-column:1;grid-row:3;align-self:center;height:60px;background:#fff4de;font-size:12px;transform:rotate(-4deg)}
      #touch-top{position:absolute;right:calc(12px + env(safe-area-inset-right,0px));top:calc(12px + env(safe-area-inset-top,0px));display:flex;gap:10px}#touch-top .touch-button{width:46px;height:46px;border-radius:14px;padding:7px}#touch-top span{display:none}
      #touch-stick{position:absolute;width:118px;height:118px;margin:-59px;border:3px solid var(--ink);box-sizing:border-box;border-radius:50%;background:#fff4de55;box-shadow:0 0 0 6px #fff4de33,0 5px 0 #24163488;pointer-events:none}
      #touch-stick:before{content:'';position:absolute;inset:11px;border:2px dashed #fff4decc;border-radius:50%}#touch-stick:after{content:'ZOOMIES!';position:absolute;bottom:calc(100% + 14px);left:50%;transform:translateX(-50%) rotate(-7deg);font:22px var(--comic);padding:4px 10px;border:2px solid var(--ink);border-radius:9px;background:var(--gold);opacity:0}
      #touch-stick.sprint{background:#ffcf3f66;border-color:#ffcf3f}#touch-stick.sprint:after{opacity:1}
      #touch-knob{position:absolute;left:32px;top:32px;width:48px;height:48px;box-sizing:border-box;border-radius:50%;border:3px solid var(--ink);background:var(--gold);box-shadow:0 4px 0 var(--ink),inset 0 4px 0 #fff7;display:grid;place-items:center;font:26px var(--round)}
      #touch-hint{position:absolute;left:calc(24px + env(safe-area-inset-left,0px));bottom:calc(82px + env(safe-area-inset-bottom,0px));width:124px;text-align:center;color:var(--paper);font:18px/1.4 var(--comic);letter-spacing:.06em;text-shadow:0 2px 0 var(--ink),2px 0 0 var(--ink),-2px 0 0 var(--ink)}
      #touch-hint b{display:grid;place-items:center;margin:0 auto 10px;width:62px;height:62px;border:2px dashed #fff4deaa;border-radius:50%;background:#24163444;font:32px var(--round)}#touch-hint small{display:block;font:11px var(--body);letter-spacing:0}
      #touch-menu{position:absolute;bottom:calc(28px + env(safe-area-inset-bottom,0px));left:50%;transform:translateX(-50%);width:min(340px,calc(100% - 36px));display:flex;flex-wrap:wrap;gap:12px}
      #touch-menu .touch-primary{width:100%;min-height:64px;background:var(--gold);font:25px var(--round);transform:rotate(-2deg)}#touch-menu .touch-secondary{flex:1;min-height:48px;font-size:14px;background:var(--teal)}#touch-menu .touch-home{background:var(--pink)}
      .touch-mobile #hudBtns{z-index:10;right:calc(14px + env(safe-area-inset-right,0px));top:calc(72px + env(safe-area-inset-top,0px))}.touch-mobile #hudBtns button{width:44px;height:44px}
      .touch-mobile #kt-menu{z-index:30}.touch-mobile #bigmap{z-index:40}
      .touch-mobile #stamBox{bottom:auto;top:calc(174px + env(safe-area-inset-top,0px));width:100px;padding:5px 8px}.touch-mobile #stamBox .lab{font-size:11px}.touch-mobile #radio{bottom:calc(300px + env(safe-area-inset-bottom,0px));max-width:190px;font-size:10px}
      .touch-mobile #prompt{bottom:calc(288px + env(safe-area-inset-bottom,0px));max-width:min(85%,34rem);white-space:normal;text-align:center;font-size:17px;line-height:1.15;padding:8px 12px}
      .touch-mobile:not([data-touch-state="play"]) #lf-counter,.touch-mobile:not([data-touch-state="play"]) #lf-family-button,.touch-mobile:not([data-touch-state="play"]) #lf-prompt{display:none}
      .touch-mobile #lf-counter{top:calc(218px + env(safe-area-inset-top,0px));bottom:auto;left:calc(12px + env(safe-area-inset-left,0px))}
      .touch-mobile #lf-family-button{top:calc(250px + env(safe-area-inset-top,0px));bottom:auto;left:calc(12px + env(safe-area-inset-left,0px));min-height:44px}
      .touch-mobile #album .alb{touch-action:pan-y;overscroll-behavior:contain}.touch-mobile #album .ahd{flex-wrap:wrap;gap:8px;position:sticky;top:-12px;background:var(--paper);z-index:2;padding-bottom:6px}.touch-mobile #album .ahd span{font-size:23px}.touch-mobile #albCount{font-size:16px;padding:5px 8px}.touch-mobile #albX{width:46px;height:46px}
      @media(max-width:600px){
        #touch-top{display:grid;grid-template-columns:48px 48px}#touch-top .touch-button{width:48px;height:48px}#touch-top .touch-button:last-child{grid-column:2;grid-row:1}#touch-top .touch-button:nth-child(2){grid-column:2;grid-row:2}.touch-mobile #hudBtns{top:132px}

        .touch-mobile #mmWrap{width:72px;height:72px;left:calc(12px + env(safe-area-inset-left,0px));top:calc(14px + env(safe-area-inset-top,0px))}.touch-mobile #topC{left:45%;top:calc(16px + env(safe-area-inset-top,0px))}.touch-mobile #letters{gap:3px}.touch-mobile #letters .L{width:21px;height:29px;font-size:19px;border-width:2px;border-radius:6px}.touch-mobile #timer{font-size:13px}
        .touch-mobile #tokBox{left:12px;right:auto;top:102px;min-width:100px;padding:5px 8px}.touch-mobile #tokNum{font-size:19px}.touch-mobile #tokBox .lab{font-size:10px}.touch-mobile #tokBox .bar{height:5px;margin-top:3px}.touch-mobile #paws{position:absolute;left:100%;top:7px;gap:0;margin-left:8px}.touch-mobile #paws i{width:19px;height:19px}
        .touch-mobile #stamBox{top:168px}.touch-mobile #banner{top:clamp(300px,42vh,390px);max-width:90%;white-space:normal}.touch-mobile #banner .big{font-size:clamp(32px,10vw,42px);line-height:.95}.touch-mobile #banner .small{font-size:11px;line-height:1.15}
        .touch-mobile #end{bottom:calc(132px + env(safe-area-inset-bottom,0px))}
      }
      @media(orientation:landscape) and (max-height:600px){
        #touch-actions{grid-template-columns:62px 70px;grid-template-rows:48px 58px 66px;gap:9px;bottom:calc(16px + env(safe-area-inset-bottom,0px))}.touch-button{font-size:12px;padding:5px}.touch-button svg{width:24px;height:24px}.touch-pee{height:54px}#touch-hint{bottom:calc(20px + env(safe-area-inset-bottom,0px))}#touch-menu{bottom:20px;flex-wrap:nowrap;width:auto;min-width:350px}#touch-menu .touch-primary{width:auto;min-width:170px;min-height:52px;font-size:20px}#touch-menu .touch-secondary{min-width:94px}
        .touch-mobile #lf-counter{top:calc(142px + env(safe-area-inset-top,0px));left:12px}.touch-mobile #lf-family-button{top:calc(178px + env(safe-area-inset-top,0px));left:12px}
        .touch-mobile #mmWrap{width:68px;height:68px}.touch-mobile #tokBox{left:103px;right:auto;top:14px;min-width:90px;padding:4px 8px}.touch-mobile #tokNum{font-size:19px}.touch-mobile #paws{display:none}.touch-mobile #stamBox{left:103px;top:86px}.touch-mobile #hudBtns{top:70px}.touch-mobile #prompt{bottom:24px;max-width:38%;font-size:15px;line-height:1.15}.touch-mobile #banner{top:clamp(112px,48vh,190px);max-width:58vw}.touch-mobile #banner .big{font-size:clamp(26px,6vw,42px)}.touch-mobile #banner .small{font-size:10px;line-height:1.15;margin-top:7px}.touch-mobile #radio{bottom:95px;right:190px}.touch-mobile #end{top:26%;right:20px;transform:none;gap:8px}body[data-touch-state="end"] #touch-menu{min-width:0;width:220px;left:auto;right:65px;transform:none}body[data-touch-state="end"] #touch-menu .touch-primary{width:100%}.touch-mobile #end .card{width:86px;padding:6px}.touch-mobile #end .card svg{width:28px;height:28px}.touch-mobile #end .card b{font-size:17px}.touch-mobile #end .card span{font-size:12px}
      }
      @media(prefers-reduced-motion:reduce){.touch-button{transition:none}}
    `; document.head.appendChild(style);
    root = document.createElement('div'); root.id = 'touch-controls'; root.hidden = true;
    playUI = document.createElement('div'); playUI.id = 'touch-play';
    for (const side of ['left', 'right']) {
      const zone = document.createElement('div'); zone.className = 'touch-zone touch-' + side; zone.setAttribute('aria-label', side === 'left' ? 'Move joystick' : 'Drag to look; pinch to zoom');
      zone.addEventListener('pointerdown', down); zone.addEventListener('pointermove', move);
      zone.addEventListener('pointerup', up); zone.addEventListener('pointercancel', up); zone.addEventListener('lostpointercapture', up); playUI.appendChild(zone);
    }
    hint = document.createElement('div'); hint.id = 'touch-hint'; hint.innerHTML = '<b>✥</b>DRAG TO RUN<small>Push farther for zoomies</small>'; playUI.appendChild(hint);
    stick = document.createElement('div'); stick.id = 'touch-stick'; stick.hidden = true;
    knob = document.createElement('div'); knob.id = 'touch-knob'; knob.textContent = '✥'; stick.appendChild(knob); playUI.appendChild(stick);
    const actions = document.createElement('div'); actions.id = 'touch-actions';
    actions.appendChild(button('JUMP', 'jump', 'Space', 'touch-jump'));
    actions.appendChild(button('BARK', 'bark', 'KeyB', 'touch-bark'));
    actions.appendChild(button('ACT / ENTER', 'act', 'KeyE', 'touch-act'));
    actions.appendChild(button('AGENT', 'agent', 'KeyQ', 'touch-agent'));
    pee = button('PEE', 'pee', 'KeyF', 'touch-pee'); actions.appendChild(pee); playUI.appendChild(actions);
    toolbar = document.createElement('div'); toolbar.id = 'touch-top'; toolbar.appendChild(button('Album', 'album', 'Tab')); toolbar.appendChild(button('Map', 'map', 'KeyL')); toolbar.appendChild(button('Pause', 'pause', 'KeyP'));
    menu = document.createElement('div'); menu.id = 'touch-menu'; primary = button('LET’S GO!', null, 'Enter', 'touch-primary'); restart = button('RESTART', null, 'KeyR', 'touch-secondary'); home = button('MENU', null, 'menu', 'touch-secondary touch-home'); menu.append(primary, restart, home);
    root.append(playUI, toolbar, menu); document.getElementById('app').appendChild(root);
    const oldReset = K.resetTouch; K.resetTouch = function () { if (oldReset) oldReset(); reset(); };
    K.touch = K.touch || { x: 0, z: 0, sprint: false };
    const enable = () => { active = true; document.body.classList.add('touch-mobile'); lastState = ''; sync(); };
    if (K.coarse || navigator.maxTouchPoints > 0) enable();
    addEventListener('pointerdown', e => { if (!active && e.pointerType === 'touch') enable(); }, { capture: true });
    addEventListener('blur', reset); addEventListener('resize', reset); document.addEventListener('visibilitychange', reset);
    document.addEventListener('contextmenu', e => { if (active) e.preventDefault(); });
    document.addEventListener('gesturestart', e => { if (active) e.preventDefault(); }, { passive: false });
  }
  const buildTouch = UI.buildTouch;
  UI.buildTouch = function () { const result = buildTouch.apply(this, arguments); mount(); return result; };
  for (const name of ['showPause', 'showEnd', 'album', 'bigMap']) {
    const original = UI[name];
    if (original) UI[name] = function () { const result = original.apply(this, arguments); sync(); return result; };
  }
  const update = UI.update;
  UI.update = function () { const result = update.apply(this, arguments); sync(); return result; };
  K.on('start', reset); K.on('end', reset);
  // Public life.hydrants uses the same 3.2m / 1.5m vertical interaction range
  // as feat_life. If no proximity data is exposed, keep the action available.
  K.on('frame', dt => {
    if (!active || !pee) return;
    proximityT -= dt; if (proximityT > 0) return; proximityT = .16;
    const life = K.life;
    let nearby = life && (typeof life.nearHydrant === 'function' ? life.nearHydrant() : life.nearHydrant);
    if (nearby === undefined && life && Array.isArray(life.hydrants) && K.A && K.A.player) {
      const p = K.A.player; nearby = false;
      for (const h of life.hydrants) {
        if ((h.x - p.x) ** 2 + (h.z - p.z) ** 2 < 3.2 ** 2 && Math.abs(h.y - p.y) < 1.5) { nearby = true; break; }
      }
    }
    pee.hidden = nearby === false || nearby === null;
    const ready = UI.actionReady || {};
    for (const b of playUI.querySelectorAll('[data-code]')) b.classList.toggle('ready', !!ready[b.dataset.code.slice(3)]);
  });
  K.scenes = K.scenes || {};
  K.scenes.touch = h => { h.play(); h.st(12); };
  K.scenes.touch_run = h => {
    h.play(); ox = 86; oy = innerHeight - 135;
    stick.style.left = ox + 'px'; stick.style.top = oy + 'px'; stick.hidden = false; hint.hidden = true;
    moveStick({ x: ox + 15, y: oy - 58 }); h.st(5);
  };
  K.scenes.touch_album = h => { h.play(); K.game.albumKey(); h.st(2); };
  // Browser integration checks run only when explicitly selected as a review scene.
  // Uses real DOM click activation and the production simulation; pointer math is
  // separately exercised by assets/touch/input_test.mjs.
  K.scenes.touch_checks = h => {
    const checks = [];
    const assert = (ok, name) => { if (!ok) throw new Error('touch: ' + name); checks.push(name); };
    const click = node => { node.click(); h.st(1); };
    sync();
    assert(active && !root.hidden, 'mobile enabled');
    click(primary); assert(K.game.state === 'intro', 'title starts intro');
    h.play(); sync();
    click(toolbar.children[2]); assert(K.game.state === 'paused' && !menu.hidden && playUI.hidden, 'pause');
    click(primary); assert(K.game.state === 'play' && menu.hidden, 'resume');
    click(toolbar.children[0]); assert(UI.albumOpen && root.hidden, 'album');
    click(document.getElementById('albX')); assert(K.game.state === 'play' && !root.hidden, 'album close');
    click(toolbar.children[1]); assert(UI.mapOpen && root.hidden, 'map');
    click(document.querySelector('.bm-close')); assert(!UI.mapOpen && K.game.state === 'play', 'map close');
    click(document.querySelector('.touch-jump')); assert(!K.A.player.onGround, 'jump');
    h.st(60);
    click(document.querySelector('.touch-bark')); assert(K.A.player.barkT > 0, 'bark');
    click(document.querySelector('.touch-agent')); if (K.agent) assert(K.agent.open, 'agent wheel');
    if (K.agent && K.agent.open) { for (const slot of document.querySelectorAll('.kt-slot')) { const r = slot.getBoundingClientRect(); assert(r.width >= 48 && r.height >= 48 && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, 'wheel target fits'); } K.agent.toggle(); sync(); }
    K.fn.endGame(true); h.st(1); assert(!menu.hidden && playUI.hidden, 'end menu');
    click(primary); assert(K.game.state === 'play', 'replay');
    for (const b of document.querySelectorAll('#touch-actions button')) {
      if (b.hidden) continue;
      const r = b.getBoundingClientRect();
      assert(r.width >= 48 && r.height >= 48 && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, 'target ' + b.dataset.code);
    }
    console.warn('TOUCH_CHECK PASS ' + checks.length); K.touchReview = checks; UI.banner('TOUCH READY', checks.length + ' browser checks', 'go'); h.st(1);
  };
})(window.K);
