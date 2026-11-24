import {
  THREE, PaintLayer, TAU, clamp, mixNumber, palette, point, random, up, paintedLine
} from '../../rendering/paint.js';
import {
  crossings, bridgeY, fallsZ, waterY, riverHalf, riverX, terrain, roadAt, landmark, trailLength
} from './land.js';

const plaster = [
  palette('#38363e','#898278'), palette('#3b3946','#837b75'),
  palette('#343d4a','#687f88'), palette('#4a4147','#95817b')
];
const roofs = [
  palette('#171f37','#4f576d'), palette('#292739','#765f65'),
  palette('#202a40','#58687d'), palette('#222639','#5e6379')
];
const stone = palette('#313b4e','#77828a');
const stoneLight = palette('#3d4855','#91918b');
const timber = palette('#241e2a','#695350');
const darkTrim = palette('#1e202c','#505663');
const glass = palette('#b66a31','#ffd484');
const glassDark = palette('#8b4c30','#f1a649');
const softWood = palette('#534240','#96806c');
const whiteSail = palette('#50545b','#bfc2a8');
const green = [
  palette('#102934','#315454'), palette('#142b31','#416159'),
  palette('#193340','#3f6b67'), palette('#1b3841','#467774'),
  palette('#0b202d','#244d4d'), palette('#213a42','#537d70')
];
const rock = [
  palette('#182632','#465867'), palette('#253247','#555d72'),
  palette('#2a3440','#606978'), palette('#303c48','#6b7380')
];

function box(layer,x,y,z,sx,sy,sz,colors,step,emit=0) {
  layer.box(point(x,y,z),point(sx,sy,sz),colors,step,emit);
}

function windowAt(layer,{darkTrim,glass,glassDark,timber,softWood},x,y,z,w,h,variant = 0) {
  box(layer,x,y,z+.012,w+.14,h+.17,.086,darkTrim,.11);
  box(layer,x,y,z+.063,w,h,.057,layer.windowPalette ?? (variant ? glassDark : glass),.085,layer.lampPower ?? .92);
  box(layer,x,y+.026,z+.105,w+.017,.047,.027,timber,.051);
  box(layer,x,y,z+.107,.053,h+.014,.026,timber,.051);
  box(layer,x,y-h*.5-.076,z+.078,w+.26,.098,.32,softWood,.08);
  for (let n=0;n<9;n++) {
    const a = layer.rng();
    const b = layer.rng();
    const left = n % 2 === 0 ? -1 : 1;
    const p = point(x+left*(w*.53+a*.14),y+(b-.48)*h,z+.044);
    layer.brush.stroke(p,point(.22,1,0),point(0,0,1),.103+a*.19,.034+b*.035,layer.windowPalette ?? glassDark,(layer.lampPower ?? .92)*.4);
  }
}

function gable(layer,x,y,z,w,rise,colors,step) {
  const n = point(0,0,1);
  layer.triangle(point(x-w/2,y,z),point(x+w/2,y,z),point(x,y+rise,z),n,colors);
  for (let py=step*.39;py<rise;py+=step*.78) {
    const span = w*(1-py/rise);
    const cols = Math.max(1,Math.floor(span/(step*1.55)));
    for (let i=0;i<cols;i++) {
      const px = x + ((i+layer.rng())/cols-.5)*span;
      layer.brush.stroke(point(px,y+py+(layer.rng()-.5)*step*.35,z+.012),point(1,.12,0),n,step*(1.34+layer.rng()),step*.74,colors);
    }
  }
}

function roof(layer,x,y,z,w,d,rise,col,stoneLight) {
  const a = w*.56;
  const b = d*.56;
  layer.face(point(x-a,y,z-b),point(0,0,2*b),point(a,rise,0),col,.202,0,.47);
  layer.face(point(x+a,y,z+b),point(0,0,-2*b),point(-a,rise,0),col,.202,0,.47);
  const top = point(x,y+rise+.021,z);
  box(layer,top.x,top.y,top.z,.12,.115,d*1.128,col,.17);
  for (const [side,depth] of [[-1,z+b],[1,z+b],[-1,z-b],[1,z-b]]) {
    paintedLine(layer.brush,point(x+side*a,y,depth+.013),point(x,y+rise,depth+.014),
      point(0,.05,1).normalize(),.104,stoneLight,Math.ceil(w*4),.082);
  }
}

