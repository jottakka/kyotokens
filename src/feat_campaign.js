/* Kyoto Agent / Flypod city campaign. All deploys and savings are game fiction.
 * No account, network upload, or real hosting-price calculation occurs here. */
(function (K) {
'use strict';
const T = K.T, W = K.W, A = K.A, UI = K.UI;
const JP = { x: -140, z: -50 };
W.PARKS.push({ x0: -164, x1: -116, z0: -68, z1: -20, n: 'Japantown', col: '#e0cfb7', plaza: true, none: 1, dens: 0 });
const jobs = [
  { name: 'Mochi menu', area: 'Japantown', x: -127, z: -29, budget: 1200, used: 200 },
  { name: 'Taco tracker', area: 'Mission', x: -40, z: 150, budget: 1400, used: 250 },
  { name: 'Sea-lion fan page', area: 'Pier 39', x: 85, z: -200, budget: 1600, used: 300 },
  { name: 'Fog forecast', area: 'Golden Gate Park', x: -186, z: 104, budget: 1800, used: 350 },
  { name: 'Ballpark scoreboard', area: 'Oracle Park', x: 166, z: 111, budget: 2000, used: 400 }
];
const campaign = K.campaign = { jobs, kiosks: [], collected: new Set(), deployed: new Set(), savings: 0, interact, JP, displays: [] };
let hud, clock = 0;
const purple = '#1c1833', violet = '#b786ff', charcoal = '#0b0f12', lime = '#b7f84a', white = '#f2f4f7';
const fabric = K.toon(new T.Color('#443069').convertSRGBToLinear());
fabric.emissive.set('#21122f').convertSRGBToLinear(); fabric.emissiveIntensity = .3;
const trim = K.toon(new T.Color('#34244e').convertSRGBToLinear());
function mesh(parent, geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) {
  const o = new T.Mesh(geo, mat); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = o.receiveShadow = true; parent.add(o); return o;
}
function inkTexture(draw, width = 1024, height = 576) { return K.canvasTex(width, height, draw); }
function text(c, s, x, y, size, color = white, align = 'left') {
  c.fillStyle = color; c.font = 'bold ' + size + 'px sans-serif'; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(s, x, y);
}
function emblem(c, x, y, scale) {
  c.save(); c.translate(x, y); c.scale(scale, scale); c.strokeStyle = violet; c.lineWidth = 16; c.shadowColor = violet; c.shadowBlur = 14; c.lineCap = c.lineJoin = 'round';
  c.beginPath(); c.moveTo(-32, -27); c.lineTo(-57, 0); c.lineTo(-32, 27); c.moveTo(15, -38); c.lineTo(-15, 38); c.moveTo(32, -27); c.lineTo(57, 0); c.lineTo(32, 27); c.stroke(); c.restore();
}
function buildHoodie(dog) {
  let body; dog.root.traverse(o => { if (o.isSkinnedMesh && o.name === 'Kyoto') body = o; });
  if (!body) throw new Error('Kyoto hoodie: missing skinned body');
  // Smooth cloth rings, weighted to the original rig, avoid inheriting noisy fur edges.
  const source = body.geometry.attributes.position, si = body.geometry.attributes.skinIndex, sw = body.geometry.attributes.skinWeight;
  const positions = [], indices = [], skinIndex = [], skinWeight = [];
  function vertex(x, y, z) {
    const id = positions.length / 3; positions.push(x, y, z);
    let near = 0, best = Infinity;
    for (let i = 0; i < source.count; i++) { const d = (source.getX(i) - x) ** 2 + (source.getY(i) - y) ** 2 + (source.getZ(i) - z) ** 2; if (d < best) { best = d; near = i; } }
    for (let k = 0; k < 4; k++) { skinIndex.push(si.array[near * 4 + k]); skinWeight.push(sw.array[near * 4 + k]); } return id;
  }
  function tube(rings) {
    const first = positions.length / 3, sides = 32;
    for (const [z, cy, rx, ry] of rings) for (let k = 0; k <= sides; k++) { const a = k / sides * Math.PI * 2; vertex(Math.sin(a) * rx, cy + Math.cos(a) * ry, z); }
    for (let j = 0; j < rings.length - 1; j++) for (let k = 0; k < sides; k++) { const a = first + j * (sides + 1) + k, b = a + sides + 1; indices.push(a, b, a + 1, b, b + 1, a + 1); }
  }
  tube([[-.97,1.40,.32,.43],[-.80,1.40,.43,.46],[-.5,1.42,.50,.51],[-.2,1.44,.49,.52],[.1,1.44,.45,.53],[.4,1.44,.47,.54],[.65,1.43,.49,.54],[.82,1.43,.52,.53],[1.08,1.43,.49,.52],[1.35,1.45,.41,.47]]);
  // Sew the chest closed so the original bandana does not show through the garment.
  const hem = positions.length / 3 - 33, center = vertex(0,1.45,1.35);
  for (let k=0;k<32;k++) indices.push(hem+k,hem+k+1,center);
  // Short sleeves terminate above the paws and follow each front shoulder.
  for (const side of [-1, 1]) {
    const first = positions.length / 3, sides = 24;
    for (const y of [.85,1.05,1.28,1.48]) for (let k = 0; k <= sides; k++) { const a = k / sides * Math.PI * 2; vertex(side * .30 + Math.cos(a) * .235, y, .87 + Math.sin(a) * .25); }
    for (let j = 0; j < 3; j++) for (let k = 0; k < sides; k++) { const a = first + j * (sides + 1) + k, b = a + sides + 1; indices.push(a, a + 1, b, b, a + 1, b + 1); }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); g.setAttribute('skinIndex', new T.Uint16BufferAttribute(skinIndex, 4)); g.setAttribute('skinWeight', new T.Float32BufferAttribute(skinWeight, 4)); g.setIndex(indices); g.computeVertexNormals(); g.computeBoundingSphere();
  const shell = new T.SkinnedMesh(g, fabric.clone()); shell.material.skinning = true; shell.material.side = T.DoubleSide; shell.name = 'kyoto_agent_hoodie';
  shell.position.copy(body.position); shell.quaternion.copy(body.quaternion); shell.scale.copy(body.scale); body.parent.add(shell); shell.bind(body.skeleton, body.bindMatrix); shell.castShadow = true; shell.frustumCulled = false;
  const hood = new T.Group(); hood.name = 'folded_purple_hood'; dog.root.add(hood);
  const ring = mesh(hood, new T.TorusGeometry(.43, .105, 8, 28), trim, 0, 1.91, .85, 1, .75, 1); ring.rotation.x = -Math.PI / 3;
  mesh(hood, new T.SphereGeometry(1, 16, 10), fabric, 0, 1.94, .55, .46, .20, .31);
  dog.root.updateMatrixWorld(true); dog.neck.attach(hood);
  const logoTex = inkTexture(c => { emblem(c, 128, 128, 1.6); }, 256, 256);
  const logoMat = new T.MeshBasicMaterial({ map: logoTex, transparent: true, depthWrite: false, toneMapped: false, side: T.DoubleSide });
  const logo = mesh(dog.root, new T.PlaneGeometry(.57, .57), logoMat, 0, 1.975, -.05); logo.name = 'violet_code_emblem'; logo.rotation.x = -Math.PI / 2;
  dog.root.updateMatrixWorld(true); dog.chest.attach(logo);
  const chestLogo = mesh(dog.root, new T.PlaneGeometry(.55, .55), logoMat, 0, 1.49, 1.405); chestLogo.name = 'chest_code_emblem'; dog.root.updateMatrixWorld(true); dog.chest.attach(chestLogo);
  for (const x of [-.19,.19]) { const cord = mesh(dog.root, new T.CylinderGeometry(.013,.013,.30,6), K.toon(violet), x, 1.76, 1.405); dog.root.updateMatrixWorld(true); dog.neck.attach(cord); }
  const flag = inkTexture(c => { ['#181818','#e82b35','#ffcc35'].forEach((col,i) => { c.fillStyle=col;c.fillRect(0,i*32,144,32); }); c.strokeStyle='#e6d4f9';c.lineWidth=6;c.strokeRect(3,3,138,90); },144,96);
  const patch = mesh(dog.root, new T.PlaneGeometry(.30,.20), new T.MeshBasicMaterial({map:flag,toneMapped:false,side:T.DoubleSide}), -.548, 1.25, .87); patch.rotation.y=-Math.PI/2; patch.name='german_right_sleeve_patch'; dog.root.updateMatrixWorld(true); const rightArm=body.skeleton.bones.find(b=>/^fl_up\.?R$/.test(b.name)); if(rightArm) rightArm.attach(patch); else throw new Error('Kyoto hoodie: missing right shoulder');
  campaign.hoodie = shell; campaign.hood = hood; campaign.emblem = logo;
}
function agentArt(image, headline, sub, portrait = false) {
  return inkTexture(c => {
    c.fillStyle = purple; c.fillRect(0, 0, 1024, 576); c.fillStyle = '#30214b'; c.fillRect(16, 16, 992, 544);
    c.fillStyle = purple; c.fillRect(28, 28, 968, 520); c.strokeStyle = violet; c.lineWidth = 3; c.strokeRect(28, 28, 968, 520);
    const im = K.assets[image], iw = portrait ? 355 : 420, ih = portrait ? 444 : 420;
    if (im) c.drawImage(im, 48, 576 - ih - 48, iw, ih);
    text(c, 'KYOTO AGENT', 480, 100, 42, violet); text(c, headline[0], 480, 217, 49); if (headline[1]) text(c, headline[1], 480, 278, 49);
    text(c, sub, 480, 389, 25, '#d4c9e8'); text(c, 'kyotoagent.dev', 480, 470, 29, violet);
  });
}
function flyArt(headline, sub, flyer = false) {
  const w = flyer ? 512 : 1024, h = flyer ? 700 : 576;
  return inkTexture(c => {
    c.fillStyle = charcoal; c.fillRect(0, 0, w, h); c.strokeStyle = lime; c.lineWidth = 5; c.strokeRect(18, 18, w - 36, h - 36);
    const logo = K.assets.flypod_logo; if (logo) c.drawImage(logo, 36, 38, 72, 72); text(c, 'flypod', 124, 77, 46, lime);
    headline.forEach((s, i) => text(c, s, 42, (flyer ? 207 : 230) + i * 64, flyer ? 40 : 68));
    text(c, sub, 42, h - 160, flyer ? 22 : 29, '#b6c5ca'); text(c, 'Find folders. Drop. Ship.', 42, h - 108, flyer ? 25 : 31, lime);
    text(c, 'flypod.dev', 42, h - 58, 26);
    if (flyer) { c.strokeStyle = '#8aa1a8'; c.lineWidth = 2; for (let i = 0; i < 7; i++) { c.beginPath(); c.moveTo(30 + i * 65, h - 35); c.lineTo(30 + i * 65, h); c.stroke(); } }
  }, w, h);
}
function display(tex, x, y, z, w, h, ry, name, posts = false) {
  const root = new T.Group(); root.name = name; root.position.set(x, y, z); root.rotation.y = ry; K.scene.add(root);
  mesh(root, new T.BoxGeometry(w + .22, h + .22, .16), K.toon('#2c2938'), 0, 0, 0);
  const face = mesh(root, new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tex, toneMapped: false }), 0, 0, .095); face.castShadow = false;
  if (posts) for (const s of [-1, 1]) mesh(root, new T.BoxGeometry(.20, y - W.terrainH(x, z), .22), K.toon('#39424b'), s * w * .32, -(y - W.terrainH(x, z)) / 2, -.13);
  W.addCull(root, x, z, posts ? 450 : 210); campaign.displays.push(root); return root;
}
function wallPaper(tex, x, y, z, w, h, ry, name) {
  const o = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tex, toneMapped: false, side: T.DoubleSide })); o.name = name; o.position.set(x, y, z); o.rotation.y = ry; K.scene.add(o); W.addCull(o, x, z, 170); campaign.displays.push(o); return o;
}
function buildAds() {
  const icon = agentArt('campaign_icon', ['Good boy.', 'Better commits.'], 'Your work. Your decisions. Proof.');
  const desk = agentArt('campaign_desk', ['Fetches bugs.', 'Returns proof.'], 'Focus on what you build.', true);
  const S = W.STAD, a = -2.80, r = S.r1 + .16;
  // Billboard sits on the facade; paper flyers sit just outside its cylindrical wall.
  const bb = display(icon, S.x + Math.sin(a) * r, 20, S.z + Math.cos(a) * r, 11, 6.1875, a, 'stadium_kyoto_agent_billboard');
  for (const s of [-1, 1]) mesh(bb, new T.BoxGeometry(.25, 1.1, .25), K.toon('#39424b'), s * 3.4, -3.65, -.1);
  for (const [angle, tex, name] of [[-2.94, desk, 'stadium_agent_desk_flyer'], [-2.84, icon, 'stadium_agent_icon_flyer'], [-1.86, flyArt(['Sit. Stay.', 'Ship.'], 'No collar tag required.', true), 'stadium_flypod_flyer']])
    wallPaper(tex, S.x + Math.sin(angle) * r, 2.8, S.z + Math.cos(angle) * r, tex.image.width / tex.image.height * 1.9, 1.9, angle, name);
  // Reuse real building-wall sites. Never combine the two supplied images on one ad.
  const walls = W.placements.filter(q => q.kind === 'building' && !q.removed && Math.hypot(q.x - JP.x, q.z - JP.z) > 35).map(q => {
    const b = q.support.box, it = q.support.item, ry = it.ry || 0, lx = (b.min.x + b.max.x) / 2, lz = b.min.z - .07;
    return { x: q.x + Math.cos(ry) * lx + Math.sin(ry) * lz, z: q.z - Math.sin(ry) * lx + Math.cos(ry) * lz, y: q.y + b.min.y, rot: ry + Math.PI };
  });
  for (const [target, tex, name] of [[[20, -20], desk, 'downtown_kyoto_agent_flyer'], [[-50, 160], flyArt(['Same URL,', 'new tricks.'], 'Good dogs keep their address.', true), 'mission_flypod_flyer'], [[-180, 104], icon, 'park_kyoto_agent_flyer']]) {
    const q = walls.slice().sort((u, v) => Math.hypot(u.x - target[0], u.z - target[1]) - Math.hypot(v.x - target[0], v.z - target[1]))[0];
    if (q) wallPaper(tex, q.x + Math.sin(q.rot) * .045, q.y + 2.9, q.z + Math.cos(q.rot) * .045, 2.8, 2.8 * tex.image.height / tex.image.width, q.rot, name);
  }
  const spot = W.billboardSpots.filter(q => Math.hypot(q.x - JP.x, q.z - JP.z) > 55 && q.x > -200).slice(-1)[0];
  if (spot) {
    const sign = display(flyArt(['Your side project', 'has left the couch.'], 'A folder. A command. A live URL.'), spot.x, spot.y + 5, spot.z, 10, 5.625, spot.rot, 'city_flypod_billboard');
    for (const s of [-1, 1]) mesh(sign, new T.BoxGeometry(.2, 2.3, .22), K.toon('#39424b'), s * 3.2, -3.85, -.1);
  }
}
function buildJapantown() {
  const root = new T.Group(); root.name = 'sf_japantown'; root.position.set(JP.x, W.terrainH(JP.x, JP.z), JP.z); K.scene.add(root); campaign.japantown = root;
  const stone = K.toon('#e4d5b9'), wood = K.toon('#63394b'), roof = K.toon('#393647'), red = K.toon('#bf5e62');
  mesh(root, new T.BoxGeometry(47, .25, 47), stone, 0, -.08, 6);
  // SF's Peace Pagoda silhouette: five receding round roofs and a slender finial.
  const tower = new T.Group(); root.add(tower); tower.position.set(-8, 0, -3); tower.name = 'japantown_peace_pagoda';
  mesh(tower, new T.CylinderGeometry(3.8, 4.5, .65, 16), stone, 0, .33, 0);
  mesh(tower, new T.CylinderGeometry(.50, .80, 10.8, 12), stone, 0, 5.5, 0);
  for (let i = 0; i < 5; i++) { const r = 4.4 - i * .6, y = 2.2 + i * 1.8; mesh(tower, new T.ConeGeometry(r, .9, 12), roof, 0, y, 0); mesh(tower, new T.CylinderGeometry(r, r, .15, 12), stone, 0, y - .45, 0); }
  mesh(tower, new T.ConeGeometry(.18, 2, 8), K.toon('#c89b64'), 0, 11.4, 0);
  W.addCircle(JP.x - 8, JP.z - 3, 4.5, root.position.y + 12.4);
  // Two compact shop fronts leave the center of the plaza open.
  for (const side of [-1, 1]) {
    mesh(root, new T.BoxGeometry(7, 5, 27), K.toon('#f5dfca'), side * 19, 2.5, 4);
    mesh(root, new T.BoxGeometry(8.5, .55, 29), roof, side * 19, 5.35, 4);
    for (let z = -6; z <= 14; z += 5) { mesh(root, new T.BoxGeometry(.12, 3.3, 3.4), wood, side * 15.45, 2.1, z); mesh(root, new T.BoxGeometry(.18, .35, 4.1), red, side * 15.25, 4.1, z); }
    W.addBox(JP.x + side * 19 - 3.5, JP.x + side * 19 + 3.5, JP.z - 9.5, JP.z + 17.5, root.position.y + 5.6);
  }
  const directory = inkTexture(c => { c.fillStyle = purple; c.fillRect(0, 0, 1024, 256); text(c, 'JAPANTOWN', 512, 90, 82, '#ffe9cf', 'center'); text(c, 'NIHONMACHI  /  SAN FRANCISCO', 512, 192, 35, violet, 'center'); }, 1024, 256);
  display(directory, JP.x, root.position.y + 5.3, JP.z + 22, 9, 2.25, 0, 'japantown_welcome', true);
  // Bronze Kyoto watches over the square. His existing identity/rig is retained.
  mesh(root, new T.CylinderGeometry(2.4, 2.7, 1.4, 8), K.toon('#5c5d69'), 5, .7, -2);
  const statue = K.rigClone(K.assets.kyoto); statue.root.name = 'kyoto_city_hero_memorial'; root.add(statue.root); statue.root.position.set(5, 1.4, -2); statue.root.scale.setScalar(1.45); statue.play('sit', 0); statue.mixer.update(.2);
  statue.root.traverse(o => { if (o.isMesh) { o.material = new T.MeshStandardMaterial({ color: '#a87543', metalness: .5, roughness: .6, skinning: !!o.isSkinnedMesh }); o.castShadow = true; } });
  W.addCircle(JP.x + 5, JP.z - 2, 2.8, root.position.y + 5);
  const plaque = inkTexture(c => { c.fillStyle = '#302638'; c.fillRect(0, 0, 1024, 576); text(c, 'THANK YOU, KYOTO', 512, 105, 65, '#f7cc8b', 'center'); text(c, 'For helping San Francisco', 512, 230, 43, white, 'center'); text(c, 'stand tall against Godzilla.', 512, 290, 43, white, 'center'); text(c, 'One brave dog. A grateful city.', 512, 435, 34, violet, 'center'); });
  display(plaque, JP.x + 5, root.position.y + 1.0, JP.z + .42, 3.5, 1.97, 0, 'kyoto_godzilla_tribute_plaque');
  for (const [x, z] of [[-11, 15], [11, 15], [-11, -12], [11, -12]]) {
    const y = W.terrainH(JP.x + x, JP.z + z) - root.position.y;
    mesh(root, new T.CylinderGeometry(.26, .48, 4.5, 7), wood, x, y + 2.25, z);
    for (let i = 0; i < 5; i++) mesh(root, new T.IcosahedronGeometry(1, 1), K.toon(i % 2 ? '#efadc9' : '#f8cadd'), x + Math.sin(i * 2.4) * 1.5, y + 4.8 + Math.cos(i * 2.4) * .6, z + Math.cos(i * 2.4) * 1.3, 1.55, 1.15, 1.4);
    W.addCircle(JP.x + x, JP.z + z, .6, y + root.position.y + 5);
  }
  for (const x of [-13, 13]) for (const z of [-5, 6, 17]) { mesh(root, new T.CylinderGeometry(.08, .10, 3, 6), wood, x, 1.5, z); mesh(root, new T.SphereGeometry(.48, 10, 6), red, x, 2.9, z, 1, 1.25, 1); }
  display(agentArt('campaign_desk', ['Good company.', 'Good work.'], 'Build with Kyoto.', true), JP.x + 15.38, root.position.y + 2.5, JP.z + 4, 3.7, 2.08, -Math.PI / 2, 'japantown_agent_poster');
  W.landmark.japantown = { o: root };
}
function buildQuest() {
  for (const j of jobs) {
    const q = W.freeWalk(j.x, j.z, 1.1); j.x = q[0]; j.z = q[1]; j.y = W.groundAt(j.x, j.z, 2, .7);
    const root = j.root = new T.Group(); root.name = 'flypod_project_' + j.name; root.position.set(j.x, j.y, j.z); K.scene.add(root);
    mesh(root, new T.BoxGeometry(1.15, .70, .24), K.toon(lime), 0, 1.05, 0); mesh(root, new T.BoxGeometry(.5, .20, .25), K.toon(lime), -.28, 1.47, 0);
    const tex = inkTexture(c => { c.fillStyle = charcoal; c.fillRect(0, 0, 512, 128); text(c, './' + j.name.toLowerCase().replaceAll(' ', '-'), 256, 68, 28, lime, 'center'); }, 512, 128);
    mesh(root, new T.PlaneGeometry(1.02, .255), new T.MeshBasicMaterial({ map: tex, toneMapped: false }), 0, 1.04, .131);
    const ring = mesh(root, new T.TorusGeometry(1.25, .065, 6, 28), new T.MeshBasicMaterial({ color: lime }), 0, .06, 0); ring.rotation.x = Math.PI / 2;
    j.tag = A.tag(root, 'FOLDER · ' + j.name, null, 2.3, 40);
  }
  for (const [x, z, label] of [[JP.x + 7, JP.z + 14, 'Japantown'], [155, 107, 'Oracle Park']]) {
    const q = W.freeWalk(x, z, 2), y = W.groundAt(q[0], q[1], 2, 1.3), root = new T.Group(); root.position.set(q[0], y, q[1]); root.name = 'flypod_deploy_kiosk'; K.scene.add(root);
    mesh(root, new T.CylinderGeometry(1.25,1.4,.4,12), K.toon(charcoal), 0,.2,0);
    mesh(root, new T.SphereGeometry(1,20,12), K.toon('#e9ece6'), 0,1.55,0,1.23,.95,.72);
    const faceTex=inkTexture(c=>{c.fillStyle=charcoal;c.fillRect(0,0,512,256);c.strokeStyle='#73dfff';c.lineWidth=15;c.lineCap='round';for(const x of [163,349]){c.beginPath();c.moveTo(x-35,145);c.lineTo(x,105);c.lineTo(x+35,145);c.stroke();}},512,256);
    mesh(root,new T.PlaneGeometry(1.7,.85),new T.MeshBasicMaterial({map:faceTex,toneMapped:false}),0,1.8,.765);
    for(const x of [-1.25,1.25]){const rotor=mesh(root,new T.TorusGeometry(.50,.08,6,24),K.toon(lime),x,2.5,0);rotor.rotation.x=Math.PI/2;mesh(root,new T.CylinderGeometry(.07,.07,.65,6),K.toon(charcoal),x,2.18,0);}
    const badge=inkTexture(c=>{c.fillStyle='#ffdd17';c.fillRect(0,0,240,60);c.fillStyle='#1359b4';c.fillRect(0,60,240,30);c.fillStyle='#df2935';c.fillRect(0,90,240,30);c.fillStyle='#76552a';c.beginPath();c.ellipse(120,63,10,14,0,0,7);c.fill();},240,120);
    mesh(root,new T.PlaneGeometry(.47,.235),new T.MeshBasicMaterial({map:badge,toneMapped:false}),.66,1.17,.65);
    const gift=mesh(root,new T.BoxGeometry(.6,.6,.6),K.toon('#ede6c6'),-1.8,.5,.5);mesh(root,new T.BoxGeometry(.12,.63,.64),K.toon(lime),-1.8,.5,.5);mesh(root,new T.BoxGeometry(.64,.63,.12),K.toon(lime),-1.8,.5,.5);
    const sign=inkTexture(c=>{c.fillStyle=charcoal;c.fillRect(0,0,512,128);if(K.assets.flypod_logo)c.drawImage(K.assets.flypod_logo,15,23,82,82);text(c,'FLYPOD · DEPLOY',115,70,34,lime);},512,128);
    mesh(root,new T.PlaneGeometry(2.7,.675),new T.MeshBasicMaterial({map:sign,toneMapped:false}),0,3.05,0);
    const ring = mesh(root, new T.TorusGeometry(2.8, .10, 6, 32), new T.MeshBasicMaterial({ color: lime }), 0, .06, 0); ring.rotation.x = Math.PI / 2;
    W.addBox(q[0] - 1.4, q[0] + 1.4, q[1] - .5, q[1] + .5, y + 2.7);
    campaign.kiosks.push({ x: q[0], y, z: q[1], root, label }); A.tag(root, 'FLYPOD · DEPLOY', null, 3.8, 65);
  }
  hud = document.createElement('button'); hud.id = 'flypodQuest'; hud.type = 'button'; hud.title = 'Open map to find project folders and deploy kiosks'; hud.addEventListener('click', () => K.game.mapKey()); document.body.appendChild(hud);
  const style = document.createElement('style'); style.textContent = '#flypodQuest{position:fixed;left:16px;bottom:200px;z-index:8;max-width:min(350px,calc(100vw - 32px));padding:12px 16px;border:2px solid #b7f84a;border-radius:12px;background:#0b0f12ee;color:#f2f4f7;font:700 12px/1.5 system-ui;text-align:left;cursor:pointer;box-shadow:0 4px 0 #241634}#flypodQuest strong{color:#b7f84a;font-size:15px}#flypodQuest span{color:#b6c5ca}#flypodQuest[hidden]{display:none}@media(max-width:700px){#flypodQuest{left:8px;bottom:310px;max-width:220px;padding:7px 10px;font-size:10px}#flypodQuest strong{font-size:12px}}@media(orientation:landscape) and (max-height:600px){#flypodQuest{left:calc(50% - 105px);top:180px;bottom:auto;max-width:210px;padding:6px 8px;font-size:10px}#flypodQuest strong{font-size:12px}}#flypodQuest:focus-visible{outline:3px solid #b786ff;outline-offset:4px}'; document.head.appendChild(style);
}
function pending() { return jobs.filter(j => campaign.collected.has(j) && !campaign.deployed.has(j)); }
function interact() {
  const P = A.player; if (K.game.state !== 'play' || P.mode !== 'walk' || P.ext || !P.onGround) return false;
  const j = jobs.find(j => !campaign.collected.has(j) && Math.hypot(j.x - P.x, j.z - P.z) < 2.9 && Math.abs(j.y - P.y) < 2);
  if (j) { UI.prompt('E · fetch ' + j.name); if (K.inp.act) { K.inp.act = false; campaign.collected.add(j); j.root.visible = false; j.tag.n.hidden = true; P.interactT = .3; K.sfx.yoink(); UI.banner('FOLDER FETCHED!', j.name + ' · bring it to a Flypod bot', 'hack', 'flypod'); } return true; }
  const kiosk = campaign.kiosks.find(q => Math.hypot(q.x - P.x, q.z - P.z) < 4.3 && Math.abs(q.y - P.y) < 2);
  if (!kiosk) return false;
  const queue = pending(); UI.prompt(queue.length ? 'E · deploy ' + queue.length + ' fetched folder' + (queue.length === 1 ? '' : 's') : 'FLYPOD · find lime project folders · L map');
  if (queue.length && K.inp.act) {
    K.inp.act = false; let reward = 0; queue.forEach(j => { campaign.deployed.add(j); reward += j.budget - j.used; });
    campaign.savings += reward; K.game.tokens += reward; P.interactT = .5; K.sfx.deploy(); A.floater(P.x, P.y + 4.5, P.z, '+' + reward + ' tok · savings', 'gold');
    UI.banner(campaign.deployed.size === jobs.length ? 'FETCH. SHIP. GOOD DOG!' : 'DEPLOYED IN GAME!', '+' + reward + ' tok saved · ' + campaign.deployed.size + '/5 live projects', 'hack', 'flypod');
  }
  return true;
}
K.on('build', () => { buildHoodie(A.kyoto); buildJapantown(); buildAds(); buildQuest(); });
K.on('start', () => { campaign.collected.clear(); campaign.deployed.clear(); campaign.savings = 0; for (const j of jobs) { j.root.visible = true; j.tag.n.hidden = false; } clock = 0; });
K.on('step', dt => { clock += dt; for (const j of jobs) { if (campaign.collected.has(j)) { j.root.visible = false; j.tag.n.hidden = true; } else { j.root.visible = Math.hypot(j.x - A.player.x, j.z - A.player.z) < 180; j.root.rotation.y = Math.sin(clock * .7) * .15; } } });
K.on('ui', g => {
  if (!hud) return; hud.hidden = g.state !== 'play'; if (hud.hidden) return;
  const count = campaign.deployed.size, queue = pending(), targets = queue.length ? campaign.kiosks : jobs.filter(j => !campaign.collected.has(j));
  const nearest = targets.slice().sort((a, b) => Math.hypot(a.x - A.player.x, a.z - A.player.z) - Math.hypot(b.x - A.player.x, b.z - A.player.z))[0];
  const next = nearest ? (queue.length ? 'Deploy at ' + nearest.label : nearest.name + ' · ' + nearest.area) + ' · ' + Math.round(Math.hypot(nearest.x - A.player.x, nearest.z - A.player.z)) + 'm' : 'All five projects shipped. Good dog!';
  const html = '<strong>FLYPOD FETCH · ' + count + '/5 shipped</strong><br>' + next + '<br><span>' + queue.length + ' carried · ' + campaign.savings + ' tok saved · L / tap: map<br>Simulated savings · game tokens</span>';
  if (hud.innerHTML !== html) hud.innerHTML = html;
});
K.scenes = K.scenes || {};
K.scenes.agenthoodie = h => { h.play(); h.pz.wait = 1e6; h.go(JP.x, JP.z + 8); h.P.heading = Math.PI; h.st(2); K.sceneCam = { noClip: true, pos: new T.Vector3(h.P.x + 3.5, h.P.y + 3.0, h.P.z - 4), look: new T.Vector3(h.P.x, h.P.y + 1.3, h.P.z) }; h.st(1); };
K.scenes.japantown = h => { h.play(); h.pz.wait = 1e6; h.go(JP.x, JP.z + 17); h.st(2); K.sceneCam = { noClip: true, pos: new T.Vector3(JP.x + 7, W.terrainH(JP.x, JP.z) + 13, JP.z + 36), look: new T.Vector3(JP.x - 1, W.terrainH(JP.x, JP.z) + 3, JP.z) }; h.st(1); };
K.scenes.campaignstadium = h => { h.play(); h.pz.wait = 1e6; h.go(173, 95); h.st(2); K.sceneCam = { noClip: true, pos: new T.Vector3(190.5, 23, 94.5), look: new T.Vector3(195.2, 20, 108.4) }; h.st(1); };
K.scenes.flypodcheck = h => {
  h.play(); h.pz.wait = 1e6; const results = [], check = (ok, s) => { if (!ok) throw new Error('campaign check: ' + s); results.push(s); };
  check(campaign.hoodie.visible && campaign.hoodie.skeleton === A.kyoto.root.getObjectByName('Kyoto').skeleton, 'starting hoodie uses Kyoto animation skeleton');
  const tokens = h.g.tokens;
  h.P.x = -500; h.P.z = 300; h.P.y = 0; K.inp.act = true; check(!interact() && !campaign.collected.size, 'distant input cannot collect'); K.inp.act = false;
  for (const j of jobs) { h.P.x = j.x; h.P.z = j.z; h.P.y = j.y; h.P.onGround = true; h.P.mode = 'walk'; h.P.ext = null; K.inp.act = true; interact(); check(campaign.collected.has(j) && !j.root.visible, 'fetch ' + j.name); }
  check(h.g.tokens === tokens, 'fetching alone pays no deployment reward');
  const k = campaign.kiosks[0]; h.P.x = k.x; h.P.z = k.z + 2; h.P.y = k.y; K.inp.act = true; interact();
  const expected = jobs.reduce((sum, j) => sum + j.budget - j.used, 0); check(campaign.deployed.size === 5 && campaign.savings === expected && h.g.tokens === tokens + expected, 'all five deploys award exactly 6500 simulated savings tokens');
  K.inp.act = true; interact(); check(h.g.tokens === tokens + expected, 'repeat deployment cannot mint tokens');
  h.g.start(true); check(!campaign.collected.size && !campaign.deployed.size && campaign.savings === 0 && jobs.every(j => j.root.visible), 'new run resets folders and savings');
  check(campaign.hoodie.visible, 'hoodie remains equipped after restart'); campaign.check = { ok: true, results }; K.scenes.japantown(h);
};
})(window.K);
