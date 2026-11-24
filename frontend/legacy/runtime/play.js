document.title = worldPlan.title + ' · Paint Atlas';
document.getElementById('world-title').textContent = worldPlan.title;
const params = new URLSearchParams(location.search);
const verifying = params.has('verify');
const mobile = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1 && innerWidth < 1050;
document.body.classList.toggle('mobile', mobile);
const guideButton = document.getElementById('guide'), tourButton = document.getElementById('tour');
const modeLabel = document.getElementById('mode'), hintLabel = document.getElementById('hint'), placeLabel = document.getElementById('place');
const controls = document.getElementById('controls');

const FT = 1/60, capsuleRadius=.44, capsuleHalf=.53, capsuleLift=capsuleRadius+capsuleHalf;
const start=pathAt(2.0);
const player={
  x:start.x,y:roadSurface(start.x,start.z)+.05,z:start.z,heading:-.64,
  vx:0,vy:0,vz:0,speed:0,grounded:true,gait:0,jumps:0,autoJumps:0
};
let physics=null, engine='initializing', routeS=2, journey=true, tour=false, jumpBuffer=0, jumpGuard=0;
let orbit=mobile?-.128:.056, pitch=.275, zoom=mobile?11.50:13.00;
let clock=0, tourTime=0, eye=null, target=null, tourStart=null, isReady=false, depthScale=1, frames=0, qaPaused=false;
let lastRoute=routeS, distanceTravelled=0;
const keys=new Set(), joystick={x:0,y:0};
const locations = isRiver
  ? [[0, 'Lối vào'], [22, 'Nhịp cầu'], [42, 'Ven sông'], [58, 'Đường trên đồi'], [140, 'Bờ bên kia']]
  : [[0, 'Lối vào'], [35, 'Đồng cỏ'], [68, 'Đường trên đồi'], [140, 'Khúc quanh']];
const tourShots = [
  [[-1,10,19],[-1,4.3,-28]],
  [[16,11,15],[20,6.1,-40]],
  [[25,12.2,-5],[32,6.3,-45]],
  [[32,13.0,-13],[37,6.3,-46]],
  [[22.7,15.1,-32],[1,7.5,-62]],
  [[-17,13.4,-37],[-16,7.4,-60]],
  [[-38,10.8,-10],[-15,5.6,-34]],
  [[-24,10,13],[-5,5,-24]],
  [[-8,8.2,21],[-3,4.5,-22]],
];
const tourPeriod=68;

function activeHint() {
  if(tour) return ['Tham quan toàn cảnh','Bấm Tham quan để trở lại'];
  if(journey) return ['Đang đi theo đường mòn', mobile ? 'Dùng cần ảo để tự cưỡi' : 'Dùng WASD để tự cưỡi'];
  return ['Tự điều khiển', 'Bật Theo đường để trở lại lối mòn'];
}
function updateUI() {
  guideButton.setAttribute('aria-pressed',String(journey));
  tourButton.setAttribute('aria-pressed',String(tour));
  const [mode,hint]=activeHint();
  if(modeLabel.textContent!==mode) modeLabel.textContent=mode;
  if(hintLabel.textContent!==hint) hintLabel.textContent=hint;
  const name = locations.findLast(([s])=>s<=routeS)?.[1] || locations[0][1];
  if(placeLabel.textContent!==name) placeLabel.textContent=name;
}
function setTour(value) {
  if(tour===value) return;
  tour=value;
  if(tour) {
    tourTime=0;
    tourStart=eye?[eye.slice(),target.slice()]:null;
  }
  updateUI();
}
function setGuide(value) {
  journey=value;
  if(value) routeS=nearestRoute(player.x,player.z).s;
  updateUI();
}
function jump() { jumpBuffer=.17; if(tour) setTour(false); }

