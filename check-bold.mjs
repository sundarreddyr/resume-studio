import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {parseInlineFormatting,toggleBulletBold} from './dist/inline-format.js';
import {createLayout,textWidth} from './dist/layout.js';
import {normalizeResume} from './dist/resume-data.js';
import {buildPDF} from './dist/pdf.js';
import {createResumeFile,readResumeFile} from './dist/resume-file.js';
import {PDFDocument,PDFName,PDFArray,PDFDict,PDFString} from './dist/assets/pdf-lib.esm.min.js';
const seed=JSON.parse(await readFile('fixtures/original-seed.json','utf8')),metrics=JSON.parse(await readFile('dist/assets/fonts/metrics.json','utf8'));
const loadFont=async f=>new Uint8Array(await readFile('dist/assets/fonts/'+f));
const plain='Processed 100M rows with Java and OpenSearch.';
const bold=toggleBulletBold(plain,10,19);assert.equal(bold.text,'Processed **100M rows** with Java and OpenSearch.');
assert.deepEqual(toggleBulletBold(bold.text,bold.start,bold.end),{text:plain,start:10,end:19});
assert.equal(toggleBulletBold(bold.text,10,23).text,plain);
assert.throws(()=>toggleBulletBold(plain,3,3));
assert.equal(toggleBulletBold('one [Java](https://example.com/java)',5,9).text,'one [**Java**](https://example.com/java)');
assert.throws(()=>toggleBulletBold('[Java](https://example.com)',8,20));
const rich='Processed **100M rows** with [**Java**](https://example.com/java) and **[OpenSearch](https://example.com/search)**.';
const runs=parseInlineFormatting(rich);assert.equal(runs.map(r=>r.text).join(''),plain);
for(const term of ['100M rows','Java','OpenSearch'])assert.equal(runs.find(r=>r.text===term).bold,true);
assert.equal(runs.find(r=>r.text==='Java').href,'https://example.com/java');
assert.equal(runs.find(r=>r.text==='OpenSearch').href,'https://example.com/search');
assert.equal(parseInlineFormatting('literal ** unmatched').map(r=>r.text).join(''),'literal ** unmatched');
const draft=normalizeResume(seed,seed),bullet=draft.sections[0].items[0].roles[0].projects[0].bullets[0];bullet.text=rich;delete bullet.originalLines;delete bullet.originalText;
const result=createLayout(draft,metrics);assert.equal(result.warnings.length,0);
for(const term of ['100M rows','Java','OpenSearch'])assert.equal(result.pages.flat().find(n=>n.text===term).font,'CMBold');
const long=structuredClone(draft);long.sections[0].items[0].roles[0].projects[0].bullets[0].text='**'+Array(500).fill('Distributed systems').join(' ')+'**';
const paged=createLayout(long,metrics);assert.ok(paged.pages.length>result.pages.length);
for(const n of paged.pages.flat())if(n.type==='text'){assert.ok(n.y<=756);if(n.font==='CMBold'&&n.text.includes('Distributed'))assert.ok(n.x+textWidth(n.text,n.font,n.size,metrics)<=576.001)}
const bytes=await buildPDF(result,metrics,loadFont,createResumeFile(draft));
const doc=await PDFDocument.load(bytes),uris=[];
for(const page of doc.getPages()){
 const annots=page.node.lookupMaybe(PDFName.of('Annots'),PDFArray);
 if(annots)for(let i=0;i<annots.size();i++){const action=annots.lookup(i,PDFDict).lookupMaybe(PDFName.of('A'),PDFDict),uri=action?.lookupMaybe(PDFName.of('URI'),PDFString);if(uri)uris.push(uri.decodeText())}
}
assert.ok(uris.includes('https://example.com/java')&&uris.includes('https://example.com/search'));
for(const [format,content]of [['pdf',bytes],['json',JSON.stringify(createResumeFile(draft))]])assert.deepEqual(normalizeResume(await readResumeFile(new File([content],'test.'+format)),seed),draft);
await writeFile('./tmp/qa/bold.pdf',bytes);
console.log('Bold verified: selected-text toggle, safe link composition, true bold font, pagination, PDF links and lossless PDF/JSON round trips.');
