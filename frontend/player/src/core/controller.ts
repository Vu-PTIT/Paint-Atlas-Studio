import * as T from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import build from 'atlas:scene';
import { createRide, loadPhysics, stepTime } from '../physics/motion.js';
import { createRider } from '../actors/rider.js';
import { World, copy, scenePaletteId, type Entry } from './world';
import { readData, downloadHTML } from './export';
import type { Meta, ObjectState, Snapshot, V3 } from './api';

type Action={id:string; before:ObjectState; after:ObjectState};
const rad=Math.PI/180;
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const vector=(p:V3)=>new T.Vector3(...p);
const frame=()=>new Promise<void>(ok=>requestAnimationFrame(()=>ok()));
export class Controller {
  meta=readData<Meta>('world-meta');
  world=new World(this.meta,matchMedia('(pointer:coarse)').matches?.82:1);
  canvas=document.getElementById('view') as HTMLCanvasElement;
  camera=new T.PerspectiveCamera(49,1,.20,900);
  renderer!:T.WebGPURenderer;
  orbit!:OrbitControls; gizmo!:TransformControls; outline?:T.BoxHelper;
  mode:'play'|'edit'='play'; selected=''; tool:'translate'|'rotate'|'scale'='translate';
  ready=false; error=''; stage='Khởi tạo đồ họa'; backend=''; physics=''; strokes=0; quality=1;
  version=0; tour=false; auto=true; message=''; joystick=new T.Vector2();
  private query=new URLSearchParams(location.search);
  private needsDraw=true;
  private listeners=new Set<()=>void>();
  private undoStack:Action[]=[]; private redoStack:Action[]=[];
  private dragStart:ObjectState|null=null;
  private ride!:ReturnType<typeof createRide>;
  private time=0; private yaw=-.29; private pitch=.28; private zoom=12.45; private interact=-20;
  private look=new T.Vector3(); private held=new Set<string>(); private lastMessage=0;
  private useInitial=true; private tourPhase=0; private tourEye?:T.CatmullRomCurve3; private tourLook?:T.CatmullRomCurve3;
  listen=(fn:()=>void)=>{this.listeners.add(fn);return ()=>{this.listeners.delete(fn);}};
  snapshot=()=>this.version;
  notify(){this.needsDraw=true;this.version++;this.listeners.forEach(fn=>fn())}
  get entry(){return this.world.objects.get(this.selected);}
  get undoCount(){return this.undoStack.length;}
  get redoCount(){return this.redoStack.length;}
  label(s:string){this.stage=s;this.notify()}
  notice=(s:string)=>{this.message=s;this.lastMessage=performance.now();this.notify()};
  private post(type:string,extra:Record<string,unknown>={}){
    if(parent!==window)parent.postMessage({app:'paint-atlas',type,session:location.hash.slice(1),...extra},'*');
  }
  save(){
    downloadHTML(this.meta,this.world.state()); this.notice('Đã xuất bản HTML');
  }
  private record(id:string,before:ObjectState,after:ObjectState){
    if(JSON.stringify(before)===JSON.stringify(after))return;
    this.undoStack.push({id,before:copy(before),after:copy(after)});
    if(this.undoStack.length>120)this.undoStack.shift();
    this.redoStack=[];
    this.changed();
  }
  private changed(){this.outline?.update();this.notify();this.post('change',{state:this.world.state()})}
  change(id:string,next:ObjectState){
    const entry=this.world.objects.get(id);if(!entry)return;
    const before=entry.state;
    if(this.world.apply(id,next))this.record(id,before,entry.state);
  }
  undo(){const a=this.undoStack.pop();if(a){this.world.apply(a.id,a.before);this.redoStack.push(a);this.select(a.id);this.changed()}}
  redo(){const a=this.redoStack.pop();if(a){this.world.apply(a.id,a.after);this.undoStack.push(a);this.select(a.id);this.changed()}}
  setTool(mode:Controller['tool']){
    this.tool=mode;this.gizmo.setMode(mode);
    this.gizmo.showX=mode==='translate';this.gizmo.showY=true;this.gizmo.showZ=mode==='translate';
    this.notify();
  }
  select(id:string){
    this.selected=id;
    this.gizmo.detach();this.outline?.removeFromParent();this.outline?.geometry.dispose();
    this.outline?.material.dispose(); this.outline=undefined;
    const e=this.entry;
    if(this.mode==='edit' && e){
      if(e.spec.movable!==false)this.gizmo.attach(e.pivot);
      if(e.proxy){
        this.outline=new T.BoxHelper(e.proxy,0xe9b676);
        this.outline.material.depthTest=false;this.outline.material.transparent=true;
        this.outline.material.opacity=.8;this.outline.renderOrder=20;this.world.scene.add(this.outline);
      }
    }
    this.notify();
  }
  focus(){
    const e=this.entry;if(!e || e.spec.id===scenePaletteId || this.mode!=='edit')return;
    const center=e.proxy?.getWorldPosition(new T.Vector3())??e.pivot.position.clone();
    const size=Math.max(...(e.spec.box?.size??[4,4,4]))*e.state.scale;
    const dir=this.camera.position.clone().sub(this.orbit.target).normalize();
    this.orbit.target.copy(center);this.camera.position.copy(center).addScaledVector(dir,clamp(size*2.1,3,45));this.orbit.update();
  }
  switchMode(mode:Controller['mode']){
    if(!this.ready||this.mode===mode)return;
    this.held.clear();this.joystick.set(0,0);this.tour=false;
    this.mode=mode;this.orbit.enabled=mode==='edit';
    if(mode==='edit'){
      this.orbit.target.copy(this.look);this.orbit.update();
      this.select(this.selected||this.world.objects.keys().next().value||'');
    }else {this.gizmo.detach();this.select(this.selected);this.useInitial=true;}
    this.notify();
  }
  setTour(){ if(this.mode==='edit')this.switchMode('play');this.tour=!this.tour;this.tourPhase=0;this.useInitial=false;this.notify()}
  follow(){this.useInitial=false;this.ride.setAuto(!this.ride.state.auto);this.auto=this.ride.state.auto;this.notify()}
  jump(){if(this.mode==='play')this.ride?.wantJump()}
  private inputs(){
    const pts=new Map<number,{x:number;y:number}>();
    let start={x:0,y:0}, draggedGizmo=false, multi=false;
    this.canvas.addEventListener('pointerdown',e=>{
      if(pts.size===0){start={x:e.clientX,y:e.clientY};draggedGizmo=this.gizmo.dragging||!!this.gizmo.axis;multi=false;}
      else multi=true;
      pts.set(e.pointerId,{x:e.clientX,y:e.clientY});if(this.mode==='play')this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener('pointermove',e=>{
      const prev=pts.get(e.pointerId);if(!prev)return;
      const other=[...pts].find(([id])=>id!==e.pointerId)?.[1];
      if(this.mode==='play'){
        if(other){
          const old=Math.hypot(prev.x-other.x,prev.y-other.y),n=Math.hypot(e.clientX-other.x,e.clientY-other.y);
          if(old>6&&n>6)this.zoom=clamp(this.zoom*old/n,3,38);
        }else{
          this.yaw-=(e.clientX-prev.x)*.006;this.pitch=clamp(this.pitch+(e.clientY-prev.y)*.004,.08,1.18);
        }
        this.tour=false;this.useInitial=false;this.interact=this.time;
      }
      pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    });
    this.canvas.addEventListener('pointerup',e=>{
      if(this.mode==='edit'&&e.button===0&&!multi&&!draggedGizmo&&!this.gizmo.dragging&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<5){
        const r=this.canvas.getBoundingClientRect(), ray=new T.Raycaster();
        ray.setFromCamera(new T.Vector2(2*(e.clientX-r.left)/r.width-1,1-2*(e.clientY-r.top)/r.height),this.camera);
        const hit=ray.intersectObjects(this.world.picking,false)[0];if(hit)this.select(hit.object.userData.entity);
      }
      pts.delete(e.pointerId);
    });
    this.canvas.addEventListener('pointercancel',e=>pts.delete(e.pointerId));
    this.canvas.addEventListener('wheel',e=>{
      if(this.mode==='play'){e.preventDefault();this.zoom=clamp(this.zoom*Math.exp(clamp(e.deltaY,-250,250)*.0014),3,38);this.useInitial=false;}
    },{passive:false});
    window.addEventListener('keydown',e=>{
      if((e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable=true]'))return;
      if(this.mode==='edit'){
        if((e.ctrlKey||e.metaKey)&&e.code==='KeyZ'){e.preventDefault();if(e.shiftKey)this.redo();else this.undo();}
        if(e.code==='KeyF')this.focus();
        if(e.code==='KeyG')this.setTool('translate');if(e.code==='KeyR')this.setTool('rotate');if(e.code==='KeyS'&&!e.ctrlKey)this.setTool('scale');
        return;
      }
      if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
      this.held.add(e.code);
      if(e.repeat)return;
      if(e.code==='Space')this.jump();if(e.code==='KeyT')this.setTour();if(e.code==='KeyP')this.follow();
    });
    window.addEventListener('keyup',e=>this.held.delete(e.code));
    window.addEventListener('blur',()=>{this.held.clear();this.joystick.set(0,0);pts.clear();});
  }
  private resize=()=>{
    const w=this.canvas.clientWidth,h=this.canvas.clientHeight;
    this.needsDraw=true;this.camera.aspect=w/Math.max(h,1);this.camera.fov=w/h<.80?66:49;this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(devicePixelRatio*this.quality);this.renderer.setSize(w,h,false);
  };
  private updateCamera(dt:number){
    const env=this.world.env, pos=this.ride.position,s=this.ride.state;
    const eye=new T.Vector3(),look=new T.Vector3();
    if(this.tour && this.tourEye && this.tourLook){
      this.tourPhase=(this.tourPhase+dt/36)%1;
      this.tourEye.getPoint(this.tourPhase,eye);this.tourLook.getPoint(this.tourPhase,look);
    }else if(this.useInitial&&this.time<(this.world.starry?1.2:6)){
      eye.fromArray(env.eye!);look.fromArray(env.look!);
    }else{
      if(s.auto && this.time-this.interact>5)this.yaw+=Math.atan2(Math.sin(s.heading+Math.PI-.14-this.yaw),Math.cos(s.heading+Math.PI-.14-this.yaw))*(1-Math.exp(-dt*1.13));
      const sin=Math.sin(this.yaw),cos=Math.cos(this.yaw),d=this.zoom*Math.cos(this.pitch),base=env.height!(pos.x,pos.z);
      eye.set(pos.x+sin*d,base+1.03+Math.sin(this.pitch)*this.zoom+(pos.y-base)*.27,pos.z+cos*d);
      eye.y=Math.max(eye.y,env.height!(eye.x,eye.z)+.65);
      look.set(pos.x-sin*3.6+cos*.6,base+(env.rider?3.92:1.6)+(pos.y-base)*.40,pos.z-cos*3.6-sin*.6);
    }
    const f=dt?1-Math.exp(-dt*8):1;this.camera.position.lerp(eye,f);this.look.lerp(look,f);this.camera.lookAt(this.look);this.camera.updateMatrixWorld();
  }
  async start(){
    const w=this.world,scene=w.scene;
    try{
      this.renderer=new T.WebGPURenderer({canvas:this.canvas,antialias:true,samples:4,outputBufferType:T.UnsignedByteType,forceWebGL:this.query.get('backend')==='webgl'});
      await this.renderer.init();this.backend=(this.renderer.backend as unknown as {isWebGPUBackend?:boolean}).isWebGPUBackend?'WebGPU':'WebGL2';
      this.resize();addEventListener('resize',this.resize);
      this.label('Đặt từng nét cọ');await frame();build(w.api);
      w.initializePalette();
      const state=readData<Snapshot>('world-state');
      for(const [id,s] of Object.entries(state))w.apply(id,s);
      const route=w.createRoute(),jumps=w.solids.filter(s=>s.jumpable);
      this.label('Chuẩn bị chuyển động');await frame();
      const ph=await loadPhysics(w.solids,this.query.get('physics')==='simple',{ground:w.env.height,bounds:w.env.terrainBounds,starry:w.starry});
      this.physics=ph.name;this.ride=createRide(ph,jumps,this.notice,route,w.starry);
      const updateSolid=(s:typeof w.solids[number])=>{ph.syncSolid(s);if(s.jumpable)s.s=this.ride.nearest(s.x,s.z)};
      w.onCollider=updateSolid;for(const s of jumps)s.s=this.ride.nearest(s.x,s.z);
      const actor=w.env.rider?createRider(scene,w.paint):null;
      const stops=w.env.tour??[
        {eye:w.env.eye!,look:w.env.look!},{eye:[-12,6,7] as V3,look:w.env.look!},{eye:[8,7,-11] as V3,look:w.env.look!}];
      if(stops.length>=3){
        this.tourEye=new T.CatmullRomCurve3(stops.map(s=>vector(s.eye)),true);
        this.tourLook=new T.CatmullRomCurve3(stops.map(s=>vector(s.look)),true);
      }
      this.orbit=new OrbitControls(this.camera,this.canvas);this.orbit.addEventListener('change',()=>{this.needsDraw=true});this.orbit.enabled=false;this.orbit.maxDistance=170;this.orbit.minDistance=.7;
      this.gizmo=new TransformControls(this.camera,this.canvas);scene.add(this.gizmo.getHelper());this.gizmo.size=.82;
      this.gizmo.addEventListener('mouseDown',()=>{if(this.entry)this.dragStart=copy(this.entry.state);this.orbit.enabled=false});
      this.gizmo.addEventListener('mouseUp',()=>{
        const e=this.entry,before=this.dragStart;this.dragStart=null;this.orbit.enabled=this.mode==='edit';
        if(!e||!before)return;
        const scale=clamp(this.tool==='scale'?e.pivot.scale.y:e.state.scale,.05,30);
        e.pivot.scale.setScalar(scale);
        const after={...e.state,position:e.pivot.position.toArray() as V3,yaw:e.pivot.rotation.y/rad,scale};
        if(w.apply(e.spec.id,after))this.record(e.spec.id,before,e.state);
      });
      this.gizmo.addEventListener('objectChange',()=>{this.needsDraw=true;this.outline?.update()});
      this.setTool('translate');this.inputs();this.updateCamera(0);
      this.meta.title=this.meta.title.trim()||'Paint Atlas';document.title=this.meta.title+' · Paint Atlas';
      scene.traverse(o=>{this.strokes+=o.userData.strokes||0});
      const moving=new T.Vector3(),grassFocus=new T.Vector3();
      const move=(dt:number)=>{
        const key=(...codes:string[])=>codes.some(c=>this.held.has(c))?1:0;
        const x=this.joystick.x+key('KeyD','ArrowRight')-key('KeyA','ArrowLeft');
        const f=-this.joystick.y+key('KeyW','ArrowUp')-key('KeyS','ArrowDown');
        const sn=Math.sin(this.yaw),cs=Math.cos(this.yaw);
        moving.set(cs*x-sn*f,0,-sn*x-cs*f);if(moving.lengthSq()>1)moving.normalize();
        if(moving.lengthSq()>.005)this.useInitial=false;
        this.ride.tick(dt,moving,!!key('ShiftLeft','ShiftRight'));
      };
      const draw=(dt:number)=>{
        this.time+=dt;w.paint.time.value=this.time;w.paint.flowTime.value+=dt*w.flow;w.animate(this.time,dt);
        const s=this.ride.state;
        if(this.mode==='play')this.updateCamera(dt);
        if(actor){actor.root.position.copy(this.ride.position);actor.root.rotation.y=s.heading;
          actor.animate(dt,s.speed,s.yVel,s.air,s.time,this.camera);actor.lantern.getWorldPosition(w.paint.lamp.value);}
        if(w.grass){this.camera.getWorldDirection(grassFocus);grassFocus.multiplyScalar(13).add(this.camera.position);w.grass(grassFocus);}
        if(this.auto!==s.auto){this.auto=s.auto;this.notify()}
        this.renderer.render(scene,this.camera);
      };
      draw(0);
      if(this.backend==='WebGPU'){
        try{
          const device=(this.renderer.backend as unknown as {device:{queue:{onSubmittedWorkDone:()=>Promise<void>}}}).device;
          await device.queue.onSubmittedWorkDone();
        }catch{
          const fallback=new URL(location.href);fallback.searchParams.set('backend','webgl');
          location.replace(fallback.href);return;
        }
      }
      this.ready=true;this.stage='';this.notify();document.body.dataset.status='ready';document.body.dataset.backend=this.backend;
      if(this.query.get('mode')==='edit')this.switchMode('edit');
      this.post('ready',{backend:this.backend,physics:this.physics,manifest:[...w.objects.values()].map(e=>e.spec)});
      let last=performance.now(),acc=0,span=0,frames=0,quick=0;
      const frozen=this.query.get('test')==='1';
      const run=(now:number)=>{
        requestAnimationFrame(run);
        if(document.hidden){last=now;return;}
        const wall=(now-last)/1000;last=now;
        if(frozen && this.mode==='play')return;
        if(this.mode==='edit' && !this.needsDraw)return;
        this.needsDraw=false;
        if(wall<=0)return;
        const dt=Math.min(wall,.18);
        if(this.mode==='play'){acc+=dt;while(acc>=stepTime){move(stepTime);acc-=stepTime;}}
        draw(this.mode==='play'?dt:0);
        if(this.mode==='edit')return;
        span+=wall;frames++;
        if(span>1.65){
          const rate=frames/span,before=this.quality;
          if(rate<36){this.quality=Math.max(.5,this.quality-.125);quick=0;}else if(rate>55 && ++quick>2){this.quality=Math.min(1,this.quality+.0625);quick=0;}
          if(before!==this.quality)this.resize();span=0;frames=0;
        }
        if(this.message && performance.now()-this.lastMessage>2600){this.message='';this.notify();}
      };
      requestAnimationFrame(run);
      if(frozen){
        Object.assign(window,{atlasProbe:{
          info:()=>({backend:this.backend,physics:this.physics,strokes:this.strokes,state:w.state(),solids:w.solids,counts:this.ride.counts,position:this.ride.position.toArray(),route:route.getLength(),mode:this.mode,tour:this.tour,auto:this.auto,camera:this.camera.position.toArray(),ride:this.ride.state,quality:this.quality,dpr:this.renderer.getPixelRatio(),zoom:this.zoom,yaw:this.yaw,colliderCenters:Object.fromEntries(w.solids.map(s=>[s.name,ph.solidCenter(s)]))}),
          advance:(seconds:number)=>{const steps=Math.max(0,Math.round(seconds/stepTime));for(let i=0;i<steps;i++)move(stepTime);draw(steps*stepTime);},
          shot:(eye:V3,look:V3)=>{this.camera.position.fromArray(eye);this.look.fromArray(look);this.camera.lookAt(this.look);this.camera.updateMatrixWorld();this.renderer.render(scene,this.camera);},
          manifest:()=>[...w.objects.values()].map(e=>e.spec)
        }});
      }
    }catch(err){this.error=err instanceof Error?err.message:String(err);this.stage='';this.notify();document.body.dataset.status='error';this.post('error',{error:this.error})}
  }
}
