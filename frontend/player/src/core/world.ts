import * as THREE from 'three/webgpu';
import * as TSL from 'three/tsl';
import { makePaint, PaintLayer, palette, point, random } from '../rendering/paint.js';
import { Swatch } from '../rendering/palette';
import { buildSky } from '../scenes/starry-ride/sky.js';
import { buildLand, makeGrass, ground, riverX, trail } from '../scenes/starry-ride/land.js';
import { buildVillage } from '../scenes/starry-ride/village.js';
import type { ColorGroup, Drawing, EntitySpec, Environment, Field, Meta, ObjectState, Snapshot, WorldAPI, V3, Values } from './api';

export interface Solid {x:number; y:number; z:number; rx:number; rz:number; h:number; angle:number; name:string; jumpable?:boolean; s:number}
export interface Entry {
  spec: EntitySpec; pivot: THREE.Group; group: THREE.Group; proxy?: THREE.Mesh;
  draw?: (ctx:Drawing)=>void; state: ObjectState; frames: ((t:number,dt:number)=>void)[]; solid?: Solid;
}
export const copy = <T,>(v:T):T => JSON.parse(JSON.stringify(v));
const toRad = Math.PI/180;
const good = (x:unknown,lo:number,hi:number):x is number => typeof x==='number' && Number.isFinite(x) && x>=lo && x<=hi;
export const scenePaletteId = '@scene-palette';
export const sceneColorGroups = {sky:'Trời', water:'Nước', architecture:'Kiến trúc'} as const;
const colorGroups = {
  sky: {index:0, fallback:'#263e46'},
  water: {index:1, fallback:'#24615f'},
  architecture: {index:3, fallback:'#a97c50'},
} as const;
const hexColor = /^#[0-9a-f]{6}$/i;
// The saved palette uses the same 80-field limit as other editable objects.
const maxSwatches=80-Object.keys(colorGroups).length;

