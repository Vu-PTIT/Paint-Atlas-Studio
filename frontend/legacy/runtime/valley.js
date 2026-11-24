const bounds = { left: -73, right: 75, north: -94, south: 35 };
const waterLevel = -.08;
const riverCenter = x => -24 - .37 * x + 6 * Math.sin((x + 10) * .071);
const riverWidth = x => 3.6 + .83 * Math.sin(.089 * x + .6) + .27 * Math.sin(x * .23) + 1.1 * smooth(20, 44, x);
const bridgeA = { x: 5, z: riverCenter(5), fx: .566, fz: -.8244, length: 9.6, halfWidth: 1.94 };
const bridgeB = { x: -40, z: riverCenter(-40), fx: -.083, fz: -.99655, length: 6.7, halfWidth: 1.73 };
const bridges = isRiver ? [bridgeA, bridgeB] : [];
const closestBridge = x => x > -14 ? bridgeA : bridgeB;
const bridgeCoords = (bridge, x, z) => {
  const dx = x - bridge.x, dz = z - bridge.z;
  return [dx * bridge.fx + dz * bridge.fz, -dx * bridge.fz + dz * bridge.fx];
};
const fromBridge = (bridge, lengthwise, y, across = 0) => [
  bridge.x + lengthwise * bridge.fx - across * bridge.fz,
  y,
  bridge.z + lengthwise * bridge.fz + across * bridge.fx
];

function valleyHeight(x, z) {
  const hills = .37 * Math.sin(x * .092 + z * .043) + .31 * Math.sin(z * .14 + .2) +
    .25 * Math.cos(x * .19 - z * .11) + .10 * Math.cos(z * .39 + x * .29);
  const rise = 1.05 * smooth(-30, -62, z) + 1.8 * Math.exp(-((x + 40) ** 2 + (z + 66) ** 2) / 540);
  return .30 + hills + rise;
}
function ground(x, z) {
  if (!isRiver) return valleyHeight(x, z);
  const cut = 1 - smooth(riverWidth(x) - .35, riverWidth(x) + 3.1, Math.abs(z - riverCenter(x)));
  return mix(valleyHeight(x,z), -1.62 + .16 * Math.sin(x * .47 + z), cut);
}
function deckHeight(bridge, s) {
  const edge = fromBridge(bridge, s, 0);
  const base = ground(edge[0], edge[2]);
  const t = Math.abs(s / bridge.length);
  const arch = .24 + 1.69 * (1 - t * t);
  return mix(base, Math.max(base, arch), 1 - smooth(.72, 1, t));
}
function roadSurface(x, z) {
  if (!isRiver) return ground(x, z);
  const bridge = closestBridge(x);
  const [s, w] = bridgeCoords(bridge, x, z);
  return Math.abs(w) <= bridge.halfWidth && Math.abs(s) <= bridge.length ? deckHeight(bridge,s) : ground(x,z);
}

const waypoints = [
  [-3.1,12.4],[.28,5.2],[-.45,-2.4],[-2.15,-8.8],[-.17,-13.4],
  [bridgeA.x,bridgeA.z],[10.27,-28.25],[13.2,-35.5],[13.1,-44.7],
  [8.6,-50.2],[.7,-51.35],[-9.8,-49.7],[-20,-46.9],[-29.7,-38.25],
  [-37.9,-26.2],[-40.54,bridgeB.z-6.35],[bridgeB.x,bridgeB.z],
  [-39.49,bridgeB.z+6.1],[-37.2,-4.8],[-31,4.8],[-24,12.85],[-15,18.25],[-7.3,17.55]
];
const path = [], pathGrid = new Map();
let trailLength = 0;
for (let k = 0; k < waypoints.length; k++) {
  const a = waypoints[(k + waypoints.length - 1) % waypoints.length], b = waypoints[k];
  const c = waypoints[(k + 1) % waypoints.length], d = waypoints[(k + 2) % waypoints.length];
  for (let i = 0; i < 25; i++) {
    const t = i / 25;
    const x = cat(a[0],b[0],c[0],d[0],t), z = cat(a[1],b[1],c[1],d[1],t);
    const prev = path.at(-1);
    if (prev) trailLength += Math.hypot(x - prev.x, z - prev.z);
    const pt = { x, z, s: trailLength };
    path.push(pt);
    const key = Math.floor(x / 6) + ',' + Math.floor(z / 6);
    if (!pathGrid.has(key)) pathGrid.set(key, []);
    pathGrid.get(key).push(pt);
  }
}
trailLength += Math.hypot(path[0].x - path.at(-1).x, path[0].z - path.at(-1).z);
function pathAt(s) {
  s = ((s % trailLength) + trailLength) % trailLength;
  let lo = 0, hi = path.length;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (path[mid].s <= s) lo = mid;
    else hi = mid;
  }
  const p = path[lo], q = path[hi % path.length];
  const t = (s - p.s) / ((hi === path.length ? trailLength : q.s) - p.s);
  return { x: mix(p.x, q.x, t), z: mix(p.z, q.z, t) };
}
function nearestRoute(x, z) {
  let best = path[0], bestDist = Infinity;
  for (const p of path) {
    const d = (x - p.x) ** 2 + (z - p.z) ** 2;
    if (d < bestDist) { best = p; bestDist = d; }
  }
  return best;
}
function trailDistance(x, z) {
  const cx = Math.floor(x / 6), cz = Math.floor(z / 6);
  let best = 53;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const cell = pathGrid.get((cx+i) + ',' + (cz+j));
    if (cell) for (const p of cell) best = Math.min(best, (p.x-x)**2 + (p.z-z)**2);
  }
  return Math.sqrt(best);
}

