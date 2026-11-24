import {
  THREE, BrushBatch, PaintLayer, TAU, clamp, mixNumber, smooth, palette, blendPalette, point, random, up, paintedLine
} from '../../rendering/paint.js';

export const waterY = -.58;
export const fallsZ = -63.8;
export function riverX(z) {
  return 23.8 + 6.2 * Math.sin((z + 9) * .099) + 3.3 * Math.sin((z + 35) * .052) + Math.max(0, -z - 53) * .34;
}
export const riverHalf = z => 4.25 + .68 * Math.sin(z * .16 + .8);
export const crossings = [-18, -42.5].map(z => ({x:riverX(z), z, half:riverHalf(z) + 5.25, width:2.05}));

export const trail = new THREE.CatmullRomCurve3([
  [-3.45,13.4], [-3.18,6.8], [-.26,-.8], [1.9,-9.1], [7.4,-14.9],
  [crossings[0].x - crossings[0].half - 1.8,-18], [crossings[0].x + crossings[0].half + 1.3,-18],
  [36.7,-20], [41,-27.2], [39.5,-35.6], [crossings[1].x + crossings[1].half + 2,-42.5],
  [crossings[1].x - crossings[1].half - .7,-42.5], [6,-45.9], [-5,-47.5],
  [-15.6,-42.7], [-22.8,-34.7], [-23.85,-24], [-26.3,-15], [-27.4,-3],
  [-24.1,10.9], [-17,19.6], [-7.3,22.3]
].map(([x,z]) => point(x,0,z)), true, 'centripetal');
trail.arcLengthDivisions = 1200;
export const trailLength = trail.getLength();
export const circles = [[-12.35,10.8,5.95,6.8], [10.9,11.1,6.45,6.8]];
export const wheatFields = [[-16.8,-14.8,6.3,10.5], [12.75,-39,5.5,6.3], [38.2,-33,5.5,7.3]];
export const landmark = (distance, out = point()) => trail.getPointAt(((distance % trailLength + trailLength) % trailLength) / trailLength, out);

const trackCells = new Map();
const indexSize = 5;
function addRoadPoint(x,z,dx,dz,width) {
  const gx = Math.floor(x/indexSize);
  const gz = Math.floor(z/indexSize);
  const road = {x,z,dx,dz,width};
  for (let u = gx - 1; u <= gx + 1; u++) {
    for (let v = gz - 1; v <= gz + 1; v++) {
      const key = u + ',' + v;
      if (!trackCells.has(key)) trackCells.set(key, []);
      trackCells.get(key).push(road);
    }
  }
}
for (let t = 0; t < trailLength; t += .73) {
  const p = landmark(t);
  const q = landmark(t + .24);
  const d = q.sub(p).normalize();
  addRoadPoint(p.x,p.z,d.x,d.z,1.92);
}
for (const [x,z,rx,rz] of circles) {
  for (let n = 0; n < 85; n++) {
    const a = n / 85 * TAU;
    addRoadPoint(x + Math.cos(a) * rx, z + Math.sin(a) * rz,
      -Math.sin(a), Math.cos(a), .72);
  }
}
for (const [ax,az,bx,bz] of [[1,-9,-7,-29],[-7,-29,-17,-32],[1,-32,8,-24],
  [-8,-39,-8,-30],[8,-15,11.8,-27.2],[-24,-21,-16.4,-22.8],[35,-20,41,-15]]) {
  const size = Math.hypot(bx-ax,bz-az);
  for (let d = 0; d < size; d += .59) {
    addRoadPoint(mixNumber(ax,bx,d/size),mixNumber(az,bz,d/size),(bx-ax)/size,(bz-az)/size,.86);
  }
}

const noRoad = {d:99, dx:1, dz:0, width:1};
export function roadAt(x,z) {
  const cells = trackCells.get(Math.floor(x/indexSize) + ',' + Math.floor(z/indexSize));
  if (!cells) return noRoad;
  let best = noRoad;
  let bestD2 = 16;
  for (const r of cells) {
    const q = ((x-r.x)**2 + (z-r.z)**2) / (r.width*r.width);
    if (q < bestD2) { bestD2 = q; best = r; }
  }
  return best === noRoad ? best : {d:Math.sqrt(bestD2), dx:best.dx, dz:best.dz, width:best.width};
}

