function barrier(s, kind) {
  const p = pathAt(s), before = pathAt(s-.35), after = pathAt(s+.35);
  const tangent = unit([after.x-before.x,0,after.z-before.z]);
  const side = [-tangent[2],0,tangent[0]];
  const h = kind === 'fence' ? .92 : kind === 'wall' ? .82 : .69;
  const width = kind === 'wall' ? 3.44 : 3.65;
  const y = ground(p.x,p.z);
  const q = (d,v,off=0) => [p.x+side[0]*d+tangent[0]*off,y+v,p.z+side[2]*d+tangent[2]*off];
  const yaw = Math.atan2(-side[2],side[0]);
  obstruction(p.x,p.z,y+h*.48,width,h+.05,kind==='wall'?.75:.45,yaw,kind);
  if (kind === 'fence') {
    for (const side of [-1,1]) tube(architecture,q(side*width*.51,-.05),q(side*width*.51,.99),.102,.081,wood[2],{step:.075,style:BASE});
    for (const ht of [.38,.75]) {
      tube(architecture,q(-width*.55,ht-.065),q(width*.53,ht+.03),.078,.061,wood[2],{step:.107,style:BASE});
      paintedLine(architecture,q(-width*.50,ht+.023,.06),q(width*.50,ht+.089,.06),.025,stoneTrim,{style:BASE});
    }
  } else if (kind === 'wall') {
    for (let row=0;row<3;row++) for(let t=-width*.46;t<width*.49;t+=.48) {
      ellipsoid(architecture,q(t+spread(.22),.10+.235*row+spread(.13),spread(.23)),
        [.29 + rand()*.091,.13+rand()*.055,.24+rand()*.105],()=>pick(rock),{detail:95,style:BASE});
    }
  } else {
    const l=width*.54;
    tube(architecture,q(-l,.24,-.04),q(l,.312,.07),.305,.238,()=>pick(bark),{sides:24,step:.109,rough:.15,style:BASE});
    tube(architecture,q(.49,.48),q(.15,.87,.18),.093,.031,wood[1],{step:.06,style:BASE});
    for (let k=0;k<2;k++) {
      const end=q(k===0?-l-.014:l+.014,k===0?.24:.31,k===0?-.04:.07), normal=scale(side,k===0?-1:1);
      for(let i=0;i<80;i++) {
        const r=Math.sqrt(rand())*(k===0?.31:.241), angle=rand()*TAU;
        const pos=add(end,add(scale(tangent,Math.cos(angle)*r),scale(UP,Math.sin(angle)*r)));
        dab(architecture,pos,normal,add(scale(tangent,-Math.sin(angle)),scale(UP,Math.cos(angle))),.060,.028,
          Math.sin(r*65)>.2?pair(0x4c3730,0x9b7355):pair(0x614635,0xc19060),BASE);
      }
    }
  }
  return p;
}
function roadsideFence(x,z,dx,dz,count) {
  let previous;
  for (let i=0;i<=count;i++) {
    const px=x+dx*i,pz=z+dz*i, y=ground(px,pz), top=[px,y+.79+spread(.13),pz];
    tube(architecture,[px,y-.09,pz],top,.084,.065,wood[1],{step:.116,style:BASE});
    if (previous) for (const h of [.16,.44]) {
      tube(architecture,add(top,[0,-h,0]),add(previous,[0,-h+spread(.06),0]),.058,.051,wood[1],{step:.15,style:BASE});
    }
    previous=top;
  }
  obstruction(x+dx*count*.5,z+dz*count*.5,ground(x+dx*count*.5,z+dz*count*.5)+.36,Math.hypot(dx,dz)*count,.82,.21,Math.atan2(-dz,dx));
}
const cypress = [
  pair(0x111b22,0x274443),pair(0x111d22,0x34534b),pair(0x122627,0x395f53),pair(0x132428,0x2e5150),
  pair(0x16262b,0x467064),pair(0x101a24,0x22423c)
];
function tree(x,z,height,width,leans = 0) {
  const y=ground(x,z)-.065;
  tube(architecture,[x,y,z],[x+.12,y+height*.57,z-.08],width*.16,width*.095,bark[0],{step:.15,style:BASE});
  const midground = z > -67;
  for(let i=0;i<7;i++) {
    const t=i/7, v=[x+leans*t+ .22*Math.sin(6*t+x),y+height*(.28+t*.54),z+.12*Math.sin(7*t+z)];
    const w=width*(1.12-.81*t)*(1+spread(.23));
    ellipsoid(architecture,v,[w,height*(.31-.184*t),w*.84],
      (a,b,c) => cypress[(Math.floor(rand()*4)+Math.round(1+Math.sin(a*9+b*8+c*2)))%cypress.length],
      {detail: midground ? (i === 0 ? 75 : 43) : (i === 0 ? 40 : 23),dir:[.32+leans*.32,1,-.04],rough:.18,style:i<3?BASE:OBJECT});
  }
  obstruction(x,z,y+height*.41,width*1.14,height*.82,width*1.16);
}
function buildTrees() {
  rand = seeded(worldSeed(135751));
  for (const {x, z, scale} of pieces('cypress')) {
    tree(x, z, 8.0 * scale, .92 * scale, spread(1.0));
  }
}