const flowerPlots = pieces('sunflowers').map(({x, z, scale}) => (
  {x, z, a: 10.6 * scale, b: 12.1 * scale, ring: 5.2 * scale}
));
const wheatPlots = pieces('wheat').map(({x, z, scale}) => (
  {x, z, a: 8.2 * scale, b: 5.0 * scale}
));
function inPlot(x, z, plot) {
  return ((x - plot.x) / plot.a) ** 2 + ((z - plot.z) / plot.b) ** 2 < 1 + .068 * Math.sin(x * .97 + z * .46);
}
function roads(x, z) {
  let widthDist = trailDistance(x,z) - (1.57 + .18 * Math.sin(x*.7+z*.33));
  for (const p of flowerPlots) {
    if (inPlot(x,z,p)) widthDist = Math.min(widthDist, Math.abs(Math.hypot(x-p.x,(z-p.z)*.87) - p.ring) - .67);
  }
  if (x > -26 && x < 30 && z < -39 && z > -74) {
    widthDist = Math.min(widthDist, Math.abs(z + 59 + 1.6*Math.sin(x*.16)) - .95);
  }
  return widthDist;
}
function groundNormal(x,z) { return unit([ground(x-.23,z) - ground(x+.23,z), .46, ground(x,z-.23) - ground(x,z+.23)]); }

const meadow = [
  pair(0x192e30,0x345253),pair(0x172b2d,0x38574c),pair(0x142b38,0x345862),
  pair(0x20343b,0x496557),pair(0x1f3834,0x4b644d),pair(0x132630,0x254658)
];
const orchard = [
  pair(0x202d24,0x405744),pair(0x132c2d,0x3a6555),pair(0x263727,0x516044),pair(0x242d2b,0x514844)
];
const roadCoats = [
  pair(0x4a393b,0x8c7358),pair(0x3c3441,0x75655b), pair(0x514246,0x927956),
  pair(0x463939,0x78604b),pair(0x5c4946,0xa18362),pair(0x35343c,0x746760)
];
const banks = [
  pair(0x273739,0x5d7367), pair(0x253842,0x435864), pair(0x2d3638,0x666358),pair(0x263949,0x4f6f6f)
];
const strawEarth = [pair(0x423626,0x74684b), pair(0x3f362c,0x807151),pair(0x322e2a,0x74634a)];
function terrainColors(x, z, road, reach) {
  if (isRiver && reach < riverWidth(x) + .7) return pick(banks);
  if (road < -.33 || road < .28 && rand() < .56) return pick(roadCoats);
  if (wheatPlots.some(p => inPlot(x,z,p))) return pick(strawEarth);
  if (flowerPlots.some(p => inPlot(x,z,p))) return pick(orchard);
  const grain = .5+.25*Math.sin(x*.20+z*.29)+.25*Math.sin(x*.31-z*.13);
  return meadow[Math.min(meadow.length - 1, Math.floor(clamp(grain + spread(.32)) * meadow.length))];
}