export function terrain(x,z) {
  const hill = 1.88 * Math.exp(-((x+36)**2/440 + (z+29)**2/650))
    + 2.74 * Math.exp(-((x-54)**2/402 + (z+50)**2/650));
  const folds = .25 * Math.cos(z * .13) + .23 * Math.sin(x * .115 + z * .09)
    + .105 * Math.sin(x*.38 + z*.41) + .047 * Math.sin(x*.9-z*.81);
  const rolling = .20 + hill + folds;
  const riverDistance = Math.abs(x - riverX(z));
  const level = mixNumber(-1.67,rolling,smooth(riverHalf(z)-.63,riverHalf(z)+1.92,riverDistance));
  return mixNumber(rolling,level,smooth(fallsZ-1.1,fallsZ+.8,z));
}

export function bridgeY(x, crossing) {
  const t = clamp(Math.abs(x-crossing.x) / crossing.half);
  const high = .43 + .97 * (1 - Math.pow(t, 2.35));
  return mixNumber(high, terrain(x,crossing.z) + .038, smooth(.73, 1, t));
}
export function ground(x,z) {
  let y = terrain(x,z);
  for (const cross of crossings) {
    if (Math.abs(z-cross.z) < cross.width && Math.abs(x-cross.x) < cross.half) y = Math.max(y, bridgeY(x,cross));
  }
  return y;
}
export function surfaceNormal(x,z) {
  const e = .16;
  return point(terrain(x-e,z)-terrain(x+e,z),2*e,terrain(x,z-e)-terrain(x,z+e)).normalize();
}

const moss = [
  palette('#111e2b','#284854'), palette('#17292f','#34535c'),
  palette('#182f35','#375d62'), palette('#15303a','#345863'),
  palette('#122938','#25566f'), palette('#203d39','#526a57'),
  palette('#142532','#324957')
];
const loam = [
  palette('#343640','#73777d'), palette('#383a42','#827e77'),
  palette('#343948','#696f80'), palette('#494449','#8b8173'),
  palette('#262e3b','#555d70'), palette('#413c40','#80786c')
];
const bank = [
  palette('#182b3c','#36576c'), palette('#192b36','#4b6264'),
  palette('#172737','#315770'), palette('#263740','#485a65')
];
const wheatSoil = palette('#332d31','#65534a');

function wheatZone(x,z) {
  return wheatFields.some(([a,b,rx,rz]) => ((x-a)/rx)**2 + ((z-b)/rz)**2 < 1.08);
}

function earthColors(x,z,rd) {
  if (Math.abs(x-riverX(z)) < riverHalf(z)+1.6 && z >= fallsZ) return bank;
  if (rd.d < 1.04) return loam;
  return moss;
}

export function terrainMeshData(x0, z0, x1, z1, nx, nz, height) {
  const positions = new Float32Array((nx+1)*(nz+1)*3);
  const indices = new Uint32Array(nx*nz*6);
  let j = 0;
  for (let iz = 0; iz <= nz; iz++) {
    const z = mixNumber(z0,z1,iz/nz);
    for (let ix = 0; ix <= nx; ix++) {
      const x = mixNumber(x0,x1,ix/nx);
      positions[j++] = x;
      positions[j++] = height(x,z);
      positions[j++] = z;
    }
  }
  let index = 0;
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const a = ix + iz*(nx+1);
      const b = a + nx + 1;
      indices.set([a,b,b+1,a,b+1,a+1],index);
      index += 6;
    }
  }
  return {positions, indices};
}

