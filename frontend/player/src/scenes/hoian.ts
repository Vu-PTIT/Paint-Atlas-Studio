import type { WorldAPI, Drawing, SwatchColor, V3 } from '@atlas/world';

// A new scene written against the same API as an imported Codex scene.
export default function build(a: WorldAPI) {
  const { THREE:T, point:p, colors:ink }=a;
  const [night='#123333',turquoise='#24615f',red='#ae422f',gold='#f1ac55',ivory='#f6dcaf']=a.palette;
  const tint=(c:string,k:number)=>'#'+new T.Color(c).multiplyScalar(k).getHexString();
  const set=(c:string,k=.38)=>ink(tint(c,k),c);
  const linked=(swatch:SwatchColor,c:string,k:number)=>ink(swatch(tint(c,k)),swatch(c));
  const shadePair=(swatch:SwatchColor,dark:string,light:string)=>ink(swatch(dark),swatch(light));
  const wood=ink('#30252a','#976445'), dark=ink('#151f23','#4e4140');
  const cream=set(ivory,.45), skin=ink('#aa5f42','#f7be85'), hair=ink('#151b24','#413239');

  const skyBase=a.swatch('sky','background','Nền trời',night);
  const clouds=a.swatch('sky','clouds','Nét mây',turquoise);
  const skyLight=a.swatch('sky','highlights','Vệt sáng',tint(ivory,.45));
  const moon=a.swatch('sky','moon','Mặt trăng',ivory);

  const waterBase=a.swatch('water','surface','Nền mặt nước',turquoise);
  const ripples=a.swatch('water','ripples','Nét gợn nước',turquoise);
  const moonReflection=a.swatch('water','moonlight','Bóng trăng',tint(ivory,.53));
  const goldReflection=a.swatch('water','gold-reflection','Bóng đèn vàng',gold);
  const redReflection=a.swatch('water','red-reflection','Bóng đèn đỏ',red);

  const walls=a.swatch('architecture','walls','Tường nhà',gold);
  const roofs=a.swatch('architecture','roofs','Mái ngói','#795d4c');
  const trim=a.swatch('architecture','trim','Viền mái',ivory);
  const timber=a.swatch('architecture','timber','Gỗ cầu và cửa','#976445');
  const stone=shadePair(a.swatch('architecture','stone','Đá xây','#b39279'),'#494854','#b39279');
  const quayTrim=linked(a.swatch('architecture','quay-trim','Viền bờ sông',ivory),ivory,.45);
  const windows=a.swatch('architecture','windows','Ánh cửa sổ',gold);
  const mullions=a.swatch('architecture','mullions','Thanh cửa xanh',turquoise);
  const lanternPaints=[
    ['lantern-red','Đèn lồng đỏ',red], ['lantern-gold','Đèn lồng vàng',gold],
    ['lantern-cream','Đèn lồng kem',ivory], ['lantern-orange','Đèn lồng cam','#da763e'],
  ].map(([id,label,color])=>linked(a.swatch('architecture',id,label,color),color,.30));
  const archWood=shadePair(timber,'#30252a','#976445');
  const archDark=shadePair(timber,'#151f23','#4e4140');
  const archCream=linked(trim,ivory,.45);
  const archTeal=linked(mullions,turquoise,.38);
  const tau=Math.PI*2;
  const height=(x:number,z:number)=>Math.abs(x+9)<1.9&&z>=-.9&&z<=9.2 ? .27+.52*Math.sin(Math.PI*(z+.9)/10.1) : z>-.65&&z<9 ? -.84 : .18;
  a.environment({background:skyBase(),eye:a.subject?[-4.95,2.05,2.67]:[11,5.6,15.6],look:a.subject?[-6.22,1.56,-1.36]:[-.7,2.55,-3.3],rider:false,height,terrainBounds:[-36,-26,38,25],
    route:[[-4,.2,-1.25],[-14,.2,-1.8],[-18,.2,-2.9],[-16,.2,-4.3],[-4,.2,-3.5],[8,.2,-2.8],[16,.2,-1.9],[8,.2,-1.1]],
    tour:[{eye:[10,5.6,15],look:[0,2.4,-4]},{eye:[-4,3.3,6],look:[-7,1.5,-2]},
      {eye:[-15,4,11],look:[-8,1,-2]},{eye:[0,2.3,-.3],look:[10,3,-6]}]});
  const rnd=(()=>{let s=a.seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;}})();
  const v=(q:V3)=>p(...q);
  const box=(l:Drawing['layer'],x:number,y:number,z:number,w:number,h:number,d:number,c:ReturnType<typeof set>,step=.25,emit=0)=>l.box(p(x,y,z),p(w,h,d),c,step,emit);
  function beam(l:Drawing['layer'],start:V3,end:V3,r:number,c:ReturnType<typeof set>,marks=100){
    const x=v(start),y=v(end),axis=y.clone().sub(x),quat=new T.Quaternion().setFromUnitVectors(p(0,1,0),axis.clone().normalize());
    l.oval(x.add(y).multiplyScalar(.5),p(r,axis.length()/2+r,r),c,marks,quat,.10);
  }
  function lantern(l:Drawing['layer'],x:number,y:number,z:number,r:number,silk:ReturnType<typeof set>,elong=.98){
    const top=y+r*elong;
    l.oval(p(x,y,z),p(r,r*elong,r),silk,Math.ceil(210+r*110),null,.88,.16);
    for(let k=0;k<10;k++){
      const angle=k*tau/10;
      for(let j=1;j<10;j++){
        const phi=Math.PI*j/10, sn=Math.sin(phi),cs=Math.cos(phi);
        const normal=p(Math.cos(angle)*sn,cs,Math.sin(angle)*sn).normalize();
        const dir=p(Math.cos(angle)*cs,-sn,Math.sin(angle)*cs).normalize();
        l.brush.stroke(p(x+(r+.009)*normal.x,y+(r*elong+.009)*cs,z+(r+.009)*normal.z),dir,normal,r*.38,.022,wood,.23);
      }
    }
    box(l,x,top,z,r*.62,.05,r*.56,wood,.09);
    box(l,x,y-r*elong,z,r*.62,.06,r*.56,wood,.09);
    beam(l,[x,y-r*elong,z],[x,y-r*elong-.24,z],.021,set(gold),40);
  }
  // Brushed sky, layered tree line, and a low moon.
  const skyLayer=a.layer(a.scene,104,'sky');
  const skyColors=[ink(skyBase(),clouds()),ink(skyBase(),clouds(tint(turquoise,.65))),ink(clouds(tint(turquoise,.67)),skyLight())];
  for(let i=0;i<54000;i++){
    const az=rnd()*tau, el=-.03+Math.pow(rnd(),1.7)*1.28, ce=Math.cos(el);
    const n=p(-Math.sin(az)*ce,-Math.sin(el),Math.cos(az)*ce);
    const pos=n.clone().multiplyScalar(-150);
    const bend=.18*Math.sin(az*5+el*12);
    const col=i%13===0&&el<.3?2:i%2;
    skyLayer.brush.stroke(pos,p(Math.cos(az),bend,Math.sin(az)),n,1.8+rnd()*4,.26+rnd()*1.1,skyColors[col],.60,0,1);
  }
  skyLayer.oval(p(-26,23,-99),p(4.8,4.8,3.6),ink(moon('#c88848'),moon()),2300,null,1);
  const silhouette=ink(night,tint(turquoise,.63));
  for(let i=0;i<47;i++){
    const x=-85+i*3.8,z=-40-rnd()*23,h=3+rnd()*8;
    skyLayer.oval(p(x,h*.24,z),p(6+rnd()*5,h,5+rnd()*3),silhouette,190);
  }
  skyLayer.finish('Bầu trời sơn dầu');

  const quay=a.layer(a.scene,44,'architecture');
  for(const [z0,z1] of [[-29,-.65],[9,29]]){
    quay.face(p(-42,.18,z1),p(84,0,0),p(0,0,z0-z1),stone,.48,.07,.62);
    box(quay,0,-.25,z0<0?-.65:9,84,.86,.25,stone,.26);
    for(let x=-40;x<41;x+=1.3)box(quay,x,.23,z0<0?-.77:9.1,1.24,.15,.43,quayTrim,.21,.08);
  }
  quay.finish('Bậc đá bến sông');
  a.entity({id:'river',kind:'Nước',name:'Sông Hoài',movable:false,position:[0,-.60,4.2],box:{center:[0,0,0],size:[58,.2,9.2]},
    fields:{flow:{kind:'number',label:'Tốc độ dòng nước',value:.92,min:0,max:4,step:.1},color:{kind:'color',label:'Màu mặt nước',value:turquoise}}},
    ({layer:l,values,random,onFrame})=>{
      const color=String(values.color), usesPalette=color===turquoise;
      const surface=usesPalette?linked(waterBase,turquoise,.20):set(color,.20);
      l.face(p(-42,0,5.3),p(84,0,0),p(0,0,-10.3),surface,.47,.32);
      const colors=[usesPalette?linked(ripples,turquoise,.38):set(color),ink(moonReflection(night),moonReflection()),
        linked(ripples,turquoise,.30),ink(goldReflection('#764132'),goldReflection()),ink(redReflection('#853d29'),redReflection())];
      for(let i=0;i<21000;i++){
        const x=(random()-.5)*80,z=(random()-.5)*10.4;
        const glow=Math.sin(x*1.30+z*.33)+Math.sin(x*.65-z*.37);
        const k=glow>1.13 && random()<.67 ? (i%3===0?4:3) : i%3;
        l.brush.stroke(p(x,.035+random()*.018,z),p(1,0,(random()-.5)*.24),p(0,1,0),.16+random()*.67,.035+random()*.11,colors[k],k>=3?.65:.35,1);
      }
      onFrame((_t,dt)=>{a.paint.flowTime.value+=dt*(Number(values.flow)-1)});
    });

  function shophouse(i:number,x:number,z:number,w:number,h:number){
    const d=3.9,rise=1.28;
    const facade=[gold,'#c98756','#e4b26d','#c39263','#e8be74'][i%5];
    a.entity({id:'house-'+(i+1),name:'Nhà phố '+(i+1),kind:'Kiến trúc',position:[x,.18,z],
      box:{center:[0,(h+rise*.55)/2,0],size:[w,h+rise*.55,d]},solid:true,
      fields:{wall:{kind:'color',label:'Màu vôi tường',value:facade},window:{kind:'color',label:'Màu cửa sổ',value:gold},
        light:{kind:'number',label:'Độ sáng đèn',value:.9,min:0,max:1,step:.05}}},
      ({layer:l,values,random})=>{
        const wall=String(values.wall), window=String(values.window), lit=Number(values.light);
        const plaster=wall===facade?linked(walls,facade,.34):set(wall,.34);
        const light=window===gold?linked(windows,gold,.23):set(window,.23);
        const front=d/2+.05, ridge=h+rise, roof=shadePair(roofs,'#202c34',i%2?'#667c76':'#795d4c');
        box(l,0,h/2,0,w,h,d,plaster,.205,.14);
        box(l,0,.16,front,w+.2,.32,.5,stone,.19);
        l.face(p(-w*.56,ridge,0),p(w*1.12,0,0),p(0,-rise,d*.63),roof,.18,.08);
        l.face(p(w*.56,ridge,0),p(-w*1.12,0,0),p(0,-rise,-d*.63),roof,.18,.08);
        for(let xx=-w*.56;xx<w*.56;xx+=.26)beam(l,[xx,ridge+.035,0],[xx,h+.035,d*.63],.046,roof,30);
        beam(l,[-w*.57,ridge+.06,0],[w*.57,ridge+.06,0],.115,archCream,160);
        for(const sg of [-1,1])beam(l,[sg*w*.46,ridge+.03,0],[sg*w*.59,ridge+.29,0],.075,archCream,36);
        box(l,0,h-.13,front,w+.26,.15,.21,archWood,.16);
        for(let k=-1;k<=1;k++){
          const xx=k*w*.287;
          box(l,xx,.97,front,w*.235,1.85,.10,archWood,.14);
          box(l,xx,1.02,front+.065,w*.167,1.42,.06,light,.11,lit);
          for(let b=-2;b<=2;b++)box(l,xx+b*w*.038,1.04,front+.12,.035,1.56,.035,archDark,.09);
          box(l,xx,1.18,front+.13,w*.204,.055,.045,archDark,.09);
        }
        if(h>3.65){
          for(const sg of [-1,1]){
            const xx=sg*w*.24; box(l,xx,h-.91,front+.03,w*.31,.96,.13,archDark,.13);
            box(l,xx,h-.91,front+.12,w*.21,.71,.07,light,.11,lit*.80);
            for(let j=-1;j<=1;j++)box(l,xx+j*w*.085,h-.91,front+.17,.037,.8,.04,archTeal,.07);
          }
          box(l,0,2.28,front+.26,w+.24,.16,.82,archWood,.15);
          beam(l,[-w*.51,2.84,front+.62],[w*.51,2.84,front+.62],.06,archWood,130);
          for(let j=0;j<16;j++)box(l,-w*.48+w*.96*j/15,2.57,front+.62,.05,.51,.05,archWood,.10);
        }
        for(const sg of [-1,1]){
          const xx=sg*w*.455;box(l,xx,h*.45,front+.28,.12,h*.9,.13,archWood,.13);
          lantern(l,xx,1.82+random()*.16,front+.46,.24,lanternPaints[i%2?0:1],1.12);
        }
      });
  }
  const row=[[-25,4.6,3.1],[-20,4.9,4.25],[-14.8,5.1,3.45],[-9.3,5.2,4.3],[-3.9,5.0,3.4],[1.4,5.35,4.55],[7,5.45,3.5],[12.5,5.3,4.12],[18.0,5.25,3.48],[23.6,5.45,4.1],[29.3,5,3.35]];
  row.forEach(([x,w,h],i)=>shophouse(i,x,-7.25-(i%3)*.17,w,h));
  const wire=a.layer(a.scene,719);
  for(let i=-2;i<=2;i++){
    const left=i*11.8-5.9;
    for(let j=0;j<6;j++){
      const xx=left+j*2,y=4.35-.79*Math.sin(j*Math.PI/6);
      beam(wire,[xx,y,-3.2],[xx+2,4.35-.79*Math.sin((j+1)*Math.PI/6),-3.2],.025,dark,30);
      lantern(wire,xx+.9,y-.38,-3.2,.21+.045*(j%2),lanternPaints[(j+6+i)%4],1.17);
    }
    box(wire,left,2.22,-3.2,.11,4.43,.11,wood,.19);
  }
  wire.finish('Dây đèn lụa');
  a.entity({id:'bridge',name:'Cầu gỗ',kind:'Kiến trúc',movable:false,position:[-9,0,0],box:{center:[0,.7,4.1],size:[3.8,1.6,10.7]}},({layer:l})=>{
    for(let i=0;i<37;i++){
      const z=-.98+i*.287,y=height(-9,z);
      box(l,0,y-.12,z,3.7,.24,.286,archWood,.15);
      if(i%4===0){for(const sign of [-1,1]){
        box(l,sign*1.76,y+.29,z,.11,1.05,.12,archDark,.12);
        if(i<36)beam(l,[sign*1.76,y+.78,z],[sign*1.76,height(-9,z+1.148)+.78,z+1.148],.065,archWood,52);
      }}
    }
  });

  for(const [i,x,z,size] of [[0,-3.2,1.1,1.06],[1,6.2,1.72,.83],[2,12.7,6.8,1]]){
    a.entity({id:'basket-'+i,name:'Thuyền thúng '+(i+1),kind:'Thuyền',position:[x,-.59,z],yaw:14+i*19,scale:size,
      box:{center:[0,.36,0],size:[2.65,.95,2.65]},fields:{reed:{kind:'color',label:'Màu nan tre',value:'#c59764'}}},({layer:l,values,onFrame,group})=>{
      const reeds=set(String(values.reed)), deep=ink('#312d2c','#8f6345'), n=50;
      const at=(k:number,v:number)=>{const t=k*tau/n, r=.63+.69*Math.sin(v*Math.PI*.54);return p(Math.cos(t)*r,.03+v*.83,Math.sin(t)*r)};
      for(let k=0;k<n;k++)for(let j=0;j<9;j++){
        const q=at(k,j/9),r=at(k+1,j/9),s=at(k+1,(j+1)/9),t=at(k,(j+1)/9);
        const norm=q.clone().setY(-.13).normalize();
        l.triangle(q,r,s,norm,reeds,.15); l.triangle(q,s,t,norm,reeds,.15);
        l.brush.stroke(q.clone().lerp(s,.5),r.clone().sub(q),norm,.22,.077,(k+j)%3?reeds:deep,.27);
        const inside=q.clone().multiplyScalar(.97);l.brush.stroke(inside,r.clone().sub(q),norm.clone().negate(),.18,.06,deep,.25);
        if(j===8)beam(l,at(k,1).toArray() as V3,at(k+1,1).toArray() as V3,.065,reeds,14);
      }
      l.oval(p(0,.18,0),p(.85,.1,.85),deep,330);
      box(l,0,.52,0,1.86,.10,.27,reeds,.12);
      beam(l,[-1.38,.19,1.12],[1,.98,-.57],.054,wood,150);
      onFrame(t=>{group.rotation.z=.032*Math.sin(t*1.1+i);group.position.y=.034*Math.sin(t+i)});
    });
  }
  if(a.subject){
    a.entity({id:'lantern-maker',role:'subject',name:'Người làm đèn',kind:'Nhân vật',position:[-6.25,.23,-1.35],yaw:19,scale:1.27,solid:true,
      box:{center:[0,.98,0],size:[.76,1.96,.53]},fields:{coat:{kind:'color',label:'Màu áo dài',value:red},lantern:{kind:'color',label:'Màu đèn',value:gold}}},
      ({layer:l,values})=>{
        const coat=set(String(values.coat),.33),lan=String(values.lantern);
        for(const s of [-1,1]){l.oval(p(s*.14,.09,.045),p(.10,.07,.18),dark,140);
          beam(l,[s*.145,.17,0],[s*.105,.84,0],.091,cream,180);}
        l.oval(p(0,.78,0),p(.30,.60,.185),coat,690,null,.12,.64);
        l.oval(p(0,1.27,0),p(.271,.365,.153),coat,640,null,.13,.76);
        l.oval(p(0,1.54,.008),p(.105,.13,.10),skin,190,null,.22);
        l.oval(p(0,1.53,.004),p(.123,.077,.119),coat,210);
        l.oval(p(0,1.73,-.064),p(.207,.248,.185),hair,540);
        l.oval(p(0,1.72,.051),p(.169,.203,.143),skin,550,null,.32);
        l.oval(p(0,1.885,.068),p(.169,.064,.142),hair,250);
        for(const s of [-1,1]){
          l.oval(p(s*.171,1.56,-.041),p(.052,.245,.116),hair,260);
          l.oval(p(s*.070,1.747,.186),p(.022,.012,.012),dark,42);
          beam(l,[s*.040,1.783,.182],[s*.105,1.79,.172],.008,hair,24);
          const hand:V3=[s<0?-.26:.01,s<0?1.28:1.02,.245];
          beam(l,[s*.212,1.43,0],[s*.31,1.14,.095],.079,coat,210);
          beam(l,[s*.31,1.14,.095],hand,.066,coat,145);
          l.oval(v(hand),p(.050,.062,.048),skin,125,null,.32);
        }
        l.oval(p(.006,1.715,.194),p(.025,.041,.025),skin,70,null,.38);
        l.oval(p(0,1.655,.183),p(.04,.012,.013),set('#b15142'),60);
        for(let i=0;i<5;i++)l.oval(p(.164+.035*Math.cos(i*tau/5),1.834+.035*Math.sin(i*tau/5),.066),p(.029,.030,.022),cream,48,null,.61);
        lantern(l,-.22,1.037,.275,.159,set(lan,.30),1.07);
        beam(l,[-.26,1.27,.23],[-.22,1.19,.275],.012,wood,24);
       });
  }
}