const rock = [
  pair(0x172539,0x4b546c),pair(0x213345,0x5b6b77),pair(0x1e2639,0x455978),pair(0x373744,0x748176),
  pair(0x202b3d,0x547b88),pair(0x25374b,0x49727e)
];
const slate = [pair(0x172339,0x365a72),pair(0x141d36,0x204f73),pair(0x16304c,0x466b77),pair(0x22283a,0x536171)];
const plaster = [pair(0x40424e,0x868779),pair(0x343f53,0x747f83),pair(0x414955,0x929884),pair(0x434042,0x887868)];
const clay = [pair(0x3d2833,0x81514b),pair(0x342735,0x714249),pair(0x4b3540,0x905c54),pair(0x28273b,0x574b4e)];
const wood = [pair(0x231b25,0x59443c),pair(0x241f2e,0x665447),pair(0x282332,0x6e6252)];
const bark = [pair(0x211f28,0x59463c),pair(0x25272a,0x585244),pair(0x263039,0x545955)];
const amber = [pair(0xd98431,0xffc85f),pair(0xf4a74d,0xffe398),pair(0xf3b85f,0xffe4ad),pair(0xad5226,0xe9a345)];
const darkStone = pair(0x152131,0x334653);
const stoneTrim = pair(0x374757,0x858a78);

const colliders = [];
const hazards = [];
function obstruction(x, z, y, width, height, depth, yaw = 0, kind = '') {
  const o = { x, z, y, width, height, depth, yaw, kind };
  colliders.push(o);
  if (kind) hazards.push(o);
  return o;
}
const cottages = pieces('cottage').map(({x, z, scale}, i) => (
  [x, z, 5.8 * scale, 4.8 * scale, 3.7 * scale, 2.8 * scale, i % 3]
));
const windmills = pieces('windmill').map(({x, z, scale}) => [x, z, scale]);
const church = pieces('chapel').map(({x, z}) => [x, z])[0];
const lanterns = pieces('lantern').map(({x, z}) => [x, ground(x, z), z]);
const reflectiveLights = [];
for (const [x, z, w, d, h] of cottages) {
  const light = [x, ground(x, z) + h * .44, z + d * .62];
  sources.push([...light, 6, .59]);
  reflectiveLights.push(light);
}
for (const [x, z, s] of windmills) {
  const light = [x, ground(x, z) + 2.14 * s, z + 2.6 * s];
  sources.push([...light, 6, .63]);
  reflectiveLights.push(light);
}
if (church) sources.push([church[0], ground(...church) + 3.9, church[1] + 4.5, 8, .51]);
for (const [x, y, z] of lanterns) sources.push([x, y + 2.12, z, 6.2, .77]);
const reflectedWindows = new Float32Array(15).fill(2000);
reflectiveLights.slice(0, 5).forEach((light, i) => reflectedWindows.set(light, i * 3));

function buildTerrain() {
  rand = seeded(worldSeed(920114));
  const spacing = 1.12;
  for (let z = -116; z <= 45; z += spacing) for (let x = -87; x <= 92; x += spacing) {
    const px = x + spread(.50), pz = z + spread(.50), y = ground(px,pz);
    const reach = Math.abs(pz - riverCenter(px)), road = roads(px,pz);
    const colors = terrainColors(px,pz,road,reach);
    const angle = .20 + .36 * Math.sin(px*.12+pz*.16) + spread(.52);
    dab(land,[px,y-.055,pz],groundNormal(px,pz),[Math.cos(angle),0,Math.sin(angle)],
      spacing * 1.14, spacing * .96, colors, BASE);
  }
  for (let z = -102; z < 41; z += .68) for (let x = -81; x < 84; x += .68) {
    const px = x + spread(.70), pz = z + spread(.70);
    const reach = Math.abs(pz - riverCenter(px));
    if (isRiver && reach < riverWidth(px) - .45) continue;
    const road = roads(px,pz), col = terrainColors(px,pz,road,reach);
    const step = road < 0 ? 3 : 4;
    const angle = .24 + .49 * Math.sin(px*.117+pz*.131);
    for (let i = 0; i < step; i++) {
      const xx = px + spread(.62), zz = pz + spread(.61), yy = ground(xx,zz);
      const a = angle + spread(road < 0 ? 1.1 : .64);
      dab(land,[xx,yy + rand()*.042,zz],groundNormal(xx,zz),[Math.cos(a),0,Math.sin(a)],
        .15+rand()*.45,.032+rand()*.115,col,TEXTURE,.73+rand()*.26);
    }
    if (road < .05 && rand() < .095) {
      const y = ground(px,pz);
      flatDab(land,px,y+.031,pz,spread(2),.095+rand()*.15,.045+rand()*.06,pick(banks),TEXTURE,.9);
    }
  }
}

