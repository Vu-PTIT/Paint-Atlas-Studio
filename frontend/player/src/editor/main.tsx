import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDownToLine, Box, Camera, Check, ChevronDown, Focus, Hand, Layers3, Move, Orbit, Paintbrush, Palette, PersonStanding, Play, Redo2, RotateCw, Scaling, SlidersHorizontal, Sparkles, Trees, Undo2, Waves, X } from 'lucide-react';
import { Controller } from '../core/controller';
import { copy, sceneColorGroups, scenePaletteId } from '../core/world';
import type { Entry } from '../core/world';
import type { ColorGroup, ObjectState } from '../core/api';

const app=new Controller();
function NumberBox({value,onCommit,label,step=.1,min,max}:{value:number;onCommit:(v:number)=>void;label:string;step?:number;min?:number;max?:number}){
  const [text,setText]=useState(String(+value.toFixed(3)));
  useEffect(()=>setText(String(+value.toFixed(3))),[value]);
  const commit=()=>{
    const n=Number(text);
    if(!text.trim()||!Number.isFinite(n)||(min!==undefined&&n<min)||(max!==undefined&&n>max)){setText(String(+value.toFixed(3)));return;}
    if(n!==value)onCommit(n);
  };
  return <input type="number" aria-label={label} value={text} step={step} min={min} max={max} onChange={e=>setText(e.target.value)}
    onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();if(e.key==='Escape'){setText(String(value));e.currentTarget.blur()}}}/>;
}
function ScenePalette({entry}: {entry:Entry}) {
  const [selected, setSelected]=useState<ColorGroup>('sky');
  const fields=Object.entries(entry.spec.fields ?? {});
  const groups=(Object.keys(sceneColorGroups) as ColorGroup[]).filter(group=>
    fields.some(([key])=>key===group || key.startsWith(group+'.')));
  const group=groups.includes(selected) ? selected : groups[0];
  const swatches=fields.filter(([key])=>key.startsWith(group+'.'));
  const legacy=fields.find(([key])=>key===group);
  const groupFields=legacy ? [...swatches, legacy] : swatches;
  const edited=groupFields.some(([key,field])=>entry.state.values[key]!==field.value);

  function setValues(values:ObjectState['values']) {
    app.change(entry.spec.id,{...entry.state,values:{...entry.state.values,...values}});
  }

  function colorInput([key,field]: typeof fields[number]) {
    return <label className="param" key={key}>
      {field.label}
      <input type="color" aria-label={field.label} value={String(entry.state.values[key])}
        onChange={event=>setValues({[key]:event.currentTarget.value})}/>
    </label>;
  }

  return <aside className="panel properties palette-inspector" aria-label="Bảng màu cảnh">
    <div className="panel-title"><Palette size={15}/> Bảng màu cảnh</div>
    <div className="palette-groups" role="group" aria-label="Khu vực trong cảnh">
      {groups.map(key=><button key={key} aria-pressed={key===group} onClick={()=>setSelected(key)}>{sceneColorGroups[key]}</button>)}
    </div>
    {swatches.map(colorInput)}
    {legacy && (!swatches.length || entry.state.values[group]!==legacy[1].value) && colorInput(legacy)}
    <button className="subbutton" disabled={!edited}
      onClick={()=>setValues(Object.fromEntries(groupFields.map(([key,field])=>[key,field.value])))}>Khôi phục màu gốc</button>
  </aside>;
}