function cottage(layer,solids,pigments,x,z,w,d,h,rise,style=0,chimney=true) {
  const {plaster,roofs,stone,stoneLight,timber,darkTrim}=pigments;
  const y=layer.baseY ?? terrain(x,z);
  const col=plaster[style%plaster.length];
  const trim=roofs[style%roofs.length];
  box(layer,x,y+h*.5-.06,z,w,h+.12,d,col,.19);
  box(layer,x,y+.17,z,w+.17,.37,d+.15,stone,.20);
  gable(layer,x,y+h,z+d*.5,w,rise,col,.205);
  gable(layer,x,y+h,z-d*.5+.001,w,rise,col,.205);
  roof(layer,x,y+h+.009,z,w,d,rise,trim,stoneLight);
  const front=z+d*.5;
  box(layer,x+.1,y+.71,front+.037,.68,1.42,.09,timber,.128);
  box(layer,x+.1,y+1.44,front+.041,.9,.10,.16,stone,.091);
  box(layer,x+.12,y+.027,front+.27,.91,.18,.50,stone,.14);
  for (const sign of [-1,1]) {
    windowAt(layer,pigments,x+sign*w*.31,y+h*.54,front,.61,.77,style%2);
  }
  if (w>4.1) windowAt(layer,pigments,x,y+h+rise*.27,front,.47,.53,1);
  if (chimney) {
    box(layer,x-w*.30,y+h+rise*.72,z-d*.16,.43,rise*.91,.5,stone,.143);
    box(layer,x-w*.30,y+h+rise*1.17,z-d*.16,.58,.16,.57,darkTrim,.12);
  }
  // A few horizontal joins in the limewash, broken by window light.
  for (let i=0;i<13;i++) {
    const px=x + (layer.rng()-.5)*w*.92;
    const py=y+.28+layer.rng()*h*.8;
    layer.brush.stroke(point(px,py,front+.016),point(1,.04,0),point(0,0,1),.23+layer.rng()*.44,.027+layer.rng()*.05,stoneLight,.04);
  }
  solids.push({x,z,y:y-.09,h:h+rise*.6,rx:w*.5,rz:d*.5,angle:0});
  return y;
}

function spire(layer,x,y,z,w,height,colors,stoneLight) {
  const tip=point(x+.05,y+height,z-.055);
  const corners=[[-1,1],[1,1],[1,-1],[-1,-1]].map(([u,v])=>point(x+u*w/2,y,z+v*w/2));
  for (let i=0;i<4;i++) {
    const a=corners[i];
    const b=corners[(i+1)%4];
    const n=point().crossVectors(b.clone().sub(a),tip.clone().sub(a)).normalize();
    layer.triangle(a,b,tip,n,colors);
    for (let j=0;j<37;j++) {
      const t=(j+layer.rng())/38;
      const l=a.clone().lerp(tip,t);
      const r=b.clone().lerp(tip,t);
      const cols=Math.max(1,Math.ceil(w*(1-t)/.23));
      for (let k=0;k<cols;k++) {
        const p=l.clone().lerp(r,(k+layer.rng())/cols).addScaledVector(n,.011);
        layer.brush.stroke(p,b.clone().sub(a).addScaledVector(up,.17),n,.16+layer.rng()*.28,.083+layer.rng()*.12,colors,.04);
      }
    }
    paintedLine(layer.brush,a,tip,n,.10,stoneLight,24,.14);
  }
}

function church(layer,solids,pigments) {
  const {plaster,roofs,stone,stoneLight,darkTrim}=pigments;
  const x=-6.65;
  const z=-34.1;
  const y=cottage(layer,solids,pigments,x,z,6.0,6.2,3.64,2.36,2,false);
  const tx=x+.03;
  const tz=z+3.06;
  box(layer,tx,y+3.06,tz,2.58,6.28,2.61,plaster[2],.175);
  box(layer,tx,y+5.87,tz,2.76,.23,2.79,stoneLight,.13);
  box(layer,tx,y+5.14,tz,2.67,.15,2.69,stone,.14);
  windowAt(layer,pigments,tx,y+4.69,tz+1.32,.58,1.32);
  box(layer,tx,y+.94,tz+1.34,1.17,1.88,.092,darkTrim,.14);
  windowAt(layer,pigments,tx,y+2.66,tz+1.32,.51,.88,1);
  spire(layer,tx,y+6.20,tz,2.78,5.88,roofs[2],stoneLight);
  box(layer,tx+.05,y+12.39,tz-.055,.065,.76,.062,stoneLight,.10,.17);
  box(layer,tx+.05,y+12.44,tz-.055,.44,.064,.062,stoneLight,.10,.17);
  solids.push({x:tx,z:tz,y:y-.09,h:6.6,rx:1.3,rz:1.33,angle:0});
}

