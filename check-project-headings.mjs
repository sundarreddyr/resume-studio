import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createLayout} from './dist/layout.js';
import {normalizeResume} from './dist/resume-data.js';
import {buildPDF} from './dist/pdf.js';
import {createResumeFile,readResumeFile} from './dist/resume-file.js';
const seed=JSON.parse(await readFile('fixtures/original-seed.json','utf8')),metrics=JSON.parse(await readFile('dist/assets/fonts/metrics.json','utf8'));
const nodes=d=>createLayout(d,metrics).pages.flat();
for(const type of ['experience','projects']){
 const draft=normalizeResume(seed,seed);draft.sections=draft.sections.filter(s=>s.type===type);
 const section=draft.sections[0];section.pageBreak=false;
 let project;
 if(type==='experience'){
  section.items=section.items.slice(0,1);section.items[0].roles=section.items[0].roles.slice(0,1);
  project={name:'Demo',dates:'',stack:'',bullets:[{text:'Visible bullet.'}]};section.items[0].roles[0].projects=[project];
 }else{project={name:'Demo',dates:'',stack:'',bullets:[{text:'Visible bullet.'}]};section.items=[project]}
 const titled=nodes(draft),heading=titled.find(n=>n.text==='Demo'),oldBullet=titled.find(n=>n.text==='Visible bullet.');
 project.name='   ';
 const unnamed=nodes(draft),bullet=unnamed.find(n=>n.text==='Visible bullet.');
 assert.equal(bullet.y,heading.y,type+' bullet occupies the omitted heading baseline');assert.ok(bullet.y<oldBullet.y);
 assert.ok(!unnamed.some(n=>n.text===' | '));
 project.dates='2025–2026';project.stack='Java, AWS';
 const metadata=nodes(draft);assert.equal(metadata.find(n=>n.text==='Visible bullet.').y,bullet.y);assert.ok(metadata.find(n=>n.text==='2025–2026').y>bullet.y);assert.ok(metadata.some(n=>n.text==='Stack: Java, AWS'));
 const copy=structuredClone(draft);if(type==='experience')copy.sections[0].items[0].roles[0].projects.unshift({name:'',dates:'',stack:'',bullets:[]});else copy.sections[0].items.unshift({name:'',dates:'',stack:'',bullets:[]});
 assert.deepEqual(nodes(copy),metadata,'empty entries add no blank spacing');
 const bytes=await buildPDF(createLayout(draft,metrics),metrics,async f=>new Uint8Array(await readFile('dist/assets/fonts/'+f)),createResumeFile(draft));
 const restored=normalizeResume(await readResumeFile(new File([bytes],'resume.pdf')),seed);assert.deepEqual(restored,normalizeResume(draft,seed),'name, metadata and content survive PDF round trip');
 if(type==='experience')await writeFile('./tmp/qa/unnamed-project.pdf',bytes);
}
console.log('Unnamed projects passed: work experience and standalone sections, removed heading gap, metadata retained, empty entries skipped and PDF round trips.');