guideButton.addEventListener('click',e=>{if(tour)setTour(false);setGuide(!journey);if(e.detail)canvas.focus({preventScroll:true});});
tourButton.addEventListener('click',e=>{setTour(!tour);if(e.detail)canvas.focus({preventScroll:true});});
document.getElementById('help').addEventListener('click',()=>{ keys.clear(); controls.showModal(); });
const moveKeys = ['KeyW','KeyA','KeyS','KeyD'];
window.addEventListener('keydown',e=>{
  if(controls.open || e.target instanceof HTMLButtonElement && e.code==='Space') return;
  if(moveKeys.includes(e.code) || e.code.startsWith('Shift') || e.code==='Space') {
    keys.add(e.code);
    e.preventDefault();
    if(e.code==='Space'&&!e.repeat) jump();
  }
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>keys.clear());

const pointers=new Map();
let pinchDistance=0;
const pinchSize=()=>{
  const [a,b]=[...pointers.values()];
  return Math.hypot(a[0]-b[0],a[1]-b[1]);
};
canvas.addEventListener('pointerdown', e=>{
  if(e.pointerType==='mouse'&&e.button!==0) return;
  if(tour) setTour(false);
  canvas.focus({preventScroll:true});
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId,[e.clientX,e.clientY]);
  if(pointers.size>1) pinchDistance=pinchSize();
});
canvas.addEventListener('pointermove', e=>{
  const pos=pointers.get(e.pointerId);
  if(!pos) return;
  pointers.set(e.pointerId,[e.clientX,e.clientY]);
  if(pointers.size>1) {
    const d=pinchSize();
    if(d>12&&pinchDistance>12) zoom=clamp(zoom*pinchDistance/d,5.8,23);
    pinchDistance=d;
  } else {
    orbit-= (e.clientX-pos[0])*.0064;
    pitch=clamp(pitch+(e.clientY-pos[1])*.0048,.09,.88);
  }
});
for(const event of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(event,e=>{
  pointers.delete(e.pointerId);
  if(pointers.size<2) pinchDistance=0;
});
canvas.addEventListener('wheel',e=>{
  e.preventDefault();
  if(tour) setTour(false);
  zoom=clamp(zoom*Math.exp(clamp(e.deltaY,-160,160)*.0017),5.8,23);
},{passive:false});

const touchStick=document.getElementById('joystick');
let stickPointer=null;
function moveStick(e) {
  const r=touchStick.getBoundingClientRect(), dx=e.clientX-r.left-r.width*.5,dy=e.clientY-r.top-r.height*.5;
  const norm=Math.max(Math.hypot(dx,dy),37);
  joystick.x=dx/norm; joystick.y=dy/norm;
  touchStick.style.setProperty('--knob-x',joystick.x*31+'px');
  touchStick.style.setProperty('--knob-y',joystick.y*31+'px');
}
touchStick.addEventListener('pointerdown',e=>{
  if(stickPointer!==null) return;
  e.preventDefault();
  stickPointer=e.pointerId;
  touchStick.setPointerCapture(e.pointerId);
  moveStick(e);
});
touchStick.addEventListener('pointermove',e=>{if(stickPointer===e.pointerId)moveStick(e);});
for(const event of ['pointerup','pointercancel','lostpointercapture']) touchStick.addEventListener(event,e=>{
  if(stickPointer!==e.pointerId) return;
  stickPointer=null;
  joystick.x=joystick.y=0;
  touchStick.style.setProperty('--knob-x','0px');
  touchStick.style.setProperty('--knob-y','0px');
});
document.getElementById('jump').addEventListener('pointerdown',e=>{e.preventDefault();jump();});
document.getElementById('jump').addEventListener('click',e=>{if(e.detail===0)jump();});

function insideObstacle(o,x,z,margin) {
  const dx=x-o.x,dz=z-o.z,c=Math.cos(o.yaw),s=Math.sin(o.yaw);
  return Math.abs(dx*c-dz*s)<o.width*.5+margin && Math.abs(dx*s+dz*c)<o.depth*.5+margin;
}
function setupFallback() {
  physics=(dx,dy,dz)=>{
    const p=player, x=p.x,z=p.z, y=p.y+dy;
    let nx=clamp(x+dx,bounds.left,bounds.right),nz=clamp(z+dz,bounds.north,bounds.south);
    let height=roadSurface(nx,nz);
    const blocked=(x,z)=>colliders.some(o=>p.y+.14<o.y+o.height*.5 && p.y+1.85>o.y-o.height*.5 &&
      insideObstacle(o,x,z,capsuleRadius*.85) && !insideObstacle(o,p.x,p.z,capsuleRadius*.85));
    if(blocked(nx,nz)||height>p.y+.35) {
      if(blocked(nx,z)||roadSurface(nx,z)>p.y+.35) nx=x;
      if(blocked(nx,nz)||roadSurface(nx,nz)>p.y+.35) nz=z;
      height=roadSurface(nx,nz);
    }
    for(const o of colliders) {
      const top=o.y+o.height*.5;
      if(p.y>=top-.065 && insideObstacle(o,nx,nz,capsuleRadius*.70)) height=Math.max(height,top);
    }
    const grounded=dy<=0 && y<height+.08;
    return [nx,grounded?height+.025:y,nz,grounded];
  };
}
function rapierTerrain(R,world) {
  const vertices=[],indices=[], cols=113, rows=99;
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++) {
    const x=mix(bounds.left-1,bounds.right+1,i/(cols-1)),z=mix(bounds.north-1,bounds.south+1,j/(rows-1));
    vertices.push(x,ground(x,z),z);
    if(i<cols-1&&j<rows-1) {
      const a=j*cols+i,b=a+1,c=a+cols,d=c+1;
      indices.push(a,c,b,b,c,d);
    }
  }
  const addMesh=(v,t)=>world.createCollider(R.ColliderDesc.trimesh(new Float32Array(v),new Uint32Array(t)));
  addMesh(vertices,indices);
  for(const b of bridges) {
    const positions=[],triangles=[],n=49;
    for(let i=0;i<n;i++){
      const s=mix(-b.length,b.length,i/(n-1)),y=deckHeight(b,s);
      positions.push(...fromBridge(b,s,y,b.halfWidth),...fromBridge(b,s,y,-b.halfWidth));
      if(i<n-1) triangles.push(i*2,i*2+1,i*2+2,i*2+2,i*2+1,i*2+3);
    }
    addMesh(positions,triangles);
  }
}
async function initPhysics() {
  try {
    const R=window.__rideRapier;
    if(!R) throw new Error('Rapier script unavailable');
    await R.init();
    const world=new R.World({x:0,y:-16,z:0});
    rapierTerrain(R,world);
    for(const o of colliders) {
      const rotation={x:0,y:Math.sin(o.yaw*.5),z:0,w:Math.cos(o.yaw*.5)};
      world.createCollider(R.ColliderDesc.cuboid(o.width*.5,o.height*.5,o.depth*.5).setTranslation(o.x,o.y,o.z).setRotation(rotation));
    }
    const p=player;
    const body=world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x,p.y+capsuleLift+.014,p.z));
    const capsule=world.createCollider(R.ColliderDesc.capsule(capsuleHalf,capsuleRadius),body);
    const controller=world.createCharacterController(.024);
    controller.enableSnapToGround(.21);
    controller.enableAutostep(.27,.39,false);
    controller.setMaxSlopeClimbAngle(.86);
    controller.setMinSlopeSlideAngle(1.02);
    world.timestep=FT;
    world.step();
    physics=(dx,dy,dz)=>{
      dx=clamp(p.x+dx,bounds.left,bounds.right)-p.x;
      dz=clamp(p.z+dz,bounds.north,bounds.south)-p.z;
      controller.computeColliderMovement(capsule,{x:dx,y:dy,z:dz});
      const m=controller.computedMovement();
      const t=body.translation();
      body.setNextKinematicTranslation({x:t.x+m.x,y:t.y+m.y,z:t.z+m.z});
      world.step();
      const r=body.translation();
      return [r.x,r.y-capsuleLift,r.z,controller.computedGrounded() && dy<=0];
    };
    physics.reset=()=>{
      body.setTranslation({x:p.x,y:p.y+capsuleLift,z:p.z},true);
      world.step();
    };
    engine='Rapier';
  } catch (error) {
    setupFallback();
    engine='built-in';
    console.warn('Rapier initialization failed. Using built-in movement physics.',error);
  }
}
function jumpAhead(p,vx,vz) {
  const speed=Math.hypot(vx,vz);
  if(speed<1.4) return false;
  const advance=(p.speed>3.8?p.speed:speed)*.43+.51;
  for(const o of hazards) {
    const dx=o.x-p.x,dz=o.z-p.z;
    if(dx*dx+dz*dz>23 || dx*vx+dz*vz<.6) continue;
    for(let k=0;k<4;k++) {
      const a=advance*(.59+.137*k)/speed;
      if(insideObstacle(o,p.x+vx*a,p.z+vz*a,.20)) return true;
    }
  }
  return false;
}
function simulate(dt) {
  clock+=dt;
  if(tour) tourTime+=dt;
  if(controls.open) return;
  const p=player;
  let lateral=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+joystick.x;
  let forward=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0)-joystick.y;
  const strength=clamp(Math.hypot(lateral,forward));
  const manual=strength>.085;
  if(tour&&manual)setTour(false);
  if(tour)return;
  const speed=keys.has('ShiftLeft')||keys.has('ShiftRight')?7.45:4.39;
  let vx=0,vz=0;
  if(manual) {
    if(journey)setGuide(false);
    const norm=Math.hypot(lateral,forward);
    lateral/=norm;forward/=norm;
    vx=(Math.cos(orbit)*lateral-Math.sin(orbit)*forward)*speed*strength;
    vz=(-Math.sin(orbit)*lateral-Math.cos(orbit)*forward)*speed*strength;
  }
  const closest=nearestRoute(p.x,p.z);
  routeS=closest.s;
  if(journey && !manual) {
    const aim=pathAt(routeS+2.72+ .07*speed);
    vx=aim.x-p.x;vz=aim.z-p.z;
    const n=Math.hypot(vx,vz)||1;
    vx=vx/n*speed;vz=vz/n*speed;
  }
  const a=1-Math.exp(-dt*(p.grounded?8.6:3.65));
  p.vx=mix(p.vx,vx,a);p.vz=mix(p.vz,vz,a);
  if(Math.hypot(vx,vz)>.30) {
    const wanted=Math.atan2(-vx,-vz);
    p.heading+=Math.atan2(Math.sin(wanted-p.heading),Math.cos(wanted-p.heading))*(1-Math.exp(-dt*6.15));
  }
  const auto=p.grounded&&journey&&jumpGuard<=0&&jumpAhead(p,vx,vz);
  if(p.grounded&&(jumpBuffer>0||auto)) {
    p.vy=7.15;
    p.grounded=false;
    jumpBuffer=0;
    jumpGuard=1.08;
    p.jumps++;
    if(auto)p.autoJumps++;
  } else {
    p.vy=p.grounded?-2.06:Math.max(-17,p.vy-16.4*dt);
  }
  jumpGuard=Math.max(0,jumpGuard-dt);
  jumpBuffer=Math.max(0,jumpBuffer-dt);
  const [x,y,z,grounded]=physics(p.vx*dt,p.vy*dt,p.vz*dt);
  const progress=Math.hypot(x-p.x,z-p.z);
  const v=progress/dt;
  distanceTravelled+=progress;
  p.speed=mix(p.speed,v,1-Math.exp(-dt*7.2));
  p.x=x;p.y=y;p.z=z;p.grounded=grounded;
  if(grounded&&p.vy<0)p.vy=0;
  if(y<-5) {
    const q=pathAt(routeS);
    Object.assign(p,{x:q.x,z:q.z,y:roadSurface(q.x,q.z)+.13,vy:0,vx:0,vz:0});
    physics.reset?.();
  }
  p.gait+=dt*(3.2+p.speed*1.71)*smooth(0,2,p.speed);
  if(Math.abs(routeS-lastRoute)>2.4) {lastRoute=routeS;updateUI();}
}

