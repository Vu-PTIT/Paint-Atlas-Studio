const ridgePalettes = [
  [pair(0x23365d,0x4b6391),pair(0x29395e,0x5a729f),pair(0x2d4566,0x647f9f),pair(0x23325e,0x526992)],
  [pair(0x182b4b,0x365e83),pair(0x1d3258,0x3c6189),pair(0x1e3851,0x436e83),pair(0x1d304a,0x3b567d)],
  [pair(0x182a41,0x324d62),pair(0x1b3246,0x425d72),pair(0x19303d,0x3f6369),pair(0x213346,0x42536a)]
];
const snow = [pair(0x627991,0xbacdd1),pair(0x77889b,0xd3dcd3),pair(0x536c91,0x9cbac7),pair(0x768da7,0xb8d0d5)];
const summits = [[-.94,12,.28],[-.62,17,.20],[-.19,21,.25],[.18,12,.23],[.48,20,.25],[.92,13,.24]];
function skyline(theta, layer) {
  const shaped = 3.2 + (1+Math.sin(theta*4 + .7*layer))*1.9 + (1+Math.sin(theta*10-1.2*layer))*1.1 +
    Math.abs(Math.sin(theta*26.5+layer)) * (1.15+(.5+.5*Math.sin(theta*13+layer))*1.24);
  let ridge = 0;
  for(const [center,height,width] of summits) {
    const dx = Math.abs(theta - center + .11*layer);
    const shoulder = Math.max(0,1-dx/(width*(1+.28*layer)));
    ridge = Math.max(ridge, (height - 4.65*layer) * shoulder ** 1.24);
  }
  const back = Math.pow(Math.max(0,Math.sin(theta*4.5+1.1*layer)),2.2)*5;
  const valley = layer === 2 ? 1-.48*Math.exp(-(((theta-.18)/.43)**2)) : 1;
  return (shaped + ridge + back) * valley * [1.24,.95,.80][layer];
}
function buildMountains() {
  rand = seeded(worldSeed(541544));
  const skirt = [pair(0x192c44,0x35546a),pair(0x1e3448,0x405f6d),pair(0x172837,0x38566b)];
  for(let x=-192;x<194;x+=4.5) for(let z=-189;z<188;z+=4.5) {
    if(x>-85&&x<91&&z<43&&z>-114) continue;
    const px=x+spread(2),pz=z+spread(2);
    flatDab(land,px,valleyHeight(px,pz)-.31,pz,spread(1.6),5.9,4.5,pick(skirt),BASE,1,0);
  }
  for(let layer=0;layer<3;layer++) {
    const radius = [172,137,103][layer], palette = ridgePalettes[layer];
    const radiusAt = t => radius+5.1*Math.sin(t*3+layer)+4.0*Math.cos(t*5.0-layer*.65);
    const point = (t,y,off=0) => {
      const r = radiusAt(t)+off;
      return [r*Math.sin(t),y,-r*Math.cos(t)];
    };
    for(let i=0;i<1007;i++) {
      const t = -PI+i*TAU/1007, h=skyline(t,layer);
      const direction = [Math.cos(t),0,Math.sin(t)], normal=[-Math.sin(t),.06,Math.cos(t)];
      const color=palette[Math.min(palette.length-1,Math.floor(clamp(.49+.28*Math.sin(t*14+layer*0.9)+spread(.55))*3.999))];
      const interval=(h+3.8)/4;
      for(let k=0;k<4;k++) {
        const y=-3.4+(k+.49)*interval;
        const baseInk = paletteMix(color, palette[(layer+k)%4], .14+.26*k/4);
        const angle = .29*Math.sin(t*52+k*1.06);
        dab(mountainBrushes,point(t,y,-.17*Math.sin(k*3.1+t*16)),normal,add(direction,scale(UP,angle)),
          1.28+rand()*.66,interval*.83,baseInk,BASE,1,0,0);
      }
      dab(mountainBrushes,point(t,h-.58,.13),normal,direction,.83+rand()*.38,.63,color,BASE,1,0,0);
      if (layer===0 && h>16.1) {
        const drape = (.65 + 3.45*smooth(16.1,27,h)) * (.68 + .32*Math.sin(t*85+.35));
        for(let k=0;k<5;k++) {
          const y = h-.38-k/4*drape;
          const angle = .24 + .58*Math.sin(t*56+k*.94);
          const pigment = paletteMix(pick(snow),color,.18+.40*k/4);
          dab(mountainBrushes,point(t+spread(.0038),y,-.57-rand()*.41),normal,add(direction,scale(UP,angle)),
            .95+rand()*.58,.27+rand()*.38,pigment,BASE,1,0,0);
        }
      }
      const count=layer===0?16:layer===1?11:10;
      for(let k=0;k<count;k++) {
        const s=t+spread(.0075), top=skyline(s,layer), y=.13+rand()*(top-.4);
        const crease=.48+.30*Math.sin(s*96+y*.43)+.22*Math.sin(s*47-y*.72);
        const capDepth=1.65 + 3.7*smooth(11,26,top) + .58*Math.sin(s*80)+ .76*Math.sin(s*33);
        const white=layer===0 && top>12.3 && top-y<capDepth*(.32+.87*crease);
        const pigment=white?pick(snow):palette[Math.min(3,Math.floor(clamp(crease+spread(.44))*3.999))];
        const strokeDir=add(scale(direction,1.0),scale(UP,spread(.95)-.5+.6*Math.cos(s*40+y*.17)));
        dab(mountainBrushes,point(s,y,-.20-rand()*.39),normal,strokeDir,.48+rand()*1.17,.10+rand()*.39,pigment,OBJECT,.83+rand()*.17,0,0);
      }
    }
  }
}