function windmill(parent,layer,paint,rng,fraction,solids,pigments,x,z,size) {
  const {plaster,roofs,stoneLight,softWood,timber,whiteSail}=pigments;
  const y=layer.baseY ?? terrain(x,z);
  const r=1.57*size;
  const base=point(x,y-.045,z);
  const rings=11;
  for (let i=0;i<rings;i++) {
    const t=i/rings*TAU;
    const q=(i+1)/rings*TAU;
    const a=point(Math.cos(t)*r,0,Math.sin(t)*r).add(base);
    const b=point(Math.cos(q)*r,0,Math.sin(q)*r).add(base);
    const c=point(Math.cos(q)*r*.69,5.2*size,Math.sin(q)*r*.69).add(base);
    const d=point(Math.cos(t)*r*.69,5.2*size,Math.sin(t)*r*.69).add(base);
    const n=point(Math.cos((t+q)*.5),.10,Math.sin((t+q)*.5)).normalize();
    layer.triangle(a,d,b,n,plaster[1]);
    layer.triangle(b,d,c,n,plaster[1]);
    for (let j=0;j<31;j++) {
      const v=(j+rng())/32;
      for (let k=0;k<5;k++) {
        const p=a.clone().lerp(d,v).lerp(b.clone().lerp(c,v),(k+rng())/5).addScaledVector(n,.014);
        layer.brush.stroke(p,b.clone().sub(a).addScaledVector(up,(rng()-.5)*.45),n,.23+rng()*.31,.12+rng()*.08,plaster[(i+j)%3]);
      }
    }
  }
  spire(layer,x,y+5.12*size,z,2.37*size,1.4*size,roofs[1],stoneLight);
  windowAt(layer,pigments,x,y+1.65*size,z+r*.94,.61*size,.85*size,1);
  windowAt(layer,pigments,x-.41*size,y+3.37*size,z+r*.79,.47*size,.59*size);
  const blades=new THREE.Group();
  blades.position.set(x,y+4.87*size,z+r*.67+.12);
  blades.scale.setScalar(size);
  parent.add(blades);
  const sail=new PaintLayer(blades,paint,rng,fraction);
  sail.oval(point(),point(.30,.30,.22),softWood,94);
  for (let i=0;i<4;i++) {
    const t=i*TAU/4+.28;
    const d=point(Math.cos(t),Math.sin(t),0);
    const n=point(-Math.sin(t),Math.cos(t),0);
    const front=point(0,0,1);
    paintedLine(sail.brush,d.clone().multiplyScalar(.018),d.clone().multiplyScalar(4.24),front,.159,timber,22);
    const a=d.clone().multiplyScalar(1.29).addScaledVector(n,.050);
    a.z=.05;
    sail.face(a,d.clone().multiplyScalar(2.69),n.clone().multiplyScalar(.65),whiteSail,.098,.19,.43);
    for (let j=0;j<11;j++) {
      const s=d.clone().multiplyScalar(1.05+j*.28);
      s.z=.09;
      paintedLine(sail.brush,s.clone().addScaledVector(n,-.15),s.clone().addScaledVector(n,.72),front,.051,softWood,6,.16);
    }
    paintedLine(sail.brush,d.clone().multiplyScalar(1.13).addScaledVector(n,.71).add(point(0,0,.075)),
      d.clone().multiplyScalar(4.15).addScaledVector(n,.71).add(point(0,0,.075)),front,.063,timber,18,.14);
  }
  sail.finish('Windmill sails');
  solids.push({x,z,y:y-.08,h:5.3*size,rx:r*.70,rz:r*.70,angle:0});
  return blades;
}

