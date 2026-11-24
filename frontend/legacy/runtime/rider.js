const riderPaint = new BrushBuffer(32768);
const riderGlow = new BrushBuffer(64);
const horseCoat = [
  pair(0x42282f,0x986244),pair(0x50312e,0xa97750),pair(0x3a2730,0x9a6645),
  pair(0x573431,0xb57d52),pair(0x382a30,0x80605a),pair(0x624034,0xaf7755)
];
const maneColor = [pair(0x1d1928,0x4b3a3e),pair(0x231e2a,0x674d43),pair(0x261f27,0x4c4144),pair(0x292636,0x64535a)];
const buckle = pair(0x655548,0xc7ab72);
const tack = [pair(0x29242c,0x725045),pair(0x33262a,0x795146),pair(0x2b232b,0x59443d)];
const saddleBlanket = [pair(0x493137,0x9b6354),pair(0x422937,0xa16a5b),pair(0x332a39,0x71495b)];
const indigoCloak = [
  pair(0x122850,0x2a5f9d),pair(0x182950,0x3663a5),pair(0x172f67,0x3c71af),pair(0x233c77,0x5085bb),
  pair(0x1c305e,0x426aa5),pair(0x182f60,0x3866ad),pair(0x254883,0x5a87c0),pair(0x15284b,0x325ea0)
];
const armour = [pair(0x212c3a,0x5c7380),pair(0x242f43,0x677e8e),pair(0x263846,0x799096)];
const face = [pair(0x593e3c,0xb88c6d),pair(0x644744,0xb98e71),pair(0x594042,0x9a7866)];
const soot = pair(0x191620,0x514147);
const hatFelt = [pair(0x25202c,0x584844),pair(0x272431,0x67574e),pair(0x231f2b,0x645552),pair(0x34303b,0x796650)];
const brass = [pair(0x665248,0xc79a57),pair(0x4a3634,0x9e7950),pair(0x635143,0xe1aa67)];
const coat = (x,y,z=0) => horseCoat[(Math.round(2.5+2.4*Math.sin(y*4+x*2-z*7+spread(2.3))))%horseCoat.length];
const legs = [];
const lampPivot = [.63,2.61,-.19];
const lampCore = [.69,2.25,-.17];

