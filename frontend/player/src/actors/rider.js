import { THREE, PaintLayer, TAU, clamp, palette, point, random, up, paintedLine } from '../rendering/paint.js';
import { float, smoothstep, uniform, uv, vec2 } from 'three/tsl';

const hide = palette('#382633','#a36944');
const shoulder = palette('#573341','#bc825b');
const darkHide = palette('#2e2530','#755745');
const muzzle = palette('#2b2430','#664c4c');
const mane = palette('#171728','#51414a');
const hoof = palette('#1b1c28','#606171');
const horseEye = palette('#0e131c','#b58e5a');
const leather = palette('#2b231f','#765341');
const leatherEdge = palette('#5b4338','#c29361');
const blue = palette('#162955','#508ac4');
const padBinding = palette('#86633f','#d9ad60');
const steel = palette('#313b52','#9db3bd');
const gloves = palette('#302c3b','#7e6f72');
const face = palette('#674a42','#cb986f');
const hat = palette('#172239','#4c6184');
const cloak = [
  palette('#15284e','#335f9c'),palette('#17396d','#487eb8'),
  palette('#17316a','#3766b2'),palette('#172651','#345087'),
  palette('#24488a','#558fd3')
];
const brass = palette('#775036','#e1b160');
const lanternGlass = palette('#dc722a','#ffd886');
const hotGlass = palette('#f6a432','#fff3bc');

function group(parent,x=0,y=0,z=0) {
  const g = new THREE.Group();
  g.position.set(x,y,z);
  parent.add(g);
  return g;
}

function segment(layer,a,b,r1,r2,colors,count,emit=.07) {
  const dir=b.clone().sub(a);
  const rotation=new THREE.Quaternion().setFromUnitVectors(up,dir.clone().normalize());
  layer.oval(a.clone().lerp(b,.5),point(r1,dir.length()*.63,r2),colors,count,rotation,emit,.66);
}

function drape(parent,paint,rng) {
  const l=new PaintLayer(parent,paint,rng,1);
  function sample(u,v) {
    const flutter=.079 * Math.sin(u*15+v*5.0) * (v*.81+.19);
    const width=.305+.307*v+.064*Math.sin(v*Math.PI);
    const scallop=(.05*Math.cos(u*15)+.036*Math.sin(u*7))*v**4;
    return point(width*u,.027-v*(.67+Math.abs(u)*.24)+scallop,
      -.09 - .78*v + .12*u*u + flutter -.058*Math.sin(v*5));
  }
  const foldColor = (u,v) => cloak[ Math.floor(clamp(.44+.40*Math.sin(u*15+v*5.0),0,.999)*cloak.length)];
  for(let i=0;i<24;i++) {
    for(let j=0;j<21;j++) {
      const u=-1+i*2/24;
      const un=-1+(i+1)*2/24;
      const v=j/21;
      const vn=(j+1)/21;
      const a=sample(u,v);
      const b=sample(un,v);
      const c=sample(un,vn);
      const d=sample(u,vn);
      const n=point().crossVectors(d.clone().sub(a),b.clone().sub(a)).normalize();
      l.triangle(a,c,b,n,foldColor(u,v),.12);
      l.triangle(a,d,c,n,foldColor(u,v),.12);
    }
  }
  for(let i=0;i<1700;i++) {
    const u=(rng()-.5)*2;
    const v=rng();
    const p=sample(u,v);
    const tangent=sample(u,v+.008).sub(p);
    const n=point().crossVectors(tangent,sample(u+.011,v).sub(p)).normalize();
    p.addScaledVector(n,.012+rng()*.012);
    l.brush.stroke(p,tangent,n,.035+rng()*.12,.012+rng()*.028,foldColor(u,v),.24);
  }
  for(const side of [-1,1]) {
    for(let i=0;i<28;i++) {
      const a=sample(side*.993,i/28);
      const b=sample(side*.993,(i+1)/28);
      a.z-=.012; b.z-=.012;
      paintedLine(l.brush,a,b,point(0,0,-1),.031,padBinding,1,.23);
    }
  }
  l.finish('The knight’s cobalt cloak');
}