const skySections = Array.from({length:24},()=>new BrushBuffer(7000));
function skyDab(x,y,angle,length,width,colors,style=SKY,alpha=1,r=433) {
  x = ((x + PI) % TAU + TAU) % TAU - PI;
  const i=Math.min(23,Math.floor((x+PI)/TAU*24)), sn=Math.sin(x), cs=Math.cos(x), sy=Math.sin(y), cy=Math.cos(y);
  const c=Math.cos(angle), s=Math.sin(angle), l=clamp(r*length,.025,29), w=clamp(r*width,.025,24);
  skySections[i].paint(r*sn*cy,r*sy,-r*cs*cy,(c*cs-s*sn*sy)*l,s*cy*l,(c*sn+s*cs*sy)*l,
    (-s*cs-c*sn*sy)*w,c*cy*w,(-s*sn+c*cs*sy)*w,colors,style,alpha,0,0);
}
const azure = pair(0x1b3863,0x2b5481);
const inkSky = pair(0x0c1932,0x1c2d51);
const cobalt = pair(0x14366c,0x285d9b);
const ultramarine = pair(0x0f235e,0x244692);
const turquoise = pair(0x276681,0x6da4af);
const jade = pair(0x326b7a,0x75a99d);
const violetSky = pair(0x1f315d,0x3a426f);
const skyFlowCenters = [
  [-.283,.265,.224,.73], [.16,.264,.211,.66], [-.79,.168,.20,.79], [.74,.15,.19,.85],
  [1.73,.34,.38,.77],[-1.94,.30,.36,.87],[2.82,.22,.37,.81],[-2.75,.47,.29,.86]
];
function current(x,y) {
  const drift = .20 * Math.sin(x * 5.6 - y * 10.7) + .14 * Math.sin(x * 11.5 + y * 6.9);
  let u=Math.cos(2*drift), v=Math.sin(2*drift), eddy=0;
  for(const [cx,cy,r,aspect] of worldPlan.sky.swirls ? skyFlowCenters : []) {
    const dx=x-cx, dy=(y-cy)/aspect;
    const d2=dx*dx+dy*dy;
    if(d2>r*r*2.4) continue;
    const d=Math.sqrt(d2);
    const a=Math.atan2(dy,dx), dir=Math.atan2(Math.cos(a)*aspect,-Math.sin(a))+.25;
    const w=(1-smooth(r*.52,r*1.54,d))*2.7;
    u+=w*Math.cos(2*dir);
    v+=w*Math.sin(2*dir);
    eddy=Math.max(eddy,w/2.7*(.50+.50*Math.sin(a*1.9+d*61)));
  }
  return [.5*Math.atan2(v,u),eddy];
}
function curvePoint(a,b,c,d,t) {
  const v=1-t;
  return [v*v*v*a[0]+3*v*v*t*b[0]+3*v*t*t*c[0]+t*t*t*d[0],
    v*v*v*a[1]+3*v*v*t*b[1]+3*v*t*t*c[1]+t*t*t*d[1]];
}
const ribbons = [
  { curve:t=>{const a=-1.88+t*TAU*1.44, r=.023+t*.212;return [-.275+r*Math.cos(a),.267+r*.735*Math.sin(a)];}, n:12600, w:.054, p:[azure,cobalt,turquoise,jade,inkSky] },
  { curve:t=>{const a=2.96-t*TAU*.96, r=.023+t*.196;return [.153+r*Math.cos(a),.266+r*.71*Math.sin(a)];}, n:6900, w:.049, p:[azure,cobalt,turquoise,ultramarine] },
  { curve:t=>curvePoint([-.97,.177],[-.70,.094],[-.56,.519],[-.26,.435],t), n:7200, w:.075,p:[azure,cobalt,turquoise,ultramarine,jade] },
  { curve:t=>curvePoint([-.27,.435],[.02,.432],[.14,.135],[.53,.233],t), n:10200, w:.118,p:[azure,cobalt,turquoise,ultramarine,jade] },
  { curve:t=>curvePoint([-.84,.099],[-.45,.135],[-.23,.017],[.24,.123],t), n:7200, w:.083,p:[azure,cobalt,turquoise,inkSky] },
  { curve:t=>curvePoint([.27,.129],[.50,.075],[.66,.186],[.92,.243],t), n:5000, w:.079,p:[azure,cobalt,jade,ultramarine] }
];
const moon = {x:.358,y:.250,r:.058};
const gilded = [
  pair(0xea8b32,0xffca66),pair(0xf8a542,0xffda7c),pair(0xf57b29,0xffb64a),pair(0xf8bf59,0xffe49a),pair(0xd88035,0xf5b951)
];
const starGold = [
  pair(0xe5a74f,0xffd97d),pair(0xffc95e,0xffe5a1),pair(0xe9b866,0xffedb0),pair(0x9d824a,0xe5c67a)
];
const haloInks = [
  pair(0x285368,0x42747a),pair(0x416362,0x7b906d),pair(0x766b47,0xb3975e),pair(0x3e6973,0x729a8d)
];
function paintMoon() {
  const {x,y,r}=moon;
  for(let i=0;i<5300;i++) {
    const a=rand()*TAU, r0=(1.04+rand()*1.27+spread(.058))*r;
    const n=Math.floor(((r0/r)-1.04)*14);
    const pal = n%6===1 ? haloInks[2] : n%7===2 ? haloInks[1] : pick([haloInks[0],haloInks[3],azure,jade]);
    const u=x+Math.cos(a)*r0*1.054, v=y+Math.sin(a)*r0;
    const angle=Math.atan2(Math.cos(a),-Math.sin(a)*1.054);
    skyDab(u,v,angle+spread(.22),.006+rand()*.020,.0018+rand()*.0060,pal,SKY,.68+rand()*.29,420-rand()*.85);
  }
  for(let i=0;i<5800;i++) {
    const a=rand()*TAU, r0=Math.sqrt(rand())*r*.985;
    const u=x+Math.cos(a)*r0*1.067, v=y+Math.sin(a)*r0;
    const marbling=.49+.20*Math.sin(a*3+r0*100)+.18*Math.sin(a*2-r0*169)+spread(.55);
    let color=gilded[Math.min(4,Math.floor(clamp(marbling)*4.999))];
    if(r0>r*.89&&Math.sin(a+.8)>.06&&rand()<.74) color=gilded[3];
    skyDab(u,v,.46+Math.sin(a-r0*16)*.98+spread(.59),.0031+rand()*.0073,.0012+rand()*.0032,color,LIGHT,1,416-rand()*.9);
  }
}
const stars = [
  [-.605,.292,.023],[-.503,.146,.016],[-.425,.370,.017],[-.184,.407,.010],[-.063,.349,.020],
  [.161,.417,.015],[.224,.176,.014],[.61,.187,.018],[.650,.365,.014],[.070,.145,.012],[-.774,.235,.014],
  [-1.06,.343,.025],[1.09,.279,.022],[-1.34,.31,.020],[1.46,.41,.019]
];
function star(x,y,r,weight=1) {
  const rays=Math.floor(5+rand()*4), phase=rand()*TAU;
  for(let i=0;i<Math.floor(235*weight);i++) {
    const a=rand()*TAU, R=Math.sqrt(rand())*r*(1.2+.58*rand());
    const ray = Math.pow(.5+.5*Math.cos((a-phase)*rays),4.0);
    const n=R/r;
    const c=n<.64||n<.70+ray*.91&&rand()<.41?pick(starGold):pick(haloInks);
    skyDab(x+Math.cos(a)*R,y+Math.sin(a)*R,a+PI*.5+spread(.82),r*(.141+rand()*.39),r*(.053+rand()*.147),
      c,c===starGold[3]?SKY:LIGHT,.78+rand()*.22,414+(.8+rand()*.9)*n);
  }
  for(let arm=0;arm<rays;arm++) {
    const a=phase+(arm+.22*spread())*TAU/rays, extent=(.95+rand()*.88)*r;
    for(let k=0;k<7;k++) {
      const d=extent*(.45+.088*k), jitter=spread(r*.23);
      skyDab(x+Math.cos(a)*d-Math.sin(a)*jitter,y+Math.sin(a)*d+Math.cos(a)*jitter,a+spread(.23),
        r*(.245-.018*k),r*(.125-.008*k),starGold[k<4?1:0],LIGHT,.95-k*.070,413+rand());
    }
  }
  for(let i=0;i<Math.floor(18*weight);i++) {
    const a=rand()*TAU, R=Math.sqrt(rand())*r*.53;
    skyDab(x+Math.cos(a)*R,y+Math.sin(a)*R,a,r*(.235+rand()*.44),r*(.086+rand()*.17),starGold[1],LIGHT,1,412+rand()*.4);
  }
}
function buildSky() {
  rand = seeded(worldSeed(862659));
  for(let t=-PI;t<PI;t+=.024) for(let e=-.33;e<1.56;e+=.021) {
    const x=t+spread(.023), y=e+spread(.018);
    const [a,power]=current(x,y);
    const base=paletteMix(azure,inkSky,smooth(-.14,.62,y));
    const pigment=paletteMix(base,Math.sin(x*19+y*19)>.35?ultramarine:cobalt,clamp(power*.37+rand()*.22));
    skyDab(x,y,a,.032+rand()*.017,.026+rand()*.020,pigment,SKY_BASE,1,456+spread(1.25));
  }
  for(let t=-PI;t<PI;t+=.0145) for(let e=-.21;e<1.52;e+=.017) {
    const x=t+spread(.017), y=e+spread(.019), [a,power]=current(x,y);
    const domain=.50+.5*Math.sin(x*11.4-y*31+1.2*Math.sin(x*14+y*12));
    const base=paletteMix(azure,inkSky,smooth(.055,.75,y));
    const pigment=paletteMix(base, domain>.75?turquoise:domain>.41?cobalt:ultramarine, .14+power*.33+rand()*.38);
    skyDab(x,y,a+spread(.74),.012+rand()*.023,.0024+rand()*.008,pigment,SKY,.65+rand()*.34,443+rand()*4);
  }
  for (const ribbon of worldPlan.sky.swirls ? ribbons : []) {
    for(let i=0;i<ribbon.n;i++) {
      const t=rand(), p=ribbon.curve(t), q=ribbon.curve(t+.0011);
      const a=Math.atan2(q[1]-p[1],q[0]-p[0]);
      const puff=spread(1)+spread(.70);
      const f=puff*ribbon.w*(.66+.49*Math.sin(t*PI));
      const x=p[0]-Math.sin(a)*f,y=p[1]+Math.cos(a)*f;
      const filament=.5+.5*Math.sin(puff*27+t*16+Math.sin(t*27));
      const highlight=filament>.75&&rand()<.32*(1-Math.abs(puff));
      const palette = highlight ? pick([turquoise,jade]) : pick(ribbon.p);
      const base = paletteMix(palette, highlight?cobalt:inkSky, .085+Math.abs(puff)*.39+rand()*.19);
      skyDab(x,y,a+spread(.43),.009+rand()*.022,.0016+rand()*.0059,base,SKY,.65+rand()*.33,431+rand()*6+i/ribbon.n*.4);
    }
  }
  if (worldPlan.sky.moon) paintMoon();
  for(const [x,y,r] of worldPlan.sky.stars ? stars : []) star(x,y,r);
  for(let i=0;worldPlan.sky.stars && i<132;i++) {
    const x=spread(TAU), y=.105+rand()*1.19;
    if(Math.abs(x)<.82&&y<.45&&rand()<.87) continue;
    const r=.0010+rand()**4*.0059;
    for(let j=0;j<4;j++) skyDab(x+spread(r),y+spread(r),rand()*TAU,r*(.5+rand()*.85),r*.36,pick(starGold),LIGHT,.80+rand()*.20,416+rand());
  }
  for(const section of skySections) { section.upload(); bakedStrokes+=section.count; }
}

