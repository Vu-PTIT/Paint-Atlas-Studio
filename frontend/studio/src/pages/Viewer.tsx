import React,{useEffect,useRef,useState} from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { api } from '../api/client';
import type { Project, Version } from '../api/types';
type Status='Đang mở'|'Đã lưu'|'Đang lưu'|'Chưa lưu';
export function Viewer({project,version,mode,back,select}:{project:Project;version:Version;mode:string;back:()=>void;select:(id:string)=>void}){
 const frame=useRef<HTMLIFrameElement>(null);
 const [session]=useState(()=>crypto.randomUUID());
 const [status,setStatus]=useState<Status>('Đang mở'),[error,setError]=useState(''),[loaded,setLoaded]=useState(false);
 const waitSave=useRef(false);
 useEffect(()=>{
  let active=true,rev=0,saving=false,conflict=false,latest:unknown=null;
  api<{revision:number}>('/versions/'+version.id+'/state').then(v=>{if(active){rev=v.revision;setLoaded(true)}}).catch(e=>setError(e.message));
  async function flush(){
   if(saving||conflict||!active)return;
   saving=true;waitSave.current=true;setStatus('Đang lưu');
   try{
    while(latest&&active){
     const next=latest;latest=null;
     const saved=await api<{revision:number}>('/versions/'+version.id+'/state','PUT',{revision:rev,state:next});rev=saved.revision;
    }
    if(active)setStatus('Đã lưu');
   }catch(e){conflict=true;if(active){setStatus('Chưa lưu');setError((e as Error).message)}}
   finally{saving=false;waitSave.current=false}
  }
  const receive=(e:MessageEvent)=>{
   const v=e.data;if(!v||e.source!==frame.current?.contentWindow||e.origin!=='null'||v.app!=='paint-atlas'||v.session!==session)return;
   if(v.type==='ready')setStatus('Đã lưu');
   if(v.type==='error')setError(String(v.error).slice(0,500));
   if(v.type==='change'&&v.state&&typeof v.state==='object'&&!Array.isArray(v.state)){latest=v.state;void flush()}
  };
  addEventListener('message',receive);
  return()=>{active=false;removeEventListener('message',receive)};
 },[version.id,session]);
 return <section className="viewer"><header><button className="quiet" onClick={back} disabled={status==='Đang lưu'}><ArrowLeft size={17}/> Xưởng vẽ</button><b>{project.draft.title}</b>
 <select aria-label="Phiên bản" value={version.id} disabled={status==='Đang lưu'} onChange={e=>select(e.target.value)}>{project.versions.map((v,i)=><option key={v.id} value={v.id}>Bản {project.versions.length-i} · {v.label}</option>)}</select>
 <span className="save-status"><Check size={13}/>{status}</span></header>
 {error&&<div className="error" role="alert">{error}</div>}
 {loaded&&<iframe title={project.draft.title} ref={frame} sandbox="allow-scripts allow-downloads" allow="fullscreen; webgpu" src={'/api/versions/'+version.id+'/html?mode='+mode+'#'+session}/>}</section>
}