function cypress(layer,x,z,h,r,twist) {
  const rng=layer.rng;
  const y=terrain(x,z)-.09;
  const profile=(t,a) => {
    const ruffle=.93+.11*Math.sin(a*5+t*18+twist)+.07*Math.sin(a*9-t*33)+.046*Math.cos(a*17+t*17);
    const silhouette=Math.pow(Math.max(.0001,Math.sin(Math.PI*t)),.69) * (1.47-1.23*t);
    const wide=r*ruffle*silhouette;
    return point(x+Math.cos(a)*wide+.14*h*t*t*Math.sin(t*2.8+twist), y+t*h,
      z+Math.sin(a)*wide+ .035*h*Math.sin(t*4.5+twist)*t);
  };
  const rows=22;
  const cols=21;
  for (let j=0;j<rows;j++) {
    for (let i=0;i<cols;i++) {
      const t=j/rows;
      const a=i/cols*TAU;
      const b=(i+1)/cols*TAU;
      const p=profile(t,a);
      const q=profile(t,b);
      const u=profile(t+1/rows,b);
      const v=profile(t+1/rows,a);
      const n=point(Math.cos(a),.1,Math.sin(a)).normalize();
      const col=green[(i+j)%green.length];
      layer.triangle(p,q,u,n,col,0,-.08);
      layer.triangle(p,u,v,n,col,0,-.08);
    }
  }
  const tall=h>6;
  const count=Math.floor(h*r*(tall ? 144 : 181));
  for (let i=0;i<count;i++) {
    const t=(i+rng())/count;
    const angle=(i*2.399963+rng()*.42)%TAU;
    const p=profile(t,angle);
    const n=point(Math.cos(angle),.19,Math.sin(angle)).normalize();
    const beside=profile(t,angle+.02).sub(p).normalize();
    const velocity=profile(Math.min(1,t+.004),angle).sub(p).normalize();
    const d=velocity.addScaledVector(beside,.29*Math.sin(t*17+angle)+.29*(rng()-.46));
    p.addScaledVector(n,.024+rng()*.07);
    const size=(.14+t*.073+rng()*.42)*(tall?1.13:.84);
    const col=green[Math.floor(clamp(.42+.29*Math.sin(angle*3+t*13)+.47*rng(),0,.999)*green.length)];
    layer.brush.stroke(p,d,n,size * (1.12+.48*rng()), .047+size*.30*rng(),col,.071);
  }
}

function buildBridge(layer,cross,{stone,stoneLight,bridgeRock,softWood}) {
  const {x,z,half,width}=cross;
  const count=84;
  const staves=[stone,stoneLight,bridgeRock,softWood];
  const bottom = px => waterY-.55 + 2.23*Math.pow(Math.max(0,1-((px-x)/(riverHalf(z)*1.11))**2),.63);
  for (let i=0;i<count;i++) {
    const left=x-half+i*2*half/count;
    const right=x-half+(i+1)*2*half/count;
    const high=bridgeY(left,cross);
    const highNext=bridgeY(right,cross);
    const bl=Math.min(high-.15,bottom(left));
    const br=Math.min(highNext-.15,bottom(right));
    const a=point(left,high,z-width);
    const b=point(right,highNext,z-width);
    const c=point(right,highNext,z+width);
    const d=point(left,high,z+width);
    layer.triangle(a,c,b,up,stoneLight);
    layer.triangle(a,d,c,up,stoneLight);
    const n=point(0,0,1);
    for (const sign of [-1,1]) {
      const zz=z+width*sign;
      const p=point(left,bl,zz);
      const q=point(right,br,zz);
      const r=point(right,highNext,zz);
      const s=point(left,high,zz);
      layer.triangle(p,q,r,n,stone);
      layer.triangle(p,r,s,n,stone);
      for (let j=0;j<Math.ceil((high-bl)*11);j++) {
        const mid=(left+right)/2+(layer.rng()-.5)*.21;
        const y=bl+(high-bl)*(j+layer.rng())/Math.ceil((high-bl)*11);
        layer.brush.stroke(point(mid,y,zz+sign*.016),point(1,(layer.rng()-.5)*.47,0),point(0,0,sign),.20+layer.rng()*.49,.084+layer.rng()*.109,staves[j%4]);
      }
      if (i%5===0 && Math.abs(left-x)<half*.88) {
        box(layer,left,high+.14,zz-.085*sign,.23,.34,.24,stone,.09);
      }
      if (i>4 && i<count-5) {
        const bar=point(left,high+.285,zz-.08*sign);
        const next=point(right,highNext+.285,zz-.08*sign);
        paintedLine(layer.brush,bar,next,point(0,.47,sign).normalize(),.16,stoneLight,2,.12);
      }
    }
    for (let j=0;j<15;j++) {
      const yy=bridgeY((left+right)*.5,cross)+.026;
      const zz=z+(layer.rng()-.5)*width*1.92;
      layer.brush.stroke(point((left+right)*.5+(layer.rng()-.5)*.15,yy,zz),point(1,0,(layer.rng()-.5)*1.41),up,.23+layer.rng()*.39,.092+layer.rng()*.11,staves[j%4]);
    }
  }
}