export class World {
  scene=new THREE.Scene();
  paint=makePaint();
  objects=new Map<string,Entry>();
  solids:Solid[]=[];
  picking:THREE.Mesh[]=[];
  starry=false;
  flow=1;
  grass?: (focus:THREE.Vector3)=>number;
  onCollider?: (solid:Solid)=>void;
  env:Environment={eye:[7,5,14],look:[0,2,0],background:'#263e46',rider:false,
    route:[[-7,0,7],[-6,0,-5],[7,0,-5],[7,0,8]],height:()=>0,terrainBounds:[-65,-65,65,65]};
  api:WorldAPI;
  private groupPaints = new Map<ColorGroup, ReturnType<typeof makePaint>>();
  private swatches = new Map<string, Swatch>();
  private proxyMaterial=new THREE.MeshBasicMaterial({visible:false});
  constructor(public meta:Meta,public fraction:number){
    const api:WorldAPI={
      THREE,TSL,scene:this.scene,paint:this.paint,seed:meta.seed,fraction,palette:meta.palette,subject:meta.subject,
      point,colors:palette,layer:(parent,seed=meta.seed,group)=>new PaintLayer(parent,this.paintFor(group),random(seed),fraction),
      swatch:(group,id,label,color)=>this.registerSwatch(group,id,label,color).shade,
      environment:values=>Object.assign(this.env,values),
      entity:(spec,draw)=>this.add(spec,draw),
      starryRide:()=>{
        this.starry=true;
        this.env={background:'#162441',eye:[-6.8,4.95,25.2],look:[-1.8,4.05,9.5],rider:true,height:ground,
          terrainBounds:[-85,-80,85,63],tour:[
            {eye:[-15,11.3,24],look:[4,4,-25]},{eye:[8,9,7],look:[17,3.55,-27]},
            {eye:[32,7.1,-44],look:[29,3.6,-70]},{eye:[2,9.3,-45],look:[-9,3.7,-30]},
            {eye:[-22.4,11,-33],look:[-7,4.1,-27]},{eye:[-34.2,11,-3],look:[-11,3.8,-7]}]};
        const waterPaint=this.paintFor('water'), architecturePaint=this.paintFor('architecture');
        buildSky(this.scene,this.paintFor('sky'),fraction,api);
        buildLand(this.scene,this.paint,fraction,waterPaint,api);
        const v=buildVillage(this.scene,this.paint,fraction,api,waterPaint,architecturePaint);
        this.solids.push(...v.solids.map(o=>({...o,s:0,name:'Rive'})));
        this.grass=makeGrass(this.scene,this.paint,fraction);
        this.add({id:'river',name:'Dòng sông',kind:'Nước',position:[riverX(-28),-.58,-28],movable:false,
          box:{center:[0,0,0],size:[6,.35,12]},fields:{flow:{kind:'number',label:'Tốc độ nước',min:0,max:4,step:.1,value:1}}},
          ({values})=>{this.flow=Number(values.flow)});
      }
    };
    this.api=api;
  }
  private defaultColor(group:ColorGroup) {
    const {index,fallback}=colorGroups[group];
    return (this.meta.palette[index] ?? fallback).toLowerCase();
  }
  private registerSwatch(group:ColorGroup,id:string,label:string,color:string) {
    if (!Object.hasOwn(colorGroups,group) || !/^[a-z0-9-]{1,40}$/.test(id) || !label.trim() || !hexColor.test(color)) {
      throw Error('Ô màu cần nhóm hợp lệ, ID ổn định, tên và mã #RRGGBB.');
    }
    const key=`${group}.${id}`;
    const original=color.toLowerCase();
    const existing=this.swatches.get(key);
    if (existing) {
      if (existing.original!==original || existing.label!==label) throw Error('Ô màu khai báo trùng: '+key);
      return existing;
    }
    if (this.swatches.size>=maxSwatches) throw Error('Cảnh có quá nhiều ô màu.');
    if (this.objects.has(scenePaletteId)) throw Error('Khai báo ô màu trong hàm dựng cảnh: '+key);
    const swatch=new Swatch(label,original);
    this.swatches.set(key,swatch);
    return swatch;
  }
  private paintFor(group?:ColorGroup) {
    if (!group || !Object.hasOwn(colorGroups,group)) return this.paint;
    let paint=this.groupPaints.get(group);
    if (!paint) {
      paint=makePaint(this.paint,this.defaultColor(group));
      this.groupPaints.set(group,paint);
    }
    return paint;
  }
  initializePalette() {
    const source=this.env.background ?? colorGroups.sky.fallback;
    let background=source;
    if (typeof source==='string' && hexColor.test(source)) {
      const swatch=this.swatches.get('sky.background') ?? (this.swatches.size<maxSwatches
        ? this.registerSwatch('sky','background','Nền trời',source) : undefined);
      if (swatch) background=swatch.shade(source);
    }
    const skyColor=new THREE.Color(background);
    this.scene.background=skyColor;
    if (!this.objects.size) return;
    this.paintFor('sky');
    const fields:Record<string,Field>={};
    for (const group of Object.keys(colorGroups) as ColorGroup[]) {
      if (this.groupPaints.has(group)) {
        fields[group]={kind:'color', label:'Tông màu chung', value:this.defaultColor(group)};
      }
    }
    for (const [key,swatch] of this.swatches) {
      fields[key]={kind:'color',label:swatch.label,value:swatch.original};
    }
    this.add({id:scenePaletteId,name:'Bảng màu cảnh',movable:false,fields},({values})=>{
      for (const [key,swatch] of this.swatches) swatch.set(String(values[key]).toLowerCase());
      for (const [group,paint] of this.groupPaints) paint.setColor(String(values[group]??this.defaultColor(group)));
      const sky=String(values.sky);
      skyColor.set(sky.toLowerCase()===this.defaultColor('sky')?background:sky);
    },true);
  }
  createRoute(){
    if(this.starry) return trail;
    const points=this.env.route;
    if(!points || points.length<3 || points.some(p=>p.length!==3||!p.every(Number.isFinite))) throw Error('Tuyến di chuyển cần ít nhất ba điểm 3D.');
    const path=new THREE.CatmullRomCurve3(points.map(p=>point(...p)),true,'centripetal');
    if(path.getLength()<1) throw Error('Tuyến di chuyển quá ngắn.');
    return path;
  }
  private add(spec:EntitySpec,draw?:Entry['draw'],internal=false){
    if(!internal && (!/^[\w.-]{1,80}$/.test(spec.id)||this.objects.has(spec.id)||['__proto__','constructor','prototype'].includes(spec.id))) throw Error('ID vật thể trùng hoặc sai định dạng: '+spec.id);
    if(!internal && this.objects.size>=1200) throw Error('Cảnh có quá nhiều vật thể chỉnh riêng.');
    const pivot=new THREE.Group(), group=new THREE.Group();
    this.scene.add(pivot); pivot.add(group); pivot.name=spec.name;
    const values:Values=Object.fromEntries(Object.entries(spec.fields||{}).map(([k,v])=>[k,v.value]));
    const state:ObjectState={position:copy(spec.position||[0,0,0]),yaw:spec.yaw??0,scale:spec.scale??1,values};
    const e:Entry={spec,pivot,group,draw,state,frames:[]};
    this.objects.set(spec.id,e);
    if(spec.box){
      const proxy=new THREE.Mesh(new THREE.BoxGeometry(...spec.box.size),this.proxyMaterial);
      proxy.position.fromArray(spec.box.center); proxy.userData.entity=spec.id;
      pivot.add(proxy); this.picking.push(proxy); e.proxy=proxy;
    }
    if(spec.solid && spec.box){
      e.solid={x:0,y:0,z:0,h:1,rx:1,rz:1,angle:0,s:0,name:spec.name,jumpable:spec.jumpable};
      this.solids.push(e.solid);
    }
    this.transform(e); this.draw(e);
    return pivot;
  }
  private draw(e:Entry){
    e.group.traverse(obj=>{if(obj instanceof THREE.Mesh) obj.geometry?.dispose()});
    e.group.clear(); e.frames=[];
    let seed=this.meta.seed;
    for(const c of e.spec.id) seed=(Math.imul(seed,31)+c.charCodeAt(0))|0;
    const rng=random(seed);
    const group=e.spec.colorGroup ?? (e.spec.kind==='Nước'?'water':e.spec.kind==='Kiến trúc'?'architecture':undefined);
    const layer=new PaintLayer(e.group,this.paintFor(group),rng,this.fraction);
    e.draw?.({group:e.group,layer,values:e.state.values,random:rng,onFrame:fn=>e.frames.push(fn)});
    layer.finish(e.spec.name);
  }
  private transform(e:Entry){
    const s=e.state,box=e.spec.box;
    e.pivot.position.fromArray(s.position); e.pivot.rotation.y=s.yaw*toRad; e.pivot.scale.setScalar(s.scale);
    e.pivot.updateWorldMatrix(true,true);
    if(e.solid && box){
      const center=e.pivot.localToWorld(point(...box.center));
      const [w,h,d]=box.size.map(x=>x*s.scale);
      Object.assign(e.solid,{x:center.x,y:center.y-h/2,z:center.z,h,rx:w/2,rz:d/2,angle:e.pivot.rotation.y});
      this.onCollider?.(e.solid);
    }
  }
  apply(id:string,next:ObjectState){
    const e=this.objects.get(id);
    if(!e || !next || !Array.isArray(next.position) || next.position.length!==3 ||
       !next.position.every(x=>good(x,-5000,5000)) || !good(next.yaw,-36000,36000)||!good(next.scale,.05,30)) return false;
    const v:Values={};
    for(const [key,field] of Object.entries(e.spec.fields||{})){
      const value=next.values?.[key]??field.value;
      if(field.kind==='number' ? !good(value,field.min,field.max) : !(typeof value==='string' && hexColor.test(value))) return false;
      v[key]=value;
    }
    const redraw=JSON.stringify(e.state.values)!==JSON.stringify(v);
    const pose=e.spec.movable===false?e.state:next;
    const reposition=JSON.stringify(e.state.position)!==JSON.stringify(pose.position)||e.state.yaw!==pose.yaw||e.state.scale!==pose.scale;
    e.state={position:copy(pose.position) as V3,yaw:pose.yaw,scale:pose.scale,values:v};
    if(reposition)this.transform(e);
    if(redraw)this.draw(e);
    return true;
  }
  state():Snapshot { return Object.fromEntries([...this.objects].map(([id,e])=>[id,copy(e.state)])); }
  animate(time:number,dt:number){for(const e of this.objects.values())for(const update of e.frames)update(time,dt)}
}