function splineCamera(t,part) {
  const n=tourShots.length, f=t*n, i=Math.floor(f), w=f-i;
  return [0,1,2].map(axis=>cat(
    tourShots[(i+n-1)%n][part][axis],tourShots[i%n][part][axis],
    tourShots[(i+1)%n][part][axis],tourShots[(i+2)%n][part][axis],w));
}
function updateCamera(dt) {
  let e,t;
  const p=player, sin=Math.sin(orbit),cos=Math.cos(orbit);
  if(tour){
    const q=(tourTime%tourPeriod)/tourPeriod;
    e=splineCamera(q,0); t=splineCamera(q,1);
    if(tourStart&&tourTime<2.7) {
      const a=smooth(0,2.7,tourTime);
      e=lerp3(tourStart[0],e,a);t=lerp3(tourStart[1],t,a);
    }
  } else {
    const level=roadSurface(p.x,p.z),height=mix(level,p.y,.38), h=Math.cos(pitch)*zoom;
    e=[p.x+sin*h,height+1.96+Math.sin(pitch)*zoom,p.z+cos*h];
    const forward=mobile?6.2:6.65;
    t=[p.x-sin*forward,height+4.33-(pitch-.275)*4.8,p.z-cos*forward];
    e[1]=Math.max(e[1],roadSurface(e[0],e[2])+1.32);
  }
  const a=1-Math.exp(-dt*(tour?3.15:8.5));
  eye=eye?lerp3(eye,e,a):e;
  target=target?lerp3(target,t,a):t;
}

