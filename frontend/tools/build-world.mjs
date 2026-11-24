import { build } from 'esbuild';
import ts from 'typescript';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const frontend=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
function validateSource(source){
  const filename=path.join(frontend,'player','src','__incoming__.ts');
  const ast=ts.createSourceFile(filename,source,ts.ScriptTarget.ES2022,true);
  if(ast.referencedFiles.length||ast.typeReferenceDirectives.length||ast.libReferenceDirectives.length)throw Error('Mã cảnh chỉ sử dụng API đã nhúng.');
  if(/\/\/\s*@ts-(nocheck|ignore|expect-error)/.test(source))throw Error('Mã cảnh cần vượt qua bước kiểm tra kiểu.');
  function inspect(n){
    if(ts.isImportDeclaration(n)){
      if(n.moduleSpecifier.text!=='@atlas/world'||!n.importClause?.isTypeOnly)throw Error('Chỉ hỗ trợ import type từ @atlas/world.');
    }
    if(ts.isImportEqualsDeclaration(n)||ts.isImportTypeNode(n)||n.kind===ts.SyntaxKind.ImportKeyword||
      (ts.isExportDeclaration(n)&&n.moduleSpecifier))throw Error('Tài nguyên của cảnh phải nằm trong tệp xuất.');
    ts.forEachChild(n,inspect);
  }
  inspect(ast);
  const options={strict:true,skipLibCheck:true,allowJs:true,checkJs:false,noEmit:true,target:ts.ScriptTarget.ES2022,
    module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,baseUrl:frontend,types:[],paths:{'@atlas/world':['player/src/core/api.ts']}};
  const contract=path.join(frontend,'player','src','__contract__.ts');
  const check="import world from './__incoming__'; import type { WorldAPI } from '@atlas/world'; const checked: (api:WorldAPI)=>void = world; void checked;";
  const host=ts.createCompilerHost(options);
  const virtual=new Map([[filename,source],[contract,check]]);
  const originalRead=host.readFile.bind(host),originalExists=host.fileExists.bind(host);
  host.fileExists=p=>virtual.has(path.normalize(p))||originalExists(p);
  host.readFile=p=>virtual.get(path.normalize(p))??originalRead(p);
  const program=ts.createProgram([filename,contract],options,host);
  const errors=ts.getPreEmitDiagnostics(program);
  if(errors.length)throw Error(errors.slice(0,8).map(d=>{
    const line=d.file&&d.start!==undefined?d.file.getLineAndCharacterOfPosition(d.start).line+1:0;
    return 'L'+line+' '+ts.flattenDiagnosticMessageText(d.messageText,' ');
  }).join('\n'));
}
const escapedJSON=v=>JSON.stringify(v).replace(/</g,'\\u003c');
export async function buildWorld(sourcePath,meta,output){
  const source=await readFile(sourcePath,'utf8');
  validateSource(source);
  const packed=await build({absWorkingDir:frontend,entryPoints:['player/src/editor/main.tsx'],bundle:true,write:false,platform:'browser',format:'iife',
    minify:true,target:'es2022',legalComments:'none',charset:'utf8',supported:{'inline-script':false},
    define:{'process.env.NODE_ENV':'"production"'},
    plugins:[{name:'world',setup(b){
      b.onResolve({filter:/^atlas:scene$/},()=>({path:'world',namespace:'world'}));
      b.onLoad({filter:/.*/,namespace:'world'},()=>({contents:source,loader:'ts',resolveDir:frontend}));
      b.onResolve({filter:/^three$/},()=>({path:require.resolve('three/webgpu')}));
    }}]});
  const licenses=await Promise.all(['node_modules/three/LICENSE','node_modules/react/LICENSE','node_modules/react-dom/LICENSE','node_modules/lucide-react/LICENSE','legacy/runtime/rapier-license.txt'].map(p=>readFile(path.join(frontend,p),'utf8')));
  const program=('/* Three.js, React, Lucide, Rapier 3D\n'+licenses.join('\n')+'\n*/\n'+packed.outputFiles[0].text).replace(/\r\n?/g,'\n').replace(/<\/script/gi,'<\\/script');
  const digest=createHash('sha256').update(program).digest('base64');
  const css=await readFile(path.join(frontend,'player/src/editor/editor.css'),'utf8');
  const shell=await readFile(path.join(frontend,'player/shell.html'),'utf8');
  const substitutions={'__DIGEST__':digest,'/* STYLE_SLOT */':css,'META_SLOT':escapedJSON(meta),'STATE_SLOT':'{}','/* PROGRAM_SLOT */':program};
  const html=shell.replace(/__DIGEST__|\/\* STYLE_SLOT \*\/|META_SLOT|STATE_SLOT|\/\* PROGRAM_SLOT \*\//g,key=>substitutions[key]);
  await mkdir(path.dirname(output),{recursive:true});
  const temp=output+'.building';await writeFile(temp,html);await rename(temp,output);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const [scene,meta,out]=process.argv.slice(2);await buildWorld(scene,JSON.parse(await readFile(meta,'utf8')),out)}
  catch(e){console.error(e.message);process.exitCode=1;}
}