function buildEarth(parent, paint, fraction) {
  const rng = random(387109);
  const data = terrainMeshData(-127,-129,127,97,200,178,terrain);
  const meshGeometry = new THREE.BufferGeometry();
  meshGeometry.setIndex(new THREE.BufferAttribute(data.indices,1));
  meshGeometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));
  const colors = new Float32Array(data.positions.length);
  const temp = new THREE.Color();
  for (let i = 0; i < data.positions.length; i += 3) {
    const x = data.positions[i];
    const z = data.positions[i+2];
    const rd = roadAt(x,z);
    const land = earthColors(x,z,rd);
    const paint = wheatZone(x,z) && rd.d > 1.04 ? wheatSoil : land[(land.length + Math.floor(Math.sin(x*.17 + z*.09)*2 + Math.cos(z*.31)*2)) % land.length];
    temp.copy(paint[0]).lerp(paint[1], .26 + .087*Math.sin(x*.56+z*.22)).toArray(colors,i);
  }
  meshGeometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  const groundMesh = new THREE.Mesh(meshGeometry, new THREE.MeshBasicMaterial({vertexColors:true}));
  groundMesh.name = 'Rolling terrain and paths underpainting';
  parent.add(groundMesh);

  const tile = 24;
  for (let tz = -4; tz < 3; tz++) {
    for (let tx = -4; tx < 4; tx++) {
      const brush = new BrushBatch(paint,rng,fraction);
      const dense = Math.abs(tx) <= 2 && tz >= -3 && tz <= 1;
      const count = dense ? 57 : 36;
      const cell = tile/count;
      for (let j = 0; j < count; j++) {
        for (let i = 0; i < count; i++) {
          const x = tx*tile + (i + rng())*cell;
          const z = tz*tile + (j + rng())*cell;
          const y = terrain(x,z);
          if (y < waterY - .055) continue;
          const road = roadAt(x,z);
          const track = road.d < 1.06 + rng() * .11;
          const list = earthColors(x,z,{d:track ? 0 : 20});
          let colors = list[Math.floor(rng()*list.length)];
          if (!track && wheatZone(x,z) && rng() < .73) colors = wheatSoil;
          let a = .45*Math.sin(x*.13+z*.15) + .33*Math.sin(z*.5) + (rng()-.5)*1.33;
          if (track) a = Math.atan2(road.dz,road.dx) + (rng()-.5)*.9;
          if (list === bank) a = Math.atan2(1,riverX(z+.5)-riverX(z-.5)) + (rng()-.5)*1.03;
          const len = cell * (1.3 + rng()*1.92) * (track ? .80 : 1);
          brush.stroke(point(x,y+.031+rng()*.019,z), point(Math.cos(a),0,Math.sin(a)), surfaceNormal(x,z),
            len, cell*(.48+rng()*.82), colors, 0, 0);
        }
      }
      brush.finish(parent,'Field, bank and road brushwork');
    }
  }
}

const mountainStyles = [
  {z:-184, span:240, height:36, run:41, low:palette('#28364d','#546681'),
    ridge:palette('#445774','#8195ae'), snow:palette('#8394ad','#cad3d5'), salt:1.2},
  {z:-133, span:187, height:25, run:35, low:palette('#182f4e','#304c6d'),
    ridge:palette('#23425f','#506d8b'), snow:null, salt:3.1},
  {z:-92, span:151, height:14.5, run:24, low:palette('#122938','#31516a'),
    ridge:palette('#1d3a55','#4b697e'), snow:null, salt:5.4}
];

