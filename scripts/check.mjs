import {readdir,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
await mkdir('tmp/qa',{recursive:true});
const run=(args)=>{const p=spawnSync(process.execPath,args,{stdio:'inherit'});if(p.status!==0)process.exit(p.status||1)};
for(const file of (await readdir('dist')).filter(f=>f.endsWith('.js')).sort())run(['--check','dist/'+file]);
run(['scripts/check-static.mjs']);
for(const file of (await readdir('.')).filter(f=>/^check(?:-.*)?\.mjs$/.test(f)).sort())run([file]);
console.log('All Resume Studio checks passed.');
