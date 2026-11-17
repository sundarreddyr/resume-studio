import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {normalizeResume} from './dist/resume-data.js';
import {createLayout} from './dist/layout.js';
import {buildPDF} from './dist/pdf.js';
import {createResumeFile,readResumeFile} from './dist/resume-file.js';
const raw=JSON.parse(await readFile(new URL('./fixtures/original-seed.json',import.meta.url),'utf8'));
const metrics=JSON.parse(await readFile(new URL('./dist/assets/fonts/metrics.json',import.meta.url),'utf8'));
const loadFont=async name=>new Uint8Array(await readFile(new URL('./dist/assets/fonts/'+name,import.meta.url)));
const migrated=normalizeResume(raw,raw);
raw.sections.filter(s=>s.type==='experience').forEach((s,si)=>s.items.forEach((c,ci)=>c.roles.forEach((r,ri)=>{
 const project=migrated.sections.filter(s=>s.type==='experience')[si].items[ci].roles[ri].projects[0];
 assert.equal(project.name,'Other');assert.deepEqual(project.bullets,r.bullets);
})));
assert.deepEqual(normalizeResume(migrated,migrated),migrated,'migration is idempotent');
const draft=structuredClone(migrated),company=draft.sections[0].items[0],role=company.roles[0];
company.stack='Java, React, AWS, System Design';
role.projects.unshift({name:'TruSearch',stack:'React, Quarkus, OpenSearch, Caffeine',dates:'2026',bullets:[{text:'Project bullet used only for export verification.'}]});
const result=createLayout(draft,metrics),texts=result.pages.flat().map(n=>n.text||'').join(' ');
assert.match(texts,/TruSearch/);assert.match(texts,/OpenSearch/);assert.match(texts,/System Design/);assert.equal(result.warnings.length,0);
for(const p of result.pages)for(const n of p)if(n.type==='text')assert.ok(n.y<=756,'new content fits pages');
for(const format of ['json','pdf']){
 const file=createResumeFile(draft);
 const bytes=format==='json'?JSON.stringify(file):await buildPDF(result,metrics,loadFont,file);
 const restored=normalizeResume(await readResumeFile(new File([bytes],'resume.'+format)),migrated);
 assert.deepEqual(restored,draft,format+' preserves company/project fields and original measured bullets');
}
const long=structuredClone(draft);
long.sections[0].items[0].roles[0].projects[0].stack=Array(120).fill('Distributed systems, Quarkus, OpenSearch').join(', ');
const paged=createLayout(long,metrics);
assert.ok(paged.pages.length>result.pages.length);
for(const p of paged.pages)for(const n of p)if(n.type==='text')assert.ok(n.y<=756,'long stack fits pages');
assert.throws(()=>normalizeResume({...raw,sections:[{...raw.sections[0],items:[{...raw.sections[0].items[0],roles:[{title:'Role',dates:'',projects:'invalid'}]}]}]},raw));
console.log('Projects verified: legacy migration, unchanged bullet preservation, repeat loading, company/project stacks, multi-page layout, PDF/JSON round trips, invalid import handling.');
