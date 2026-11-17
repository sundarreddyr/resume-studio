import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {toggleBulletBold,toggleBulletItalic,parseInlineFormatting} from './dist/inline-format.js';
import {createLayout,textWidth,fontForRun} from './dist/layout.js';
import {normalizeResume} from './dist/resume-data.js';
import {buildPDF} from './dist/pdf.js';
import {createResumeFile,readResumeFile} from './dist/resume-file.js';
let plain='Built reliable Java services.';
for(const [first,second] of [[toggleBulletBold,toggleBulletItalic],[toggleBulletItalic,toggleBulletBold]]){
 const a=first(plain,6,14),b=second(a.text,a.start,a.end);
 let run=parseInlineFormatting(b.text).find(r=>r.text==='reliable');assert.ok(run.bold&&run.italic);
 for(const remove of [first,second]){
  const c=remove(b.text,b.start,b.end);run=parseInlineFormatting(c.text).find(r=>r.text==='reliable');assert.equal(Number(run.bold)+Number(run.italic),1);
  const d=(remove===first?second:first)(c.text,c.start,c.end);assert.equal(d.text,plain);
 }
}
for(const text of ['***both***','**_both_**','_**both**_','**bold *both* bold**','*italic **both** italic*']){
 const run=parseInlineFormatting(text).find(r=>r.text.includes('both'));assert.ok(run.bold&&run.italic,text);
}
assert.equal(parseInlineFormatting('snake_case_variable and literal * unmatched').map(r=>r.text).join(''),'snake_case_variable and literal * unmatched');
assert.throws(()=>toggleBulletItalic(plain,4,4));
const seed=JSON.parse(await readFile('fixtures/original-seed.json','utf8')),metrics=JSON.parse(await readFile('dist/assets/fonts/metrics.json','utf8'));
const draft=normalizeResume(seed,seed),b=draft.sections[0].items[0].roles[0].projects[0].bullets[0];b.text='Built _italic_ services with **_both_** and [**_Java_**](https://example.com/java).';delete b.originalText;delete b.originalLines;
const layout=createLayout(draft,metrics);
for(const [text,font]of [['italic','CMItalic'],['both','CMBoldItalic'],['Java','CMBoldItalic']])assert.equal(layout.pages.flat().find(n=>n.text===text).font,font);
assert.equal(layout.pages.flat().find(n=>n.text==='Java').href,'https://example.com/java');
const long=structuredClone(draft);long.sections[0].items[0].roles[0].projects[0].bullets[0].text='**_'+Array(500).fill('Italic services').join(' ')+'_**';
const pages=createLayout(long,metrics);assert.ok(pages.pages.length>layout.pages.length);
for(const n of pages.pages.flat())if(n.type==='text'){assert.ok(n.y<=756);if(n.font==='CMBoldItalic'&&n.text.includes('Italic'))assert.ok(n.x+textWidth(n.text,n.font,n.size,metrics)<=576.001)}
assert.equal(fontForRun({bold:true,italic:true}),'CMBoldItalic');
const pdf=await buildPDF(layout,metrics,async f=>new Uint8Array(await readFile('dist/assets/fonts/'+f)),createResumeFile(draft));
for(const [format,bytes] of [['pdf',pdf],['json',JSON.stringify(createResumeFile(draft))]])assert.deepEqual(normalizeResume(await readResumeFile(new File([bytes],'resume.'+format)),seed),draft);
await writeFile('./tmp/qa/italic.pdf',pdf);
console.log('Italic passed: both toggle orders, independent removal, nested formatting, links, real italic/bold-italic fonts, page bounds and PDF/JSON round trips.');