function mountains(parent, paint, fraction) {
  const rng = random(33802);
  for (const band of mountainStyles) {
    const layer = new PaintLayer(parent,paint,rng,fraction);
    const ridge = x => {
      const rolling = .45 + .21*Math.sin(x*.044 + band.salt)
        + .18*Math.sin(x*.085 + band.salt*.6)
        + .083*Math.sin(x*.176 + band.salt)
        + .043*Math.sin(x*.328 + band.salt*4);
      let summit = band.height * (rolling + .16 + .037*Math.sin(x*.595 + band.salt));
      if (band.snow) summit += 9.7 * Math.exp(-(((x + 42) / 16)**2)) + 6 * Math.exp(-(((x - 63) / 12)**2));
      return summit;
    };
    const sample = (x,t) => {
      const distort = 1 + .036 * Math.sin(x*.39 + t*18) * Math.sin(t*Math.PI);
      const y = mixNumber(-1.7, ridge(x), Math.pow(t,1.27) * distort);
      return point(x,y,band.z + band.run*(1-t) + Math.sin(x*.059+band.salt)*9 + Math.sin(x*.159)*1.3);
    };
    const shades = Array.from({length:9},(_,i) => blendPalette(band.low,band.ridge,i/8));
    const tones = (x,t) => {
      if (band.snow && ridge(x)>22.3 && t > .79 + .079*Math.sin(x*.27) + .03*Math.sin(x*.94)) return band.snow;
      const blend = clamp(t*.47 + Math.sin(x*.29+t*19)*.19 + Math.cos(x*.106 + t*6)*.19 + .14);
      return shades[Math.floor(blend*8)];
    };
    const cols = 244;
    const rows = 23;
    for (let j=0;j<rows;j++) {
      for (let i=0;i<cols;i++) {
        const x = mixNumber(-band.span,band.span,i/cols);
        const t = j/rows;
        const w = band.span*2/cols;
        const p = sample(x,t);
        const q = sample(x+w,t);
        const r = sample(x+w,t+1/rows);
        const s = sample(x,t+1/rows);
        const n = point().crossVectors(q.clone().sub(p),s.clone().sub(p)).normalize();
        const col = tones(x+w*.5,t+.5/rows);
        layer.triangle(p,q,r,n,col,0,.24);
        layer.triangle(p,r,s,n,col,0,.24);
        if (j < rows-1) continue;
        const back = s.clone(); back.z -= 15; back.y = -1.5;
        const backNext = r.clone(); backNext.z -= 15; backNext.y = -1.5;
        layer.triangle(s,r,backNext,n,band.low);
        layer.triangle(s,backNext,back,n,band.low);
      }
    }
    for (let j=0;j<40;j++) {
      for (let i=0;i<294;i++) {
        const x = mixNumber(-band.span,band.span,(i+rng())/294);
        const t = (j+rng())/40;
        const p = sample(x,t);
        const a = sample(x+.24,t).sub(p);
        const b = sample(x, Math.min(1.01,t+.017)).sub(p);
        const normal = point().crossVectors(a,b).normalize();
        p.addScaledVector(normal,.072+.18*rng());
        const slant = a.normalize().addScaledVector(b.normalize(),-.90+1.36*Math.sin(x*.2 + t*19) + rng()*.61);
        layer.brush.stroke(p,slant,normal,1.55+rng()*4.8,.53+rng()*1.39,tones(x,t),.10,0,.57);
      }
    }
    layer.finish(band.snow ? 'Snow and rock on the far range' : 'Painted mountain range');
  }
}

const riverColors = [
  palette('#0c294b','#285f8c'), palette('#123751','#4385a2'),
  palette('#1e5278','#5194b2'), palette('#132c53','#395e8e'),
  palette('#16435b','#3e7e97'), palette('#243d60','#557ba1'),
  palette('#214964','#629aa6')
];
const poolGold = palette('#76543a','#e7ad50');
const paleCurrent = palette('#3a6e85','#8bb5c1');

function buildRiver(parent, paint, fraction, api) {
  const bed = riverColors[0].map(api.swatch('water', 'river-bed', 'Nền lòng sông', '#285f8c'));
  const ripples = api.swatch('water', 'river-ripples', 'Nét gợn nước', '#5194b2');
  const currents = riverColors.map(pair => pair.map(ripples));
  const foam = paleCurrent.map(api.swatch('water', 'foam', 'Bọt ven bờ', '#8bb5c1'));
  const reflectionGold = poolGold.map(api.swatch('water', 'gold-reflection', 'Bóng đèn vàng', '#e7ad50'));
  const rng = random(827130);
  const brush = new BrushBatch(paint,rng,fraction);
  const under = new PaintLayer(parent,paint,rng,fraction);
  const sample = (z,v,y=waterY) => point(riverX(z) + (v*2-1)*(riverHalf(z)+.94),y,z);
  for (let z = fallsZ; z < 92; z += .78) {
    const a = sample(z,0);
    const b = sample(z,1);
    const c = sample(z+.78,1);
    const d = sample(z+.78,0);
    under.triangle(a,c,b,up,bed,.34);
    under.triangle(a,d,c,up,bed,.34);
    for (let i = 0; i < 73; i++) {
      const q = z + rng()*.78;
      const v = rng();
      const p = sample(q,v,waterY+.015+rng()*.043);
      const edge = Math.abs(v-.5)*2;
      const reflection = .18*Math.sin(q*.77+v*28)+.32*Math.sin(v*13+q*.19)+.5;
      const color = rng() < .092 && edge > .85 ? foam : currents[Math.floor(clamp(reflection+rng()*.41,0,.999)*currents.length)];
      brush.stroke(p,point(1,0,(rng()-.5)*.66),up,.31+rng()*1.39,.037+rng()*.16,color,.29,1);
    }
  }
  for (const [z, v] of [[-13.8,.995],[-25,.72],[-34,.91],[-45.7,.35]]) {
    for (let i=0;i<174;i++) {
      const p = sample(z + (rng()-.5)*4.3,v+(rng()-.5)*.39,waterY+.044+rng()*.04);
      brush.stroke(p,point(1,0,rng()*.32-.16),up,.24+rng()*.89,.027+rng()*.073,reflectionGold,.53,1);
    }
  }
  under.finish('Water surface');
  brush.finish(parent,'River eddies and reflections');
}