function cascade(parent,layer,paint,rng,fraction,api) {
  const x=riverX(fallsZ);
  const z=fallsZ;
  const shades=[
    palette('#2a6584','#5896ae'),palette('#46879e','#a5c7c9'),
    palette('#31577d','#6296b4'),palette('#7dabb9','#cdd9d5')
  ];
  const water=api.swatch('water','falls','Dòng thác','#5896ae');
  const spray=api.swatch('water','spray','Bọt thác','#cdd9d5');
  const icy=shades.map(pair=>pair.map(water));
  const mist=shades.map(pair=>pair.map(spray));
  // A terraced rock face sits behind the channel. Flanking ledges narrow
  // the bed near the lip while leaving the full falling sheet exposed.
  const span=10.4;
  const surface=(u,t)=>{
    const bank=Math.abs(u);
    const central=1-Math.min(1,Math.max(0,(bank-.23)/.23));
    const fracture=Math.sin(u*19+.58)+.74*Math.sin(u*38-1.09)+.44*Math.sin(u*71);
    const crest=(6.02+1.80*Math.sin(u*3.5+.72)+.47*fracture)*(1-central)+7.01*central;
    const edgeDip=Math.min(1,Math.max(0,(bank-.85)/.15));
    const reach=crest*(1-.73*edgeDip);
    const horizon=t*t*(Math.sin(u*7.4)*.22+.20*Math.cos(u*33+t*8));
    const shelf=.28*Math.cos(t*21+u*7.4) + .31*Math.sin(u*18+t*4.6);
    const front=-.56-1.17*t*t + (1-central)*(.92*shelf+ .81*Math.sin(u*9.1+.81))
      - .49*central + horizon;
    return point(x+u*span+.27*Math.sin(u*15+t*4)*Math.sin(t*Math.PI),
      -1.04+t*(reach+.65),z+front);
  };
  const cols=68;
  const rows=28;
  for(let i=0;i<cols;i++) {
    for(let j=0;j<rows;j++) {
      const u=i/cols*2-1;
      const v=(i+1)/cols*2-1;
      const t=j/rows;
      const next=(j+1)/rows;
      const a=surface(u,t);
      const b=surface(v,t);
      const c=surface(v,next);
      const d=surface(u,next);
      const n=point().crossVectors(b.clone().sub(a),d.clone().sub(a)).normalize();
      const vein=Math.sin(t*18+u*8)+Math.sin(t*39-u*3.6)*.46+Math.cos(u*21)*.38;
      const col=rock[Math.floor(clamp(.52+vein*.26,0,.999)*rock.length)];
      layer.triangle(a,b,c,n,col,.052);
      layer.triangle(a,c,d,n,col,.052);
      for(let k=0;k<4;k++){
        const f=(k+rng())/4;
        const g=rng();
        const p=a.clone().lerp(b,f).lerp(d.clone().lerp(c,f),g).addScaledVector(n,.022+rng()*.043);
        const angle=.22+.77*Math.sin(u*12+t*19)+(rng()-.5)*.81;
        const dir=point(Math.cos(angle),Math.sin(angle),0);
        layer.brush.stroke(p,dir,n,.12+rng()*.58,.06+rng()*.19,col,.079);
      }
      if(j===rows-1) {
        const back=d.clone().add(point(0,-.65,-3.4));
        const backNext=c.clone().add(point(0,-.65,-3.4));
        layer.triangle(d,c,backNext,up,col,.05);
        layer.triangle(d,backNext,back,up,col,.05);
        layer.triangle(back,backNext,backNext.clone().setY(-.73),n,col);
        layer.triangle(back,backNext.clone().setY(-.73),back.clone().setY(-.73),n,col);
      }
    }
  }
  for(let i=0;i<22;i++) {
    const sign=i%2 ? 1 : -1;
    const px=x+sign*(3.25+rng()*7.45);
    const amount=.26+rng()*.52;
    const py=.02+rng()*.29;
    const pz=z+.39+rng()*1.96;
    layer.oval(point(px,py,pz),point(amount*1.4,amount,amount*.94),rock[i%rock.length],119,null,.06,.82);
  }
  const fall = new PaintLayer(parent,paint,rng,fraction);
  const brush=fall.brush;
  const width=4.38;
  const height=7.0;
  const sample=(t,u)=>point(x+u*width*.5*(.93+.17*t)+Math.sin(t*Math.PI)*.26,
    waterY+t*height,z+.83-1.28*t*t+.13*Math.cos(u*2.4+t*3.7));
  const front=point(0,0,1);
  for(let i=0;i<28;i++) {
    for(let j=0;j<11;j++) {
      const a=i/28;
      const b=(i+1)/28;
      const u=(j/11)*2-1;
      const v=((j+1)/11)*2-1;
      const p=sample(a,u);
      const q=sample(a,v);
      const r=sample(b,v);
      const s=sample(b,u);
      fall.triangle(p,q,r,front,icy[j%3],.44);
      fall.triangle(p,r,s,front,icy[j%3],.44);
    }
  }
  for (let i=0;i<6900;i++) {
    const t=rng();
    const u=(rng()-.5)*2;
    const p=sample(t,u).add(point(0,0,.035+rng()*.11));
    const d=sample(Math.min(1,t+.041),u).sub(p);
    d.z=0;
    d.x+=(rng()-.5)*.119;
    const gleam=.47+.34*Math.sin(u*19.5+t*1.7)-.093*Math.sin(t*8)+rng()*.32;
    const col=icy[Math.floor(clamp(gleam,0,.999)*icy.length)];
    brush.stroke(p,d,front,.15+rng()*1.19,.028+rng()*.105,col,.49,3);
  }
  for(let i=0;i<1320;i++) {
    const q=rng()*TAU;
    const r=Math.sqrt(rng());
    const p=point(x+Math.cos(q)*r*2.88,waterY+.055+rng()*.25*(1-r),z+1.81+Math.sin(q)*r*2.62);
    brush.stroke(p,point(Math.cos(q+.9),0,Math.sin(q+.9)),up,.14+rng()*.63,.036+rng()*.131,mist[i%4],.54,1);
  }
  for(let i=0;i<720;i++) {
    const u=(rng()-.5)*2;
    const back=rng()*3.7;
    const edge=sample(1,u);
    const p=edge.clone().add(point(.14*back,.025+back*.43,-back));
    brush.stroke(p,point(1,0,(rng()-.5)*.43),up,.19+rng()*.41,.055+rng()*.099,mist[i%4],.45,1);
  }
  fall.finish('Falling water and spray');
}

