import RAPIER from '@dimforge/rapier3d-compat';
import { clamp, point, mixNumber } from '../rendering/paint.js';
import { crossings, bridgeY, terrain, ground, terrainMeshData, landmark, trailLength, fallsZ, riverX, riverHalf } from '../scenes/starry-ride/land.js';

export const stepTime=1/60;
const radius=.42;
const halfHeight=.34;
const centerHeight=radius+halfHeight;
const contact=.038;
const gravity=15.6;
const launch=6.93;

function within(o,x,z,margin) {
  const ax=x-o.x, az=z-o.z;
  const cos=Math.cos(o.angle), sin=Math.sin(o.angle);
  return Math.abs(ax*cos-az*sin)<o.rx+margin && Math.abs(ax*sin+az*cos)<o.rz+margin;
}

function basicPhysics(solids, env) {
  const ground = env.ground;
  const [xmin,zmin,xmax,zmax] = env.bounds;
  const position=point();
  let grounded=true;
  function place(x,z) {
    position.set(x,ground(x,z),z);
    grounded=true;
  }
  function move(dx,dy,dz) {
    const nextX=clamp(position.x+dx,xmin,xmax);
    const nextZ=clamp(position.z+dz,zmin,zmax);
    const canEnter=(x,z)=>!solids.some(o=>position.y+Math.max(0,dy)<o.y+o.h-.016
      && position.y+1.48>o.y && within(o,x,z,radius));
    if(canEnter(nextX,position.z)) position.x=nextX;
    if(canEnter(position.x,nextZ)) position.z=nextZ;
    let floor=ground(position.x,position.z);
    for(const o of solids) {
      if(o.jumpable && position.y>=o.y+o.h-.012 && within(o,position.x,position.z,radius*.91)) {
        floor=Math.max(floor,o.y+o.h);
      }
    }
    const nextY=position.y+dy;
    grounded=nextY <= floor + (dy<=0 ? .095 : 0);
    position.y=grounded ? floor : nextY;
    return grounded;
  }
  return {name:'Built-in physics',solidCenter:o=>({x:o.x,y:o.y+o.h/2,z:o.z}),syncSolid() {},position,place,move,isGrounded:()=>grounded};
}

function rapierPhysics(solids, env) {
  const ground = env.ground;
  const [xmin,zmin,xmax,zmax] = env.bounds;
  const world=new RAPIER.World({x:0,y:-gravity,z:0});
  world.timestep=stepTime;
  function addSurface(data) {
    world.createCollider(RAPIER.ColliderDesc.trimesh(data.positions,data.indices));
  }
  addSurface(terrainMeshData(xmin-1,zmin-1,xmax+1,zmax+1,env.starry?222:80,env.starry?194:80,env.starry?terrain:ground));
  for(const b of env.starry ? crossings : []) {
    addSurface(terrainMeshData(b.x-b.half,b.z-b.width,b.x+b.half,b.z+b.width,82,8,x=>bridgeY(x,b)));
  }
  const handles = new Map();
  function syncSolid(o) {
    const old = handles.get(o);
    if(old) world.removeCollider(old, true);
    const shape = world.createCollider(RAPIER.ColliderDesc.cuboid(o.rx,o.h*.5,o.rz)
      .setTranslation(o.x,o.y+o.h*.5,o.z)
      .setRotation({x:0,y:Math.sin(o.angle/2),z:0,w:Math.cos(o.angle/2)}));
    handles.set(o, shape);
  }
  for(const o of solids) syncSolid(o);
  const body=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(-3,2,14));
  const collider=world.createCollider(RAPIER.ColliderDesc.capsule(halfHeight,radius),body);
  const controller=world.createCharacterController(contact);
  controller.enableSnapToGround(.28);
  controller.setMaxSlopeClimbAngle(Math.PI*.225);
  controller.setMinSlopeSlideAngle(Math.PI*.31);
  controller.setApplyImpulsesToDynamicBodies(false);
  const position=point();
  let grounded=true;
  function place(x,z) {
    const y=ground(x,z);
    body.setTranslation({x,y:y+centerHeight+contact+.007,z},true);
    world.step();
    position.set(x,y,z);
    grounded=true;
  }
  function move(dx,dy,dz) {
    const t=body.translation();
    const request={x:clamp(t.x+dx,xmin,xmax)-t.x,y:dy,z:clamp(t.z+dz,zmin,zmax)-t.z};
    controller.computeColliderMovement(collider,request);
    const actual=controller.computedMovement();
    body.setNextKinematicTranslation({x:t.x+actual.x,y:t.y+actual.y,z:t.z+actual.z});
    world.step();
    const p=body.translation();
    position.set(p.x,p.y-centerHeight-contact,p.z);
    grounded=controller.computedGrounded();
    return grounded;
  }
  return {name:'Rapier',solidCenter:o=>handles.get(o)?.translation(),syncSolid,position,place,move,isGrounded:()=>grounded};
}

export async function loadPhysics(solids,forceFallback,env) {
  try {
    if(forceFallback) throw new Error('Fallback requested');
    await RAPIER.init();
    return rapierPhysics(solids,env);
  } catch (error) {
    if(!forceFallback) console.warn('Rapier could not start. Using built-in physics.',error);
    return basicPhysics(solids,env);
  }
}