const foliage = [
  pair(0x25391f,0x52684a),pair(0x132c27,0x47714f),pair(0x293923,0x687448),pair(0x203c32,0x508368),
  pair(0x1e302b,0x4a756a),pair(0x384334,0x77754b)
];
const petal = [pair(0x80703c,0xc5a84a),pair(0x79512b,0xdaab48),pair(0x695532,0xbdaa55),pair(0x996330,0xe6ba58),pair(0x896632,0xcfa153)];
const heart = [pair(0x352129,0x76513c),pair(0x3b2c26,0x806341),pair(0x483229,0x987747),pair(0x29252c,0x745343)];
const stalk = pair(0x243224,0x62714b);
function sunflower(x,z,sc) {
  const y=ground(x,z), sway=spread(.26)*sc;
  const stem=[x+sway,y+sc*.76,z-.073*sc], tip=[x+sway+.12*sc,y+sc*.95,z+.16*sc];
  paintedLine(land,[x,y-.018,z],stem,.028*sc,stalk,{style:PETAL,step:.14});
  paintedLine(land,stem,tip,.027*sc,stalk,{style:PETAL,step:.09});
  for(let j=0;j<4;j++) {
    const d=j&1?1:-1, t=.18+j*.145;
    const node=[x+sway*t,y+sc*t,z-.052*sc*t];
    const pos=add(node,[d*(.105+rand()*.15)*sc,.047*sc,spread(.45)*sc]);
    const v=sub(pos,node);
    dab(land,pos,unit([.16,.81,.56]),[v[0],-.15,v[2]+.16],.215*sc,.085*sc,pick(foliage),PETAL);
    dab(land,lerp3(node,pos,.85),[.11,.71,.55],v,.132*sc,.038*sc,pick(foliage),PETAL,.96);
  }
  // All heads bow toward the same compass direction with a small natural spread.
  const n=unit([.25+spread(.07),-.30+spread(.105),.93]);
  const e=unit(cross(UP,n)), f=cross(n,e), radius=(.108+rand()*.043)*sc;
  const cc=add(tip,scale(n,.046*sc)), turn=rand()*TAU;
  dab(land,cc,n,e,radius*1.08,radius*.99,heart[0],PETAL);
  for(let i=0;i<13;i++) {
    const a=turn+i*TAU/13+spread(.20), v = add(scale(e,Math.cos(a)),scale(f,Math.sin(a)));
    const droop = .009 * sc * (1+Math.sin(a));
    const p=add(cc,add(scale(v,radius*(1.21+rand()*.29)),[0,-droop,-.023*sc]));
    const color=pick(petal);
    dab(land,p,n,add(v,[0,-.19,0]),radius*(.62+rand()*.35),radius*.24,color,PETAL,.98);
    if(i%2===0) dab(land,add(p,scale(n,.013*sc)),n,v,radius*.56,radius*.102,pick(petal),PETAL,.96);
  }
  for(let i=0;i<12;i++) {
    const a=rand()*TAU, r=Math.sqrt(rand())*radius*.83;
    const p=add(cc,add(add(scale(e,Math.cos(a)*r),scale(f,Math.sin(a)*r)),scale(n,.015+rand()*.013)));
    dab(land,p,n,add(scale(e,.51),scale(f,.74)),radius*.32,radius*.153,pick(heart),PETAL);
  }
}
const wheat = [
  pair(0x4e3e35,0x9c8359),pair(0x6d5638,0xb3975a),pair(0x4d4836,0x9b8965),
  pair(0x55452e,0x968057),pair(0x72583d,0xc4a366),pair(0x695b3e,0xa99969)
];
function buildCrops() {
  rand=seeded(worldSeed(43012));
  for (const plot of flowerPlots) {
    for(let x=plot.x-plot.a;x<plot.x+plot.a;x+=.60) for(let z=plot.z-plot.b;z<plot.z+plot.b;z+=.65) {
      const xx=x+spread(.66), zz=z+spread(.73);
      if(!inPlot(xx,zz,plot)||roads(xx,zz)<.23||(isRiver&&Math.abs(zz-riverCenter(xx))<riverWidth(xx)+1.3)) continue;
      if(rand()<.115+.13*Math.sin(xx*1.04+zz*.40)) continue;
      sunflower(xx,zz,.84+rand()*.94);
    }
  }
  for (const plot of wheatPlots) {
    for (let x=plot.x-plot.a;x<plot.x+plot.a;x+=.305) for(let z=plot.z-plot.b;z<plot.z+plot.b;z+=.316) {
      const xx=x+spread(.55),zz=z+spread(.50);
      if(!inPlot(xx,zz,plot)||roads(xx,zz)<.12||(isRiver&&Math.abs(zz-riverCenter(xx))<riverWidth(xx)+.52)) continue;
      const y=ground(xx,zz), h=.36+rand()*.75, a=.22+Math.sin(xx*.86+zz*.22)*.30+spread(.17);
      const col=pick(wheat), n=unit([spread(.92),.35,.9]);
      dab(land,[xx+a*h*.5,y+h*.47,zz],n,[a,1,.07],h*.50,.025,col,PETAL,.95);
      for(let j=0;j<3;j++){
        const f=(j%2===0?1:-1)*(j===2?.32:1),t=.74+.103*j;
        dab(land,[xx+a*h*t+f*.038,y+t*h,zz+.03],n,[a+f*.35,1,.07],.106*h+.022,.035*h+.012,pick(wheat),PETAL,.97);
      }
    }
  }
}