function makeJumpables(parent,paint,rng,fraction,solids,api) {
  const details=[
    {s:8.9,rx:1.66,rz:.22,h:.53,name:'Fallen log'},
    {s:trailLength*.386,rx:1.87,rz:.123,h:.84,name:'Rail fence'},
    {s:trailLength*.726,rx:1.76,rz:.25,h:.72,name:'Stone wall'}
  ];
  for (const o of details) {
    const p=landmark(o.s);
    const forward=landmark(o.s+1).sub(landmark(o.s-1)).normalize();
    const y=groundForObstacle(p.x,p.z);
    o.x=p.x; o.z=p.z; o.y=y; o.angle=Math.atan2(forward.x,forward.z); o.jumpable=true;
    const label={'Fallen log':'Thân cây đổ','Rail fence':'Hàng rào','Stone wall':'Tường đá'}[o.name];
    api.entity({id:'barrier-'+details.indexOf(o),name:label,kind:'Chướng ngại',solid:true,jumpable:true,
      position:[p.x,y,p.z],yaw:o.angle*180/Math.PI,box:{center:[0,o.h/2,0],size:[o.rx*2,o.h,o.rz*2]}},({layer:l})=>{
    if(o.name==='Fallen log') {
      l.oval(point(0,o.h*.47,0),point(o.rx,.245,.235),softWood,1100,null,.06);
      for (const sign of [-1,1]) {
        const cap=point(sign*(o.rx-.029),o.h*.47,0);
        for(let j=0;j<27;j++) {
          const t=j*TAU/27;
          const p=cap.clone().add(point(0,Math.cos(t)*.093,Math.sin(t)*.116));
          l.brush.stroke(p,point(0,-Math.sin(t),Math.cos(t)),point(sign,0,0),.065,.033,timber);
        }
      }
      paintedLine(l.brush,point(.66,.25,0),point(.91,.66,.05),point(0,0,1),.128,timber,6,.12);
    } else if(o.name==='Rail fence') {
      for(const sign of [-1,1]) box(l,sign*(o.rx-.095),o.h*.47,0,.18,o.h+.02,.19,softWood,.092);
      for(const y of [.32,.65]) box(l,0,y,0,o.rx*2-.15,.112,.15,timber,.083);
      paintedLine(l.brush,point(-o.rx+.2,.69,.086),point(o.rx-.18,.69,.086),point(0,0,1),.055,softWood,15,.11);
    } else {
      for(let j=0;j<3;j++) {
        for(let i=0;i<9;i++) {
          const x=(i-4)*.37+((j%2)-.5)*.14;
          box(l,x,(j+.49)*.232,0,.36,.226,.46+rng()*.065,rock[(i+j)%4],.094);
        }
      }
      for(let i=0;i<9;i++) {
        box(l,(i-4)*.37,.707,0,.36,.096,.49,stone,.091);
      }
    }
    });
  }
  return details;
}