const maxCanvas=gl.getParameter(gl.MAX_VIEWPORT_DIMS);
let frameAverage=16.7, badFrames=0, goodFrames=0, fittedDPR=1, pixelWidth=1, pixelHeight=1;
function fit() {
  const w=canvas.clientWidth,h=canvas.clientHeight;
  const dpr=window.devicePixelRatio||1;
  fittedDPR=Math.min(dpr*depthScale,maxCanvas[0]/w,maxCanvas[1]/h);
  pixelWidth=Math.max(1,Math.round(w*fittedDPR));pixelHeight=Math.max(1,Math.round(h*fittedDPR));
  if(canvas.width!==pixelWidth||canvas.height!==pixelHeight) {
    canvas.width=pixelWidth;canvas.height=pixelHeight;gl.viewport(0,0,pixelWidth,pixelHeight);
  }
}
function adapt(ms) {
  frameAverage=mix(frameAverage,clamp(ms,5,125),.063);
  if(frameAverage>28) {
    badFrames++;
    goodFrames=0;
    if(badFrames>=29&&depthScale>.48) {depthScale=Math.max(.48,depthScale*.86);badFrames=0;fit();}
  } else if(frameAverage<19) {
    badFrames=0;
    goodFrames++;
    if(goodFrames>=210&&depthScale<1) {depthScale=Math.min(1,depthScale/.90);goodFrames=0;fit();}
  } else {
    badFrames=Math.max(0,badFrames-1);
    goodFrames=0;
  }
}
function render() {
  fit();
  const fov=mobile&&pixelWidth/pixelHeight<.9?1.265:.872;
  const m=multiply(perspective(fov,pixelWidth/pixelHeight,.26,650),lookAt(eye,target));
  const planes=frustum(m);
  const lamp=pose(clock,player);
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.uniform1i(uniforms.uRig,0);
  gl.uniformMatrix4fv(uniforms.uVP,false,m);
  gl.uniform3fv(uniforms.uEye,eye);
  gl.uniform3fv(uniforms.uLamp,lamp);
  gl.uniform3fv(uniforms['uReflections[0]'],reflectedWindows);
  gl.uniform1f(uniforms.uTime,clock);
  gl.uniform1f(uniforms.uDensity, mobile ? .80 : 1);
  gl.uniform1f(uniforms.uMoonVisible, worldPlan.sky.moon ? 1 : 0);
  gl.uniform3fv(uniforms.uFog, pigments.sky[1].map(value => value / 255));
  drawCount=0;
  // Paint the deep sky first so the antialiased edges blend into the scenery behind them.
  for(const section of skySections) if(visible(section,planes)) section.draw();
  mountainBrushes.draw(planes);
  land.draw(planes);
  architecture.draw(planes);
  drawGrass(eye,planes);
  gl.uniform1i(uniforms.uRig,1);
  gl.uniformMatrix4fv(uniforms['uBones[0]'],false,bones);
  rotating.draw();
  riderPaint.draw();
  gl.depthMask(false);
  gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
  riderGlow.draw();
  gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(true);
  frames++;
}
let previous=0, accumulated=0;
function frame(now) {
  if(!isReady) return;
  requestAnimationFrame(frame);
  if(qaPaused) { previous=now; return; }
  const elapsed=previous?now-previous:16.7;
  previous=now;
  // Cap the accumulator so a backgrounded browser cannot advance the ride by minutes.
  const dt=Math.min(.12,elapsed/1000);
  accumulated+=dt;
  while(accumulated>=FT) {simulate(FT);accumulated-=FT;}
  updateCamera(dt);
  render();
  if(frames>4 && !document.hidden)adapt(elapsed);
}
function applyWorldPalette() {
  paintWith([azure, inkSky, cobalt, ultramarine, turquoise, jade], 'sky', .57);
  for (const tones of ridgePalettes) paintWith(tones, 'sky', .28);
  paintWith([...meadow, ...orchard, ...banks], 'land');
  paintWith(roadCoats, 'path');
  paintWith(plaster, 'walls');
  paintWith([...slate, ...clay], 'roof');
  paintWith([...cypress, ...foliage], 'foliage');
  paintWith([...waterCoats, ...waterShine, ...cascade], 'water', .55);
  paintWith([...gilded, ...starGold, ...amber], 'light', .68);
}