function makeLeg(parent,paint,rng,side,front) {
  const z=front ? .64 : -.62;
  const hip=group(parent,side*(front?.255:.294),1.17,z);
  const joint=group(hip,0,-.55,front?.035:-.066);
  const l=new PaintLayer(hip,paint,rng,1);
  const k=new PaintLayer(joint,paint,rng,1);
  segment(l,point(0,.14,front?-.034:-.048),point(0,-.49,front?.038:-.058),front?.106:.147,.112,front?hide:shoulder,210);
  l.oval(point(0,-.50,front?.031:-.045),point(.091,.118,.095),darkHide,74);
  segment(k,point(0,.033,-.01),point(0,-.454,.008),.063,.076,darkHide,139);
  k.oval(point(0,-.461,.017),point(.080,.108,.101),muzzle,81);
  k.oval(point(0,-.528,.042),point(.091,.064,.120),hoof,102,null,.10);
  l.finish('Horse thigh');
  k.finish('Horse fetlock and hoof');
  return {hip,joint,side,front};
}

function buildNeck(parent,paint,rng) {
  const g=group(parent,0,1.31,.52);
  const l=new PaintLayer(g,paint,rng,1);
  segment(l,point(0,-.04,-.12),point(0,.69,.49),.237,.267,shoulder,625,.12);
  segment(l,point(0,.69,.43),point(0,.61,.98),.167,.187,hide,442,.11);
  l.oval(point(0,.526,.955),point(.164,.131,.210),muzzle,197,null,.09);
  l.oval(point(0,.523,1.066),point(.121,.081,.109),darkHide,101,null,.08);
  for (const side of [-1,1]) {
    const a=point(side*.108,.722,.428);
    const b=point(side*.145,.974,.410);
    segment(l,a,b,.068,.057,darkHide,136);
    segment(l,a.clone().lerp(b,.35).add(point(0,0,.046)),b.clone().add(point(0,0,.021)),.033,.027,shoulder,68,.11);
    l.oval(point(side*.151,.686,.736),point(.025,.043,.060),horseEye,64,null,.26);
    l.oval(point(side*.169,.707,.755),point(.011,.013,.016),padBinding,12,null,.35);
    l.oval(point(side*.109,.567,1.077),point(.039,.042,.025),hoof,39,null,.09);
    const n=point(side,.17,.26).normalize();
    const ring=point(side*.153,.552,1.034);
    l.oval(ring,point(.029,.037,.037),brass,29,null,.23);
    paintedLine(l.brush,point(side*.150,.556,1.022),point(side*.179,.710,.549),n,.049,leather,18,.08);
    paintedLine(l.brush,point(side*.170,.705,.563),point(side*.102,.779,.463),n,.055,leatherEdge,7,.14);
  }
  const maneN=point(.94,.19,.27).normalize();
  for(let i=0;i<131;i++) {
    const t=(i+rng())/131;
    const p=point((rng()-.53)*.22,.184+t*.60,-.21+t*.635);
    p.z+=Math.sin(t*3)*.11;
    const d=point((rng()-.58)*.43,-.74, -.47-rng()*.30);
    l.brush.stroke(p,d,maneN,.16+rng()*.26,.038+rng()*.083,mane,.11);
  }
  l.finish('Horse neck, ears and bridle');
  return g;
}

function buildTail(parent,paint,rng) {
  const g=group(parent,0,1.38,-1.03);
  const l=new PaintLayer(g,paint,rng,1);
  const sections=[
    point(.03,-.04,-.02),point(.047,-.173,-.22),point(.106,-.36,-.37),
    point(.121,-.58,-.48),point(.102,-.76,-.53)
  ];
  for(let i=0;i<sections.length-1;i++) {
    segment(l,sections[i],sections[i+1],.107-i*.019,.100-i*.014,mane,96,.12);
  }
  for(let i=0;i<115;i++) {
    const t=rng();
    l.brush.stroke(point(.07+Math.sin(t*3)*.11+(rng()-.5)*.131,-t*.74,-t*.54),
      point(.25*Math.sin(3*t),-1,-.74),point(.96,0,.28).normalize(),
      .095+rng()*.21,.026+rng()*.050,mane,.1);
  }
  l.finish('Horse tail');
  return g;
}

