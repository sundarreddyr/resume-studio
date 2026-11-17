import assert from 'node:assert/strict';
import {readFile,access,readdir} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('dist');
const check=async(file,ref)=>{if(!ref||/^(https?:|data:|#)/.test(ref))return;assert.ok(!ref.startsWith('/'),`${file}: ${ref} must be relative for GitHub Pages`);const target=path.resolve(path.dirname(file),ref.split(/[?#]/)[0]);assert.ok(target===root||target.startsWith(root+path.sep),'Asset stays in dist');await access(target)};
const html=await readFile('dist/index.html','utf8');for(const m of html.matchAll(/(?:src|href)=["']([^"']+)["']/g))await check(path.join(root,'index.html'),m[1]);
for(const f of await readdir(root)){if(!/\.(css|js)$/.test(f))continue;const file=path.join(root,f),text=await readFile(file,'utf8');for(const m of text.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]|url\(['"]?([^)'"\s]+)['"]?\)/g))await check(file,m[1]||m[2]);}
for(const f of ['assets/seed.json','assets/resume-2026-11-17-corrected.json','assets/original.pdf','assets/reference-1.png','assets/reference-2.png','assets/fonts/metrics.json'])await access(path.join(root,f));
console.log('Static files passed: relative Pages assets, module imports, CSS fonts, and required resume assets.');
