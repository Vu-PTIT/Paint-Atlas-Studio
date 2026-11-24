import type { Meta, Snapshot } from './api';
export function readData<T>(id: string): T {
  return JSON.parse(document.getElementById(id)!.textContent || '{}') as T;
}
export function portableHTML(meta: Meta, state: Snapshot): string {
  const out = document.implementation.createHTMLDocument(meta.title);
  out.documentElement.lang = 'vi';
  out.head.replaceChildren(...Array.from(document.head.children).filter(node =>
    ['META','TITLE'].includes(node.tagName) || node.id==='atlas-css').map(node => node.cloneNode(true)));
  const main = out.createElement('main');
  main.id = 'surface';
  const canvas = out.createElement('canvas');
  canvas.id = 'view'; canvas.tabIndex = 0;
  canvas.setAttribute('aria-label','Thế giới 3D tương tác');
  main.append(canvas);
  const ui = out.createElement('div'); ui.id = 'ui';
  out.body.append(main, ui);
  for (const [id,data] of [['world-meta',meta],['world-state',state]] as const) {
    const script=out.createElement('script');
    script.type='application/json'; script.id=id;
    script.textContent=JSON.stringify(data).replace(/</g,'\\u003c');
    out.body.append(script);
  }
  out.body.append(document.getElementById('atlas-program')!.cloneNode(true));
  return '<!doctype html>\n'+out.documentElement.outerHTML;
}
export function downloadHTML(meta: Meta, state: Snapshot) {
  const href=URL.createObjectURL(new Blob([portableHTML(meta,state)],{type:'text/html;charset=utf-8'}));
  const link=document.createElement('a');
  link.href=href; link.download=meta.title.replace(/[\\/:*?"<>|]/g,'-')+'.html';
  link.click(); setTimeout(()=>URL.revokeObjectURL(href),2000);
}