function buildLantern(parent,paint,rng) {
  const g=group(parent,.656,2.031,.21);
  const l=new PaintLayer(g,paint,rng,1);
  l.box(point(0,-.093,0),point(.138,.195,.134),lanternGlass,.038,1);
  l.box(point(0,-.105,0),point(.119,.120,.146),hotGlass,.042,.95);
  l.box(point(0,-.211,0),point(.181,.041,.176),brass,.052,.37);
  l.box(point(0,.026,0),point(.182,.041,.175),brass,.052,.30);
  l.oval(point(0,.052,0),point(.121,.039,.108),brass,89,null,.28);
  for(const x of [-.075,.075]) {
    for(const z of [-.071,.071]) {
      l.box(point(x,-.09,z),point(.019,.221,.017),leatherEdge,.037,.36);
    }
  }
  const n=point(0,0,1);
  for(let i=0;i<12;i++) {
    const a=i/12*Math.PI;
    const b=(i+1)/12*Math.PI;
    paintedLine(l.brush,point(.068*Math.cos(a),.056+.098*Math.sin(a),.006),
      point(.068*Math.cos(b),.056+.098*Math.sin(b),.006),n,.027,brass,2,.37);
  }
  l.finish('Lantern glass and frame');

  const glowMaterial = new THREE.MeshBasicNodeMaterial({
    depthWrite:false,transparent:true,blending:THREE.AdditiveBlending,side:THREE.DoubleSide
  });
  glowMaterial.colorNode=uniform(new THREE.Color('#ed9c4c'));
  glowMaterial.opacityNode=smoothstep(0,.5,uv().sub(vec2(.5)).length()).oneMinus().pow(3.4).mul(float(.47));
  const halo=new THREE.Mesh(new THREE.PlaneGeometry(1.04,1.04),glowMaterial);
  halo.position.y=-.094;
  g.add(halo);
  return {g,halo};
}

function elasticReins(parent,neck) {
  const geo=new THREE.CylinderGeometry(.011,.014,1,6);
  const mat=new THREE.MeshBasicMaterial({color:'#614d46'});
  const reins=[];
  const a=point();
  const b=point();
  const delta=point();
  for(const side of [-1,1]) {
    const cord=[];
    for(let i=0;i<5;i++) {
      const mesh=new THREE.Mesh(geo,mat);
      parent.add(mesh);
      cord.push(mesh);
    }
    reins.push({side,cord});
  }
  return () => {
    for(const {side,cord} of reins) {
      const bit=point(side*.157,.56,1.035).applyQuaternion(neck.quaternion).add(neck.position);
      const hand=point(-.282,2.156,.453);
      b.copy(bit);
      for(let i=0;i<cord.length;i++) {
        a.copy(b);
        const t=(i+1)/cord.length;
        b.copy(bit).lerp(hand,t);
        b.y-=.16*4*t*(1-t);
        const mesh=cord[i];
        mesh.position.copy(a).lerp(b,.5);
        delta.subVectors(b,a);
        mesh.scale.y=delta.length();
        mesh.quaternion.setFromUnitVectors(up,delta.normalize());
      }
    }
  };
}