function planeWindow(batch,x,y,z,w,h,arch=false,normal=Z) {
  const along = Math.abs(normal[2]) > .5 ? [Math.sign(normal[2]),0,0] : [0,0,-Math.sign(normal[0])];
  const orient = (s,t,off=0) => add([x,y+t,z],add(scale(along,s),scale(normal,off)));
  function quad(a,b,c,d,colors,options={}) {
    panel(batch,orient(a[0],a[1],a[2]),orient(b[0],b[1],b[2]),orient(c[0],c[1],c[2]),orient(d[0],d[1],d[2]),colors,options);
  }
  const hw = w*.53;
  const top = h*.5, bottom = -h*.5;
  quad([-hw-.07,bottom-.075], [hw+.07,bottom-.075], [hw+.07,top+.045],[-hw-.07,top+.045],darkStone,
    {step:.095,rough:.012,style:BASE,exclude:(u,v) => arch && v>.7 && Math.abs(u-.5)>(1-v)*1.67+.07});
  const rows = Math.ceil(h/.072), cols = Math.ceil(w/.085);
  for (let j=0;j<rows;j++) for (let i=0;i<cols;i++) {
    const a = (i+.5+spread(.42))/cols, b = (j+.5+spread(.49))/rows;
    if (arch && b>.65 && Math.abs(a-.5)>(1-b)*1.6+.03) continue;
    const shade = (j + i)%4 === 0 ? amber[0] : pick(amber.slice(0,3));
    dab(batch,orient((a-.5)*w,(b-.5)*h,.041),normal,UP,.082,.057,shade,LIGHT);
  }
  paintedLine(batch,orient(-hw-.11,bottom-.07,.04),orient(hw+.11,bottom-.07,.04),.052,stoneTrim,{normal:normal,style:BASE});
  if (w > .38) {
    paintedLine(batch,orient(0,bottom,.088),orient(0,top-(arch?.08:0),.088),.025,wood[0],{normal,style:BASE});
    paintedLine(batch,orient(-hw,.02,.087),orient(hw,.02,.087),.023,wood[0],{normal,style:BASE});
  }
}
function house(x,z,w,d,h,rise,kind) {
  const y = ground(x,z) - .06, a = w * .5, b = d * .5;
  const body = architecture, roof = kind === 1 ? clay : slate;
  const wall = (s,t) => plaster[Math.min(3, Math.floor(clamp(.5 + .22*Math.sin(s*22 + t*12) + spread(.8)) * 3.999))];
  box(body,[x,y+h*.5,z],[w,h,d],wall,{step:.24,stepY:.17,style:BASE});
  panel(body,[x-a,y+h,z+b],[x+a,y+h,z+b],[x+.18,y+h+rise,z+b],[x+.18,y+h+rise,z+b],wall,{step:.23,style:BASE});
  panel(body,[x+a,y+h,z-b],[x-a,y+h,z-b],[x+.18,y+h+rise,z-b],[x+.18,y+h+rise,z-b],wall,{step:.25,style:BASE});
  const eave = .28;
  const roofColor = (s,t) => roof[(Math.floor(t * 14) + (Math.sin(s * 21 + t * 32) > .25 ? 1 : 0) + Math.floor(rand()*2))%roof.length];
  panel(body,[x-a-eave,y+h-.1,z+b+eave],[x+.18,y+h+rise,z+b+eave],[x+.18,y+h+rise,z-b-eave],[x-a-eave,y+h-.1,z-b-eave],roofColor,{step:.22,stepY:.15,dir:[0,0,1],style:BASE});
  panel(body,[x+.18,y+h+rise,z+b+eave],[x+a+eave,y+h-.1,z+b+eave],[x+a+eave,y+h-.1,z-b-eave],[x+.18,y+h+rise,z-b-eave],roofColor,{step:.22,stepY:.15,dir:[0,0,1],style:BASE});
  paintedLine(body,[x+.18,y+h+rise+.06,z-b-eave],[x+.18,y+h+rise+.06,z+b+eave],.057,slate[3],{normal:UP,style:BASE});
  if (kind !== 2) {
    box(body,[x+w*.26,y+h+rise*.73+.32,z-.63],[.49,1.44,.53],()=>pick(rock),{step:.13,style:BASE});
    box(body,[x+w*.26,y+h+rise*.73+1.01,z-.63],[.65,.16,.67],rock[0],{step:.12,style:BASE});
  }
  box(body,[x+.18,y+.91,z+b+.035],[.73,1.83,.095],wood[0],{step:.10,style:BASE});
  for (const s of [-1,1]) {
    planeWindow(body,x+s*w*.29,y+1.48,z+b+.10,.52,.78);
    if (h > 3.45) planeWindow(body,x+s*w*.26,y+h*.74,z+b+.10,.45,.61);
    planeWindow(body,x+(a+.09)*s,y+1.48,z-.65,.52,.71,false,[s,0,0]);
  }
  if (w > 5) planeWindow(body,x+.23,y+h+rise*.32,z+b+.08,.34,.48,true);
  obstruction(x,z,y+h*.5,w,h,d);
}
function chapel() {
  const [x,z] = church, y = ground(x,z);
  house(x,z-2.9,7.5,8.6,4.3,3.6,2);
  const w = 2.63, h = 7.7, wall = () => pick(plaster);
  box(architecture,[x,y+h*.5,z+1.45],[w,h,w],wall,{step:.17,stepY:.145,style:BASE});
  for (const row of [3.7,6.9,7.7]) {
    box(architecture,[x,y+row,z+1.45],[w+.25,.16,w+.25],()=>pick(rock),{step:.14,style:BASE});
  }
  const top = [x+.15,y+14.1,z+1.45], skin = () => pick(slate);
  const corners = [[x-1.52,y+7.72,z+2.97],[x+1.52,y+7.72,z+2.97],[x+1.52,y+7.72,z-.07],[x-1.52,y+7.72,z-.07]];
  for(let i=0;i<4;i++) {
    panel(architecture,corners[i],corners[(i+1)%4],top,top,skin,{step:.16,stepY:.17,style:BASE,dir:UP});
    paintedLine(architecture,corners[i],top,.055,stoneTrim,{style:BASE});
  }
  for (const s of [-1,1]) planeWindow(architecture,x+s*.62,y+5.75,z+2.825,.42,1.43,true);
  planeWindow(architecture,x,y+2.30,z+2.826,.82,2.85,true);
  planeWindow(architecture,x+w*.5+.044,y+5.75,z+1.45,.45,1.87,true,X);
  paintedLine(architecture,top,add(top,[0,1.04,0]),.047,pair(0x6a5a45,0xb19a5f),{style:BASE});
  paintedLine(architecture,add(top,[-.30,.73,0]),add(top,[.30,.73,0]),.046,pair(0x6a5a45,0xb19a5f),{style:BASE});
  obstruction(x,z+1.45,y+3.5,w,7,w);
}