const waterCoats = [
  pair(0x163146,0x285b75),pair(0x102744,0x245070),pair(0x172e4f,0x2c6786),pair(0x152f3d,0x306578),
  pair(0x1b3f56,0x32768a),pair(0x1b324d,0x2e5272)
];
const waterShine = [pair(0x255278,0x5697a6),pair(0x285d78,0x72a9b0),pair(0x244f6e,0x4d889b),pair(0x2b607e,0x84b7b6)];
const waterGold = [pair(0x605348,0xb6955a),pair(0x655743,0xe4b576),pair(0x493e46,0xa78463),pair(0x34657b,0x81b5b6)];
function buildWater() {
  rand=seeded(worldSeed(6168));
  for(let x=-86;x<87;x+=.72) {
    const z0=riverCenter(x), w=riverWidth(x);
    for(let z=z0-w-.3;z<z0+w+.3;z+=.62) {
      const xx=x+spread(.56),zz=z+spread(.59);
      if(ground(xx,zz)>waterLevel+.13) continue;
      flatDab(land,xx,waterLevel-.018+spread(.009),zz,.13+spread(.19),1.2+rand()*.55,.56+rand()*.2,pick(waterCoats),BASE,1,0);
      for(let i=0;i<5;i++) {
        const px=xx+spread(.73), pz=zz+spread(.66),sweep=.06+.10*Math.sin(px*.44+pz*.07)+spread(.12);
        const column= Math.exp(-(((px - 24 - (pz+29)*.49)/7.8)**2)) * .5 +
          Math.exp(-(((px-10)*.17)**2))*.42 + Math.exp(-(((px+21)*.18)**2))*.37;
        const glint=rand();
        const pal=glint<column*.55?waterGold:glint<.37+column*.44?waterShine:waterCoats;
        flatDab(land,px,waterLevel+.026+rand()*.052,pz,sweep,.19+rand()*.86,.030+rand()*.110,pick(pal),WATER,.71+rand()*.28,
          pal===waterGold?.20:0);
      }
    }
  }
}
const granite = [
  pair(0x172938,0x42687b),pair(0x19283c,0x4f6781),pair(0x263543,0x596d78),pair(0x1d3447,0x497f8d),
  pair(0x233348,0x4f617b),pair(0x1f2837,0x484b67),pair(0x2b4247,0x63877d)
];
const cascade = [
  pair(0x376f92,0x78b6c3),pair(0x447990,0x8ebdc1),pair(0x437a9d,0x94c9d0),
  pair(0x4d8aa6,0xb0d6cf),pair(0x2a527b,0x689db1),pair(0x6196ae,0xd3e1d3)
];
const fallSite = {x:32.7,z:-43.0,y:11.4};
function buildWaterfall() {
  rand=seeded(worldSeed(700945));
  const {x,z,y}=fallSite;
  for(let i=0;i<27;i++){
    const xx=x+(i/26-.5)*29.1, zz=z-4.0+spread(5.5);
    const h=6.2+6.2*Math.exp(-(((xx-x)/10.3)**2)) + spread(4.3);
    ellipsoid(architecture,[xx,h*.43-.34,zz],[1.33+rand()*2.84,h*.62,1.9+rand()*3.15],
      (a,b,c)=>granite[(Math.floor(rand()*4)+Math.floor((1+b)*4))%granite.length],
      {detail:21,dir:[-.33,1,-.14],rough:.23,style:BASE});
  }
  for(let i=0;i<15;i++) {
    const xx=x+spread(17),zz=z+spread(6.8)+.9,rr=.65+rand()*1.75;
    ellipsoid(architecture,[xx,ground(xx,zz)+rr*.24,zz],[rr,rr*.74,rr*.67],()=>pick(granite),{detail:64,rough:.18,style:BASE});
  }
  const sheet = (u,t) => [x+u*(3.12+t*1.13)+.14*Math.sin(t*14+u*4), y*(1-t)-.13+.21*Math.sin(u*6+t*4),
    z + .9 + 2.78*t+1.0*t*t + .43*Math.sin(u*3.6) + .29*Math.sin(u*7.3+t*4)];
  for(let i=0;i<111;i++) for(let j=0;j<127;j++) {
    const u=(i+.5+spread(.85))/111*2-1, t=(j+.5+spread(.98))/127;
    if(Math.abs(u)>.82+rand()*.22 || rand()<.06+.06*Math.cos(u*93)) continue;
    const p=sheet(u,t), next=sheet(u,t+.014);
    const streak=.54+.32*Math.sin(u*39+t*2)+.14*Math.sin(u*74+t*18);
    const color=cascade[Math.min(cascade.length-1,Math.floor(clamp(streak+spread(.57))*5.999))];
    dab(architecture,p,unit([.22*Math.cos(u*3.6),.18,.96]),sub(next,p),.14+rand()*.53,.035+rand()*.11,color,FALL,.81+rand()*.18,0,0);
  }
  for(let i=0;i<2900;i++) {
    const u=rand()*TAU,r=Math.sqrt(rand()), px=x+Math.cos(u)*r*6.25,pz=z+3.85+Math.sin(u)*r*4.7;
    const y=waterLevel+.04+(1-r)*1.48*rand()**3;
    if(ground(px,pz)>y+.7) continue;
    dab(architecture,[px,y,pz],i%4===0?Z:UP,[Math.cos(u),.12,Math.sin(u)],.10+rand()*.5,.029+rand()*.081,pick(cascade),i%4===0?FALL:WATER,.50+rand()*.45,0,0);
  }
  obstruction(x,z-4.5,5.25,26.0,10.9,6.2);
}
