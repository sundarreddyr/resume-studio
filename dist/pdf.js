import {contactIconPDF} from './contact-icons.js';
import {fontFor,textWidth} from './layout.js';
import {RESUME_ATTACHMENT} from './resume-file.js';
const encoder=new TextEncoder();
const ascii=s=>encoder.encode(s);
const cat=parts=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;parts.forEach(p=>{out.set(p,at);at+=p.length});return out};
const num=n=>Number(n.toFixed(4)).toString();
const colorRGB=color=>[1,3,5].map(i=>num(parseInt(color.slice(i,i+2),16)/255)).join(' ');
const hex=n=>n.toString(16).padStart(4,'0').toUpperCase();
function unicodeHex(ch){return Array.from(ch).map(c=>{const cp=c.codePointAt(0);if(cp<=65535)return hex(cp);const v=cp-65536;return hex(55296+(v>>10))+hex(56320+(v&1023))}).join('')}
function cmapString(map){const entries=[...map.entries()];let s='/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /ResumeUnicode def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n';for(let i=0;i<entries.length;i+=90){const group=entries.slice(i,i+90);s+=group.length+' beginbfchar\n';for(const [gid,ch]of group)s+='<'+hex(gid)+'> <'+unicodeHex(ch.normalize('NFKC'))+'>\n';s+='endbfchar\n'}return s+'endcmap\nCMapName currentdict /CMap defineresource pop\nend end'}
export async function buildPDF(layout,metrics,loadFont,editableResume=null){
 const objects=[null];const reserve=()=>{objects.push(null);return objects.length-1};
 const obj=s=>{objects.push(typeof s==='string'?ascii(s):s);return objects.length-1};
 const stream=(bytes,extra='')=>obj(cat([ascii('<< /Length '+bytes.length+' '+extra+' >>\nstream\n'),bytes,ascii('\nendstream')]));
 const used=new Map();
 for(const page of layout.pages)for(const n of page)if(n.type==='text')for(const ch of Array.from(n.text)){const family=fontFor(ch,n.font,metrics),gid=metrics[family].cmap[ch.codePointAt(0)];if(gid===undefined)throw new Error('Replace the unsupported character '+ch+' before exporting.');if(!used.has(family))used.set(family,new Map());if(!used.get(family).has(gid))used.get(family).set(gid,ch)}
 const fontRefs={},fontKeys={};let fi=0;
 for(const [family,chars]of used){const m=metrics[family],font=await loadFont(m.file);const raw=stream(font,'/Length1 '+font.length);const name=family.replace(/[^a-z0-9]/gi,'');const descriptor=obj('<< /Type /FontDescriptor /FontName /'+name+' /Flags 34 /FontBBox [-1000 -400 2000 1200] /ItalicAngle '+(family.includes('Italic')?'-12':'0')+' /Ascent 800 /Descent -200 /CapHeight 700 /StemV 80 /FontFile2 '+raw+' 0 R >>');const cid=obj('<< /Type /Font /Subtype /CIDFontType2 /BaseFont /'+name+' /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor '+descriptor+' 0 R /CIDToGIDMap /Identity /DW 500 /W [0 ['+m.widths.join(' ')+']] >>');const uni=stream(ascii(cmapString(chars)));fontRefs[family]=obj('<< /Type /Font /Subtype /Type0 /BaseFont /'+name+' /Encoding /Identity-H /DescendantFonts ['+cid+' 0 R] /ToUnicode '+uni+' 0 R >>');fontKeys[family]='F'+(++fi)}
 const pageTree=reserve(),pageRefs=[];
 for(const page of layout.pages){let content='0 g\n0 G\n';const links=[];
  for(const n of page){
   if(n.type==='line'){content+=num(n.width)+' w '+num(n.x)+' '+num(792-n.y)+' m '+num(n.x2)+' '+num(792-n.y)+' l S\n';continue}
   if(n.type==='icon'){content+=contactIconPDF(n);continue}
   if(n.type!=='text')continue;if(n.color)content+='q '+colorRGB(n.color)+' rg\n';let x=n.x;const chars=Array.from(n.text);
   chars.forEach((ch,i)=>{const fam=fontFor(ch,n.font,metrics),m=metrics[fam],gid=m.cmap[ch.codePointAt(0)];const px=n.xs?.[i]??x;content+='BT /'+fontKeys[fam]+' '+num(n.size)+' Tf 1 0 0 1 '+num(px)+' '+num(792-n.y)+' Tm <'+hex(gid)+'> Tj ET\n';x=px+(m.widths[gid]||500)*n.size/1000;});
   if(n.underline){const rgb=colorRGB(n.color||'#000000'),end=n.x+textWidth(n.text,n.font,n.size,metrics),baseline=792-n.y-1.6;content+='q '+rgb+' RG .45 w '+num(n.x)+' '+num(baseline)+' m '+num(end)+' '+num(baseline)+' l S Q\n';}
   if(n.color)content+='Q\n';
   if(n.href){const uri=n.href.replace(/[\\()]/g,'\\$&');links.push(obj('<< /Type /Annot /Subtype /Link /Rect ['+num(n.x)+' '+num(792-n.y-2)+' '+num(n.x+textWidth(n.text,n.font,n.size,metrics))+' '+num(792-n.y+n.size)+'] /Border [0 0 0] /A << /S /URI /URI ('+uri+') >> >>'));}
  }
  const contents=stream(ascii(content));pageRefs.push(obj('<< /Type /Page /Parent '+pageTree+' 0 R /MediaBox [0 0 612 792] /Resources << /Font << '+Object.entries(fontRefs).map(([f,r])=>'/'+fontKeys[f]+' '+r+' 0 R').join(' ')+' >> >> /Contents '+contents+' 0 R '+(links.length?'/Annots ['+links.map(r=>r+' 0 R').join(' ')+']':'')+' >>'));
 }
 objects[pageTree]=ascii('<< /Type /Pages /Kids ['+pageRefs.map(x=>x+' 0 R').join(' ')+'] /Count '+pageRefs.length+' >>');
 let editableCatalog='';
 if(editableResume){
  const bytes=ascii(JSON.stringify(editableResume));
  const attachment=stream(bytes,'/Type /EmbeddedFile /Subtype /application#2Fjson /Params << /Size '+bytes.length+' >>');
  const fileSpec=obj('<< /Type /Filespec /F ('+RESUME_ATTACHMENT+') /UF ('+RESUME_ATTACHMENT+') /Desc (Editable Resume Studio content) /AFRelationship /Data /EF << /F '+attachment+' 0 R >> >>');
  const fileNames=obj('<< /Names [('+RESUME_ATTACHMENT+') '+fileSpec+' 0 R] >>');
  editableCatalog=' /Names << /EmbeddedFiles '+fileNames+' 0 R >> /AF ['+fileSpec+' 0 R]';
 }
 const root=obj('<< /Type /Catalog /Pages '+pageTree+' 0 R'+editableCatalog+' >>');const info=obj('<< /Title (Resume) /Creator (Resume Studio) /Producer (Resume Studio) >>');
 const chunks=[ascii('%PDF-1.7\n%resume\n')],offsets=[0];let length=chunks[0].length;
 for(let i=1;i<objects.length;i++){offsets.push(length);const chunk=cat([ascii(i+' 0 obj\n'),objects[i],ascii('\nendobj\n')]);chunks.push(chunk);length+=chunk.length;}
 const xref=length;let tail='xref\n0 '+objects.length+'\n0000000000 65535 f \n';for(const offset of offsets.slice(1))tail+=String(offset).padStart(10,'0')+' 00000 n \n';tail+='trailer\n<< /Size '+objects.length+' /Root '+root+' 0 R /Info '+info+' 0 R >>\nstartxref\n'+xref+'\n%%EOF';chunks.push(ascii(tail));return cat(chunks);
}
