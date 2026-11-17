import {inlineEducationQualification} from './education.js';
import {normalizeWebUrl,COMPANY_LINK_COLOR} from './links.js';
import {parseInlineFormatting} from './inline-format.js';
const families={CMR10:'CMRoman',CMBX10:'CMBold',CMTI10:'CMItalic',CMBXTI10:'CMBoldItalic',CMCSC10:'CMSmallCaps',CMMI10:'CMRoman'};
export function fontFor(text,font,metrics){return metrics[font]?.cmap[text.codePointAt(0)]!==undefined?font:'Fallback'}
export function shapeText(text,font,metrics){const ls={ffi:'ﬃ',ffl:'ﬄ',ff:'ﬀ',fi:'ﬁ',fl:'ﬂ'};return String(text).replace(/ffi|ffl|ff|fi|fl/g,t=>metrics[font]?.cmap[ls[t].codePointAt(0)]!==undefined?ls[t]:t)}
export function textWidth(text,font,size,metrics){return Array.from(shapeText(text,font,metrics)).reduce((sum,ch)=>{const f=fontFor(ch,font,metrics),m=metrics[f];return sum+(m.widths[m.cmap[ch.codePointAt(0)]]||500)*size/1000},0)}
export function wrapText(text,font,size,width,metrics){
 const result=[];
 for(const paragraph of String(text).split('\n')){
  if(!paragraph.trim()){result.push('');continue}
  let line='';
  for(const word of paragraph.trim().split(/\s+/)){
   const candidate=line?line+' '+word:word;
   if(textWidth(candidate,font,size,metrics)<=width){line=candidate;continue}
   if(line){result.push(line);line=''}
   if(textWidth(word,font,size,metrics)<=width){line=word;continue}
   for(const ch of Array.from(word)){if(line&&textWidth(line+ch,font,size,metrics)>width){result.push(line);line=''}line+=ch}
  }
  if(line)result.push(line);
 }
 return result.length?result:[''];
}
export const fontForRun=(run,fallback='CMRoman')=>run.bold?(run.italic?'CMBoldItalic':'CMBold'):(run.italic?'CMItalic':fallback);
// Wrap styled runs using the same font metrics as plain bullets and PDF output.
export function wrapLinkedText(runs,font,size,width,metrics){
 const lines=[];
 const append=(list,run)=>{if(!run.text)return;const last=list.at(-1);if(last&&last.href===run.href&&last.named===run.named&&last.bold===run.bold&&last.italic===run.italic)last.text+=run.text;else list.push({text:run.text,href:run.href,named:run.named,bold:run.bold,italic:run.italic})};
 const measure=list=>list.reduce((sum,r)=>sum+textWidth(r.text,fontForRun(r,font),size,metrics),0);
 const chars=runs.flatMap(r=>Array.from(r.text,ch=>({text:ch,href:r.href,named:r.named,bold:r.bold,italic:r.italic})));
 const paragraphs=[[]];for(const ch of chars){if(ch.text==='\n')paragraphs.push([]);else paragraphs.at(-1).push(ch)}
 for(const paragraph of paragraphs){
  const words=[];let word=[];
  for(const ch of paragraph){if(/\s/u.test(ch.text)){if(word.length){words.push(word);word=[]}}else word.push(ch)}
  if(word.length)words.push(word);
  let line=[];
  for(const word of words){
   const candidate=line.map(r=>({...r}));
   if(line.length)append(candidate,{text:' ',href:line.at(-1).href===word[0].href?word[0].href:undefined,named:line.at(-1).named===word[0].named?word[0].named:undefined,bold:!!(line.at(-1).bold&&word[0].bold),italic:!!(line.at(-1).italic&&word[0].italic)});
   word.forEach(ch=>append(candidate,ch));
   if(measure(candidate)<=width){line=candidate;continue}
   if(line.length){lines.push(line);line=[]}
   for(const ch of word){
    const next=line.map(r=>({...r}));append(next,ch);
    if(line.length&&measure(next)>width){lines.push(line);line=[]}
    append(line,ch);
   }
  }
  lines.push(line);
 }
 return lines;
}
export function createLayout(data,metrics){
 const pages=[[]],warnings=[];let page=pages[0],y=0;
 const scale=(Number(data.layout.fontScale)||100)/100,space=(Number(data.layout.spacing)||100)/100;
 const margin=Number(data.layout.margin)||36,left=margin,right=612-margin,dx=margin-36;
 const exact=scale===1&&space===1&&margin===36;
 const f=s=>s*scale,g=s=>s*space;
 const add=(text,x,y,font='CMRoman',size=9.963,extra={})=>{if(String(text).length)page.push({type:'text',text:extra.xs?String(text):shapeText(text,font,metrics),x,y,font,size:f(size),...extra})};
 const newPage=()=>{page=[];pages.push(page);y=46.959};
 const ensure=(height)=>{if(y+height>792-margin-2)newPage()};
 const align=(text,x,y,font,size)=>add(text,x-textWidth(text,font,f(size),metrics),y,font,size);
 const fit=(text,x,y,font,size,width,extra={})=>{
  const lines=wrapText(text,font,f(size),width,metrics);lines.forEach((l,i)=>add(l,x,y+g(11.955)*i,font,size,extra));return (lines.length-1)*g(11.955);
 };
 const drawRuns=(runs,x,baseline,font,size)=>{
  let xx=x;for(const run of runs){const family=fontForRun(run,font);add(run.text,xx,baseline,family,size,run.href?{href:run.href,...(run.named!==false?{color:COMPANY_LINK_COLOR,underline:true}:{})}:{});xx+=textWidth(run.text,family,f(size),metrics)}
 };
 const alignFormatted=(text,x,baseline,font,size)=>{
  const runs=parseInlineFormatting(text);
  const width=runs.reduce((total,run)=>total+textWidth(run.text,fontForRun(run,font),f(size),metrics),0);
  drawRuns(runs,x-width,baseline,font,size);
 };
 const educationRow=(text,x,font,size,width,rightText,rightX,rightFont,rightSize)=>{
  const lines=wrapLinkedText(parseInlineFormatting(text),font,f(size),width,metrics);
  lines.forEach((line,i)=>{
   if(i)y+=g(11.955);ensure(g(2));drawRuns(line,x,y,font,size);
   if(i===0)alignFormatted(rightText,rightX,y,rightFont,rightSize);
  });
 };
 const heading=(section)=>{ensure(48*space);add(section.title,left,y,'CMSmallCaps',11.955);page.push({type:'line',x:left,x2:right,y:y+g(4.384),width:.398});y+=g(17.896)};
 let experienceIndent=0;
 const bullet=(b,kind='dash')=>{
  const x=kind==='dot'?left+10.8:left+32.4+experienceIndent;
  const runs=parseInlineFormatting(b.text),hasLinks=runs.some(r=>r.href||r.bold||r.italic);
  const orig=!experienceIndent&&!hasLinks&&exact&&b.text===b.originalText&&b.originalLines?.length;
  const lines=hasLinks?wrapLinkedText(runs,'CMRoman',f(9.963),right-x,metrics).map(runs=>({runs})):orig?b.originalLines:wrapText(b.text,'CMRoman',f(9.963),right-x,metrics).map((text,i)=>({dy:g(11.955)*i,text}));
  ensure(Math.min((lines.length-1)*g(11.955)+2,45));
  const marker=kind==='dot'?'•':'–';
  const markerX=kind==='dot'?left+.365:left+21.217+experienceIndent;
  add(marker,markerX,y,kind==='dot'?'Fallback':'CMBold',9.963);
  lines.forEach((line,i)=>{
   if(y>792-margin-2){newPage()}
   if(orig){for(const s of line.spans)add(s.text,s.x+dx,y,families[s.font]||'CMRoman',s.size,{xs:s.xs?.map(v=>v+dx)})}
   else if(line.runs){let xx=x;for(const run of line.runs){const font=fontForRun(run);add(run.text,xx,y,font,9.963,run.href?{href:run.href,...(run.named!==false?{color:COMPANY_LINK_COLOR,underline:true}:{})}:{});xx+=textWidth(run.text,font,f(9.963),metrics)}}
   else add(line.text,x,y);
   if(i<lines.length-1)y+=g(11.955);
  });
 };
 const flowingText=(text,x,font='CMItalic',size=9.963)=>{
  const lines=wrapText(text,font,f(size),right-x,metrics);
  lines.forEach((line,i)=>{if(i)y+=g(11.955);ensure(g(2));add(line,x,y,font,size)});
 };
 const drawExperienceRoles=(owner,indent=0)=>{experienceIndent=indent;
    const roles=[...(owner.roles||[]),...(owner.entities||[]).flatMap(e=>(e.roles||[]).map(r=>({...r,entityName:r.entityName||e.name,entityUrl:r.entityUrl||e.url,entityStack:r.entityStack||e.stack})))];
    roles.forEach((role,ri)=>{
     y+=g(ri?20.523:13.55);ensure(g(40));
     const roleDates=role.dates;
     const entityName=String(role.entityName||'').trim(),entityUrl=entityName?normalizeWebUrl(role.entityUrl):'';
     if(entityName&&role.entityUrl?.trim()&&!entityUrl)warnings.push('Enter a valid website URL for '+entityName+' to make its title clickable.');
     const runs=[{text:role.title,bold:true,italic:true},...(entityName&&role.title.trim()?[{text:' - ',bold:true}]:[]),...(entityName?[{text:entityName,bold:true,...(entityUrl?{href:entityUrl,named:true}:{})}]:[])];
     const avail=(right-left)-32.4-indent-textWidth(roleDates,'CMBoldItalic',f(9.963),metrics)-20;
     const lines=wrapLinkedText(runs,'CMBoldItalic',f(10.909),Math.max(avail,80),metrics);
     lines.forEach((line,i)=>drawRuns(line,left+21.6+indent,y+i*g(11.955),'CMBoldItalic',10.909));
     align(roleDates,right-7.01,y,'CMBoldItalic',9.963);y+=(lines.length-1)*g(11.955)+g(14.944);
     if(!role.projects){role.bullets.forEach((b,bi)=>{if(bi)y+=g(13.948);bullet(b)});}
     else role.projects.filter(project=>project.name.trim()||project.dates?.trim()||project.stack?.trim()||project.bullets.some(b=>b.text.trim())).forEach((project,pi)=>{
      const named=!!project.name.trim();
      if(pi)y+=g(19);ensure(g(named?40:14));
      if(named){flowingText(project.name,left+21.6+indent,'CMBold');if(project.dates?.trim()){y+=g(12);flowingText(project.dates,left+21.6+indent)}}
      const visibleBullets=project.bullets.filter(b=>b.text.trim());
      if(named&&visibleBullets.length)y+=g(14);
      visibleBullets.forEach((b,bi)=>{if(bi)y+=g(13.948);bullet(b)});
      let hasContent=named||visibleBullets.length>0;
      if(!named&&project.dates?.trim()){if(hasContent)y+=g(14);flowingText(project.dates,left+21.6+indent);hasContent=true}
      if(project.stack?.trim()){if(hasContent)y+=g(14);flowingText('Stack: '+project.stack,left+32.4+indent)}
     });
     const next=roles[ri+1];
     if(role.entityName?.trim()&&role.entityStack?.trim()&&(!next||next.entityName!==role.entityName||next.entityStack!==role.entityStack)){y+=g(14);flowingText('Skills / stack: '+role.entityStack,left+21.6+indent)}
    });
 experienceIndent=0;
 };
 // Match the source's name and contact baseline exactly.
 const nameSize=f(24.787),nameWidth=textWidth(data.personal.name,'CMSmallCaps',nameSize,metrics);
 add(data.personal.name,306-nameWidth/2,52.938,'CMSmallCaps',24.787);
 if(nameWidth>right-left)warnings.push('Your name is wider than the header. Shorten it or reduce the text size.');
 let headerShift=0;
 const role=String(data.personal.role??'').trim();
 if(role){
  const lines=wrapText(role,'CMRoman',f(10.909),right-left,metrics);
  lines.forEach((line,i)=>add(line,306-textWidth(line,'CMRoman',f(10.909),metrics)/2,68.5+g(12)*i,'CMRoman',10.909));
  headerShift=16+g(12)*(lines.length-1);
 }
 const contacts=[['phone','phone','phoneName'],['mail','email','emailName'],['linkedin','linkedin','linkedinName'],['portfolio','portfolio','portfolioName']].flatMap(([icon,valueKey,nameKey])=>{
  const value=String(data.personal[valueKey]??'').trim(),name=String(data.personal[nameKey]??'').trim();if(!value)return [];
  const href=icon==='phone'?'tel:'+value.replace(/^tel:/i,''):icon==='mail'?'mailto:'+value.replace(/^mailto:/i,''):normalizeWebUrl(value);
  if(!href)warnings.push('Enter a valid '+valueKey+' URL to make its link clickable.');
  return [{icon,text:name||value,href,named:!!name}];
 });
 const rows=[[]];let used=0;
 contacts.forEach(item=>{
  item.width=f(14)+textWidth(item.text,'CMRoman',f(9.963),metrics);
  const gap=rows.at(-1).length?g(14):0;
  if(used+gap+item.width>right-left&&rows.at(-1).length){rows.push([]);used=0}
  rows.at(-1).push(item);used+=item.width+(rows.at(-1).length>1?g(14):0);
 });
 rows.forEach((row,ri)=>{
  const total=row.reduce((sum,item)=>sum+item.width,0)+Math.max(0,row.length-1)*g(14),ratio=Math.min(1,(right-left)/(total||1));
  let x=306-total*ratio/2;const baseline=68.878+headerShift+g(14)*ri;
  row.forEach((item,i)=>{
   if(i){add('|',x+g(4)*ratio,baseline,'Fallback',9.963*ratio);x+=g(14)*ratio}
   page.push({type:'icon',icon:item.icon,x,y:baseline,size:f(9.963)*ratio});
   add(item.text,x+f(14)*ratio,baseline,'CMRoman',9.963*ratio,{...(item.href?{href:item.href}:{}),...(item.named&&item.href?{color:COMPANY_LINK_COLOR,underline:true}:{})});
   x+=item.width*ratio;
  });
 });
 const location=String(data.personal.location??'').trim();
 const locationLines=location?wrapText(location,'CMRoman',f(9.963),right-left,metrics):[];
 locationLines.forEach((line,i)=>add(line,306-textWidth(line,'CMRoman',f(9.963),metrics)/2,68.878+headerShift+g(14)*(rows.length+i),'CMRoman',9.963));
 y=95.28+headerShift+Math.max(0,rows.length-1)*g(14)+locationLines.length*g(14);
 let lastType='header';
 for(const section of data.sections.filter(s=>s.enabled)){
  if(section.pageBreak&&page.length)newPage();
  else if(lastType!=='header'){
   const extra=lastType==='experience'?24.908:lastType==='education'?20.305:lastType==='skills'?26.402:24.908;
   y+=g(extra);
  }
  if(section.type==='projects'){
   heading(section);y+=g(1.993);
   section.items.filter(p=>p.name.trim()||p.stack?.trim()||p.dates?.trim()||p.bullets.some(b=>b.text.trim())).forEach((p,i)=>{
    if(i)y+=g(21.003);const named=!!p.name.trim();ensure(g(named?30:14));let yy=y;
    if(named){
    const maxTitleWidth=(right-left)-textWidth(p.dates,'CMRoman',f(10.909),metrics)-35;
    const title=p.name+(p.stack?' | '+p.stack:'');
    const tl=wrapText(title,'CMBold',f(9.963),maxTitleWidth,metrics);
    if(tl.length===1){add(p.name,left+10.8,y,'CMBold');let xx=left+10.8+textWidth(p.name,'CMBold',f(9.963),metrics);if(p.stack){add(' | ',xx,y);xx+=textWidth(' | ','CMRoman',f(9.963),metrics);add(p.stack,xx,y,'CMItalic')}}
    else{tl.forEach((l,i)=>add(l,left+10.8,y+i*g(11.955),'CMBold'));y+=(tl.length-1)*g(11.955)}
    align(p.dates,right-5.4,yy,'CMRoman',10.909);y+=g(13.965);
    }
    const visibleBullets=p.bullets.filter(b=>b.text.trim());
    visibleBullets.forEach((b,j)=>{if(j)y+=g(13.948);bullet(b)});
    if(!named){
     let hasContent=visibleBullets.length>0;
     if(p.dates?.trim()){if(hasContent)y+=g(14);flowingText(p.dates,left+10.8);hasContent=true}
     if(p.stack?.trim()){if(hasContent)y+=g(14);flowingText('Stack: '+p.stack,left+10.8)}
    }
   });
  }else if(section.type==='experience'){
   heading(section);
   section.items.forEach((company,ci)=>{
    if(ci)y+=g(23.014);ensure(g(61));
    const url=normalizeWebUrl(company.url);
    if(company.url?.trim()&&!url)warnings.push('Enter a valid website URL for '+(company.name||'this company')+' to make its title clickable.');
    const titleH=fit(company.name.trim()||company.url||'',left+10.8,y,'CMBold',10.909,(right-left)*.68,url?{href:url,...(company.name.trim()?{color:COMPANY_LINK_COLOR,underline:true}:{})}:{});
    align(company.dates||company.location,right-7.01,y,'CMItalic',9.963);y+=titleH;
    if(company.dates?.trim()&&company.location?.trim()){y+=g(12);align(company.location,right-7.01,y,'CMItalic',9.963)}
    drawExperienceRoles(company);
    if(company.stack?.trim()){y+=g(16);flowingText('Skills / stack: '+company.stack,left+10.8);}
   });
  }else if(section.type==='education'){
   heading(section);
   section.items.forEach((ed,i)=>{
    if(i)y+=g(24);ensure(g(32));
    educationRow(ed.name,left+10.8,'CMBold',10.909,(right-left)*.72,ed.location,right-5.4,'CMItalic',9.963);
    y+=g(13.549);
    educationRow(inlineEducationQualification(ed),left+10.8,'CMItalic',9.963,(right-left)*.78,ed.dates,right-6.76,'CMItalic',9.963);
   });
  }else if(section.type==='skills'){
   heading(section);y-=g(.573);
   section.items.forEach((item,i)=>{if(i)y+=g(11.955);ensure(g(12));let label=item.label.replace(/:$/,'')+':';const xx=left+10.8+textWidth(label,'CMBold',f(9.963),metrics);add(label,left+10.8,y,'CMBold');const line=wrapText(' '+item.value,'CMRoman',f(9.963),right-xx,metrics);line.forEach((l,j)=>{if(j){y+=g(11.955);ensure(g(12))}add((j?'':' ')+l.trimStart(),j?left+10.8:xx,y)});});
  }else{
   heading(section);y-=g(.573);section.items.forEach((b,i)=>{if(i)y+=g(20.922);bullet(b,'dot')});
  }
  lastType=section.type;
 }
 // Detect unsupported glyphs rather than silently omitting them.
 const missing=new Set();for(const p of pages)for(const n of p)if(n.type==='text')for(const ch of n.text){const ff=fontFor(ch,n.font,metrics);if(metrics[ff].cmap[ch.codePointAt(0)]===undefined)missing.add(ch)}
 if(missing.size)warnings.push('This template does not contain these characters: '+[...missing].join(' ')+'. Replace them before exporting.');
 return {pages,warnings};
}