function modelHorse() {
  rand=seeded(923184);
  const body=riderPaint;
  const bodyEllipsoid=(p,r,c,opts={})=>ellipsoid(body,p,r,c,{style:BASE,...opts});
  const bodyTube=(a,b,r,s,c,opts={})=>tube(body,a,b,r,s,c,{style:BASE,...opts});
  bodyEllipsoid([0,1.69,.05],[.49,.57,1.044],coat,{detail:510,dir:[.05,.38,1]});
  bodyEllipsoid([0,1.68,.705],[.48,.55,.63],coat,{detail:520,dir:[.49,.22,1]});
  bodyEllipsoid([0,1.65,-.65],[.444,.55,.54],coat,{detail:432,dir:[.09,.67,-.36]});
  bodyTube([0,1.83,-.48],[0,2.65,-1.19],.425,.265,(t,a)=>horseCoat[Math.floor(rand()*4)%horseCoat.length],{step:.039,sides:39});
  bodyEllipsoid([0,2.50,-1.23],[.285,.365,.37],coat,{detail:570,dir:[.08,.68,.31]});
  bodyEllipsoid([0,2.51,-1.56],[.251,.300,.46],coat,{detail:870,dir:[.09,.59,-.39]});
  bodyEllipsoid([0,2.295,-1.86],[.216,.156,.273],(x,y)=>y>.05?horseCoat[1]:maneColor[1],{detail:840,dir:[.25,.09,-1]});
  bodyEllipsoid([0,2.65,-1.79],[.094,.116,.145],pair(0x7d604d,0xbd9e75),{detail:340});
  for(const k of [-1,1]) {
    bodyTube([k*.143,2.71,-1.44],[k*.206,3.018,-1.53],.087,.023,()=>pick(horseCoat),{step:.029,sides:13});
    paintedLine(body,[k*.156,2.79,-1.499],[k*.201,2.995,-1.549],.025,maneColor[0],{style:BASE,normal:[k*.5,0,-.8]});
    bodyEllipsoid([k*.220,2.575,-1.625],[.036,.050,.063],soot,{detail:390});
    bodyEllipsoid([k*.243,2.594,-1.65],[.013,.012,.018],pair(0x6e654b,0xf7d896),{detail:300,minimum:7});
    bodyEllipsoid([k*.170,2.343,-2.027],[.044,.028,.044],soot,{detail:400,minimum:19});
    bodyTube([k*.194,2.71,-1.54],[k*.229,2.312,-1.825],.024,.019,tack[0],{step:.024,sides:9});
    bodyEllipsoid([k*.220,2.341,-1.846],[.035,.048,.047],buckle,{detail:500,minimum:24});
  }
  for(let i=0;i<12;i++) {
    const a=PI*(.08+i*.083);
    const q=(p,off)=>[Math.cos(a)*p,2.32+Math.sin(a)*p,-1.884+off];
    bodyTube(q(.226,i*.001),q(.226,.06+i*.001),.021,.021,tack[0],{step:.019,sides:6});
  }
  for(let i=0;i<=16;i++) {
    const t=i/16;
    const a=[.03,2.72-t*.76,-1.27+t*.88], b=[.166+spread(.18),a[1]-.052-rand()*.17,a[2]+.11+rand()*.19];
    bodyTube(a,b,.077+rand()*.041,.024,()=>pick(maneColor),{step:.052,sides:12,rough:.16});
  }
  for(let i=0;i<5;i++) {
    const x=spread(.22);
    bodyTube([x,2.769,-1.53],[x+.057,2.585+spread(.12),-1.82],.055,.011,maneColor[2],{step:.036,sides:9});
  }

  let index=1;
  for(const z of [-.67,.77]) for(const k of [-1,1]) {
    const hind=z>0;
    const hip=[k*.326,1.59,z], knee=[k*.334,.83,z+(hind?.197:-.059)], ankle=[k*.333,.177,z+(hind?.1:-.055)];
    const upper=index++, lower=index++;
    legs.push({hip,knee,upper,lower,hind,k});
    bodyEllipsoid([hip[0],1.45,hip[2]+.025],[.153,.350,.182],coat,{detail:552,bone:upper});
    bodyTube(hip,knee,hind?.172:.142,hind?.071:.078,coat,{step:.040,sides:22,bone:upper});
    bodyEllipsoid(knee,[.081,.076,.088],coat,{detail:418,bone:lower});
    bodyTube(knee,ankle,.072,.045,(t,a)=>t>.68?pick(maneColor):pick(horseCoat),{step:.037,sides:17,bone:lower});
    bodyEllipsoid(add(ankle,[0,-.068,-.049]),[.091,.105,.125],(x,y)=>y<-.44?soot:maneColor[1],{detail:760,bone:lower});
  }
  const tailPoints=[[0,1.86,.99],[.045,1.68,1.4],[.07,1.12,1.57],[.21,.57,1.65],[.23,.38,1.62]];
  for(let i=0;i<tailPoints.length-1;i++) {
    for(let j=0;j<8;j++) {
      const off=[spread(.17),spread(.12),spread(.16)];
      bodyTube(add(tailPoints[i],off),add(tailPoints[i+1],off),.056+spread(.034),i<2?.063:.033,()=>pick(maneColor),
        {step:.044,sides:8,bone:15,rough:.23});
    }
  }

  // Saddle, blanket, leather girth, and hand-painted metal stirrup loops.
  bodyEllipsoid([0,2.048,.13],[.555,.213,.66],()=>pick(saddleBlanket),{detail:615,rough:.05});
  bodyEllipsoid([0,2.216,.055],[.426,.158,.518],()=>pick(tack),{detail:685});
  bodyEllipsoid([0,2.262,.47],[.35,.158,.22],()=>pick(tack),{detail:685});
  bodyEllipsoid([0,2.275,-.249],[.30,.127,.164],()=>pick(tack),{detail:650});
  for(const side of [-1,1]) {
    bodyTube([side*.34,2.19,-.13],[side*.486,1.418,-.10],.043,.035,tack[0],{step:.037,sides:9});
    const center=[side*.49,1.425,-.092];
    for(let i=0;i<13;i++){
      const a=i/13*TAU,b=(i+1)/13*TAU;
      const q=t=>[center[0],center[1]+.135*Math.sin(t),center[2]+.101*Math.cos(t)];
      bodyTube(q(a),q(b),.016,.016,buckle,{step:.036,sides:6});
    }
    for(let i=0;i<10;i++) {
      const t=i/10, b=(i+1)/10;
      const q = u => [side*(.216+.24*Math.sin(PI*u*.6)),mix(2.34,2.72,u)-.124*Math.sin(PI*u),mix(-1.85,-.37,u)];
      bodyTube(q(t),q(b),.013,.014,tack[0],{step:.055,sides:6});
    }
  }
}
function modelKnight() {
  const b=riderPaint, bone=10;
  const ef=(p,r,c,o={})=>ellipsoid(b,p,r,c,{style:BASE,bone,...o});
  const tf=(a,z,r,s,c,o={})=>tube(b,a,z,r,s,c,{style:BASE,bone,...o});
  ef([0,2.38,.07],[.318,.286,.233],()=>pick(armour),{detail:565});
  ef([0,2.739,.046],[.319,.411,.228],()=>pick(armour),{detail:610});
  for(const s of [-1,1]) {
    tf([s*.196,2.39,.046],[s*.430,1.97,-.269],.141,.104,()=>pick(armour),{step:.044,sides:22});
    tf([s*.429,1.99,-.267],[s*.457,1.465,-.029],.104,.063,()=>pick(tack),{step:.043,sides:19});
    ef([s*.462,1.456,-.101],[.092,.081,.162],soot,{detail:680});
    ef([s*.286,2.903,.043],[.148,.164,.196],()=>pick(armour),{detail:694});
    tf([s*.304,2.91,.038],[s*.421,2.688,-.093],.118,.083,()=>pick(armour),{step:.039,sides:20});
    tf([s*.421,2.688,-.093],[s*(s>0?.629:.437),s>0?2.607:2.72,s>0?-.18:-.361],.079,.061,()=>pick(tack),
      {step:.035,sides:17});
    ef([s*(s>0?.629:.437),s>0?2.607:2.72,s>0?-.18:-.361],[.066,.068,.076],()=>pick(face),{detail:670});
  }
  ef([0,3.077,.044],[.143,.135,.13],()=>pick(indigoCloak),{detail:675});
  ef([0,3.259,.033],[.157,.209,.154],()=>pick(face),{detail:1000});
  ef([-.009,3.275,.107],[.149,.178,.104],()=>pick(maneColor),{detail:760});
  ef([0,3.224,-.092],[.103,.087,.080],()=>pick(face),{detail:700});
  ef([0,3.281,-.119],[.050,.044,.053],face[1],{detail:750});
  ef([0,3.475,.034],[.244,.193,.224],()=>pick(hatFelt),{detail:840,dir:[.19,1,.04]});
  const brim=(a,r)=>{
    const x=Math.cos(a)*r*.472,z=Math.sin(a)*r*.423;
    const y=3.386+.059*Math.cos(a+1.1)*r+.067*Math.sin(a*2+.61)*r*r+.04*r*r;
    return [x,y,z+.047];
  };
  for(let i=0;i<1500;i++){
    const a=rand()*TAU,r=.35+Math.sqrt(rand())*.67,p=brim(a,r);
    const dir=sub(brim(a+.026,r),p);
    const color = r>.9&&rand()<.42?pair(0x4d3b36,0x987356):pick(hatFelt);
    dab(b,p,UP,dir,.044+rand()*.054,.020+rand()*.023,color,BASE,1,bone);
    if(i%2===0) dab(b,add(p,[0,-.039,0]),[0,-1,0],dir,.072,.028,hatFelt[0],BASE,1,bone);
  }
  for(let i=0;i<87;i++){
    const a=i*TAU/87;
    dab(b,[Math.cos(a)*.246,3.463,Math.sin(a)*.226+.033],[Math.cos(a),0,Math.sin(a)],[-Math.sin(a),0,Math.cos(a)],
      .025,.036,tack[1],BASE,1,bone);
  }
  ef([-.238,3.459,.091],[.032,.045,.048],buckle,{detail:850});
  ef([.083,3.033,-.113],[.047,.048,.031],buckle,{detail:700});
  // The cloth is sampled in three overlapping panels with folds in the brush direction.
  function cloakPoint(u,t) {
    const wave=Math.sin(u*11+t*3.5)+.40*Math.sin(u*22-t*6);
    const width=.309+ .421*t+.055*Math.sin(t*PI);
    return [u*width-.16*t*t, 3.072-1.254*t+.11*u*u+.083*Math.sin(u*13)*t*t,
      .153+.988*t-.283*u*u + wave*(.032+.094*t)+.019*Math.cos(t*11)];
  }
  for(let i=0;i<118;i++) for(let j=0;j<74;j++){
    const u=(j+.5+spread(.80))/74*2-1,t=(i+.5+spread(.88))/118;
    const p=cloakPoint(u,t),a=sub(cloakPoint(u+.009,t),p),v=sub(cloakPoint(u,t+.009),p);
    const n=unit(cross(v,a));
    const m=Math.abs(u)<.32?17:u<0?18:19;
    const fold=.48+.32*Math.cos(u*11+t*3.5)+.17*Math.sin(u*24-t*6);
    const col=indigoCloak[Math.min(7,Math.floor(clamp(fold+spread(.59))*7.999))];
    dab(b,p,n,v,.023+rand()*.047,.014+rand()*.027,col,BASE,1,m);
    if(i%4===0&&j%2===0)dab(b,add(p,[.003,.005,-.037]),scale(n,-1),v,.034+rand()*.033,.026,
      indigoCloak[7],BASE,1,m);
  }
  for(let i=0;i<100;i++){
    const u=i/99*2-1, p=cloakPoint(u,.988);
    dab(b,add(p,[0,-.013,.017]),Z,sub(cloakPoint(u+.019,.988),p),.033,.015,
      indigoCloak[3],BASE,1,Math.abs(u)<.32?17:u<0?18:19);
  }
  const lampBone=14;
  const lantern=(p)=>add(lampCore,p);
  for(let i=0;i<24;i++){
    const a=i/24*TAU,t=(i+1)/24*TAU;
    const handle=k=>[lampPivot[0]+.055+.106*Math.cos(k),2.581+.092*Math.sin(k),-.178];
    tf(handle(a),handle(t),.016,.016,brass[2],{step:.022,sides:6,bone:lampBone});
  }
  ef(lantern([0,0,0]),[.117,.180,.115],()=>pick([amber[1],amber[2],gilded[3]]),{detail:920,bone:lampBone,style:LIGHT});
  for(const y of [-.182,.185]) {
    ef(lantern([0,y,0]),[.160,.069,.156],()=>pick(brass),{detail:610,bone:lampBone});
  }
  for(const a of [-1,1])for(const c of [-1,1]){
    tf(lantern([a*.119,-.166,c*.119]),lantern([a*.100,.170,c*.100]),.0175,.0155,brass[1],{step:.023,sides:8,bone:lampBone});
  }
  for(const [n,t] of [[Z,X],[X,Z],[UP,X]]) {
    dab(riderGlow,lampCore,n,t,.55,.52,pair(0xe29332,0xffbd5f),GLOW,.17,lampBone,0);
  }
}
function buildRider() {
  modelHorse();
  modelKnight();
  riderPaint.upload();
  riderGlow.upload();
  bakedStrokes+=riderPaint.count+rotating.count;
}