const rotating = new BrushBuffer(18000);
const millPivots = [];
function windmill(x,z,s,index) {
  const y = ground(x,z);
  const p = (a,b,c) => [x+a*s,y+b*s,z+c*s];
  const tone = (t,theta) => plaster[(Math.floor(t * 26) + Math.floor(theta * 2) + Math.floor(rand()*5) + 40) % plaster.length];
  tube(architecture,p(0,-.035,0),p(0,7.95,0),2.43*s,1.7*s,tone,{step:.16*s,sides:54,rough:.026,band:true,style:BASE});
  tube(architecture,p(0,7.91,0),p(.18,10.65,0),1.98*s,.042*s,()=>pick(slate),
    {step:.13*s,sides:44,band:true,rough:.071,style:BASE});
  tube(architecture,p(0,7.62,0),p(0,7.88,0),1.89*s,1.89*s,()=>pick(rock),{step:.085,sides:48,style:BASE,band:true});
  box(architecture,p(0,.95,2.37),[1.03*s,1.88*s,.1],wood[0],{step:.13,style:BASE});
  planeWindow(architecture,x-.84*s,y+2.14*s,z+2.21*s,.44*s,.76*s,true);
  planeWindow(architecture,x+.78*s,y+4.18*s,z+2.04*s,.41*s,.77*s,true);
  planeWindow(architecture,x-2.02*s,y+3.84*s,z,.44*s,.80*s,true,[-1,0,0]);
  obstruction(x,z,y+3.35*s,3.41*s,6.7*s,3.41*s);
  const bone = 21 + index;
  const hub = p(0,7.15,2.22);
  millPivots.push(hub);
  ellipsoid(rotating,hub,[.49*s,.47*s,.25*s],wood[2],{detail:190,bone,style:BASE});
  const cloth = [pair(0x293744,0x698a91),pair(0x263943,0x5c7988),pair(0x2d3a49,0x818f85)];
  const trim = pair(0x3b3640,0x95816d);
  for (let i=0;i<4;i++) {
    const a = .36 + i*PI*.5, c = Math.cos(a), d = Math.sin(a);
    const q = (r,t,v=0) => [hub[0]+s*(r*c-t*d),hub[1]+s*(r*d+t*c),hub[2]+s*v];
    tube(rotating,q(.06,0),q(5.36,0),.125*s,.091*s,wood[2],{step:.10,sides:10,bone,style:BASE});
    panel(rotating,q(1.10,.08,-.03),q(5.24,.07,-.03),q(5.10,1.28,-.055),q(1.0,.82,-.055),()=>pick(cloth),
      {step:.17*s,stepY:.12*s,bone,style:BASE,alpha:.97});
    paintedLine(rotating,q(1.02,.81,.055),q(5.12,1.27,.055),.056*s,trim,{bone,style:BASE});
    for(let j=1;j<=9;j++) {
      const r = .93 + j*.47;
      paintedLine(rotating,q(r,-.16,.066),q(r,.80+(r-1)*.117,.066),.048*s,trim,{bone,style:BASE});
    }
    paintedLine(rotating,q(1.1,.38,.063),q(5.27,.62,.068),.047*s,trim,{bone,style:BASE});
  }
}