function groundForObstacle(x,z) {
  for(const b of crossings) {
    if (Math.abs(z-b.z)<b.width && Math.abs(x-b.x)<b.half) return bridgeY(x,b);
  }
  return terrain(x,z);
}

export function buildVillage(parent,paint,fraction,api,waterPaint,architecturePaint) {
  const walls=api.swatch('architecture','walls','Tường nhà','#898278');
  const tiles=api.swatch('architecture','roofs','Mái ngói','#4f576d');
  const masonry=api.swatch('architecture','stone','Đá xây','#77828a');
  const wood=api.swatch('architecture','timber','Gỗ cửa và cối xay','#695350');
  const windows=api.swatch('architecture','windows','Ánh cửa sổ','#ffd484');
  const sailcloth=api.swatch('architecture','sails','Vải cánh quạt','#bfc2a8');
  const pigments={
    plaster:plaster.map(pair=>pair.map(walls)), roofs:roofs.map(pair=>pair.map(tiles)),
    stone:stone.map(masonry), stoneLight:stoneLight.map(masonry), bridgeRock:rock[2].map(masonry),
    timber:timber.map(wood), darkTrim:darkTrim.map(wood), softWood:softWood.map(wood),
    glass:glass.map(windows), glassDark:glassDark.map(windows), whiteSail:whiteSail.map(sailcloth),
  };
  const rng=random(6101238);
  const layer=new PaintLayer(parent,paint,rng,fraction);
  const solids=[];
  for (const [index,[x,z,w,d,h,r,s]] of [
    [-17.3,-29.0,4.2,3.38,2.43,1.44,0],
    [-14.6,-37.1,4.9,4.14,2.63,1.65,1],
    [-2.72,-25.9,4.48,4.1,2.62,1.81,3],
    [2.9,-32.5,4.08,3.87,2.35,1.41,2],
    [7.71,-26.1,3.83,3.2,2.33,1.65,1],
    [-2.9,-39.6,4.13,3.8,2.57,1.59,0],
    [-23.7,-39.1,3.71,3.15,2.28,1.45,3],
    [36.1,-27.7,4.31,3.8,2.77,1.72,1],
    [39.2,-15.1,4.78,3.9,2.62,1.83,2],
    [33.7,-31.9,3.55,3.6,2.2,1.4,0]
  ].entries()) {
    const id='house-'+(index+1);
    api.entity({id,name:'Nhà ven đường '+(index+1),kind:'Kiến trúc',position:[x,terrain(x,z),z],
      solid:true,box:{center:[0,h*.5+r*.30,0],size:[w,h+r*.60,d]},
      fields:{window:{kind:'color',label:'Màu cửa sổ',value:'#ffd484'},light:{kind:'number',label:'Độ sáng đèn',value:.92,min:0,max:1,step:.02}}},
    ({layer:piece,values})=>{
      piece.baseY=0;
      const color=new THREE.Color(values.window);
      const shade=color.clone().multiplyScalar(.42);
      piece.windowPalette=values.window==='#ffd484' ? [windows(shade),windows()] : [shade,color];
      piece.lampPower=values.light;
      cottage(piece,[],pigments,0,0,w,d,h,r,s);
    });
  }
  const churchX=-6.65, churchZ=-34.1;
  api.entity({id:'church',name:'Nhà thờ làng',kind:'Kiến trúc',position:[churchX,terrain(churchX,churchZ),churchZ],
    solid:true,box:{center:[0,4,0],size:[6,8,6.2]}},({group})=>{
    const offset=new THREE.Group();
    offset.position.set(-churchX,-terrain(churchX,churchZ),-churchZ);
    group.add(offset);
    const local=new PaintLayer(offset,architecturePaint,random(7571),fraction);
    church(local,[],pigments);local.finish('Nhà thờ');
  });
  const mills=[];
  for (const [index,[x,z,size]] of [[13.3,-24.2,1.02],[-29.5,-36.5,.78],[40.6,-49.1,.86]].entries()) {
    api.entity({id:'mill-'+index,name:'Cối xay '+(index+1),kind:'Kiến trúc',position:[x,terrain(x,z),z],
      solid:true,box:{center:[0,2.65*size,0],size:[2.25*size,5.3*size,2.25*size]},
      fields:{speed:{kind:'number',label:'Tốc độ cánh',value:index%2?-.37:.4,min:-2,max:2,step:.05}}},
    ({group,layer:piece,random:r,onFrame,values})=>{
      piece.baseY=0;
      const blades=windmill(group,piece,architecturePaint,r,fraction,[],pigments,0,0,size);
      onFrame((t,dt)=>{blades.rotation.z+=dt*values.speed;});
    });
  }
  for (const [index,[x,z,h,r,t]] of [
    [-9.2,-3.2,10.5,1.63,2.1],[-12,-7.0,7.7,1.18,1.5],
    [-16.1,-9.9,6.1,.98,3.4], [-20.4,-23.7,8.3,1.34,2.9],
    [-20.4,-30.1,6.6,1.29,1.2],[-10.9,-40.3,7.6,1.04,3.3],
    [-3.8,-33.4,6.2,1.13,2.8],[3.9,-37.5,7.7,1.3,3.6],
    [11.16,-32.3,6.11,1.1,4.65],[17.1,-33.8,4.4,.86,2.4],
    [21.5,-51.1,7.93,1.21,2.95],[41.5,-23.7,8.5,1.32,1.65],
    [40.1,-36.6,6.1,1.2,.52],[-33.2,-16.0,5.9,1.3,3.8]
  ].entries()) {
    api.entity({id:'cypress-'+(index+1),name:'Bách '+(index+1),kind:'Cây',position:[x,terrain(x,z),z],
      box:{center:[0,h/2,0],size:[r*2,h,r*2]}},({group})=>{
      const offset=new THREE.Group();
      offset.position.set(-x,-terrain(x,z),-z);group.add(offset);
      const local=new PaintLayer(offset,paint,random(Math.floor((x+100)*1121)),fraction);
      cypress(local,x,z,h,r,t);local.finish('Tán bách');
    });
  }
  for (let i=0;i<85;i++) {
    const x=(rng()-.5)*134;
    const z=-49-rng()*27;
    if(Math.abs(x-riverX(z))<riverHalf(z)+2.7) continue;
    const h=1.7+rng()*3.8;
    cypress(layer,x,z,h,.49+rng()*.65,rng()*TAU);
  }
  for (let i=0;i<99;i++) {
    const z=(rng()-.62)*101;
    const x=riverX(z)+(i%2?1:-1)*(riverHalf(z)+1.5+rng()*2.7);
    if(roadAt(x,z).d<1.32) continue;
    const y=terrain(x,z);
    const w=.21+rng()*.52;
    layer.oval(point(x,y-.09,z),point(w,w*.69,w*(.57+rng()*.65)),rock[i%rock.length],23);
  }
  const bridges=new PaintLayer(parent,architecturePaint,rng,fraction);
  for(const b of crossings) buildBridge(bridges,b,pigments);
  bridges.finish('Village bridges');
  cascade(parent,layer,waterPaint,rng,fraction,api);
  solids.push({x:riverX(fallsZ),z:fallsZ-2.5,y:-1.04,h:7.4,rx:9.5,rz:1.85,angle:0});
  const jumpables=makeJumpables(parent,paint,rng,fraction,solids,api);
  layer.finish('Village stonework, cypresses and bridge');
  return {mills,solids,jumpables};
}
