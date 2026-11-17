import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {normalizeResume} from './dist/resume-data.js';
import {createLayout} from './dist/layout.js';
import {buildPDF} from './dist/pdf.js';
import {createResumeFile,readResumeFile} from './dist/resume-file.js';
import {PDFDocument,PDFName,PDFArray,PDFDict,PDFString} from './dist/assets/pdf-lib.esm.min.js';
const seed=JSON.parse(await readFile('fixtures/original-seed.json','utf8')),metrics=JSON.parse(await readFile('dist/assets/fonts/metrics.json','utf8'));
const draft=normalizeResume(seed,seed);draft.personal.role='Technical Lead | Backend systems';draft.personal.portfolioName='Portfolio';draft.personal.linkedinName='LinkedIn';draft.personal.emailName='Email';draft.personal.phoneName='Call';draft.personal.portfolio='https://sundar-reddy-portfolio.sundarreddy022.chatgpt.site/';
const layout=createLayout(draft,metrics),nodes=layout.pages.flat(),role=nodes.find(n=>n.text===draft.personal.role),portfolio=nodes.find(n=>n.text==='Portfolio'),linkedin=nodes.find(n=>n.text===draft.personal.linkedinName);
assert.ok(role.y>nodes.find(n=>n.text===draft.personal.name).y&&role.y<linkedin.y);assert.equal(portfolio.y,linkedin.y);assert.ok(portfolio.x>linkedin.x);assert.equal(portfolio.href,draft.personal.portfolio);
const bytes=await buildPDF(layout,metrics,async f=>new Uint8Array(await readFile('dist/assets/fonts/'+f)),createResumeFile(draft));
const doc=await PDFDocument.load(bytes),uris=[];
for(const page of doc.getPages()){const annotations=page.node.lookupMaybe(PDFName.of('Annots'),PDFArray);if(annotations)for(let i=0;i<annotations.size();i++){const a=annotations.lookup(i,PDFDict).lookupMaybe(PDFName.of('A'),PDFDict);const uri=a?.lookupMaybe(PDFName.of('URI'),PDFString);if(uri)uris.push(uri.decodeText())}}
assert.ok(uris.includes(draft.personal.portfolio));
for(const [ext,content]of [['pdf',bytes],['json',JSON.stringify(createResumeFile(draft))]])assert.deepEqual(normalizeResume(await readResumeFile(new File([content],'resume.'+ext)),seed),draft);
for(const [name,value]of [['Call','tel:'+draft.personal.phone],['Email','mailto:'+draft.personal.email],['LinkedIn','https://'+draft.personal.linkedin],['Portfolio',draft.personal.portfolio]]){const n=nodes.find(n=>n.text===name);assert.equal(n.href,value);assert.equal(n.color,'#215fa6');assert.equal(n.underline,true)}
assert.equal(nodes.filter(n=>n.type==='icon').length,4);
const unnamed=structuredClone(draft);for(const k of ['phoneName','emailName','linkedinName','portfolioName'])unnamed.personal[k]='';const un=createLayout(unnamed,metrics).pages.flat();for(const k of ['phone','email','linkedin','portfolio']){const n=un.find(n=>n.text===unnamed.personal[k]);assert.ok(n);assert.ok(!n.color&&!n.underline)}
const noRole=structuredClone(draft);noRole.personal.role='';noRole.personal.linkedinName='';noRole.personal.portfolio='';const plain=createLayout(noRole,metrics);assert.ok(!plain.pages.flat().some(n=>n.text==='Portfolio'&&n.href));assert.equal(plain.pages.flat().find(n=>n.text===draft.personal.linkedin).y,68.878);
const invalid=structuredClone(draft);invalid.personal.portfolio='javascript:alert(1)';assert.ok(!createLayout(invalid,metrics).pages.flat().some(n=>n.text==='Portfolio'&&n.href));
await writeFile('./tmp/qa/header.pdf',bytes);
console.log('Header passed: role placement, portfolio beside LinkedIn, clickable PDF annotation, optional fields, unsafe URLs rejected, and lossless PDF/JSON round trips.');
