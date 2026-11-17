import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createLayout,wrapLinkedText,textWidth} from './dist/layout.js';
import {buildPDF} from './dist/pdf.js';
import {normalizeResume} from './dist/resume-data.js';
import {parseInlineLinks,inlineLinkMarkup} from './dist/inline-links.js';
import {createResumeFile,readResumeFile} from './dist/resume-file.js';
import {PDFDocument,PDFName,PDFArray,PDFDict,PDFString} from './dist/assets/pdf-lib.esm.min.js';
const read=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));
const seed=await read('./fixtures/original-seed.json'),metrics=await read('./dist/assets/fonts/metrics.json');
const loadFont=async f=>new Uint8Array(await readFile(new URL('./dist/assets/fonts/'+f,import.meta.url)));
const plain='Built reliable Java services with OpenSearch and AWS.';
const markup='Built reliable '+inlineLinkMarkup('Java','https://example.com/java')+' services with '+inlineLinkMarkup('OpenSearch','https://example.com/search?x=1&y=2')+' and AWS.';
assert.equal(parseInlineLinks(markup).map(r=>r.text).join(''),plain);
for(const bad of ['javascript:alert(1)','data:text/html,test','https://user:password@example.com'])assert.throws(()=>inlineLinkMarkup('word',bad));
assert.equal(parseInlineLinks('[unsafe](javascript:alert)').some(r=>r.href),false);
assert.equal(parseInlineLinks(inlineLinkMarkup('docs','https://example.com/wiki/(Java)'))[0].href,'https://example.com/wiki/%28Java%29');
assert.throws(()=>inlineLinkMarkup('line\nbreak','https://example.com'));
const draft=normalizeResume(seed,seed),b=draft.sections[0].items[0].roles[0].projects[0].bullets[0];b.text=markup;delete b.originalText;delete b.originalLines;
const result=createLayout(draft,metrics),nodes=result.pages.flat();
for(const name of ['Java','OpenSearch']){
 const n=nodes.find(n=>n.text===name);assert.ok(n.href);assert.equal(n.color,'#215fa6');assert.equal(n.underline,true);
}
assert.ok(nodes.find(n=>n.text==='Built reliable '&&!n.href));assert.equal(result.warnings.length,0);
// Long links wrap across lines and pages; annotations remain bounded to linked text.
const long=structuredClone(draft);long.sections[0].items[0].roles[0].projects[0].bullets[0].text='Intro '+inlineLinkMarkup(Array(350).fill('OpenSearch Java').join(' '),'https://example.com/long')+' after';
const longLayout=createLayout(long,metrics);assert.ok(longLayout.pages.length>result.pages.length);assert.ok(longLayout.pages.flat().filter(n=>n.href==='https://example.com/long').length>10);
for(const n of longLayout.pages.flat())if(n.type==='text'){assert.ok(n.y<=756);if(n.href==='https://example.com/long')assert.ok(n.x+textWidth(n.text,n.font,n.size,metrics)<=576.001)};
for(const line of wrapLinkedText(parseInlineLinks('office '+inlineLinkMarkup('affinity '+Array(100).fill('x').join(''),'https://example.com')+' final'),'CMRoman',9.963,80,metrics))assert.ok(line.reduce((s,r)=>s+textWidth(r.text,'CMRoman',9.963,metrics),0)<=80.001);
const bytes=await buildPDF(result,metrics,loadFont,createResumeFile(draft));
const pdf=await PDFDocument.load(bytes),uris=[];
for(const p of pdf.getPages()){
 const annots=p.node.lookupMaybe(PDFName.of('Annots'),PDFArray);
 if(annots)for(let i=0;i<annots.size();i++){
  const action=annots.lookup(i,PDFDict).lookupMaybe(PDFName.of('A'),PDFDict),uri=action?.lookupMaybe(PDFName.of('URI'),PDFString);if(uri)uris.push(uri.decodeText());
 }
}
assert.ok(uris.includes('https://example.com/java'));assert.ok(uris.includes('https://example.com/search?x=1&y=2'));
for(const [format,content] of [['pdf',bytes],['json',JSON.stringify(createResumeFile(draft))]]){
 const restored=normalizeResume(await readResumeFile(new File([content],'test.'+format)),seed);assert.deepEqual(restored,draft,format+' retains all content and links');
}
// Existing content and measured original layout stay untouched.
const baseline=normalizeResume(seed,seed);assert.deepEqual(baseline.sections[0].items[0].roles[0].projects[0].bullets,seed.sections[0].items[0].roles[0].bullets);
await writeFile('./tmp/qa/bullet-links.pdf',bytes);
console.log('Bullet links passed: inline URL safety, selected-word styling, wrapping and pagination, PDF URI annotations, PDF/JSON round trips and legacy draft preservation.');