function buildBridge(bridge, stone) {
  const { length: l, halfWidth: w } = bridge;
  const q = (s,y,a) => fromBridge(bridge,s,y,a);
  const arch = s => {
    const main = s/4.04;
    return Math.abs(main)<1 ? -.27+1.72*Math.sqrt(1-main*main) : -.81;
  };
  for (let s = -l; s < l; s += .25) {
    const next = Math.min(l,s+.28), a = deckHeight(bridge,s), b = deckHeight(bridge,next);
    panel(architecture,q(s,a,w),q(next,b,w),q(next,b,-w),q(s,a,-w),()=>pick(roadCoats),{step:.22,stepY:.21,style:BASE});
    for (const side of [-1,1]) {
      const col = () => pick(rock);
      const edge = w*side;
      if (stone) {
        const bottomA = Math.min(a-.11,arch(s)), bottomB = Math.min(b-.11,arch(next));
        panel(architecture,q(s,bottomA,edge),q(next,bottomB,edge),q(next,b+.51,edge),q(s,a+.51,edge),col,
          {step:.22,stepY:.13,style:BASE});
        panel(architecture,q(next,b+.49,edge),q(s,a+.49,edge),q(s,a+.49,edge-side*.26),q(next,b+.49,edge-side*.26),()=>pick(plaster),
          {step:.16,stepY:.10,style:BASE});
        if (Math.abs(s)<4.01)
          panel(architecture,q(s,bottomA,edge+.04*side),q(next,bottomB,edge+.04*side),q(next,bottomB+.24,edge+.04*side),q(s,bottomA+.24,edge+.04*side),
            () => pick(plaster),{step:.13,stepY:.13,style:BASE});
      } else if ((Math.round((s+l)*4)%7)===0) {
        tube(architecture,q(s,a-.23,edge),q(s,a+.70,edge),.095,.078,wood[1],{step:.13,style:BASE});
      }
    }
  }
  for (const side of [-1,1]) for (let s=-l+.55;s<l;s+=1.1) {
    const p=q(s,deckHeight(bridge,s)+(stone?.24:.35),w*side);
    obstruction(p[0],p[2],p[1],1.16,stone?.48:.71,.24,Math.atan2(-bridge.fz,bridge.fx));
  }
  if (!stone) {
    for (const side of [-1,1]) for (let s=-l;s<l;s+=.36) {
      const next=Math.min(l,s+.37);
      paintedLine(architecture,q(s,deckHeight(bridge,s)+.62,w*side),q(next,deckHeight(bridge,next)+.62,w*side),.049,wood[1],{style:BASE});
    }
  }
}

function lampPost(x,y,z) {
  tube(architecture,[x,y-.13,z],[x,y+2.06,z],.091,.068,wood[2],{step:.11,style:BASE});
  const c = [x,y+2.12,z];
  ellipsoid(architecture,c,[.13,.20,.13],(a,b)=>b>.5?amber[2]:amber[1],{style:LIGHT,detail:190});
  for (const i of [-1,1]) for(const j of [-1,1]) paintedLine(architecture,[x+i*.143,y+1.94,z+j*.143],[x+i*.13,y+2.30,z+j*.13],
    .023,wood[2],{style:BASE});
  ellipsoid(architecture,[x,y+2.34,z],[.19,.083,.19],wood[1],{style:BASE});
}