const deltaAngle=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));

export function createRide(physics,jumpables,notice,path,starry) {
  const trailLength = path.getLength();
  const landmark = (s, target = point()) => path.getPointAt(((s%trailLength+trailLength)%trailLength)/trailLength,target);
  const segments=Math.ceil(trailLength/.39);
  const segmentLength=trailLength/segments;
  const route=Array.from({length:segments},(_,i)=>landmark(i*segmentLength));
  function nearest(px,pz,previous=null) {
    let d2=Infinity;
    let along=0;
    const from=previous===null ? 0 : Math.floor(previous/segmentLength)-17;
    const to=previous===null ? segments : from+35;
    for(let i=from;i<to;i++) {
      const a=route[(i+segments)%segments];
      const b=route[(i+1+segments)%segments];
      const dx=b.x-a.x;
      const dz=b.z-a.z;
      const t=clamp(((px-a.x)*dx+(pz-a.z)*dz)/(dx*dx+dz*dz));
      const q=(a.x+t*dx-px)**2+(a.z+t*dz-pz)**2;
      if(q<d2) {d2=q; along=(i+t)*segmentLength;}
    }
    return (along+trailLength)%trailLength;
  }

  const p=physics.position;
  const aim=point();
  const target=point();
  const velocity=point();
  const counts={manual:0, resets:0, 'Fallen log':0,'Rail fence':0,'Stone wall':0};
  let heading=0;
  let previousSpeed=0;
  let speed=0;
  let distance=0;
  let yVel=0;
  let jumpBuffer=0;
  let time=0;
  let air=0;
  let auto=true;
  let lastJump=-10;
  let needsCatchUp=false;

  function place(s) {
    distance=(s+trailLength)%trailLength;
    landmark(distance,target);
    physics.place(target.x,target.z);
    const next=landmark(distance+.43);
    heading=Math.atan2(next.x-p.x,next.z-p.z);
    yVel=0;
    speed=0;
    previousSpeed=0;
    air=0;
    velocity.set(0,0,0);
    jumpBuffer=0;
    lastJump=-10;
    needsCatchUp=false;
  }
  function setAuto(enabled) {
    if(enabled && !auto) {
      distance=nearest(p.x,p.z);
      needsCatchUp=true;
    }
    auto=enabled;
  }
  function wantJump() { jumpBuffer=.142; }
  function tick(dt,manual,sprint) {
    time+=dt;
    let magnitude=manual.length();
    if(magnitude>.085) {
      auto=false;
      aim.copy(manual).divideScalar(magnitude);
      distance=nearest(p.x,p.z,distance);
    } else if(auto) {
      distance=nearest(p.x,p.z,distance);
      landmark(distance+(needsCatchUp ? .7 : 2.2+speed*.15),target);
      aim.set(target.x-p.x,0,target.z-p.z);
      if(aim.length()<2.4) needsCatchUp=false;
      aim.normalize();
      magnitude=1;
    } else {
      aim.set(0,0,0);
      magnitude=0;
    }
    const chosen=magnitude*(sprint ? 9.5 : auto ? 5.21 : 6.02);
    const goalHeading=aim.lengthSq()>.001 ? Math.atan2(aim.x,aim.z) : heading;
    if(aim.lengthSq()>.001) heading+=deltaAngle(heading,goalHeading)*(1-Math.exp(-dt*11.3));
    velocity.lerp(aim.multiplyScalar(chosen),1-Math.exp(-dt*(magnitude>.02 ? 7.3 : 9.1)));

    const grounded=physics.isGrounded();
    const autoJump=auto && grounded && time-lastJump>.84 && jumpables.find(o=>{
      const ahead=(o.s-distance+trailLength)%trailLength;
      return ahead>.04 && ahead<Math.max(1.12,.51*velocity.length()) && Math.hypot(p.x-o.x,p.z-o.z)<5.0;
    });
    if(grounded && (jumpBuffer>0 || autoJump)) {
      yVel=launch;
      lastJump=time;
      if(autoJump) {
        counts[autoJump.name] = (counts[autoJump.name] || 0) + 1;
        notice('Đã vượt ' + autoJump.name.toLowerCase());
      } else counts.manual++;
      jumpBuffer=0;
    }
    jumpBuffer=Math.max(0,jumpBuffer-dt);
    yVel-=gravity*dt;
    const oldX=p.x;
    const oldZ=p.z;
    const landed=physics.move(velocity.x*dt,yVel*dt,velocity.z*dt);
    if(landed && yVel<0) yVel=-.12;
    previousSpeed=speed;
    speed=mixNumber(speed,Math.hypot(p.x-oldX,p.z-oldZ)/dt,.21);
    air=mixNumber(air,landed ? 0 : 1,.24);
    if(starry && p.y<-.99 && p.z>fallsZ && Math.abs(p.x-riverX(p.z))<riverHalf(p.z)+.28) {
      place(nearest(oldX,oldZ) - 5.9);
      counts.resets++;
      notice('Đã quay về bờ sông');
    }
  }
  place(0);
  return {
    position:p, counts, nearest, place, tick, wantJump, setAuto,
    get state() { return {auto,heading, speed,previousSpeed,distance,yVel,air,time,grounded:physics.isGrounded()}; }
  };
}