export function createRider(parent,paint) {
  const rng=random(150709);
  const worldRoot=group(parent);
  const body=group(worldRoot);
  const horse=new PaintLayer(body,paint,rng,1);
  horse.oval(point(0,1.243,-.12),point(.457,.446,.876),hide,860,null,.11);
  horse.oval(point(0,1.291,-.641),point(.442,.417,.492),shoulder,469,null,.12);
  horse.oval(point(0,1.325,.525),point(.354,.440,.425),hide,450,null,.13);
  horse.oval(point(0,1.110,-.03),point(.389,.324,.636),darkHide,315,null,.10);
  horse.oval(point(0,1.602,-.111),point(.467,.119,.482),padBinding,413,null,.16);
  horse.oval(point(0,1.651,-.11),point(.426,.121,.451),blue,358,null,.15);
  horse.oval(point(0,1.723,-.102),point(.302,.137,.381),leather,397,null,.11);
  horse.oval(point(0,1.775,-.348),point(.318,.112,.156),leatherEdge,190,null,.14);
  for(const side of [-1,1]) {
    const n=point(side,.073,0).normalize();
    paintedLine(horse.brush,point(side*.429,1.428,-.044),point(side*.43,.978,-.011),n,.111,leather,11,.13);
    paintedLine(horse.brush,point(side*.397,1.64,.075),point(side*.497,1.18,.097),n,.049,leatherEdge,11,.18);
  }

  horse.oval(point(0,1.855,-.052),point(.298,.157,.213),gloves,301,null,.11);
  horse.oval(point(0,2.102,-.035),point(.265,.379,.169),steel,460,null,.15);
  horse.oval(point(0,2.287,-.142),point(.307,.113,.178),blue,285,null,.14);
  horse.oval(point(0,2.444,-.010),point(.097,.144,.099),gloves,125,null,.15);
  horse.oval(point(0,2.623,.030),point(.158,.196,.148),face,375,null,.16);
  horse.oval(point(0,2.561,.099),point(.140,.088,.102),gloves,199,null,.14);
  horse.oval(point(0,2.746,.026),point(.472,.052,.393),hat,767,null,.17);
  horse.oval(point(-.022,2.829,.017),point(.228,.161,.192),hat,529,null,.17);
  horse.oval(point(-.020,2.79,.013),point(.229,.042,.198),brass,267,null,.20);

  for(const side of [-1,1]) {
    const a=point(side*.220,1.845,.008);
    const b=point(side*.394,1.503,.131);
    const c=point(side*.438,1.163,.117);
    segment(horse,a,b,.108,.106,steel,198,.13);
    segment(horse,b,c,.067,.069,gloves,170,.12);
    horse.oval(c.clone().add(point(.014*side,-.035,.108)),point(.089,.068,.148),leather,138,null,.12);
    const outer=point(side,0,.16).normalize();
    paintedLine(horse.brush,c.clone().add(point(.082*side,-.107,.130)),
      c.clone().add(point(.088*side,-.032,-.019)),outer,.034,brass,6,.26);

    const sh=point(side*.249,2.296,-.035);
    const elbow=point(side*(side>0?.448:.314),2.084,.218);
    const hand=side>0 ? point(.638,2.159,.22) : point(-.283,2.159,.447);
    horse.oval(sh,point(.156,.132,.144),steel,225,null,.18);
    segment(horse,sh,elbow,.078,.085,blue,184,.14);
    segment(horse,elbow,hand,.072,.070,steel,182,.16);
    horse.oval(hand,point(.069,.070,.075),gloves,130,null,.15);
  }
  horse.finish('Horse, tack and knight');

  const neck=buildNeck(body,paint,rng);
  const tail=buildTail(body,paint,rng);
  const fabric=group(body,0,2.296,-.135);
  drape(fabric,paint,rng);
  const legs=[makeLeg(body,paint,rng,-1,true),makeLeg(body,paint,rng,1,true),
    makeLeg(body,paint,rng,-1,false),makeLeg(body,paint,rng,1,false)];
  const {g:lantern,halo}=buildLantern(body,paint,rng);
  const updateReins=elasticReins(body,neck);

  let gaitPhase=0;
  const targetQuat=new THREE.Quaternion();
  const yawInverse=new THREE.Quaternion();
  function animate(dt,speed,vY,air,time,camera) {
    const stride=clamp(speed/5.7);
    const gallop=clamp((speed-6.0)/3.6);
    gaitPhase+=dt*(3.2 + speed*1.42);
    const wave=Math.sin(gaitPhase);
    body.position.y=.021+Math.sin(gaitPhase*2)*stride*.035;
    body.rotation.x=-vY*.032+wave*stride*.028;
    body.rotation.z=Math.cos(gaitPhase)*stride*.025;
    tail.rotation.x=Math.sin(gaitPhase*.72)*.14*stride - .13*gallop;
    tail.rotation.y=Math.cos(time*3.9+gaitPhase*.36)*(.083+.124*stride);
    neck.rotation.x=.039*wave*stride+vY*.011;
    fabric.rotation.x=.149*stride+.078*gallop+Math.sin(time*5+gaitPhase*.25)*(.039+.031*stride);
    fabric.rotation.z=Math.sin(time*4.75)*(.028+.022*stride);
    lantern.rotation.x=.076*Math.sin(gaitPhase+1)*stride+vY*.04;
    lantern.rotation.z=.061*Math.sin(gaitPhase*.54)*stride-.078;
    for(const leg of legs) {
      const offset=leg.side<0 ? 0 : Math.PI;
      const back=leg.front? .35 : Math.PI+.16;
      const phase=gaitPhase+offset*(1-gallop*.72)+back;
      const swing=Math.cos(phase) * (.34+.26*gallop)*stride;
      const tuck=leg.front ? -1 : 1;
      leg.hip.rotation.x=swing*(1-air) + air*(tuck*.55+vY*.026);
      const lift=Math.max(0,Math.sin(phase));
      leg.joint.rotation.x=(.12 + lift*(.38+gallop*.22)*stride)*(1-air) + air*(leg.front ? .98 : -.68);
    }
    updateReins();
    if(camera) {
      camera.getWorldQuaternion(targetQuat);
      lantern.getWorldQuaternion(yawInverse).invert();
      halo.quaternion.copy(yawInverse).multiply(targetQuat);
    }
  }
  return {root:worldRoot,lantern,animate};
}