function boot() {
  try {
    applyWorldPalette();
    rand = seeded(worldSeed(66381));
    for (const row of cottages) house(...row);
    if (church) chapel();
    windmills.forEach((w, i) => windmill(...w, i));
    bridges.forEach((bridge, i) => buildBridge(bridge, i === 0));
    for (const pos of lanterns) lampPost(...pos);
    if (worldPlan.obstacles) {
      barrier(12.1, 'fence');
      barrier(52.7, 'log');
      barrier(88.1, 'wall');
    }
    buildTrees();
    buildTerrain();
    buildCrops();
    if (isRiver) buildWater();
    if (worldPlan.waterfall) buildWaterfall();
    if (worldPlan.mountains) buildMountains();
    rotating.upload();
    buildSky();
    buildRider();
    architecture.upload();
    mountainBrushes.upload();
    land.upload();
    setupFallback();
    updateCamera(FT);
    render();
    isReady=true;
    loading.classList.add('finished');
    updateUI();
    if(verifying) installVerification();
    requestAnimationFrame(frame);
    initPhysics();
  } catch(error) {
    loading.innerHTML='<p>Không thể dựng cảnh trên thiết bị này.</p>';
    console.error(error);
  }
}
canvas.addEventListener('webglcontextlost',e=>{
  e.preventDefault();
  isReady=false;
  loading.classList.remove('finished');
  loading.innerHTML='<p>Đồ họa đã dừng. Tải lại trang để dựng lại cảnh.</p>';
});
requestAnimationFrame(()=>requestAnimationFrame(boot));