const bones = new Float32Array(MAX_BONES*16);
const transform = (m,v) => [
  m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12],
  m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13],
  m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]
];
function pose(time,p) {
  const motion=clamp(p.speed/4.3), gallop=smooth(4.6,7.15,p.speed), airborne=!p.grounded;
  const step=p.gait, bop=(.022+.041*gallop)*Math.cos(step*2)*motion;
  const jumpLean=airborne?clamp(-p.vy*.032,-.25,.23):0;
  const root=around([0,1.52,.08],bop*.27+jumpLean,p.heading,.023*Math.sin(step)*motion,[p.x,p.y+bop,p.z]);
  bones.set(root,0);
  for(const l of legs) {
    const cycle=step+(l.hind?PI*.93:0)+(l.k>0?PI*(1-gallop*.63):0);
    const bend=airborne ? (l.hind?.23:-.46)+.20*Math.sin(step) : Math.sin(cycle)*motion*(.38+.24*gallop);
    const kneeBend=airborne ? (l.hind?-.47:.82) : Math.max(0,Math.cos(cycle+.76))*motion*(l.hind?-.52:.69);
    const joint=multiply(root,around(l.hip,bend,0,0));
    bones.set(joint,l.upper*16);
    bones.set(multiply(joint,around(l.knee,kneeBend,0,0)),l.lower*16);
  }
  const torso=multiply(root,around([0,2.35,.06], -.064*Math.sin(step)*motion-jumpLean*.65,0,.031*Math.cos(step)*motion));
  bones.set(torso,10*16);
  const lantern=multiply(torso,around(lampPivot, -.068+.17*Math.sin(step+.92)*motion,0,.104*Math.sin(time*4.3)));
  bones.set(lantern,14*16);
  bones.set(multiply(root,around([0,1.84,.99],.073*Math.sin(step)*motion,.19*Math.sin(time*2.65),.093*Math.sin(step))),15*16);
  for(let i=17;i<=19;i++){
    bones.set(multiply(torso,around([0,3.05,.17],
      .036*Math.sin(time*3.18+i*.33)+.086*gallop, .024*Math.sin(time*2.95+i),.023*Math.cos(time*3.44+i*.45))),i*16);
  }
  for(let i=0;i<millPivots.length;i++) bones.set(around(millPivots[i],0,0,time*(i===0?-.32:-.262)),(21+i)*16);
  return transform(lantern,lampCore);
}