const petal = [
  palette('#86501e','#d89336'), palette('#a26226','#eeb74c'),
  palette('#99652e','#fac56d'), palette('#704220','#c77a2f')
];
const leaf = [palette('#193a33','#3f725b'), palette('#223e33','#527958'), palette('#213d3c','#3b7067')];
const sunflowerHeart = palette('#352a2a','#785339');
const sunflowerSeeds = palette('#47382e','#9d6d3c');
const flowerNormal = point(-.24,-.36,1).normalize();
const petalU = point().crossVectors(up,flowerNormal).normalize();
const petalV = point().crossVectors(flowerNormal,petalU).normalize();
const bladeNormal = point(-.11,.07,1).normalize();
const wheat = [
  palette('#5d4735','#b09360'), palette('#715139','#c2a270'),
  palette('#505044','#92856b'), palette('#53473b','#a98a61')
];

function growSunflower(brush,rng,x,z) {
  const y = terrain(x,z);
  const height = .63 + Math.pow(rng(),.86)*1.27;
  const radius = .12 + height*.063 + rng()*.048;
  const seed = rng()*TAU;
  const base = point(x,y,z);
  const middle = point(x+(rng()-.5)*.16,y+height*.65,z+.06);
  const neck = point(x-.075,y+height,z+.16);
  const head = neck.clone().addScaledVector(flowerNormal,.062);
  const greens = leaf[Math.floor(rng()*leaf.length)];
  paintedLine(brush,base,middle,bladeNormal,.037,greens,4,0,2);
  paintedLine(brush,middle,head,bladeNormal,.047,greens,3,0,2);
  for (let j = 0; j < 4; j++) {
    const a = seed+j*2.45;
    const n = point(Math.sin(a)*.44,.51,Math.cos(a)*.54).normalize();
    const d = point(Math.cos(a), .38 + rng()*.38, Math.sin(a));
    const center = base.clone().lerp(neck,.28+j*.151).addScaledVector(d, height*.084);
    brush.stroke(center,d,n,height*(.21+rng()*.13),height*(.11+rng()*.043),greens,0,2);
    brush.stroke(center.clone().addScaledVector(n,.018),d,n,height*.20,.016,leaf[2],.12,2);
  }
  const petals = 11 + Math.floor(rng()*4);
  for (let j = 0; j < petals; j++) {
    const a = seed + j*TAU/petals;
    const radial = petalU.clone().multiplyScalar(Math.cos(a)).addScaledVector(petalV,Math.sin(a));
    const at = head.clone().addScaledVector(radial,radius*(.62+rng()*.14));
    brush.stroke(at,radial,flowerNormal,radius*(.83+rng()*.39),radius*(.28+rng()*.22),petal[j%petal.length],.34,2);
  }
  for (let j=0; j<14; j++) {
    const a = seed + j*2.39996;
    const r = radius*.42*Math.sqrt(j/14);
    const m = head.clone().addScaledVector(flowerNormal,.020+j*.0004)
      .addScaledVector(petalU,Math.cos(a)*r).addScaledVector(petalV,Math.sin(a)*r);
    brush.stroke(m,petalU,flowerNormal,radius*.41,radius*.22,j%4===2 ? sunflowerSeeds : sunflowerHeart,.29,2);
  }
}

