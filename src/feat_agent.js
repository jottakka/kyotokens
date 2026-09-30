/* KYOTOKEN — Kyoto's agent — owner: agent. Hooks only; no core function wrappers.
 * Slow motion uses the existing hitStop budget from the frame hook (75% of
 * the previous frame), keeping simulation, traffic and all other hooks in sync.
 * Only our Pascal ext is released; other features' movement owners are respected.
 * Robo-Shark borrows the surf paddleStep controller only while paddling; calls
 * that original at dt=0 to retain its plank/pose, then restores it on completion.
 * No actor damage, core wrappers, runtime asset loads, or shared-source edits.
 */
(function (K) {
  'use strict';
  const T = K.T, A = K.A, W = K.W, U = K.U;
  const abilities = [
    ['Hack GPS', 512, 12, '8s of confidently wrong turns', 'hack', '#75e3df'],
    ['Hack skates', 768, 10, '5s of involuntary disco', 'zap', '#ff9fbc'],
    ['Summon skater', 1024, 20, 'Board delivery. No subscription.', 'yoink', '#bca4ff'],
    ['DoorDash', 1024, 18, 'Snack delivery + 12s zoomies', 'gulp', '#ffad70'],
    ['Call Waymo', 2048, 40, 'Your private ride. 30 seconds.', 'honk', '#8fe5b4'],
    ['Rocket strike', 4096, 25, 'Requires Elon’s dropped rocket', 'whoosh', '#ffca62'],
    ['Deploy to prod', 1024, 16, '6s confetti cover. Ship it!', 'deploy', '#ff8fb6'],
    ['Robo-Shark', 1536, 24, 'Scares Pascal · water within 60m · land wheels', 'whoosh', '#82e5ea']
  ];
  const paths = [
    '<path d="M8 24 23 7l-3 14 13-2-16 16 3-13z"/><circle cx="30" cy="9" r="3"/>',
    '<path d="m10 8 8 3-1 12 14 4v5H8v-7l3-5z"/><circle cx="12" cy="36" r="3"/><circle cx="27" cy="36" r="3"/><path d="m27 4-3 7h6l-3 8"/>',
    '<path d="M5 24c7 9 23 9 30 0M9 22l22-9"/><circle cx="13" cy="33" r="3"/><circle cx="29" cy="31" r="3"/>',
    '<path d="M9 15h23l-2 22H11zM15 15V9a5 5 0 0 1 10 0v6"/><path d="m17 25 3 3 5-6"/>',
    '<path d="m7 18 4-10h19l4 10v14H6V18zm0 0h27M11 25h3m12 0h3M11 33v4m18-4v4M18 5h5"/>',
    '<path d="M16 27C10 14 23 5 34 5c0 12-7 24-20 21L6 34l3-12 6-3M23 27l-1 9-6-7M10 31l-5 6"/><circle cx="26" cy="13" r="3"/>',
    '<path d="m7 34 5-19 14 14zM19 13l2-8m8 13 8-3M27 8l4-4M30 26l7 4M6 8l3 3"/><circle cx="31" cy="21" r="2"/>',
    '<path d="M5 25 2 16l9 4c7-9 19-8 26 3-8 8-19 10-27 3l-8 6zM17 17l4-11 6 10M15 30l5 6 3-6M27 23h8"/><circle cx="29" cy="20" r="2"/><path d="M22 6V3m-2 0h4"/>'
  ];
  const cooldowns = new Float32Array(8), particles = [];
  let drone, ears, tail, rotors, eyes, tag, rocket, food, ring, dust, dummy; const droneMats = []; let droneOp = 1; const cf = new K.T.Vector3(), kc = new K.T.Vector3(), seg = new K.T.Vector3(), rel = new K.T.Vector3();
  let menu, panel, toggle, bank, detail, rideUI, slots = [], open = false;
  let happy = 0, chatter = 6, pickupT = 0, oldTokens = 0, t = 0, pulseT = 0, ownedStop = 0;
  let control = null, delivery = null, rideCar = null, rider = null, pendingSkater = null;
  let shark, sharkTail, sharkWheels, sharkJets, sharkLamp, sharkAntenna, sharkRipple, signal, sharkRun = null;
  let coastCache = null, coastStamp = -99;
  const SEA = -1.6, landMove = { grounded: true, dynamic: true };
  let deployT = 0, deployEmit = 0, lastHUD = '', portrait = false;
  const v = new T.Vector3(), color = new T.Color();
  const API = K.agent = { say, cast, toggle: () => setOpen(!open), abilities, cooldowns,
    get open() { return open; }, get drone() { return drone; }, get active() { return sharkRun ? 7 : control && control.kind; },
    get shark() { return shark; }, get sharkState() { return sharkRun && sharkRun.phase; }, reason };
  function sound(name) { if (K.sfx && K.sfx[name]) K.sfx[name](); }
  function say(text) { if (!tag) return; A.say(tag, text, 2.6, 'speech'); happy = 2.8; chatter = 7; }
  function feedback(i) { const P = A.player; sound(abilities[i][4]); K.fn.juice(.18, .12, .035); burst(P.x, P.y + 1.5, P.z, abilities[i][5], 22); K.UI.banner(abilities[i][0].toUpperCase(), abilities[i][3], 'hack'); happy = 3; pulseT = .6; }
  function mesh(parent, geo, mat, x, y, z, sx, sy, sz) { const m = new T.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); if (sx) m.scale.set(sx, sy, sz); parent.add(m); return m; }
  function build(scene) {
    const ball = new T.SphereGeometry(1, 16, 12), box = new T.BoxGeometry(1, 1, 1), tube = new T.CylinderGeometry(1, 1, 1, 12);
    const cream = K.toon('#fff0ce'), gold = K.toon('#dc9a3d'), ink = K.toon('#263044'), pink = K.toon('#fa79aa');
    const glow = new T.MeshBasicMaterial({ color: '#78fff0' });
    drone = new T.Group(); drone.name = 'KYOTOKEN'; scene.add(drone);
    // v2 design: cream shell + gold 'fur cap', dark visor with happy ^^ eyes, floppy retriever ears on hinges, a 6-segment plume tail
    // that wags as a travelling wave, four ducted rotors, and a bone-tipped antenna. Materials are drone-only so it can fade when in the way.
    const own = c => { const m = K.toon(c).clone(); droneMats.push(m); return m; }, ownB = (c, o) => { const m = new T.MeshBasicMaterial(Object.assign({ color: c }, o || {})); droneMats.push(m); return m; };
    const shell = own('#fff3dc'), capM = own('#e3a446'), capD = own('#c98530'), visor = own('#1c2333'), creamM = own('#fff7e6'), pinkM = own('#ff86b3'), inkM = own('#27303f');
    const eyeM = ownB('#7dfff0'), shine = ownB('#ffffff', { transparent: true, opacity: .75 }), blade = ownB('#ffffff', { transparent: true, opacity: .28, side: T.DoubleSide, depthWrite: false });
    const body = new T.Group(); drone.add(body);
    mesh(body, ball, shell, 0, 0, 0, .74, .62, .7);
    mesh(body, new T.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, 1.05), capM, 0, .03, -.02, .77, .64, .73);             // fur cap
    for (let i = 0; i < 5; i++) { const a = (i - 2) * .32; mesh(body, ball, capD, Math.sin(a) * .5, .5, .16 + Math.cos(a) * .1, .13, .07, .16).rotation.set(.4, a, 0); }   // fringe tufts over the visor
    mesh(body, ball, visor, 0, .02, .47, .54, .37, .26);
    mesh(body, ball, shine, -.2, .16, .69, .11, .045, .02).rotation.z = .35;
    eyes = [];
    for (const side of [-1, 1]) {
      const eye = new T.Group(); eye.position.set(side * .18, .05, .705); body.add(eye);
      const arc = new T.Mesh(new T.TorusGeometry(.085, .026, 6, 14, Math.PI), eyeM); eye.add(arc); eyes.push(eye);   // ^ ^
      mesh(body, ball, pinkM, side * .36, -.12, .6, .085, .045, .03);                                                   // blush
    }
    mesh(body, ball, pinkM, 0, -.2, .64, .07, .055, .035);                                                                // tongue
    mesh(body, new T.TorusGeometry(.62, .03, 6, 32), inkM, 0, -.12, 0).rotation.x = Math.PI / 2;                        // seam
    ears = [];
    for (const side of [-1, 1]) {
      const ear = new T.Group(); ear.position.set(side * .58, .34, .06); body.add(ear); ears.push(ear);
      const flap = mesh(ear, ball, capM, side * .1, -.36, 0, .17, .42, .1); flap.rotation.z = side * .22;
      mesh(ear, ball, capD, side * .13, -.62, .02, .14, .14, .09);
      const inner = mesh(ear, ball, creamM, side * .07, -.32, side * 0 + .05, .1, .3, .05); inner.rotation.z = side * .22;
    }
    tail = new T.Group(); tail.position.set(0, .12, -.6); tail.rotation.x = -.95; body.add(tail); tail.segs = [];
    let parent = tail;
    for (let i = 0; i < 6; i++) { const seg = new T.Group(); seg.position.y = i ? .15 : 0; parent.add(seg); tail.segs.push(seg);
      const r = .15 - i * .012; mesh(seg, ball, i > 3 ? creamM : capM, 0, .08, 0, r * 1.15, .13, r); parent = seg; }
    rotors = [];
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      const arm = mesh(body, tube, creamM, x * .52, .3, z * .38, .05, .36, .05); arm.rotation.set(z * .9, 0, -x * .9);
      const duct = new T.Group(); duct.position.set(x * .78, .44, z * .56); body.add(duct);
      const ring = new T.Mesh(new T.TorusGeometry(.23, .045, 8, 24), capM); ring.rotation.x = Math.PI / 2; duct.add(ring);
      const disc = new T.Mesh(new T.CircleGeometry(.2, 20), blade); disc.rotation.x = -Math.PI / 2; duct.add(disc);
      const rotor = new T.Group(); duct.add(rotor); rotors.push(rotor);
      mesh(rotor, box, inkM, 0, 0, 0, .38, .015, .05); mesh(rotor, box, inkM, 0, 0, 0, .05, .015, .38);
    }
    const ant = mesh(body, tube, inkM, .12, .78, -.05, .02, .3, .02); ant.rotation.z = -.25;
    const bone = new T.Group(); bone.position.set(.16, .94, -.05); body.add(bone);
    mesh(bone, tube, creamM, 0, 0, 0, .025, .16, .025).rotation.z = Math.PI / 2; for (const bx of [-.09, .09]) for (const by of [-.03, .03]) mesh(bone, ball, creamM, bx, by, 0, .04, .04, .04);
    mesh(body, new T.TorusGeometry(.2, .04, 6, 20), pinkM, 0, -.58, 0).rotation.x = Math.PI / 2;                        // belly light
    tag = A.tag(drone, 'KYOTOKEN', 'agent', 1.2, 80);
    food = new T.Group(); scene.add(food); food.visible = false;
    mesh(food, box, K.toon('#f8b75d'), 0, 0, 0, .65, .8, .42);
    mesh(food, new T.TorusGeometry(.2, .035, 6, 12), ink, 0, .46, 0);
    mesh(food, ball, pink, 0, .02, .22, .14, .14, .02);
    rocket = new T.Group(); scene.add(rocket); rocket.visible = false;
    mesh(rocket, tube, cream, 0, 0, 0, .22, 1.15, .22);
    const rocketRed = K.toon('#f04e45');
    mesh(rocket, new T.ConeGeometry(.23, .45, 12), rocketRed, 0, .8, 0);
    for (const side of [-1, 1]) mesh(rocket, box, rocketRed, side * .27, -.43, 0, .25, .38, .09);
    mesh(rocket, new T.ConeGeometry(.17, .8, 10), K.toon('#ff8f36'), 0, -.91, 0).rotation.z = Math.PI;
    ring = mesh(scene, new T.TorusGeometry(1, .035, 5, 48), glow); ring.rotation.x = Math.PI / 2; ring.visible = false;
    dust = new T.InstancedMesh(new T.IcosahedronGeometry(1, 0), K.toon('#ffffff').clone(), 112); dust.instanceMatrix.setUsage(T.DynamicDrawUsage); dust.frustumCulled = false; dust.setColorAt(0, color.set('#ffffff')); dust.count = 0; scene.add(dust); dummy = new T.Object3D();
    for (let i = 0; i < 112; i++) particles.push({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0, color: '#ffffff' });
    buildShark(scene, ball, box, tube);
    signal = new T.Group(); scene.add(signal); signal.visible = false;
    for (let i = 0; i < 3; i++) { const r = mesh(signal, new T.TorusGeometry(1, .045, 5, 32), new T.MeshBasicMaterial({ color: i === 1 ? '#ff83b4' : '#78fff0', transparent: true, opacity: .8 })); r.rotation.x = Math.PI / 2; r.position.y = i * .45; }
    buildUI(); drone.visible = false;
  }
  // Reusable low-poly toy geometry: broad plated silhouette, rounded safety teeth.
  function buildShark(scene, ball, box, tube) {
    const steel = K.toon('#7099ae'), light = K.toon('#d8eff2'), dark = K.toon('#233d52'), teal = K.toon('#259fae');
    const cyan = new T.MeshBasicMaterial({ color: '#6ffff4' }), red = new T.MeshBasicMaterial({ color: '#ff5368' });
    const fin = (parent, points, width, material) => {
      const vertices = [], indices = [], n = points.length;
      for (const x of [-width / 2, width / 2]) for (const yz of points) vertices.push(x, yz[0], yz[1]);
      for (let i = 1; i < n - 1; i++) indices.push(0, i + 1, i, n, n + i, n + i + 1);
      for (let i = 0; i < n; i++) { const j = (i + 1) % n; indices.push(i, j, n + j, i, n + j, n + i); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); g.setIndex(indices); g.computeVertexNormals();
      return mesh(parent, g, material);
    };
    shark = new T.Group(); shark.name = 'KYOTOKEN_ROBO_SHARK'; scene.add(shark); shark.visible = false;
    mesh(shark, ball, dark, 0, 0, 0, 1.23, 1.02, 2.3);
    mesh(shark, ball, steel, 0, .12, .12, 1.2, .96, 2.25);
    mesh(shark, ball, light, 0, -.38, .3, 1.06, .61, 1.99);
    mesh(shark, ball, steel, 0, .18, 1.52, .96, .67, 1.05);
    // A black grille and blunt cream teeth read as a smile, never a bite.
    mesh(shark, ball, dark, 0, -.28, 1.68, .87, .25, .89);
    for (let i = -2; i <= 2; i++) {
      const tooth = mesh(shark, new T.ConeGeometry(.13, .25, 4), light, i * .29, -.26, 2.23 - Math.abs(i) * .055); tooth.rotation.z = Math.PI;
    }
    const bandGeo = new T.TorusGeometry(1, .065, 5, 20);
    for (const z of [-1.15, -.35]) mesh(shark, bandGeo, dark, 0, .02, z, 1.12, .94, 1);
    const rivets = new T.InstancedMesh(new T.SphereGeometry(.085, 6, 4), light, 16), stamp = new T.Object3D();
    for (let i = 0; i < 16; i++) { const a = i % 8 * Math.PI / 4; stamp.position.set(Math.cos(a) * 1.13, .04 + Math.sin(a) * .96, i < 8 ? -.35 : -1.15); stamp.updateMatrix(); rivets.setMatrixAt(i, stamp.matrix); } shark.add(rivets);
    fin(shark, [[.68, .25], [2.08, -.85], [.76, -1.3]], .19, dark);
    fin(shark, [[.85, .04], [1.89, -.82], [.86, -1.09]], .24, teal);
    sharkLamp = mesh(shark, ball, red, 0, 1.91, -.81, .16, .13, .16);
    for (const side of [-1, 1]) {
      const wing = fin(shark, [[0, .8], [.15, -.5], [-1.45, -1.12], [-.9, .15]], .18, steel); wing.rotation.z = side * 1.12; wing.position.set(side * .86, -.18, -.15);
      mesh(shark, ball, dark, side * .98, .27, 1.04, .25, .36, .39);
      mesh(shark, ball, cyan, side * 1.16, .27, 1.08, .10, .24, .26);
      mesh(shark, ball, red, side * 1.245, .27, 1.12, .045, .115, .12);
      for (let i = 0; i < 3; i++) { const gill = mesh(shark, box, dark, side * 1.19, -.05, .38 - i * .24, .055, .38, .075); gill.rotation.x = -.25; }
    }
    sharkTail = new T.Group(); sharkTail.position.set(0, .08, -2); shark.add(sharkTail);
    mesh(sharkTail, ball, teal, 0, 0, -.43, .49, .53, .86);
    fin(sharkTail, [[0, -.55], [1.35, -1.5], [.5, -1.54], [0, -1.2], [-.95, -1.46], [-.78, -.97]], .22, steel);
    sharkAntenna = new T.Group(); sharkAntenna.position.set(0, .9, .95); shark.add(sharkAntenna);
    mesh(sharkAntenna, tube, dark, 0, .36, 0, .045, .75, .045);
    mesh(sharkAntenna, ball, cyan, 0, .77, 0, .14, .14, .14);
    sharkWheels = new T.Group(); shark.add(sharkWheels);
    for (const side of [-1, 1]) for (const z of [-1, .95]) {
      const wheel = mesh(sharkWheels, tube, dark, side * .88, -1.02, z, .32, .25, .32); wheel.rotation.z = Math.PI / 2;
      mesh(sharkWheels, ball, cyan, side * 1.02, -1.02, z, .04, .17, .17);
    }
    sharkJets = new T.Group(); shark.add(sharkJets);
    for (const side of [-1, 1]) { mesh(shark, tube, dark, side * .66, -.69, -1.14, .22, .39, .22); mesh(sharkJets, new T.ConeGeometry(.2, .85, 8), cyan, side * .66, -1.18, -1.14).rotation.z = Math.PI; }
    sharkRipple = new T.Group(); scene.add(sharkRipple); sharkRipple.visible = false;
    for (let i = 0; i < 3; i++) { const r = mesh(sharkRipple, new T.TorusGeometry(1, .06, 5, 40), new T.MeshBasicMaterial({ color: i === 1 ? '#ffffff' : '#82f5f2', transparent: true, opacity: .8, depthWrite: false })); r.rotation.x = Math.PI / 2; }
  }
  function waterHere(x, z) { return W.inLand ? !W.inLand(x, z, 1.5) : false; }
  function canBorrowPaddle() { return K.surf && K.surf.paddling && A.pascal.ext && A.pascal.ext.name === 'paddleStep'; }
  function nearestWater(force) {
    const p = A.pascal;
    if (!force && t - coastStamp < .7 && coastCache && Math.hypot(p.x - coastCache.px, p.z - coastCache.pz) < 3) return coastCache.spot;
    let spot = null;
    if (waterHere(p.x, p.z)) { const a = Math.atan2(A.player.x - p.x, A.player.z - p.z); const x = p.x + Math.sin(a) * 10, z = p.z + Math.cos(a) * 10; spot = waterHere(x, z) ? { x, z } : { x: p.x, z: p.z }; }
    for (let r = 4; r <= 60 && !spot; r += 4) for (let i = 0; i < 32; i++) { const a = i * Math.PI / 16, x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r; if (waterHere(x, z) && waterClear(x, z)) { spot = { x, z }; break; } }
    coastCache = { px: p.x, pz: p.z, spot }; coastStamp = t; return spot;
  }
  function waterClear(x, z) {
    if (x < -920 || x > 785 || z < -645 || z > 685) return false;
    return !W.forNear || !W.forNear(x, z, 1, c => c.top > .65 && c.bot < SEA + 2.5 && W.overlaps(c, x, z, 1));
  }
  function splash(x, z) {
    sharkRipple.position.set(x, SEA + .09, z); sharkRipple.visible = true;
    burst(x, SEA + .3, z, '#c9ffff', 32); burst(x, SEA + .1, z, '#3cdada', 18);
    sound('splash');
  }
  function finishShark(resume = true) {
    if (!sharkRun) return;
    const c = sharkRun, p = A.pascal;
    if (p.ext === c.ext) {
      p.ext = resume && c.previous && K.surf && K.surf.paddling ? c.previous : null;
      p.root.rotation.x = p.root.rotation.z = 0; p.vx = p.vz = 0; p.safe = null;
      if (resume) { p.wait = Math.max(p.wait > 100 ? 0 : p.wait || 0, 2); p.play('idle'); A.say(p.tag, 'Nur ein Spielzeug… alles gut!', 3.2); }
    }
    sharkRun = null; if (shark) shark.visible = false; if (sharkRipple) sharkRipple.visible = false;
  }
  function fleeStep(c, dt) {
    const p = A.pascal, P = A.player, wet = !!c.previous && waterHere(p.x, p.z);
    const away = Math.atan2(p.x - P.x || .01, p.z - P.z), base = Math.hypot(p.x - P.x, p.z - P.z);
    let heading = c.heading, score = -Infinity;
    // Short footprint probes find a clean lane around piers, street furniture and corners.
    for (let i = 0; i < 9; i++) {
      const a = away + (i ? Math.ceil(i / 2) * .39 * (i % 2 ? 1 : -1) : 0); let clear = true;
      for (let j = 1; j <= 5; j++) { const x = p.x + Math.sin(a) * j, z = p.z + Math.cos(a) * j;
        if (wet ? !waterHere(x, z) || !waterClear(x, z) : !W.inLand(x, z, 1) || W.blockedAt(x, z, 1, W.groundAt(x, z, p.y, 1))) { clear = false; break; } }
      if (!clear) continue;
      const s = Math.hypot(p.x + Math.sin(a) * 5 - P.x, p.z + Math.cos(a) * 5 - P.z) - base + Math.cos(a - c.heading) * .5;
      if (s > score) { score = s; heading = a; }
    }
    c.heading = heading; p.heading = U.lerpAng(p.heading, heading, 1 - Math.exp(-dt * 9));
    if (score > -Infinity) {
      const speed = (wet ? 19 : 22) * Math.min(1, (c.t - 1) * 2);
      if (wet) { p.x += Math.sin(heading) * speed * dt; p.z += Math.cos(heading) * speed * dt; p.y = SEA + .32 + Math.sin(c.t * 8) * .07; }
      else { landMove.grounded = true; W.move(p, Math.sin(heading) * speed * dt, Math.cos(heading) * speed * dt, .9, p.y, landMove); p.y = W.groundAt(p.x, p.z, p.y, .9); }
    }
    p.place();
    if (c.previous && K.surf && K.surf.paddling) { c.previous(0); if (!K.surf.paddling) c.previous = null; }
    else { p.play('panic'); p.mixer.update(dt * 1.65); }
    p.root.rotation.z = Math.sin(c.t * 17) * .1;
  }
  function startShark() {
    const spot = nearestWater(true); if (!spot) return false;
    const previous = canBorrowPaddle() ? A.pascal.ext : null;
    finishPascal(); const p = A.pascal;
    const c = { t: 0, phase: 'breach', previous, homeX: spot.x, homeZ: spot.z, heading: Math.atan2(p.x - A.player.x || .01, p.z - A.player.z), emit: 0, ripple: 0, ext: null, retreatX: 0, retreatZ: 0 };
    shark.position.set(spot.x, SEA - 2, spot.z); shark.rotation.set(0, Math.atan2(p.x - spot.x, p.z - spot.z), 0); shark.visible = true;
    splash(spot.x, spot.z); say('Robo-Shark! All bark. No bite.'); A.say(p.tag, 'HAI!! Ein Roboter-Hai!!', 3.5, 'shout');
    c.ext = dt => {
      c.t += dt; c.ripple += dt;
      if (c.t >= 11.8) { finishShark(); return; }
      if (c.t < 1) {
        shark.position.y = SEA + .65 + Math.sin(c.t * Math.PI) * 3.2 - (1 - c.t) * 2.65;
        shark.rotation.x = -.5 * Math.sin(c.t * Math.PI); p.play('panic'); p.mixer.update(dt);
        if (c.previous) c.previous(0);
      } else if (c.t < 7.5) {
        c.phase = 'chase'; fleeStep(c, dt);
        const dx = p.x - shark.position.x, dz = p.z - shark.position.z, d = Math.hypot(dx, dz) || 1;
        const stride = Math.min(Math.max(0, d - 6.2), (d > 18 ? 34 : 22) * dt);
        shark.position.x += dx / d * stride; shark.position.z += dz / d * stride;
        const wet = waterHere(shark.position.x, shark.position.z);
        shark.position.y = wet ? SEA + .72 + Math.sin(c.t * 7) * .16 : W.groundAt(shark.position.x, shark.position.z, p.y, 1) + 1.35 + Math.abs(Math.sin(c.t * 10)) * .13;
        shark.rotation.set(Math.sin(c.t * 9) * .035, U.lerpAng(shark.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-dt * 6)), Math.sin(c.t * 7) * .045);
        if (c.t - dt < 3.1 && c.t >= 3.1) A.say(p.tag, 'Nein nein nein!', 3, 'shout');
        if (c.t - dt < 5.4 && c.t >= 5.4) A.say(p.tag, wet ? 'Ich bin kein Fischstäbchen!' : 'DER HAI HAT RÄDER?!', 2.8, 'shout');
        c.retreatX = shark.position.x; c.retreatZ = shark.position.z;
      } else {
        if (c.phase === 'chase') { c.phase = 'return'; A.say(p.tag, 'Puh… ich brauche eine Pause!', 3); say('Good shark. Back to the bath.'); }
        const k = U.clamp((c.t - 7.5) / 3, 0, 1), ease = k * k * (3 - 2 * k);
        shark.position.x = U.lerp(c.retreatX, c.homeX, ease); shark.position.z = U.lerp(c.retreatZ, c.homeZ, ease);
        shark.rotation.y = U.lerpAng(shark.rotation.y, Math.atan2(c.homeX - c.retreatX, c.homeZ - c.retreatZ), 1 - Math.exp(-dt * 7));
        const wet = waterHere(shark.position.x, shark.position.z);
        shark.position.y = (wet ? SEA + .7 : W.terrainH(shark.position.x, shark.position.z) + 2) + Math.sin(k * Math.PI) * 5;
        if (k >= 1) {
          if (c.phase !== 'dive') { c.phase = 'dive'; c.ripple = 0; splash(c.homeX, c.homeZ); }
          shark.position.y = SEA + .7 - (c.t - 10.5) * 3.5; shark.rotation.x = (c.t - 10.5) * .7;
        }
        if (c.previous && K.surf && K.surf.paddling) c.previous(0); else { p.play('idle'); p.mixer.update(dt); }
      }
      const land = !waterHere(shark.position.x, shark.position.z); sharkWheels.visible = land; sharkJets.visible = land || c.phase === 'return';
      sharkJets.scale.y = .8 + Math.sin(c.t * 37) * .2; sharkTail.rotation.y = Math.sin(c.t * 10) * .24; sharkAntenna.rotation.z = Math.sin(c.t * 12) * .12;
      const blink = Math.sin(c.t * 12) > 0 ? 1.25 : .65; sharkLamp.scale.set(.16 * blink, .13 * blink, .16 * blink);
      sharkRipple.visible = c.ripple < 1.7;
      for (let i = 0; i < sharkRipple.children.length; i++) { const r = sharkRipple.children[i], k = c.ripple + i * .2; r.scale.setScalar(1 + k * 3.6); r.material.opacity = Math.max(0, 1 - k / 1.8) * .7; }
      c.emit -= dt; if (c.emit <= 0 && c.phase !== 'dive') { c.emit = .08; burst(shark.position.x, land ? shark.position.y - .9 : SEA + .2, shark.position.z, land ? '#8ce9e8' : '#efffff', 3); }
    };
    sharkRun = c; p.ext = c.ext; return true;
  }
  function burst(x, y, z, tint, count, smoke) {
    let n = 0;
    for (const p of particles) { if (p.life > 0) continue; p.life = smoke ? 1.2 : .65 + Math.random() * .5; p.x = x; p.y = y; p.z = z; p.vx = (Math.random() - .5) * (smoke ? 2 : 8); p.vy = smoke ? 2 : 2 + Math.random() * 5; p.vz = (Math.random() - .5) * (smoke ? 2 : 8); p.size = smoke ? .45 : .075 + Math.random() * .11; p.color = tint; if (++n >= count) break; }
  }
  function buildUI() {
    const style = document.createElement('style');
    style.textContent = `
#kt-menu{position:fixed;inset:0;z-index:75;pointer-events:none;opacity:0;visibility:hidden;transition:opacity .2s,visibility .2s;font-family:Arial,sans-serif;color:#253346;background:linear-gradient(90deg,transparent 12%,#13293835 65%,#13293888)}
#kt-menu.on{opacity:1;visibility:visible;pointer-events:auto}#kt-panel{position:absolute;right:3vw;top:50%;width:490px;height:548px;transform:translateY(-46%) scale(.65) rotate(9deg);transition:transform .32s cubic-bezier(.18,1.4,.4,1)}#kt-menu.on #kt-panel{transform:translateY(-50%) scale(1) rotate(0)}
.kt-title{margin:0 0 4px 25px;color:#fff3d7;font:400 31px/1 var(--round);letter-spacing:-1px;text-shadow:2px 3px #253346}.kt-kicker{margin-left:27px;color:#a3ffee;font:bold 10px Arial;letter-spacing:3px}.kt-wheel{position:relative;width:490px;height:490px;filter:drop-shadow(0 12px 0 #14253290)}.kt-track{position:absolute;inset:17px;border:3px solid #ffe9a4;border-radius:50%;background:repeating-conic-gradient(from -22.5deg,#fff1cf15 0deg 44deg,#ffecb650 44deg 45deg);box-shadow:0 0 0 8px #23364c,0 0 0 11px #79ddd6;}
.kt-slot{position:absolute;width:114px;height:105px;margin:-52px 0 0 -57px;border:3px solid #263346;border-radius:24px;background:var(--tint);color:#263346;box-shadow:0 7px 0 #263346, inset 0 3px 0 #ffffffa0;cursor:pointer;transform:rotate(var(--tilt));transition:transform .15s,filter .15s;display:flex;align-items:center;flex-direction:column;justify-content:center;padding:3px;touch-action:manipulation}.kt-slot:hover,.kt-slot:focus-visible{transform:translateY(-5px) rotate(0) scale(1.07);outline:3px solid #fff6d9;z-index:3}.kt-slot.locked{filter:grayscale(.92);background:#b4bcc4}.kt-slot b{font-family:var(--round);font-size:11px;line-height:13px;white-space:nowrap}.kt-slot svg{height:35px;width:35px;fill:none;stroke:currentColor;stroke-width:2.7;stroke-linecap:round;stroke-linejoin:round}.kt-key{position:absolute;left:7px;top:6px;font:bold 10px Arial;border:1px solid #26334680;border-radius:5px;padding:1px 4px}.kt-cost{font:bold 11px Arial;background:#fff1cf;border:2px solid #263346;border-radius:10px;padding:2px 9px;margin-top:4px}.kt-cool{position:absolute;bottom:0;left:8%;width:84%;height:4px;border-radius:5px;background:#263346;transform-origin:left;transform:scaleX(0)}
.kt-center{position:absolute;left:50%;top:50%;width:170px;height:170px;transform:translate(-50%,-50%);border-radius:50%;border:4px solid #263346;background:#fff0cb;box-shadow:inset 0 5px #fff9e8,0 6px 0 #263346;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.kt-center small{letter-spacing:2px;font:bold 9px Arial}.kt-bank{font:900 29px Arial;letter-spacing:-1px;margin:4px 0}.kt-detail{font:bold 11px/1.25 Arial;width:142px;min-height:30px}.kt-slow{font:bold 9px Arial;color:#176d70;border-top:1px solid #26334630;padding-top:7px}.kt-footer{text-align:center;color:#fff1cf;font:bold 11px Arial;margin-top:-1px;letter-spacing:1px}
#kt-toggle{position:fixed;left:22px;bottom:92px;z-index:35;border:3px solid #24354a;border-radius:18px;background:#ffda70;color:#24354a;box-shadow:0 5px #24354a;padding:9px 14px;font:bold 12px Arial;cursor:pointer}#kt-toggle b{background:#24354a;color:#fff1cf;padding:3px 6px;border-radius:5px;margin-right:7px}#kt-ride{position:fixed;left:50%;bottom:150px;transform:translateX(-50%);z-index:34;color:#263346;background:#fff1cf;border:3px solid #263346;border-radius:40px;padding:6px 16px 6px 7px;align-items:center;gap:9px;font:bold 12px Arial}#kt-toggle.kt-driving{bottom:92px}#kt-ride svg{width:44px;height:44px;transform:rotate(-90deg)}#kt-ride circle{fill:none;stroke:#263346;stroke-width:5}#kt-ride .kt-progress{stroke:#29bda5;stroke-dasharray:113;stroke-dashoffset:0}#kt-ride[hidden],#kt-toggle[hidden]{display:none}#kt-ride:not([hidden]){display:flex}
@media(max-width:650px){#kt-panel{right:50%;margin-right:-245px;transform:translateY(-46%) scale(.68)}#kt-menu.on #kt-panel{transform:translateY(-50%) scale(.68)}#kt-toggle{left:12px;bottom:155px;padding:8px}#kt-menu{background:#13293888}}@media(max-height:600px) and (min-width:651px){#kt-panel{transform:translateY(-46%) scale(.72)}#kt-menu.on #kt-panel{transform:translateY(-50%) scale(.72)}}@media(prefers-reduced-motion:reduce){#kt-menu,#kt-panel,.kt-slot{transition:none}}
`;
    document.head.appendChild(style);
    menu = document.createElement('div'); menu.id = 'kt-menu'; menu.setAttribute('role', 'dialog'); menu.setAttribute('aria-label', 'Kyotoken ability wheel'); menu.setAttribute('aria-hidden', 'true'); menu.inert = true;
    menu.innerHTML = '<div id="kt-panel"><p class="kt-kicker">YOUR VERY GOOD COPILOT</p><h2 class="kt-title">KYOTOKEN</h2><div class="kt-wheel"><div class="kt-track"></div><div class="kt-center"><small>AVAILABLE TOKENS</small><strong class="kt-bank">0</strong><span class="kt-detail">Big ideas.<br>Small paws.</span><span class="kt-slow">◷ THINK TIME · 25%</span></div></div><div class="kt-footer">1–8 TO DEPLOY · Q TO CLOSE</div></div>';
    if (K.coarse) menu.querySelector('.kt-footer').textContent = 'TAP AN ABILITY · TAP OUTSIDE TO CLOSE';
    panel = menu.querySelector('#kt-panel'); bank = menu.querySelector('.kt-bank'); detail = menu.querySelector('.kt-detail');
    const wheel = menu.querySelector('.kt-wheel');
    abilities.forEach((a, i) => { const b = document.createElement('button'), angle = (-90 + i * 45) * Math.PI / 180; b.className = 'kt-slot'; b.style.left = 245 + Math.cos(angle) * 177 + 'px'; b.style.top = 245 + Math.sin(angle) * 177 + 'px'; b.style.setProperty('--tint', a[5]); b.style.setProperty('--tilt', (i % 2 ? 3 : -3) + 'deg'); b.innerHTML = '<span class="kt-key">' + (i + 1) + '</span><svg viewBox="0 0 40 42" aria-hidden="true">' + paths[i] + '</svg><b>' + a[0] + '</b><span class="kt-cost"></span><span class="kt-cool"></span>'; b.setAttribute('aria-label', a[0] + ', ' + a[1] + ' tokens'); b.addEventListener('click', e => { e.stopPropagation(); cast(i); }); b.addEventListener('mouseenter', () => { detail.textContent = reason(i) || a[3]; }); b.addEventListener('focus', () => { detail.textContent = reason(i) || a[3]; }); wheel.appendChild(b); slots.push({ button: b, cost: b.querySelector('.kt-cost'), cool: b.querySelector('.kt-cool') }); });
    menu.addEventListener('click', e => { if (e.target === menu) setOpen(false); }); document.body.appendChild(menu);
    toggle = document.createElement('button'); toggle.id = 'kt-toggle'; toggle.innerHTML = '<b>Q</b> KYOTOKEN'; toggle.setAttribute('aria-label', 'Open Kyotoken abilities'); toggle.addEventListener('click', () => { K.sfx.init(); K.sfx.resume(); setOpen(!open); }); toggle.hidden = true; document.body.appendChild(toggle);
    rideUI = document.createElement('div'); rideUI.id = 'kt-ride'; rideUI.hidden = true; rideUI.innerHTML = '<svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="18" opacity=".15"/><circle class="kt-progress" cx="22" cy="22" r="18"/></svg><span>WAYMO · 30s</span>'; document.body.appendChild(rideUI);
    document.addEventListener('visibilitychange', () => { if (document.hidden && open) setOpen(false); });
  }
  function fitWheel() { if (panel && K.coarse) panel.style.transition = 'none'; if (panel) panel.style.transform = 'translateY(-50%) scale(' + Math.min(1, ((K.VW || 1280) - 24) / 490, ((K.VH || 800) - 32) / 590) + ')'; }
  addEventListener('resize', fitWheel);
  function setOpen(value) {
    if (!menu || (value && K.game.state !== 'play')) return;
    if (!value && !open) return;   // was replaying the click sound every frame while not playing (title/intro/pause) = the looping noise
    if (value && K.unlock) K.unlock(true); if (value) fitWheel();
    open = !!value; document.body.classList.toggle('kyoto-wheel', open); menu.classList.toggle('on', open); menu.setAttribute('aria-hidden', String(!open)); menu.inert = !open;
    if (!open && ownedStop > 0) { K.game.hitStop = Math.max(0, (K.game.hitStop || 0) - ownedStop); ownedStop = 0; }
    sound(open ? 'deploy' : 'click'); updateHUD();
  }
  function reason(i) {
    const P = A.player, g = K.game;
    if (cooldowns[i] > 0) return 'Recharging · ' + Math.ceil(cooldowns[i]) + 's';
    if (i === 5 && !(g.inv && g.inv.rocket > 0)) return 'Find Elon’s dropped rocket first!';
    if (g.tokens < abilities[i][1]) return 'Need ' + U.fmt(abilities[i][1] - g.tokens) + ' more tokens';
    if (i === 7) {
      if (sharkRun) return 'Robo-Shark is already on patrol';
      if (!nearestWater()) return 'Bring Pascal within 60m of water';
      if (Math.hypot(P.x - A.pascal.x, P.z - A.pascal.z) > 95) return 'Pascal is already far away';
      if (A.pascal.ext && (!control || A.pascal.ext !== control.ext) && !canBorrowPaddle()) return 'Pascal is busy. Try again shortly.';
    }
    if ([0, 1, 5].includes(i) && A.pascal.ext && (!control || A.pascal.ext !== control.ext)) return 'Pascal is busy. Try again shortly.';
    if ([2, 3, 4].includes(i) && (P.mode !== 'walk' || P.ext || !P.onGround)) return 'Paws on the ground first!';
    if ((i === 3 || i === 4) && delivery) return 'Delivery already on its way!';
    return '';
  }
  function cast(i) {
    if (!Number.isInteger(i) || i < 0 || i > 7 || K.game.state !== 'play') return false;
    const no = reason(i); if (no) { say(no); sound('click'); return false; }
    const P = A.player, g = K.game;
    if (i === 4 && !callCar()) { say('No safe pickup spot. Try a street!'); sound('click'); return false; }
    if (i === 2) summonSkater();
    if (i === 0 || i === 1 || i === 5) startPascal(i);
    if (i === 3) { food.visible = true; food.position.set(P.x + 9, P.y + 7, P.z - 5); delivery = { kind: 'food', t: 0 }; say('Express delivery. Extra crumbs.'); }
    if (i === 6) { deployT = 6; g.buffs.ghost = Math.max(g.buffs.ghost || 0, 6); K.fn.setGhost(true); say('No bugs. Only butterflies.'); A.say(A.pascal.tag, 'Wer hat das freigegeben?!', 3); }
    if (i === 7 && !startShark()) { say('Bring Pascal within 60m of water'); return false; }
    g.tokens -= abilities[i][1]; if (i === 5) g.inv.rocket--; cooldowns[i] = abilities[i][2]; oldTokens = g.tokens;
    setOpen(false); feedback(i); return true;
  }
  function finishPascal() {
    if (!control) return; const p = A.pascal;
    if (p.ext === control.ext) { p.ext = null; p.root.rotation.x = p.root.rotation.z = 0; p.y = W.terrainH(p.x, p.z); p.vx = p.vz = 0; p.place(); p.stun = Math.max(p.stun || 0, control.kind === 5 ? 3 : 1); p.play('idle'); if (control.kind === 5) { A.say(p.tag, 'Alles gut… fünf Sterne.', 3); burst(p.x, p.y + 1, p.z, '#ffd96b', 20); } }
    control = null; rocket.visible = false;
  }
  function startPascal(kind) {
    finishPascal(); const p = A.pascal, P = A.player, dx = p.x - P.x, dz = p.z - P.z, d = Math.hypot(dx, dz) || 1;
    const target = W.free(p.x + dx / d * 100, p.z + dz / d * 100, 2);
    const c = { kind, t: 0, duration: kind === 0 ? 8 : kind === 1 ? 5 : 6, x: p.x, z: p.z, tx: target[0], tz: target[1], heading: Math.atan2(dx || 1, dz), emit: 0, ext: null };
    c.ext = dt => {
      c.t += dt; if (c.t >= c.duration) { finishPascal(); return; }
      if (kind === 0) { p.heading = c.heading; W.move(p, Math.sin(c.heading) * 13 * dt, Math.cos(c.heading) * 13 * dt, .8, p.y); p.y = W.terrainH(p.x, p.z); p.play('skate'); }
      else if (kind === 1) { p.heading += dt * 8; W.move(p, Math.sin(c.heading) * -3 * dt, Math.cos(c.heading) * -3 * dt, .8, p.y); p.y = W.terrainH(p.x, p.z); p.root.rotation.z = Math.sin(c.t * 15) * .17; p.play('skate'); }
      else if (c.t > 1.1) {
        const k = U.clamp((c.t - 1.1) / 4.9, 0, 1), ease = 1 - Math.pow(1 - k, 2);
        p.x = U.lerp(c.x, c.tx, ease); p.z = U.lerp(c.z, c.tz, ease); p.y = W.terrainH(p.x, p.z) + Math.sin(k * Math.PI) * 27; p.heading = Math.atan2(c.tx - c.x, c.tz - c.z); p.root.rotation.x = Math.sin(k * Math.PI) * .9; p.play('panic');
        rocket.position.set(p.x, p.y + .6, p.z); rocket.rotation.set(Math.PI / 2, 0, -p.heading); rocket.visible = true;
        if (c.t - dt <= 1.1) { A.say(p.tag, 'OOOOHHH NEIN!', 4.5, 'shout'); sound('zoom'); K.fn.juice(.28, .12); }
      }
      p.place(); p.mixer.update(dt); c.emit -= dt;
      if (c.emit <= 0) { c.emit = .09; burst(p.x, p.y + .7, p.z, kind === 5 ? (Math.random() < .5 ? '#ffb354' : '#d9def0') : abilities[kind][5], kind === 5 ? 4 : 2, kind === 5); }
    };
    control = c; p.ext = c.ext;
    A.say(p.tag, kind === 0 ? 'Das Navi sagt… links?!' : kind === 1 ? 'Meine Skates tanzen?!' : 'Was macht der kleine Hund?!', 3.8);
    say(kind === 0 ? 'Recalculating… creatively.' : kind === 1 ? 'Bluetooth: disco connected.' : 'One gentle express flight!');
  }
  function summonSkater() {
    const P = A.player;
    if (K.life && K.life.spawnSkater) { if (K.life.spawnSkater(P.x + 7, P.z + 3)) return; }
    if (!rider) { rider = A.person({ acc: ['acc_cap', 'acc_hair_short'], shirt: '#ac85ef', pants: '#24334b', hat: '#ffcb64' }); rider.board = A.kyoto.board.clone(); rider.root.add(rider.board); rider.board.visible = true; rider.tag = A.tag(rider.root, 'BOARD DELIVERY', null, 3.8, 60); }
    const f = W.free(P.x + 9, P.z + 4, .8); rider.x = f[0]; rider.z = f[1]; rider.y = W.terrainH(rider.x, rider.z); rider.root.visible = true; rider.board.visible = true; rider.play('skate'); rider.place(); pendingSkater = { t: 24, taken: false }; A.say(rider.tag, 'Your board trial is ready!', 3);
  }
  function callCar() {
    const P = A.player;
    const car = A.cars.find(c => c.kind === 'waymo' && c.mode !== 'driven'); if (!car) return false;
    let spot = null;
    for (let r = 5; r <= 11 && !spot; r += 2) for (let i = 0; i < 12; i++) { const ang = i * Math.PI / 6, x = P.x + Math.cos(ang) * r, z = P.z + Math.sin(ang) * r; if (Math.abs(W.terrainH(x, z) - P.y) < 1 && W.los(P.x, P.z, x, z) && A.vehicleClear(car, x, z, P.heading)) { spot = { x, z }; break; } }
    if (!spot) return false;
    const h = P.heading; let sx = spot.x - Math.sin(h) * 9, sz = spot.z - Math.cos(h) * 9;
    for (let j = 0; j <= 9; j++) if (!A.vehicleClear(car, U.lerp(sx, spot.x, j / 9), U.lerp(sz, spot.z, j / 9), h)) { sx = spot.x; sz = spot.z; break; }
    Object.assign(car, { x: sx, z: sz, heading: h, mode: 'parked', speed: 0, v: 0 }); car.g.position.set(sx, W.terrainH(sx, sz), sz); car.g.rotation.set(0, h, 0); car.g.visible = true; if (A.carGroup) A.carGroup.add(car.g);
    delivery = { kind: 'car', car, x: sx, z: sz, tx: spot.x, tz: spot.z, t: 0 }; say('Waymo arriving. Good boy priority.'); return true;
  }
  function updateHUD() {
    if (!bank) return; const g = K.game; bank.textContent = U.fmt(g.tokens);
    for (let i = 0; i < slots.length; i++) { const s = slots[i], no = reason(i); s.button.classList.toggle('locked', !!no); s.button.setAttribute('aria-disabled', String(!!no)); s.button.title = no || abilities[i][3]; s.button.setAttribute('aria-label', abilities[i][0] + ', ' + abilities[i][1] + ' tokens. ' + (no || abilities[i][3])); s.cost.textContent = cooldowns[i] > 0 ? Math.ceil(cooldowns[i]) + 's' : i === 7 && !nearestWater() ? 'NEAR WATER' : i === 5 && !(g.inv && g.inv.rocket) ? 'ROCKET + ' + U.fmt(abilities[i][1]) : '● ' + U.fmt(abilities[i][1]); s.cool.style.transform = 'scaleX(' + (cooldowns[i] / abilities[i][2]) + ')'; }
  }
  function step(h, g) {
    for (let i = 0; i < 8; i++) cooldowns[i] = Math.max(0, cooldowns[i] - h);
    const P = A.player;
    if (delivery) { const d = delivery; d.t += h;
      if (d.kind === 'food') { food.position.lerp(v.set(P.x, P.y + 1.4, P.z), 1 - Math.exp(-h * 3)); food.rotation.y += h * 4;
        if (d.t > 1.4 && food.position.distanceTo(v) < 1) { g.buffs.turbo = Math.max(g.buffs.turbo || 0, 12); food.visible = false; delivery = null; burst(P.x, P.y + 1, P.z, '#eeb56a', 26); A.sfxText(P.x, P.y + 2, P.z, 'NOM!', 'gold'); sound('gulp'); K.fn.juice(.12, .15); say('Five-star snack. Twelve-second zoomies.'); }
      } else { const c = d.car, k = Math.min(1, d.t / 1.6); c.x = U.lerp(d.x, d.tx, k); c.z = U.lerp(d.z, d.tz, k); c.g.position.set(c.x, W.terrainH(c.x, c.z), c.z);
        if (k >= 1) { if (Math.hypot(P.x - c.x, P.z - c.z) < 15 && P.mode === 'walk') K.fn.enterCar(c);
          if (P.car === c) { P.carT = 30; rideCar = c; delivery = null; say('Please keep all four paws inside.'); }
          else if (d.t > 8) { delivery = null; g.tokens += abilities[4][1]; cooldowns[4] = 0; say('Pickup missed. Tokens refunded!'); }
        }
      }
    }
    if (rideCar) { if (P.car !== rideCar) { rideCar = null; say('Ride over. Your driver was a toaster.'); } else if (P.carT <= h * 2) { if (K.fn.exitCar(true)) { rideCar = null; say('Free trial expired. Please walk responsibly.'); sound('boing'); K.fn.juice(.15, .12); } } }
    if (pendingSkater && rider) { pendingSkater.t -= h; const d = Math.hypot(P.x - rider.x, P.z - rider.z); rider.heading = Math.atan2(P.x - rider.x, P.z - rider.z);
      if (!pendingSkater.taken && d > 2.2) W.move(rider, Math.sin(rider.heading) * h * 9, Math.cos(rider.heading) * h * 9, .7, rider.y);
      rider.y = W.terrainH(rider.x, rider.z); rider.place(); rider.mixer.update(h);
      if (!pendingSkater.taken && d < 2.8 && P.mode === 'walk') { P.board = Math.max(P.board || 0, 25); rider.board.visible = false; pendingSkater.taken = true; pendingSkater.t = 4; rider.play('idle'); sound('yoink'); A.sfxText(P.x, P.y + 2, P.z, 'YOINK!', 'pink'); say('Board acquired. Terms: woof.'); }
      if (pendingSkater.t <= 0) { rider.root.visible = false; pendingSkater = null; }
    }
    if (sharkRun && A.pascal.ext !== sharkRun.ext) finishShark(false);
    if (deployT > 0) { deployT -= h; deployEmit -= h; if (deployEmit <= 0) { deployEmit = .13; burst(P.x, P.y + 1, P.z, Math.random() < .5 ? '#ff83b4' : '#7af0d5', 5, true); } }
  }
  function frame(dt, tt, g) {
    if (!drone) return;
    if (g.state !== 'play') { setOpen(false); toggle.hidden = true; rideUI.hidden = true; return; }
    // Input is checked once per rendered frame: K.pressed remains set through all substeps.
    if (K.pressed('KeyQ')) setOpen(!open);
    for (let i = 0; i < 8; i++) if (open && K.pressed('Digit' + (i + 1))) cast(i);
    ownedStop = 0; if (open) { ownedStop = dt * .75; g.hitStop = (g.hitStop || 0) + ownedStop; }
    const P = A.player; t += dt; happy = Math.max(0, happy - dt); pickupT -= dt; chatter -= dt; pulseT = Math.max(0, pulseT - dt);
    drone.visible = true; toggle.hidden = false; toggle.classList.toggle('kt-driving', P.mode === 'car');
    const heading = P.heading, cam = K.camera; cam.getWorldDirection(cf); cf.y = 0; if (cf.lengthSq() < 1e-6) cf.set(0, 0, 1); cf.normalize();
    const side = P.mode === 'car' ? 3.2 : 1.9;   // hover beside Kyoto as seen from the camera (right side, a bit ahead), never between camera and dog
    v.set(P.x - cf.z * side + cf.x * .6, P.y + (P.mode === 'car' ? 4.2 : 3.05) + Math.sin(t * 3) * .16, P.z + cf.x * side + cf.z * .6);
    if (control && control.kind === 5 && control.t < 1.1) { v.set(A.pascal.x, A.pascal.y + 1.1, A.pascal.z); rocket.visible = true; rocket.position.copy(drone.position); rocket.rotation.set(.2, 0, -.7); }
    if (delivery && delivery.kind === 'food') { v.copy(food.position); v.y += 1; }
    if (portrait) v.set(P.x + 1, P.y + 3.6, P.z - 2.2);
    drone.position.lerp(v, 1 - Math.exp(-dt * 5));
    { const C = K.camera.position; kc.set(P.x, P.y + 1.2, P.z); seg.subVectors(kc, C); const L2 = seg.lengthSq(); rel.subVectors(drone.position, C); const tt = L2 > 0 ? rel.dot(seg) / L2 : 0;
      let block = false; if (tt > 0 && tt < 1.05) { rel.addScaledVector(seg, -tt); block = rel.length() < 1.5; }
      droneOp = U.damp(droneOp, block ? .25 : 1, 10, dt); const tr = droneOp < .98;
      for (const m of droneMats) { if (m.userData.baseOp == null) m.userData.baseOp = m.transparent ? m.opacity : 1; m.transparent = tr || m.userData.baseOp < 1; m.opacity = m.userData.baseOp * droneOp; m.depthWrite = !tr && m.userData.baseOp >= 1; } }
    const face = portrait || open ? Math.atan2(K.camera.position.x - drone.position.x, K.camera.position.z - drone.position.z) : heading;
    drone.rotation.set(Math.sin(t * 2.4) * .05, U.lerpAng(drone.rotation.y, face, 1 - Math.exp(-dt * 7)), Math.sin(t * 2) * .06);
    drone.scale.setScalar(.92 * (1 + Math.sin(pulseT * 20) * pulseT * .09));
    ears[0].rotation.z = -.12 + Math.sin(t * 8) * .18; ears[1].rotation.z = .12 - Math.sin(t * 8 + .6) * .18; { const f = happy > 0 ? 16 : 7, amp = happy > 0 ? .5 : .32; tail.segs.forEach((sg, i) => { sg.rotation.z = Math.sin(t * f - i * .55) * amp * (.5 + i * .12); sg.rotation.x = .06 + Math.sin(t * f * .5 - i * .4) * .05; }); }
    for (const r of rotors) r.rotation.y += dt * 65; for (const e of eyes) e.scale.y = Math.sin(t * .7) > .998 ? .12 : 1;
    if (g.tokens > oldTokens && pickupT <= 0) { pickupT = 3; say(U.pick(['Token treats!', 'Braver Junge!', 'Guter Hund!', 'Who’s a good boy? YOU!'])); } oldTokens = g.tokens;
    if (chatter <= 0) { const d = Math.hypot(P.x - A.pascal.x, P.z - A.pascal.z); if (A.agents.some(a => !a.hacked && a.pos.distanceToSquared(drone.position) < 625)) say('Achtung! Agents!'); else if (d < 40) say('Pascal ' + Math.round(d) + 'm!'); else say(U.pick(["You’re a good boy!", 'Braver Junge!', 'Guter Hund!'])); chatter = 10 + Math.random() * 7; }
    let n = 0; for (const p of particles) { if (p.life <= 0) continue; p.life -= dt; if (p.life <= 0) continue; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= dt * 6; dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(t * 2 + n, t * 3, n); dummy.scale.set(p.size * Math.min(1, p.life * 3), p.size * .65, p.size); dummy.updateMatrix(); dust.setMatrixAt(n, dummy.matrix); color.set(p.color); dust.setColorAt(n++, color); }
    dust.count = n; dust.instanceMatrix.needsUpdate = true; if (dust.instanceColor) dust.instanceColor.needsUpdate = true;
    signal.visible = !!control || deployT > 0;
    if (signal.visible) { const target = control ? A.pascal : P; signal.position.set(target.x, target.y + .18, target.z); for (let i = 0; i < signal.children.length; i++) { const r = signal.children[i], k = (t * 1.8 + i / 3) % 1; r.scale.setScalar(.65 + k * 2); r.material.opacity = (1 - k) * .72; r.rotation.z = t * (control && control.kind === 1 ? 8 : 2); } }
    const activeRide = rideCar && P.car === rideCar; rideUI.hidden = !activeRide; ring.visible = !!activeRide;
    if (activeRide) { ring.position.set(P.x, W.terrainH(P.x, P.z) + .15, P.z); ring.scale.setScalar(4.6); rideUI.querySelector('span').textContent = 'WAYMO · ' + Math.ceil(P.carT) + 's'; rideUI.querySelector('.kt-progress').style.strokeDashoffset = 113 * (1 - P.carT / 30); }
    const key = Math.floor(t * 8) + ':' + open; if (key !== lastHUD) { lastHUD = key; updateHUD(); }
  }
  function reset() { finishShark(false); coastCache = null; coastStamp = -99; finishPascal(); setOpen(false); cooldowns.fill(0); delivery = null; pendingSkater = null; rideCar = null; deployT = 0; portrait = false; happy = 2; chatter = 5; oldTokens = K.game.tokens; particles.forEach(p => { p.life = 0; }); if (dust) dust.count = 0; if (food) food.visible = false; if (ring) ring.visible = false; if (rider) rider.root.visible = false; if (drone) { drone.position.set(A.player.x, A.player.y + 3.2, A.player.z); drone.visible = true; } }
  K.on('pause', () => { setOpen(false); if (toggle) toggle.hidden = true; if (rideUI) rideUI.hidden = true; });
  K.on('ui', g => { if (g.state !== 'play') { setOpen(false); if (toggle) toggle.hidden = true; if (rideUI) rideUI.hidden = true; } if (drone) drone.visible = g.state === 'play' || g.state === 'paused'; });
  K.on('build', build); K.on('start', reset); K.on('step', step); K.on('frame', frame); K.on('bark', () => { happy = 4; if (chatter < 4) say('Who’s a good boy? YOU!'); });
  K.on('beforeEnd', () => { finishShark(false); finishPascal(); if (signal) signal.visible = false; });
  K.on('end', () => { finishShark(false); finishPascal(); setOpen(false); if (toggle) toggle.hidden = true; if (rideUI) rideUI.hidden = true; if (food) food.visible = false; if (ring) ring.visible = false; });
  K.scenes = K.scenes || {};
  function sharkReview(h, land) {
    if (land) {
      h.play(); h.go(242, 110); h.P.heading = -Math.PI / 2; h.P.inv = 999;
      const spot = W.free(246, 102, 1.1); Object.assign(A.pascal, { x: spot[0], z: spot[1], y: W.terrainH(spot[0], spot[1]), wait: 0, safe: null }); A.pascal.place();
    } else {
      if (!K.scenes.surf) throw new Error('Shark review requires the surf scene'); K.scenes.surf(h); h.P.inv = 999;
    }
    h.g.tokens = 8192;
    if (!cast(7)) throw new Error('Robo-Shark activation failed: ' + reason(7));
    h.g.told.move = h.g.told.wheel = true; h.st(land ? 47 : 48);
    const p = A.pascal, x = (p.x + shark.position.x + h.P.x) / 3, z = (p.z + shark.position.z + h.P.z) / 3;
    const y = land ? W.terrainH(x, z) : SEA;
    const portraitView = K.VW < K.VH, heading = Math.atan2(p.x - h.P.x, p.z - h.P.z);
    const camX = portraitView ? x - Math.sin(heading) * 32 + Math.cos(heading) * 3 : x + (land ? 25 : 12);
    const camZ = portraitView ? z - Math.cos(heading) * 32 - Math.sin(heading) * 3 : z + (land ? 1 : 19);
    K.sceneCam = { pos: new T.Vector3(camX, y + (portraitView ? 12 : 7), camZ), look: new T.Vector3(x, y + 1.6, z), noClip: true }; h.st(1);
    if (K.UI.updateBanner) for (let i = 0; i < 6; i++) K.UI.updateBanner(2);
    if (portraitView) say('Good shark!');
    A.say(p.tag, land ? 'DER HAI HAT RÄDER?!' : 'HAI!! Ein Roboter-Hai!!', 4, 'shout'); A.updateTags(0);
  }
  K.scenes.shark = h => sharkReview(h, false);
  K.scenes.shark_land = h => sharkReview(h, true);
  K.scenes.shark_checks = h => {
    const results = [], check = (name, ok) => { if (!ok) throw new Error('SHARK CHECK: ' + name); results.push(name); };
    K.scenes.surf(h); h.P.inv = 999; h.g.tokens = 8192;
    const p = A.pascal, previous = p.ext, before = Math.hypot(p.x - h.P.x, p.z - h.P.z), tokens = h.g.tokens;
    check('surf casting allowed', cast(7)); check('single charge', h.g.tokens === tokens - 1536 && !cast(7));
    h.st(40); const pausedX = p.x, pausedZ = p.z, pausedT = sharkRun.t; h.g.state = 'paused'; h.st(30); check('pause freezes chase and shark timer', p.x === pausedX && p.z === pausedZ && sharkRun.t === pausedT); h.g.state = 'play';
    h.st(130); check('Pascal escapes at least 45m', Math.hypot(p.x - h.P.x, p.z - h.P.z) > before + 45);
    check('plank remains visible', K.surf.paddling && K.scene.getObjectByName('pascal_plank').visible);
    check('shark keeps a safe gap', Math.hypot(p.x - shark.position.x, p.z - shark.position.z) > 5.5);
    h.st(200); check('shark dives and releases movement', !sharkRun && !shark.visible && p.ext === previous);
    const distance = Math.hypot(p.x - h.P.x, p.z - h.P.z); h.st(90);
    check('Pascal returns after the scare', Math.hypot(p.x - h.P.x, p.z - h.P.z) < distance - 5);
    h.g.start(true); check('restart cleans visuals and cooldown', !shark.visible && !sharkRipple.visible && cooldowns[7] === 0);
    sharkReview(h, true); const landStart = Math.hypot(p.x - h.P.x, p.z - h.P.z); h.st(130);
    check('land Pascal flees', Math.hypot(p.x - h.P.x, p.z - h.P.z) > landStart + 15);
    check('land wheels deploy', sharkWheels.visible); h.st(230); check('land returns normal pursuit', !sharkRun && p.ext == null);
    h.go(0, 100); Object.assign(p, { x: 5, z: 100, y: W.terrainH(5, 100), ext: null }); coastStamp = -99; cooldowns[7] = 0;
    const bankBefore = h.g.tokens; check('inland rejection never spends', !cast(7) && h.g.tokens === bankBefore);
    console.warn('SHARK PASS ' + results.length + ': ' + results.join('; '));
    sharkReview(h, false);
  };
  K.scenes.agent = h => {
    h.play(); h.go(20, -30); h.P.heading = Math.PI; h.P.inv = 999; A.pascal.wait = 999; h.g.tokens = 8192; h.g.inv = h.g.inv || {}; h.g.inv.rocket = 1;
    h.st(30); portrait = true; drone.position.set(h.P.x + 1, h.P.y + 3.6, h.P.z - 2.2); K.sceneCam = { pos: new T.Vector3(h.P.x - 9, h.P.y + 4.6, h.P.z - 1), look: new T.Vector3(h.P.x, h.P.y + 1.7, h.P.z + 3.5), noClip: true };
    say('Good boy. Great ideas.'); setOpen(true); h.st(2);
  };
  K.scenes.agent_rocket = h => {
    h.play(); h.go(20, -30); h.P.inv = 999; A.pascal.wait = 999; h.g.tokens = 20000; h.g.inv = h.g.inv || {}; h.g.inv.rocket = 1;
    Object.assign(A.pascal, { x: 28, z: -30, y: W.terrainH(28, -30) }); A.pascal.place();
    if (!cast(5)) throw new Error('Agent review: rocket activation failed'); h.st(65);
    const p = A.pascal; K.sceneCam = { pos: new T.Vector3(p.x - 12, p.y + 6, p.z - 15), look: new T.Vector3(p.x, p.y + 1, p.z), noClip: true }; h.st(1);
  };
  K.scenes.agent_waymo = h => {
    h.play(); h.go(20, -30); h.P.inv = 999; A.pascal.wait = 999; h.g.tokens = 20000;
    if (!cast(4)) throw new Error('Agent review: no Waymo pickup'); h.st(75);
    if (h.P.mode !== 'car') throw new Error('Agent review: Waymo boarding failed');
    K.sceneCam = { pos: new T.Vector3(h.P.x - 10, h.P.y + 6, h.P.z - 12), look: new T.Vector3(h.P.x, h.P.y + 1, h.P.z), noClip: true }; h.st(1);
  };
})(window.K);