const grassCache = new Map();
const grassSize = 7.5;
function grassCell(cx,cz) {
  const old = rand;
  rand = seeded(Math.imul(cx,73856093)^Math.imul(cz,19349663)^445265);
  const batch = new BrushBuffer(1024);
  const count=710;
  for(let i=0;i<count;i++) {
    const x=(cx+rand())*grassSize, z=(cz+rand())*grassSize;
    if(x<bounds.left||x>bounds.right||z<bounds.north||z>bounds.south||roads(x,z)<.17||Math.abs(z-riverCenter(x))<riverWidth(x)+.7) continue;
    if (wheatPlots.some(p=>inPlot(x,z,p)) && rand()<.65) continue;
    const y=ground(x,z), a=rand()*TAU,h=.067+rand()**1.83*.34;
    const bend=.10+rand()*.63, cos=Math.cos(a),sin=Math.sin(a);
    const stem=[cos*bend,1,sin*bend];
    const col=rand()<.23?pick(orchard):pick(foliage);
    dab(batch,[x+stem[0]*h*.4,y+h*.43,z+stem[2]*h*.4],unit([-sin,.25,cos]),stem,h*.60,.012+rand()*.026,col,GRASS,.78+rand()*.22);
    if(i%5===0) dab(batch,[x-h*.10,y+h*.46,z+h*.12],unit([sin,.30,cos]),[-stem[0],1,-stem[2]],h*.58,.010+rand()*.016,col,GRASS,.90);
  }
  rand=old;
  return batch.upload();
}
function drawGrass(eye,planes) {
  const cx=Math.floor(eye[0]/grassSize), cz=Math.floor(eye[2]/grassSize);
  const next = new Set();
  for(let z=cz-4;z<=cz+4;z++) for(let x=cx-4;x<=cx+4;x++) {
    const dx=Math.max(x*grassSize-eye[0],0,eye[0]-(x+1)*grassSize);
    const dz=Math.max(z*grassSize-eye[2],0,eye[2]-(z+1)*grassSize);
    if(dx*dx+dz*dz>30.5*30.5) continue;
    const key=x+','+z;
    next.add(key);
    if(!grassCache.has(key)) grassCache.set(key,grassCell(x,z));
    const batch=grassCache.get(key);
    if(batch.count&&visible(batch,planes)) batch.draw();
  }
  if(grassCache.size>129) for(const [key,batch] of grassCache) if(!next.has(key)) {
    batch.dispose();
    grassCache.delete(key);
  }
}