function installVerification() {
  qaPaused=true;
  window.__nightRide=Object.freeze({
    state:()=>({
      engine, mobile, guide:journey, tour, tourTime, camera:[...eye], target:[...target], zoom, orbit, pitch, width:canvas.width, height:canvas.height,
      scale:depthScale, deviceDPR:devicePixelRatio, density:mobile?.80:1, bakedStrokes, drawCount, frames,
      grassCells:grassCache.size, clock, routeS, trailLength, distanceTravelled, player:{...player},
      hazards:hazards.map(o=>({type:o.kind,x:o.x,z:o.z,s:nearestRoute(o.x,o.z).s})),
      terrain:worldPlan.terrain, objects:worldPlan.objects,
      techniques:{bristles:13, drawType:'instanced quads', mountainLayers:worldPlan.mountains ? 3 : 0}, glError:gl.getError()
    }),
    advance:(seconds,draw=true)=>{
      for(let i=0;i<Math.round(seconds/FT);i++)simulate(FT);
      updateCamera(Math.min(seconds,.8)||FT);
      if(draw)render();
    },
    draw:()=>render(),
    resume:()=>{qaPaused=false;},
    pause:()=>{qaPaused=true;},
    placeAt:s=>{
      const point=pathAt(s);
      Object.assign(player,{x:point.x,z:point.z,y:roadSurface(point.x,point.z)+.045,vx:0,vy:0,vz:0,grounded:true,speed:0});
      routeS=s;
      jumpGuard=0;
      physics.reset?.();
      eye=target=null;
      updateCamera(FT);
      updateUI();
    },
    adapt:(ms,count)=>{for(let i=0;i<count;i++)adapt(ms);},
    shot:(x,y,z,tx,ty,tz)=>{
      eye=[x,y,z];target=[tx,ty,tz];render();
    }
  });
}