function Inspector(){
  const e=app.entry;
  if(!e)return <aside className="panel properties"><p>Chọn vật thể trong cảnh.</p></aside>;
  if(e.spec.id===scenePaletteId)return <ScenePalette entry={e}/>;
  const change=(fn:(s:ObjectState)=>void)=>{const next=copy(e.state);fn(next);app.change(e.spec.id,next)};
  return <aside className="panel properties" aria-label="Thuộc tính vật thể">
    <div className="panel-title"><SlidersHorizontal size={15}/> Thuộc tính</div>
    <h2>{e.spec.name}</h2><small>{e.spec.kind||'Vật thể'}</small>
    {e.spec.movable!==false&&<><div className="fieldname">Vị trí <i>m</i></div><div className="axis-row">{['X','Y','Z'].map((axis,i)=><label key={axis}><span>{axis}</span><NumberBox label={'Vị trí '+axis} value={e.state.position[i]} min={-5000} max={5000} onCommit={v=>change(s=>{s.position[i]=v})}/></label>)}</div>
    <label className="param">Góc xoay Y <NumberBox label="Góc xoay Y" step={5} value={e.state.yaw} onCommit={v=>change(s=>{s.yaw=v})}/></label>
    <label className="param">Tỷ lệ <NumberBox label="Tỷ lệ" min={.05} max={30} step={.05} value={e.state.scale} onCommit={v=>change(s=>{s.scale=v})}/></label></>}
    {Object.entries(e.spec.fields||{}).map(([key,f])=><label className="param" key={key}>{f.label}{f.kind==='color'?
      <input type="color" aria-label={f.label} value={String(e.state.values[key])} onChange={ev=>change(s=>{s.values[key]=ev.target.value})}/>:
      <NumberBox label={f.label} value={Number(e.state.values[key])} min={f.min} max={f.max} step={f.step} onCommit={v=>change(s=>{s.values[key]=v})}/>}</label>)}
    <button className="subbutton" onClick={()=>app.focus()}><Focus size={15}/> Đưa vào tâm nhìn</button>
  </aside>;
}
function Joystick(){
  const [stick,setStick]=useState([0,0]);
  const move=(el:HTMLElement,x:number,y:number)=>{
    const b=el.getBoundingClientRect(),r=b.width*.35;
    app.joystick.set((x-b.left-b.width/2)/r,(y-b.top-b.height/2)/r).clampLength(0,1);
    setStick([app.joystick.x*r,app.joystick.y*r]);
  };
  const end=()=>{app.joystick.set(0,0);setStick([0,0])};
  useEffect(()=>end,[]);
  return <div className="touchpad"><div className="joy" role="group" aria-label="Cần di chuyển" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);move(e.currentTarget,e.clientX,e.clientY)}}
    onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))move(e.currentTarget,e.clientX,e.clientY)}} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
    <span style={{transform:'translate('+stick[0]+'px,'+stick[1]+'px)'}}/></div><button className="jump" onPointerDown={e=>{if(e.isPrimary)app.jump()}} onClick={e=>{if(e.detail===0)app.jump()}}>Nhảy</button></div>;
}
const ico=(kind?:string)=>kind==='Cây'?Trees:kind==='Nước'?Waves:kind==='Nhân vật'?PersonStanding:Box;
function Player(){
  useSyncExternalStore(app.listen,app.snapshot);
  const [mobile,setMobile]=useState<'list'|'props'|''>('');
  const [help,setHelp]=useState(false);
  const [filter,setFilter]=useState('');
  if(app.error)return <div className="load"><Paintbrush/><h2>Chưa mở được cảnh</h2><p role="alert">{app.error}</p><button onClick={()=>{const u=new URL(location.href);u.searchParams.set('backend','webgl');location.replace(u)}}>Mở bằng WebGL2</button></div>;
  if(!app.ready)return <div className="load"><i className="spin"><Orbit size={35}/></i><h2>{app.meta.title}</h2><p>{app.stage}…</p></div>;
  const edit=app.mode==='edit';
  const mobileClass=mobile?' show-'+mobile:'';
  const objects=[...app.world.objects].filter(([id])=>id!==scenePaletteId);
  const palette=app.world.objects.has(scenePaletteId);
  const openPalette=()=>{app.select(scenePaletteId);setMobile('props')};
  return <div className={'hud '+(edit?'editing':'playing')+mobileClass}>
    <header className="bar"><div className="wordmark"><i><Paintbrush size={16}/></i><strong>Paint Atlas</strong><span>Studio</span></div>
      <div className="switch"><button className={!edit?'on':''} aria-pressed={!edit} onClick={()=>app.switchMode('play')}><Play size={14}/> Chơi</button><button className={edit?'on':''} aria-pressed={edit} onClick={()=>app.switchMode('edit')}><SlidersHorizontal size={14}/> Chỉnh sửa</button></div>
      <button className="export" onClick={()=>app.save()}><ArrowDownToLine size={15}/><span>Xuất HTML</span></button>
    </header>
    {edit?<><aside className="panel objects"><div className="panel-title"><Layers3 size={15}/> Vật thể <b>{objects.length}</b></div>
      {palette&&<button className="subbutton scene-palette" aria-pressed={app.selected===scenePaletteId} onClick={openPalette}><Palette size={15}/> Bảng màu cảnh</button>}
      <input className="filter" aria-label="Lọc vật thể" placeholder="Tìm vật thể…" value={filter} onChange={e=>setFilter(e.target.value)}/>
      <div className="object-list">{objects.filter(([,e])=>e.spec.name.toLocaleLowerCase('vi').includes(filter.toLocaleLowerCase('vi'))).map(([id,e])=>{
        const Icon=ico(e.spec.kind);
        return <button key={id} aria-pressed={app.selected===id} className={app.selected===id?'selected':''} onClick={()=>{app.select(id);setMobile('props')}} onDoubleClick={()=>app.focus()}><Icon size={15}/><span>{e.spec.name}</span></button>})}</div>
      </aside><Inspector/><div className="tools">{([[Move,'translate','Di chuyển'],[RotateCw,'rotate','Xoay'],[Scaling,'scale','Đổi kích thước']] as const).map(([Icon,tool,label])=>
        <button aria-label={label} title={label} className={app.tool===tool?'on':''} key={tool} onClick={()=>app.setTool(tool)}><Icon size={17}/></button>)}
        <i/><button aria-label="Hoàn tác" title="Hoàn tác" disabled={!app.undoCount} onClick={()=>app.undo()}><Undo2 size={17}/></button><button aria-label="Làm lại" title="Làm lại" disabled={!app.redoCount} onClick={()=>app.redo()}><Redo2 size={17}/></button></div>
      <div className="mobile-tabs"><button onClick={()=>setMobile(mobile==='list'?'':'list')}><Layers3 size={15}/> Vật thể</button><button onClick={()=>setMobile(mobile==='props'?'':'props')}><SlidersHorizontal size={15}/> Thuộc tính</button></div></>:
      <><div className="location"><small><span/> {app.tour?'THAM QUAN':app.auto?'ĐANG THEO TUYẾN':'DI CHUYỂN TỰ DO'}</small><h1>{app.meta.title}</h1></div>
      <div className="travel"><button aria-pressed={app.auto} onClick={()=>app.follow()}><Orbit size={16}/>{app.auto?'Theo tuyến':'Tự do'}</button><button aria-pressed={app.tour} onClick={()=>app.setTour()}><Camera size={16}/>Toàn cảnh</button><button aria-label="Cách điều khiển" onClick={()=>setHelp(!help)}><Hand size={16}/></button></div>
      <Joystick/></>}
    {help&&!edit&&<div className="help"><button onClick={()=>setHelp(false)} aria-label="Đóng"><X size={15}/></button><strong>Điều khiển</strong><p>WASD di chuyển · Shift chạy nhanh · Space nhảy</p><p>Kéo để xoay · Cuộn hoặc chụm hai ngón để zoom</p></div>}
    {app.message&&<div className="toast" role="status"><Check size={14}/>{app.message}</div>}
  </div>;
}
createRoot(document.getElementById('ui')!).render(<Player/>);
void app.start();
