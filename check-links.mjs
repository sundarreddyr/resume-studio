import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createLayout} from './dist/layout.js';
import {buildPDF} from './dist/pdf.js';
import {normalizeWebUrl,COMPANY_LINK_COLOR} from './dist/links.js';
import {createResumeFile,readResumeFile} from './dist/resume-file.js';
import {PDFDocument,PDFName,PDFArray,PDFDict,PDFString} from './dist/assets/pdf-lib.esm.min.js';
const seed=JSON.parse(await readFile(new URL('./fixtures/original-seed.json',import.meta.url),'utf8'));
const metrics=JSON.parse(await readFile(new URL('./dist/assets/fonts/metrics.json',import.meta.url),'utf8'));
const loadFont=async name=>new Uint8Array(await readFile(new URL('./dist/assets/fonts/'+name,import.meta.url)));
assert.equal(normalizeWebUrl('example.com/about?source=resume&section=engineering'),'https://example.com/about?source=resume&section=engineering');
for(const value of ['javascript:alert(1)','data:text/html,test','ftp://example.com','https://user:secret@example.com'])assert.equal(normalizeWebUrl(value),'');
const draft=structuredClone(seed);draft.sections[0].items[0].url='https://example.com/about?source=resume&section=engineering';
const layout=createLayout(draft,metrics),nodes=layout.pages.flat(),name=draft.sections[0].items[0].name;
const title=nodes.find(n=>n.text===name);
assert.equal(title.href,draft.sections[0].items[0].url);assert.equal(title.color,COMPANY_LINK_COLOR);assert.equal(title.underline,true);
assert.ok(nodes.filter(n=>n.color).every(n=>n.text===name));
assert.ok(!nodes.find(n=>n.text==='Technical Lead').href);
const bytes=await buildPDF(layout,metrics,loadFont,createResumeFile(draft,{visibleOnly:true}));
const pdf=await PDFDocument.load(bytes);const links=[];
for(const page of pdf.getPages()){
 const annotations=page.node.lookupMaybe(PDFName.of('Annots'),PDFArray);
 if(annotations)for(let i=0;i<annotations.size();i++){
  const annotation=annotations.lookup(i,PDFDict),action=annotation.lookupMaybe(PDFName.of('A'),PDFDict);
  const uri=action?.lookupMaybe(PDFName.of('URI'),PDFString);if(uri)links.push(uri.decodeText());
 }
}
assert.ok(links.includes(title.href));
const reopened=await readResumeFile(new File([bytes],'company-links.pdf'));
assert.equal(reopened.sections[0].items[0].url,draft.sections[0].items[0].url);
const invalid=structuredClone(draft);invalid.sections[0].items[0].url='javascript:alert(1)';
const invalidLayout=createLayout(invalid,metrics);assert.ok(invalidLayout.warnings.some(w=>w.includes('valid website URL')));assert.ok(!invalidLayout.pages.flat().find(n=>n.text===name).href);
await writeFile('./tmp/qa/company-links.pdf',bytes);
console.log('Company links verified: title-only color, PDF link annotations, safe URL handling and editable PDF round trip.');
