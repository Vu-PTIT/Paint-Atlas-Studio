import React,{useEffect,useRef,useState} from 'react';
import { ArrowLeft, ArrowRight, Check, Clipboard, Crop as CropIcon, Eye, ImagePlus, LoaderCircle, Palette, Save, Sparkles, UserRound, WandSparkles } from 'lucide-react';
import { api, uploadArtwork } from '../api/client';
import type { Crop, FullDraft, Job, Project } from '../api/types';
import { initial, samples } from '../draft';

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
function CropView({src,crop,onChange}:{src:string;crop:Crop;onChange:(c:Crop)=>void}){
 const start=useRef<[number,number]|null>(null);
 const pos=(e:React.PointerEvent<HTMLDivElement>)=>{const r=e.currentTarget.getBoundingClientRect();return [Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))] as const};
 const move=(e:React.PointerEvent<HTMLDivElement>)=>{
  if(!start.current)return;const [a,b]=start.current,[x,y]=pos(e);
  if(Math.abs(x-a)>.015&&Math.abs(y-b)>.015)onChange({x:Math.min(a,x),y:Math.min(b,y),w:Math.abs(x-a),h:Math.abs(y-b)});
 };
 return <div className="crop-area"><div className="crop-image" onPointerDown={e=>{const [x,y]=pos(e);start.current=[x,y];e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={move} onPointerUp={e=>{move(e);start.current=null}} onPointerCancel={()=>{start.current=null}}>
 <img src={src} alt="Tranh để khoanh vùng" draggable={false}/><span style={{left:crop.x*100+'%',top:crop.y*100+'%',width:crop.w*100+'%',height:crop.h*100+'%'}}/></div></div>;
}
export function Wizard({project,back,onView,onJobs,refresh}:{project?:Project;back:()=>void;onView:(p:string,v:string)=>void;onJobs:()=>void;refresh:()=>Promise<void>}){
 const [d,set]=useState<FullDraft>(()=>project?structuredClone(project.draft):initial());
 const saved=useRef<Project|undefined>(project);
 const [step,setStep]=useState(0),[busy,setBusy]=useState(''),[error,setError]=useState(''),[note,setNote]=useState('');
 const [source,setSource]=useState(''),[promptTitle,setPromptTitle]=useState('Prompt tạo thế giới'),[showPrompt,setShowPrompt]=useState(false),[dataPrompt,setDataPrompt]=useState<{prompt:string;manual:string}|null>(null);
 const [method,setMethod]=useState<'generate'|'import'|'sample'>('generate'),[sample,setSample]=useState<'hoian'|'starry'>('hoian');
 const mounted=useRef(true);const taskSeq=useRef(0);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;taskSeq.current++}},[]);
 const patch=(v:Partial<FullDraft>)=>set(prev=>({...prev,...v}));
 const artwork=d.artwork?'/api/artworks/'+d.artwork:'';
 const save=async()=>{
  const draft={...d,title:d.title.trim()||'Thế giới mới'};
  const p=saved.current?await api<Project>('/projects/'+saved.current.id,'PUT',{revision:saved.current.revision,draft}):await api<Project>('/projects','POST',draft);
  saved.current=p;if(mounted.current&&!d.title.trim())patch({title:p.draft.title});return p;
 };
 const action=async(fn:()=>Promise<void>)=>{setError('');setNote('');try{await fn()}catch(e){if(mounted.current)setError((e as Error).message)}finally{if(mounted.current)setBusy('')}};
 const takeFile=async(f:File)=>{setBusy('Đang đọc ảnh');await action(async()=>{
   const artwork = await uploadArtwork(f);
   patch({artwork:artwork.id,palette:artwork.palette,crop:{x:0,y:0,w:1,h:1},style:'',subject_notes:''});
 });};
 const sampleArt=(s:typeof samples.sky)=>patch({artwork:s.id,palette:[...s.palette],style:s.style,subject_notes:'',crop:{x:0,y:0,w:1,h:1}});
 const job=async(kind:'analyze'|'generate'|'import'|'sample')=>{
   const seq=++taskSeq.current;setBusy(kind==='analyze'?'Đang đọc tranh':'Đang xếp lượt dựng');
   await action(async()=>{
    const p=await save();
    const {id}=await api<{id:string}>('/jobs','POST',{project:p.id,revision:p.revision,action:kind,sample,source:kind==='import'?source:''});
    while(mounted.current&&seq===taskSeq.current){
      const jobs=await api<Job[]>('/jobs');const j=jobs.find(j=>j.id===id);
      if(j){setBusy(j.stage);
       if(j.status==='failed'||j.status==='interrupted')throw Error(j.error||j.stage);
       if(j.status==='done'){
        if(kind==='analyze'){patch({style:j.result?.style||'',palette:j.result?.palette??d.palette,subject_notes:j.result?.subject_notes||''});setNote('Đã nhận kết quả. Bạn có thể sửa trước khi dựng.')}
        else{await refresh();if(mounted.current)onView(p.id,j.result!.version!)}
        break;
       }}
      await wait(900);
    }
   });
 };
 const preview=()=>action(async()=>{setPromptTitle('Prompt tạo thế giới');const prompt=await api<{manual:string;prompt:string}>('/prompt','POST',{...d,title:d.title||'Thế giới mới'});setDataPrompt(prompt);setShowPrompt(true)});
 const grabCrop=()=>action(async()=>{const p=await save();const a=document.createElement('a');a.href='/api/projects/'+p.id+'/crop';a.download='chu-the.png';a.click()});
 const titles=['Tranh tham chiếu','Phong cách vẽ','Mô tả thế giới'];
 return <main className="wizard page"><div className="breadcrumb"><button onClick={back}><ArrowLeft size={14}/>Xưởng vẽ</button><span>/</span> Dự án</div>
 <div className="page-heading"><div><h1>{project?'Sửa bản nháp':'Tạo thế giới'}</h1><p>Lấy cách vẽ từ một bức tranh, rồi tự chọn điều xuất hiện trong cảnh.</p></div>
 <button className="light-btn" disabled={!!busy} onClick={()=>action(async()=>{setBusy('Đang lưu');await save();await refresh();setNote('Đã lưu bản nháp.')})}><Save size={15}/>Lưu nháp</button></div>
 <nav className="steps">{titles.map((s,i)=><button className={i===step?'current':i<step?'complete':''} key={s} disabled={!!busy} onClick={()=>setStep(i)}><b>{i<step?<Check size={13}/>:i+1}</b>{s}</button>)}</nav>
 <div className="wizard-grid"><section className="form-card"><h2>{titles[step]}</h2>
 {step===0&&<><label className="input-label">Tên thế giới<input maxLength={96} value={d.title} placeholder="Ví dụ: Bến đèn dưới trăng" onChange={e=>patch({title:e.target.value})}/></label>
 <label className="drop" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)void takeFile(f)}}>
 <ImagePlus size={27}/><strong>{d.artwork?'Thay tranh tham chiếu':'Chọn hoặc thả tranh vào đây'}</strong><span>PNG, JPG, WebP · tối đa 6 MiB</span><input type="file" aria-label="Tải tranh" accept="image/png,image/jpeg,image/webp" onChange={e=>{const f=e.target.files?.[0];if(f)void takeFile(f)}}/></label>
 <div className="input-label">Hoặc dùng tranh mẫu</div><div className="reference-options">{Object.values(samples).map(s=><button key={s.id} className={d.artwork===s.id?'chosen':''} onClick={()=>sampleArt(s)}><img src={'/reference/'+s.source} alt=""/><span>{s.title}</span>{d.artwork===s.id&&<Check size={14}/>}</button>)}</div>
 <div className="input-label">Cách dùng tranh</div><div className="modes"><button className={d.mode==='style'?'chosen':''} onClick={()=>patch({mode:'style'})}><Palette size={17}/> Chỉ lấy phong cách</button><button className={d.mode==='subject'?'chosen':''} onClick={()=>{patch({mode:'subject'});setSample('hoian')}}><UserRound size={17}/> Dựng thêm chủ thể</button></div>
 {d.mode==='subject'&&artwork&&<><p className="hint">Kéo trên tranh để chọn vùng chủ thể.</p><CropView src={artwork} crop={d.crop} onChange={crop=>patch({crop})}/><button className="link-btn" onClick={()=>patch({crop:{x:0,y:0,w:1,h:1}})}>Chọn toàn ảnh</button></>}</>}
 {step===1&&<><label className="input-label">Bảng màu</label><div className="palette-edit">{d.palette.map((c,i)=><label key={i}><input type="color" aria-label={'Màu '+(i+1)} value={c} onChange={e=>patch({palette:d.palette.map((x,j)=>j===i?e.target.value:x)})}/><span>{c.toUpperCase()}</span></label>)}</div>
 <button className="dark-btn" disabled={!d.artwork||!!busy} onClick={()=>job('analyze')}><Sparkles size={15}/>Đọc phong cách bằng Codex</button><button className="link-btn manual-analysis" onClick={()=>{
 const text="Hãy đọc tranh đính kèm. Viết bằng tiếng Việt một đoạn Visual Style mô tả chất liệu, độ dày, hướng nét, màu sáng, bóng và nhấn. Đưa 5 mã màu #RRGGBB theo thứ tự từ bóng đến sáng. Giữ phần phong cách chỉ gồm đặc tính tạo hình."+(d.mode==='subject'?" Tôi gửi thêm ảnh cắt. Viết riêng đoạn Subject Reference mô tả hình khối, tư thế và chi tiết nhận biết trong vùng này.":" Tôi sẽ tự chọn vật thể và bối cảnh trong phần World.");
 setPromptTitle('Prompt đọc tranh');setDataPrompt({prompt:text,manual:text});setShowPrompt(true)
 }}><Clipboard size={14}/>Lấy prompt để đọc tranh trong ChatGPT</button>
 <label className="input-label">Chất liệu, hướng nét và ánh sáng<textarea rows={4} value={d.style} placeholder="Nhập tay hoặc dùng Codex đọc tranh…" onChange={e=>patch({style:e.target.value})}/></label>
 {d.mode==='subject'&&<label className="input-label">Đặc điểm của chủ thể<textarea rows={3} value={d.subject_notes} onChange={e=>patch({subject_notes:e.target.value})} placeholder="Dáng người, trang phục, tư thế, chi tiết nhận biết…"/></label>}
 <label className="input-label">Kỹ thuật dựng<select value={d.technique} onChange={e=>patch({technique:e.target.value as FullDraft['technique']})}><option value="impasto">Sơn dầu impasto · nét cọ 3D</option><option value="reference">Cho Codex chọn theo tranh</option></select></label></>}
 {step===2&&<><label className="input-label">Thế giới của bạn<textarea rows={4} value={d.world} onChange={e=>patch({world:e.target.value})} placeholder="Bối cảnh, vật thể và những gì người chơi có thể làm…"/></label>
 {d.mode==='subject'&&<label className="input-label">Chủ thể xuất hiện ở đâu?<input value={d.subject_role} onChange={e=>patch({subject_role:e.target.value})} placeholder="Ví dụ: đứng ở đầu cầu, tay cầm đèn"/></label>}
 <details><summary>Điều khiển và seed</summary><label className="input-label">Điều khiển<input value={d.controls} onChange={e=>patch({controls:e.target.value})}/></label><label className="input-label">Seed<input type="number" min="0" max="2147483647" value={d.seed} onChange={e=>patch({seed:Math.max(0,Math.min(2147483647,Math.floor(Number(e.target.value))))})}/></label></details>
 <button className="link-btn" onClick={preview}><Eye size={15}/>Xem prompt</button>
 <label className="input-label">Cách dựng<select value={method} onChange={e=>setMethod(e.target.value as typeof method)}><option value="generate">Codex trên máy · sinh cảnh mới</option><option value="import">Nhập mã .ts từ cuộc trò chuyện Codex</option><option value="sample">Dùng bố cục có sẵn</option></select></label>
 {method==='import'&&<><p className="hint">Sao chép prompt kèm hướng dẫn, gửi vào Codex và nhập module TypeScript nhận được.</p><button className="link-btn" onClick={preview}><Clipboard size={14}/>Prompt cho Codex</button>{d.mode==='subject'&&<button className="link-btn" onClick={grabCrop}><CropIcon size={14}/>Tải vùng đã chọn</button>}
 <label className="input-label">Mã cảnh<input type="file" aria-label="Chọn mã cảnh" accept=".ts,.txt" onChange={async e=>{const f=e.target.files?.[0];if(f)setSource(await f.text())}}/><textarea rows={4} spellCheck={false} placeholder="Dán mã TypeScript tại đây" value={source} onChange={e=>setSource(e.target.value)}/></label></>}
 {method==='sample'&&<label className="input-label">Bố cục mẫu<select value={sample} onChange={e=>setSample(e.target.value as typeof sample)}><option value="hoian">Phố Hội An · dùng bảng màu của bạn</option><option value="starry" disabled={d.mode==='subject'}>The Starry Ride · cảnh sơn dầu gốc</option></select><span className="hint">Cảnh mẫu dùng hình học đã dựng sẵn. Chọn Codex để tạo vật thể riêng theo mô tả và ảnh.</span></label>}</>}
 {(note||error)&&<div role={error?'alert':'status'} className={error?'error':'success'}>{error||note}</div>}
 {busy&&<div className="busy" role="status"><LoaderCircle className="spin" size={16}/>{busy} <button onClick={onJobs}>Xem lượt dựng</button></div>}
 <footer className="form-actions">{step>0&&<button className="quiet" disabled={!!busy} onClick={()=>setStep(step-1)}><ArrowLeft size={15}/>Quay lại</button>}
 {step<2?<button className="primary" disabled={!!busy||step===0&&d.mode==='subject'&&!artwork} onClick={()=>setStep(step+1)}>Tiếp tục<ArrowRight size={15}/></button>:
 <button className="primary" disabled={!!busy||method==='generate'&&(!d.world.trim()||!d.style.trim())||method==='import'&&!source.trim()} onClick={()=>job(method)}><WandSparkles size={16}/>{method==='generate'?'Dựng bằng Codex':method==='sample'?'Dựng cảnh mẫu':'Dựng từ mã'}</button>}</footer>
 </section><aside className="reference-card"><div className="ref-title"><Palette size={16}/>Tranh tham chiếu</div>{artwork?<img className="reference-main" src={artwork} alt="Tranh tham chiếu đã chọn"/>:<div className="ref-empty"><ImagePlus size={30}/><p>Chưa chọn tranh</p></div>}
 <div className="ref-caption"><h3>{d.title||'Thế giới mới'}</h3><div className="swatches">{d.palette.map((c,i)=><i key={i} style={{background:c}}/>)}</div><p>{d.mode==='subject'?'Phong cách và chủ thể 3D':'Phong cách từ tranh'}</p></div></aside></div>
 {showPrompt&&dataPrompt&&<div className="modal-back"><section className="modal"><h2>{promptTitle}</h2><pre>{method==='import'?dataPrompt.manual:dataPrompt.prompt}</pre><footer><button className="light-btn" onClick={()=>setShowPrompt(false)}>Đóng</button><button className="primary" onClick={()=>{navigator.clipboard.writeText(dataPrompt.manual).then(()=>setNote('Đã sao chép prompt.')).catch(()=>setError('Hãy chọn và sao chép văn bản trong khung.'));setShowPrompt(false)}}><Clipboard size={15}/>Sao chép prompt</button></footer></section></div>}
 </main>;
}