function crops(parent,paint,fraction) {
  const rng = random(45190);
  const sunflower = new BrushBatch(paint,rng,fraction);
  for (const [x,z,rx,rz] of [[-12.2,10.8,9.25,9.9],[10.25,10.05,11.2,9.8],[-18.6,-2.0,4.3,5.0]]) {
    for (let j=-rz;j<rz;j+=.68) {
      for (let i=-rx;i<rx;i+=.71) {
        const px = x+i+(rng()-.5)*.53;
        const pz = z+j+(rng()-.5)*.54;
        if (((px-x)/rx)**2 + ((pz-z)/rz)**2 > .91+rng()*.18 || roadAt(px,pz).d < 1.19 || rng()<.08) continue;
        growSunflower(sunflower,rng,px,pz);
      }
    }
  }
  sunflower.finish(parent,'Night-facing sunflower fields');
  const brush = new BrushBatch(paint,rng,fraction);
  for (const [x,z,rx,rz] of wheatFields) {
    for (let j=-rz;j<rz;j+=.32) {
      for (let i=-rx;i<rx;i+=.33) {
        const px=x+i+rng()*.29;
        const pz=z+j+rng()*.30;
        if (((px-x)/rx)**2+((pz-z)/rz)**2>.97 || roadAt(px,pz).d<1.22 || terrain(px,pz)<waterY+.25) continue;
        const h=.37+rng()*.48;
        const sy=terrain(px,pz);
        const angle=rng()*TAU;
        const n=point(Math.cos(angle),.09,Math.sin(angle)).normalize();
        const d=point(.16+rng()*.27,1,.1);
        const p=point(px,sy+h*.27,pz);
        const colors=wheat[Math.floor(rng()*wheat.length)];
        brush.stroke(p,d,n,h*.74,.027,colors,.05,2);
        p.addScaledVector(d,h*.45);
        brush.stroke(p,d,n,h*.46,.068,colors,.12,2);
        const side=point().crossVectors(d,n).normalize();
        brush.stroke(p.clone().addScaledVector(side,.033),d.clone().addScaledVector(side,.37),n,h*.40,.019,colors,.17,2);
      }
    }
  }
  brush.finish(parent,'Wheat fields');
}

export function makeGrass(parent,paint,fraction) {
  let gx = Infinity;
  let gz = Infinity;
  let current = null;
  const size = 6.4;
  return focus => {
    paint.grassFocus.value.copy(focus);
    const i = Math.floor(focus.x/size);
    const j = Math.floor(focus.z/size);
    if (i===gx && j===gz) return current?.userData.strokes ?? 0;
    gx = i;
    gz = j;
    const brush = new BrushBatch(paint,random(945117),fraction);
    for (let v=j-3;v<=j+3;v++) {
      for (let u=i-3;u<=i+3;u++) {
        const tileSeed = (u*2183653) ^ (v*784147) ^ 52519;
        const rng = random(tileSeed);
        brush.rng = random(tileSeed ^ 945117);
        for (let n=0;n<111;n++) {
          const x = (u+rng())*size;
          const z = (v+rng())*size;
          const y = terrain(x,z);
          if (roadAt(x,z).d < (1.04+rng()*.16) || y < waterY+.135) continue;
          const phi = rng()*TAU;
          const normal = point(Math.sin(phi),.04,Math.cos(phi)).normalize();
          const green = leaf[Math.floor(rng()*leaf.length)];
          const h = .095+rng()*.30;
          const k = point(x,y+h*.37,z);
          for (let leg=-1;leg<=1;leg++) {
            const skew = leg*(.39+rng()*.72);
            const d = point(Math.cos(phi)*skew,1,-Math.sin(phi)*skew);
            brush.stroke(k.clone().addScaledVector(d,.047),d,normal,h*(.70+rng()*.86),.022+rng()*.029,green,0,4);
          }
        }
      }
    }
    if (current) {
      current.removeFromParent();
      current.geometry.dispose();
    }
    current = brush.finish(parent,'Grass near the current view');
    return current?.userData.strokes ?? 0;
  };
}

export function buildLand(parent,paint,fraction,waterPaint,api) {
  mountains(parent,paint,fraction);
  buildEarth(parent,paint,fraction);
  buildRiver(parent,waterPaint,fraction,api);
  crops(parent,paint,fraction);
}
