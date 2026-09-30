/* Integration polish: short contextual hints and endpoint-driven review journeys. */
(function (K) {
'use strict';
const A = K.A, UI = K.UI;
K.on('frame', (dt, tt, g) => {
  if (g.state !== 'play' || (K.agent && K.agent.open) || !document.getElementById('banner').hidden) return;
  const hint = (id, title, text) => { g.told[id] = true; UI.banner(title, text); };
  if (!g.told.move && g.time > 6 && g.time < 14) hint('move', 'GO EXPLORE', K.coarse ? 'drag to run · push farther for zoomies' : 'WASD to run · Shift for zoomies');
  else if (!g.told.wheel && g.time > 14 && g.tokens >= 512) hint('wheel', 'A LITTLE HELP?', K.coarse ? 'tap AGENT to spend your tokens' : 'Q · Kyotoken has a few good ideas');
});
if (!/[?&]test=1\b/.test(location.search)) return;
const scenes = K.scenes = K.scenes || {};
const assert = (ok, message) => { if (!ok) throw new Error('POLISH: ' + message); };
function metrics() {
  const r = K.renderer, prev = r.info.autoReset, samples = [];
  r.info.autoReset = false;
  try {
    for (let i = 0; i < 28; i++) { r.info.reset(); const t = performance.now(); K.render(12); if (i > 3) samples.push(performance.now() - t); }
    samples.sort((a, b) => a - b);
    return { calls: r.info.render.calls, triangles: r.info.render.triangles, geometries: r.info.memory.geometries, textures: r.info.memory.textures, medianSubmitMs: +samples[12].toFixed(2), viewport: [K.VW, K.VH] };
  } finally { r.info.autoReset = prev; }
}
scenes.hud = h => {
  h.play(); h.pz.wait=999; h.g.tokens=4096; h.st(12);
  h.g.told.move=h.g.told.wheel=true; K.$('#banner').hidden=true;
};
scenes.clues = h => {
  h.play(); h.pz.wait=999; h.g.tokens=4096;
  const hydrant=K.life.hydrants.reduce((a,b)=>Math.hypot(a.x+345,a.z+200)<Math.hypot(b.x+345,b.z+200)?a:b);
  h.go(hydrant.x+1.5,hydrant.z+1); h.P.heading=Math.PI; h.P.inv=999;
  const c=A.cars.find(c=>c.kind==='waymo');
  Object.assign(c,{x:hydrant.x+5,z:hydrant.z,heading:0,mode:'parked',speed:0,v:0});
  if(!c.g.parent)A.carGroup.add(c.g);c.g.visible=true;c.g.position.set(c.x,K.W.terrainH(c.x,c.z),c.z);c.g.rotation.set(0,0,0);
  const mail=K.life.carriers[0];Object.assign(mail,{x:hydrant.x-4,z:hydrant.z+1,y:K.W.terrainH(hydrant.x-4,hydrant.z+1),cooldown:0,goalX:hydrant.x-4,goalZ:hydrant.z+1});mail.place();
  h.st(2); K.sceneCam={noClip:true,pos:new K.T.Vector3(hydrant.x+12,hydrant.y+9,hydrant.z+17),look:new K.T.Vector3(hydrant.x+2,hydrant.y+1.3,hydrant.z)};
  h.st(1);UI.updateActionCues();K.$('#banner').hidden=true;
  console.warn('HUD_CLUES '+JSON.stringify({ready:UI.actionReady,targets:UI.actionCues.map(t=>t.key+':'+t.label),badges:document.querySelectorAll('.world-cue:not([hidden])').length}));
};
scenes.hud_checks = h => {
  scenes.clues(h); K.sceneCam=null;
  assert(UI.actionReady.E && UI.actionReady.F && UI.actionReady.Q,'E/F/Q readiness follows production gates');
  assert(document.querySelectorAll('.world-cue:not([hidden])').length>=2,'E and F badges visibly projected above targets');
  assert(document.querySelectorAll('#shortcutBar button').length===11,'all eleven shortcuts');
  const toggle=document.getElementById('shortcutToggle');toggle.click();assert(document.getElementById('shortcutBar').hidden,'collapse controls');toggle.click();
  const hydrant=UI.actionCues.find(t=>t.key==='F').o;hydrant.cooldown=10;UI.updateActionCues();assert(!UI.actionReady.F,'cooldown clears pee cue');hydrant.cooldown=0;UI.updateActionCues();
  const cv=K.renderer.domElement;
  const zoom=K.zoom || 1;cv.dispatchEvent(new WheelEvent('wheel',{deltaY:80}));assert(K.zoom>zoom,'wheel zoom retained');K.zoom=zoom;
  const move=(x,y)=>cv.dispatchEvent(new PointerEvent('pointermove',{pointerType:'mouse',clientX:x,clientY:y}));
  cv.dispatchEvent(new PointerEvent('pointerenter',{pointerType:'mouse',clientX:300,clientY:240}));
  let yaw=h.g.camYaw;move(360,260);h.st(12);assert(Math.abs(h.g.camYaw-yaw)>.08 && K.inp.camPitch>0,'hover orbit without mouse button');
  move(K.VW-1,260);h.st(20);yaw=h.g.camYaw;h.st(35);assert(Math.abs(h.g.camYaw-yaw)>.3,'resting at edge keeps rotating');
  cv.dispatchEvent(new PointerEvent('pointerleave',{pointerType:'mouse'}));h.st(40);yaw=h.g.camYaw;h.st(30);assert(Math.abs(h.g.camYaw-yaw)<.001,'leaving canvas stops edge turning');
  K.locked=true;document.dispatchEvent(new Event('pointerlockchange'));assert(h.g.state==='play','pointer unlock never pauses');
  document.dispatchEvent(new Event('pointerlockerror'));assert(h.g.state==='play','pointer lock denial degrades gracefully');
  h.g.pause(true);yaw=h.g.camYaw;move(700,300);h.st(10);assert(h.g.camYaw===yaw,'menu blocks camera movement');h.g.pause(false);
  K.resetInput();scenes.clues(h);
  console.warn('HUD_CHECKS PASS hover / edge / leave / lock fallback / pause / readiness / controls');
};
scenes.polish_perf = h => { h.play(); h.go(12, -30); h.st(8); console.warn('POLISH_PERF ' + JSON.stringify(metrics())); };
scenes.polish_map = h => { h.play(); h.st(1, ['KeyL']); assert(UI.mapOpen && h.g.state === 'paused', 'L opens map'); };
scenes.polish_life_repeat = h => { scenes.surf_test(h); scenes.lifecheck(h); };
scenes.polish_systems = h => {
  scenes.ceos_check(h);
  const rockets = h.g.inv.rocket; h.g.tokens = Math.max(h.g.tokens, 4096);
  assert(rockets > 0 && K.agent.cast(5), 'Elon pickup feeds rocket ability');
  h.st(220); assert(h.g.inv.rocket === rockets - 1 && !A.pascal.ext, 'acquired rocket lands and consumes once');
  scenes.boss_check(h); scenes.agents_check(h); scenes.surf_test(h); scenes.lifecheck(h);
  console.warn('POLISH_SYSTEMS PASS CEO→rocket / Vespa→meeting / agents / surf→Alcatraz / hydrant→postcards→family');
};
scenes.polish_check = h => {
  let checks = 0; const check = (ok, msg) => { assert(ok, msg); checks++; };
  h.g.start(); h.st(12); check(h.g.state === 'intro', 'title starts intro'); h.st(1, ['Enter']); check(h.g.state === 'play', 'intro skips into play');
  h.P.inv = 999; A.pascal.wait = 999;
  h.st(1, ['KeyQ']); check(K.agent.open, 'Q opens wheel'); h.st(1, ['KeyP']); check(h.g.state === 'play' && !K.agent.open, 'P only closes wheel'); h.st(1); h.st(1, ['KeyP']);
  const time = h.g.time; h.st(6); check(h.g.time === time, 'pause freezes simulation'); h.st(1, ['KeyP']); check(h.g.state === 'play', 'P resumes');
  h.st(1, ['KeyL']); check(UI.mapOpen, 'map opens'); h.st(1, ['Tab']); check(UI.albumOpen && !UI.mapOpen, 'album replaces map'); h.st(1, ['Tab']); check(h.g.state === 'play', 'album resumes');
  K.life.openAlbum(); check(h.g.state === 'paused', 'family pauses'); h.g.pause(false); check(document.getElementById('lf-album').hidden, 'external resume closes family');
  const cv = K.renderer.domElement, yaw = h.g.camYaw, capture = cv.setPointerCapture; cv.setPointerCapture = () => {}; // Synthetic pointer has no OS capture target.
  cv.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 987, pointerType: 'mouse', button: 2, clientX: 220, clientY: 220 }));
  cv.dispatchEvent(new PointerEvent('pointermove', { pointerId: 987, pointerType: 'mouse', clientX: 260, clientY: 235 }));
  cv.dispatchEvent(new PointerEvent('pointerup', { pointerId: 987, pointerType: 'mouse', button: 2, clientX: 260, clientY: 235 }));
  cv.setPointerCapture = capture; h.st(1); check(h.g.camYaw !== yaw && !K.inp.dragging, 'mouse orbit moves and releases');
  for (let i = 0; i < 8; i++) {
    h.g.start(true); h.go(20, -30); h.P.inv = 999; A.pascal.wait = 999; h.st(3); h.g.tokens = 20000; h.g.inv.rocket = 1;
    if (i === 7 && 'sharkState' in K.agent) { h.go(242,110); const spot=K.W.free(246,102,1.1); Object.assign(A.pascal,{x:spot[0],z:spot[1],y:K.W.terrainH(spot[0],spot[1]),wait:999,safe:null}); A.pascal.place(); }
    h.st(1, ['Digit' + (i + 1)]); check(K.agent.cooldowns[i] === 0 && h.g.tokens === 20000, 'closed wheel ignores digit ' + (i + 1));
    h.st(1, ['KeyQ']); h.st(1, ['Digit' + (i + 1)]); check(K.agent.cooldowns[i] > 0, 'ability ' + (i + 1) + ' activates from keyboard');
    check(h.g.tokens === 20000 - K.agent.abilities[i][1], 'ability ' + (i + 1) + ' spends once');
    if (i === 0 || i === 1 || i === 5) { check(!!A.pascal.ext, 'Pascal controlled'); h.st(280); check(!A.pascal.ext, 'Pascal released'); }
    if (i === 2) check(K.life.skaters.length > 0, 'skater delivery registered');
    if (i === 3) { h.st(100); check(h.g.buffs.turbo > 0, 'snack arrives'); }
    if (i === 4) { h.st(90); check(h.P.mode === 'car', 'Waymo boards'); h.st(950); check(h.P.mode === 'walk', 'Waymo times out safely'); }
    if (i === 5) check(h.g.inv.rocket === 0, 'rocket consumed once');
    if (i === 6) check(h.g.buffs.ghost > 0, 'confetti protects');
    if (i === 7) check('sharkState' in K.agent ? K.agent.active === 7 && !!K.agent.sharkState : h.g.buffs.jammer > 0, 'eighth ability enters its active state');
  }
  h.g.start(true); h.st(4); h.g.pause(true); h.st(1); h.g.pause(false); h.st(1); const before = metrics();
  for (let i = 0; i < 2; i++) { h.g.pause(true); h.st(1); h.g.start(true); h.st(2); }
  const after = metrics(); check(after.geometries <= before.geometries + 2, 'pause/restart geometries bounded');
  check(!h.P.ext && !A.pascal.ext && !K.agent.open && !UI.mapOpen && h.g.inv.rocket === undefined, 'restart cleans owners and inventory');
  check(getComputedStyle(document.getElementById('hud')).visibility !== 'hidden', 'restart restores HUD');
  K.fn.endGame(false); h.st(1); check(h.g.state === 'end', 'end screen'); h.st(1, ['Enter']); check(h.g.state === 'play', 'replay starts');
  console.warn('POLISH_CHECK PASS ' + checks + ' ' + JSON.stringify({ before, after }));
};
scenes.polish_round2 = h => {
  let n = 0; const check = (ok, msg) => { assert(ok, msg); n++; };
  h.play(); h.P.inv = 999; A.pascal.wait = 999;
  for (const key of ['Escape', 'Tab', 'KeyP']) {
    h.st(1, ['KeyQ']); check(K.agent.open, 'wheel opened for ' + key);
    window.dispatchEvent(new KeyboardEvent('keydown', {code:key, bubbles:true}));
    window.dispatchEvent(new KeyboardEvent('keyup', {code:key, bubbles:true})); h.st(1);
    check(!K.agent.open && h.g.state === 'play' && !UI.albumOpen, key + ' dismisses only');
  }
  const resources = performance.getEntriesByType('resource');
  check(!resources.some(r => r.name.includes('/photos/') && r.initiatorType === 'fetch'), 'no startup photo prefetch probes');
  const portraits = resources.filter(r => r.name.includes('/art/ceo/'));
  check(new Set(portraits.map(r => r.name)).size === portraits.length, 'static CEO art requested at most once per file');
  let acts = 0, steps = 0, largest = 0;
  const observe = (dt) => { acts += K.inp.act ? 1 : 0; steps++; largest = Math.max(largest, dt); };
  K.on('step', observe);
  h.st(1, ['KeyQ', 'KeyE']); check(acts === 0 && K.agent.open, 'simultaneous Q/E cannot act');
  h.st(1, ['KeyE']); check(acts === 0 && h.P.mode === 'walk', 'wheel blocks interaction');
  K.agent.toggle(); h.g.hitStop = 0; steps = 0; largest = 0; const time = h.g.time;
  K.step(1, .1, []); check(steps === 4 && largest <= 1/60 + 1e-8 && h.g.time - time <= 4/60 + 1e-8, 'hitch capped to four fixed substeps');
  UI.clearPrompt('main'); UI.clearPrompt('hydrant'); UI.clearPrompt('surf');
  let tapped = false;
  UI.prompt('SURF', {source:'test-surf',priority:20}); UI.prompt('HYDRANT', {source:'test-hydrant',priority:40}); UI.prompt('PHOTO', {source:'test-photo',priority:50});
  check(UI.hud.promptT.textContent === 'PHOTO', 'interact wins over ambience');
  UI.prompt('DANGER', {source:'test-danger',priority:90,onActivate:()=>{tapped=true;}});
  check(UI.hud.promptT.textContent === 'DANGER' && document.querySelectorAll('#lf-prompt').length === 0, 'one priority prompt surface');
  UI.hud.prompt.click(); check(tapped, 'visible prompt activates its own source');
  UI.clearPrompt('test-danger'); check(UI.hud.promptT.textContent === 'PHOTO', 'clearing winner reveals next offer');
  ['test-surf','test-hydrant','test-photo'].forEach(UI.clearPrompt);
  UI.prompt('EXPIRES', {source:'test-expiry', priority:99}); h.st(20); check(UI.hud.prompt.dataset.source !== 'test-expiry', 'stale offers expire');
  UI.reset(); UI.banner('FIRST REWARD', 'one'); UI.banner('SECOND REWARD', 'two');
  UI.updateBanner(1.1); check(UI.hud.banner.querySelector('.big').textContent === 'FIRST REWARD', 'banner gets minimum dwell');
  UI.updateBanner(.81); check(UI.hud.banner.querySelector('.big').textContent === 'SECOND REWARD', 'next reward is queued');
  UI.reset(); check(UI.hud.banner.hidden, 'restart UI reset clears queue');
  const img = document.createElement('img'); UI.photoImage(img, A.photos[0]); img.dispatchEvent(new Event('error'));
  check(img.src.startsWith('data:image/svg+xml,') && img.onerror === null, 'photo error gives one local placeholder');
  check(A.photoSrc('alcatraz') === 'photos/p_alcatraz.png', 'Alcatraz uses existing static photo');
  let endedClean = false; K.on('end', () => { endedClean = h.P.mode === 'walk' && !h.P.ext && !h.P.car && !h.P.cable && !h.P.surfing; });
  h.P.ext = () => {}; K.fn.endGame(false); check(endedClean, 'end observers see released movement modes');
  h.g.start(true); h.st(3); h.P.inv = 999; A.pascal.wait = 999;
  if (K.coarse) {
    h.g.pause(true); const home = document.querySelector('.touch-home'); home.click();
    check(home.textContent.includes('LEAVE RUN?') && h.g.state === 'paused', 'first touch MENU tap asks before leaving'); h.g.pause(false); h.st(1);
  }
  console.warn('ROUND2_CHECK PASS ' + n);
};
})(window.K);
