import {contactIconSVG} from './contact-icons.js';
import {toggleBulletBold,toggleBulletItalic} from './inline-format.js';
import {parseInlineLinks,inlineLinkMarkup} from './inline-links.js';
import {normalizeResume,groupSpecbeeExperience,flattenCompanyEntities} from './resume-data.js';
import {createLayout} from './layout.js';
import {buildPDF} from './pdf.js';
import {icon} from './icons.js';
import {createResumeFile,readResumeFile,unwrapResumeFile} from './resume-file.js';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const updatedResume=new URLSearchParams(location.search).get('resume')==='2026-11-17-corrected';
// Opening the reviewed snapshot keeps its edits separate from any existing browser draft.
const clone=o=>JSON.parse(JSON.stringify(o)),key='sundar-resume-studio-v1'+(updatedResume?'-2026-11-17-corrected':'');
let seed,data,metrics,layout,undo=[],redo=[],saveTimer,previewTimer,historyTimer,editing=false,zoom='fit',storageFailed=false;
let openSections=new Set(['personal']);
let openProjects=new Set();
const collapsedCompanies=new WeakSet();
const get=path=>path.split('.').reduce((o,k)=>o?.[k],data);
const set=(path,value)=>{const p=path.split('.'),last=p.pop();p.reduce((o,k)=>o[k],data)[last]=value};
const baseField=(label,path,{area=false,help='',type='text',placeholder=''}={})=>`<label class="field ${area?'compact':''}"><span>${esc(label)}</span><${area?'textarea':'input'} data-path="${path}" ${area?'rows="3"':`type="${type}"`} placeholder="${esc(placeholder)}" spellcheck="${area?'true':'false'}" ${area?'':`value="${esc(get(path))}"`}>${area?esc(get(path)):''}${area?'</textarea>':''}</label>${help?`<p class="field-help">${esc(help)}</p>`:''}`;
const textFormatControls=path=>`<button class="text-button bold-control" data-action="bullet-bold" data-path="${path}" title="Select words, then click Bold (⌘B / Ctrl+B)"><strong>B</strong> Bold</button><button class="text-button italic-control" data-action="bullet-italic" data-path="${path}" title="Select words, then click Italic (⌘I / Ctrl+I)"><em>I</em> Italic</button>`;
const field=(label,path,options={})=>options.format?`<div class="format-field">${baseField(label,path,options)}<div class="text-format-controls">${textFormatControls(path)}</div></div>`:baseField(label,path,options);
const act=(name,action,path,ico,extra='')=>`<button class="icon-button" data-action="${action}" data-path="${path}" aria-label="${esc(name)}" title="${esc(name)}" ${extra}>${icon(ico)}</button>`;
const add=(label,action,path)=>`<button class="small-add" data-action="${action}" data-path="${path}">${icon('plus')}${esc(label)}</button>`;
const tools=(label,path,index,total,remove=true)=>`<div class="card-heading"><span>${esc(label)}</span>${act('Move up','move-up',path,'up',index===0?'disabled':'')}${act('Move down','move-down',path,'down',index===total-1?'disabled':'')}${remove?act('Remove '+label,'remove',path,'trash'):''}</div>`;
const companyHeading=(company,path,index,total)=>{
 const expanded=!collapsedCompanies.has(company),name=company.name||'Untitled company';
 return `<div class="card-heading company-heading"><button type="button" class="company-toggle" data-action="toggle-company" data-path="${path}" aria-expanded="${expanded}" aria-controls="company-content-${path.replaceAll('.','-')}" aria-label="${expanded?'Collapse':'Expand'} company ${esc(name)}" title="${expanded?'Collapse':'Expand'} company ${esc(name)}"><span class="company-label">COMPANY ${index+1}</span><span class="company-name">${esc(name)}</span><span class="company-chevron">${icon('chevron')}</span></button>${act('Move up','move-up',path,'up',index===0?'disabled':'')}${act('Move down','move-down',path,'down',index===total-1?'disabled':'')}${act('Remove COMPANY '+(index+1),'remove',path,'trash')}</div>`;
};
const bulletLinkControls=(text,path)=>`${textFormatControls(path)}<button class="text-button" data-action="bullet-link" data-path="${path}">Add link</button>${parseInlineLinks(text).filter(r=>r.href).map(r=>`<button class="text-button link-chip" data-action="bullet-link" data-path="${path}" data-link-start="${r.start}" title="Edit link to ${esc(r.href)}">${esc(r.text)}</button>`).join('')}`;
const bullets=(items,path)=>items.map((b,i)=>`<div class="bullet-row">${field('Bullet '+(i+1),path+'.'+i+'.text',{area:true})}${act('Remove bullet '+(i+1),'remove',path+'.'+i,'close')}<div class="bullet-links">${bulletLinkControls(b.text,path+'.'+i+'.text')}</div></div>`).join('')+add('Add bullet','add-bullet',path);
function rememberOpen(){document.querySelectorAll('.experience-project').forEach(d=>{d.open?openProjects.add(d.dataset.path):openProjects.delete(d.dataset.path)});document.querySelectorAll('.section-block').forEach(d=>{d.open?openSections.add(d.dataset.id):openSections.delete(d.dataset.id)})}
function renderRoles(owner,path){
 return owner.roles.map((r,ri)=>{const rp=path+'.roles.'+ri;return `<div class="role-card">${tools('ROLE '+(ri+1),rp,ri,owner.roles.length)}${field('Role title',rp+'.title')}${field('Role dates',rp+'.dates',{placeholder:'Apr 2026 - Oct 2026'})}${field('Entity name (optional)',rp+'.entityName',{placeholder:'Leave blank for a role directly at the company',help:'Shown after the role title. Leave blank to show only the role under the parent company.'})}${field('Entity website URL (optional)',rp+'.entityUrl',{type:'url',placeholder:'https://entity.com',help:'Makes only the entity name clickable.'})}<details class="role-extra"><summary>Additional entity details (optional)</summary>${field('Entity tenure (saved, not printed)',rp+'.entityDates')}${field('Entity location (saved, not printed)',rp+'.entityLocation')}${field('Entity skills / stack (optional)',rp+'.entityStack',{area:true})}</details>${r.projects.map((p,pi)=>{const pp=rp+'.projects.'+pi;return `<details class="experience-project" data-path="${pp}" ${openProjects.has(pp)?'open':''}><summary><span>${esc(p.name||'Untitled project')}</span><span class="project-count">${p.bullets.length} ${p.bullets.length===1?'bullet':'bullets'}</span><span class="chevron">${icon('chevron')}</span></summary><div class="project-content">${tools('PROJECT '+(pi+1),pp,pi,r.projects.length)}${field('Project name',pp+'.name')}${field('Project dates (optional)',pp+'.dates')}${bullets(p.bullets,pp+'.bullets')}${field('Stack',pp+'.stack',{area:true,placeholder:'React, Quarkus, OpenSearch'})}</div></details>`}).join('')}${add('Add project','add-project',rp+'.projects')}</div>`}).join('')+add('Add role','add-role',path+'.roles');
}
function renderEditor(){
 const personal=`<details class="section-block" data-id="personal" ${openSections.has('personal')?'open':''}><summary class="section-summary"><span class="section-number">01</span>Personal details<span class="chevron">${icon('chevron')}</span></summary><div class="section-content">${field('Full name','personal.name')}${field('Position / role (optional)','personal.role',{placeholder:'Technical Lead | Backend systems',help:'One centered line beneath your name. Clear it to hide it.'})}${field('Location (optional)','personal.location',{placeholder:'Bengaluru, India'})}${field('Phone display name (optional)','personal.phoneName')}${field('Phone number','personal.phone')}${field('Email display name (optional)','personal.emailName')}${field('Email address','personal.email')}${field('LinkedIn display name (optional)','personal.linkedinName')}${field('LinkedIn URL','personal.linkedin',{help:'Use the short address you want displayed on your resume.'})}${field('Portfolio display name (optional)','personal.portfolioName',{placeholder:'Portfolio, Website, My Work'})}${field('Portfolio URL (optional)','personal.portfolio',{type:'url',placeholder:'https://your-portfolio.com',help:'Shown next to LinkedIn. Leave the display name blank to show the URL.'})}</div></details>`;
 $('#section-editor').innerHTML=personal+data.sections.map((s,si)=>{
  const path='sections.'+si;let content=field('Section title',path+'.title');
  if(s.type==='experience')content+=s.items.map((c,ci)=>{const cp=path+'.items.'+ci;return `<div class="card company-card" data-path="${cp}">${companyHeading(c,cp,ci,s.items.length)}<div class="company-content" id="company-content-${cp.replaceAll('.','-')}" ${collapsedCompanies.has(c)?'hidden':''}>${field('Company',cp+'.name')}${field('Company website URL (optional)',cp+'.url',{type:'url',placeholder:'https://company.com',help:'Links the parent company name in the preview and PDF.'})}${field('Company tenure (optional)',cp+'.dates',{placeholder:'Apr 2022 - Oct 2026'})}${field('Location',cp+'.location')}<p class="hierarchy-note">Add roles and projects under this company. An optional entity name appears beside its role; leave it blank for a role directly at the company.</p>${renderRoles(c,cp)}${field('Company skills / stack',cp+'.stack',{area:true})}</div></div>`}).join('')+add('Add company','add-company',path+'.items');
  if(s.type==='projects')content+=s.items.map((p,pi)=>{const pp=path+'.items.'+pi;return `<div class="card">${tools('PROJECT '+(pi+1),pp,pi,s.items.length)}${field('Project name',pp+'.name')}${field('Tech stack',pp+'.stack')}${field('Dates',pp+'.dates')}${bullets(p.bullets,pp+'.bullets')}</div>`}).join('')+add('Add project','add-project',path+'.items');
  if(s.type==='education')content+=s.items.map((e,ei)=>{const ep=path+'.items.'+ei;return `<div class="card">${tools('EDUCATION '+(ei+1),ep,ei,s.items.length)}${field('Institution',ep+'.name',{format:true})}${field('Location',ep+'.location',{format:true})}${field('Degree / qualification',ep+'.qualification',{format:true})}${field('Dates',ep+'.dates',{format:true})}</div>`}).join('')+add('Add education','add-education',path+'.items');
  if(s.type==='skills')content+=s.items.map((e,ei)=>{const ep=path+'.items.'+ei;return `<div class="card">${tools('SKILL GROUP '+(ei+1),ep,ei,s.items.length)}${field('Category',ep+'.label')}${field('Skills',ep+'.value',{area:true})}</div>`}).join('')+add('Add skill group','add-skill',path+'.items');
  if(s.type==='bullets')content+=bullets(s.items,path+'.items');
  content+=`<div class="section-settings"><label class="check"><input type="checkbox" data-path="${path}.enabled" ${s.enabled?'checked':''}>Show this section</label><label class="check"><input type="checkbox" data-path="${path}.pageBreak" ${s.pageBreak?'checked':''}>Start this section on a new page</label><div class="section-actions">${act('Move section up','move-up',path,'up',si===0?'disabled':'')}${act('Move section down','move-down',path,'down',si===data.sections.length-1?'disabled':'')}<button class="text-button" data-action="remove" data-path="${path}">${icon('trash')} Remove section</button></div></div>`;
  return `<details class="section-block" data-id="${esc(s.id)}" ${openSections.has(s.id)?'open':''}><summary class="section-summary"><span class="section-number">${String(si+2).padStart(2,'0')}</span>${esc(s.title)}<span class="section-count">${s.items.length}${!s.enabled?' · hidden':''}</span><span class="chevron">${icon('chevron')}</span></summary><div class="section-content">${content}</div></details>`;
 }).join('');
 renderLayout();updateHistory();
}
function renderLayout(){
 $('#layout-panel').innerHTML=`<p class="layout-label">THE ORIGINAL FORMAT</p><div class="locked-format"><strong>Computer Modern</strong><br>US Letter · 8.5 × 11 in<br>Small-cap headings · Serif body<br>Original indentation and section rules</div><label class="field"><span>Text size</span><div class="range-row"><input type="range" aria-label="Text size" data-path="layout.fontScale" min="90" max="110" step="1" value="${data.layout.fontScale}"><output>${data.layout.fontScale}%</output></div></label><label class="field"><span>Vertical spacing</span><div class="range-row"><input type="range" aria-label="Vertical spacing" data-path="layout.spacing" min="85" max="115" step="1" value="${data.layout.spacing}"><output>${data.layout.spacing}%</output></div></label><label class="field"><span>Page margins</span><select data-path="layout.margin" aria-label="Page margins"><option value="36" ${data.layout.margin===36?'selected':''}>Original · 0.5 in</option><option value="45" ${data.layout.margin===45?'selected':''}>Comfortable · 0.625 in</option><option value="54" ${data.layout.margin===54?'selected':''}>Wide · 0.75 in</option></select></label><button class="small-add" data-action="reset-layout">${icon('reset')}Restore original layout</button><p class="field-help" style="margin-top:8px">Leave these at their original values to match the uploaded format.</p><div class="layout-divider"></div><p class="layout-label">YOUR FILES</p><div class="file-actions"><button class="button secondary" data-action="backup">${icon('download')}Download editable JSON</button><button class="button secondary" data-action="import">${icon('upload')}Upload PDF or JSON</button><button class="button secondary" data-action="paste-json">Paste JSON</button><button class="button secondary" data-action="print">${icon('print')}Print resume</button><a class="button secondary" href="assets/original.pdf" download="SundarResume-original.pdf" style="text-decoration:none">${icon('file')}Download original PDF</a></div><p class="field-help" style="margin-top:2px">Upload a PDF downloaded from this builder to continue editing. JSON files keep your full draft, including hidden sections. Files are opened on your device.</p><div class="layout-divider"></div><p class="layout-label">A FRESH START</p><div class="file-actions"><button class="button secondary" data-action="blank">${icon('plus')}Start with a blank resume</button><button class="button secondary" data-action="restore">${icon('reset')}Restore original content</button></div>`;
}
const iconGraphic=contactIconSVG;
function previewNode(n){
 if(n.type==='line')return `<line x1="${n.x}" y1="${n.y}" x2="${n.x2}" y2="${n.y}" stroke="#000" stroke-width="${n.width}"/>`;
 if(n.type==='icon')return iconGraphic(n);
 const text=`<text x="${n.xs?n.xs.join(' '):n.x}" y="${n.y}" font-family="${n.font},Fallback,serif" font-size="${n.size}" xml:space="preserve" style="fill:${n.color||'#000'}"${n.underline?' text-decoration="underline"':''}>${esc(n.text)}</text>`;
 return n.href?`<a class="resume-link" href="${esc(n.href)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(n.text)} — ${esc(n.href)}"><title>${esc(n.href)}</title>${text}</a>`:text;
}
function renderPreview(){
 layout=createLayout(data,metrics);$('#page-count').textContent=layout.pages.length+(layout.pages.length===1?' page':' pages');
 $('#pages').innerHTML=layout.pages.map((page,i)=>`<div class="paper-wrapper"><svg class="paper" viewBox="0 0 612 792" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Resume page ${i+1}"><title>Resume page ${i+1}</title>${page.map(previewNode).join('')}</svg><span class="paper-label">${String(i+1).padStart(2,'0')} / ${String(layout.pages.length).padStart(2,'0')}</span></div>`).join('');
 $('#format-note').innerHTML=icon(layout.warnings.length?'file':'lock')+esc(layout.warnings[0]||'Original format preserved. Your content reflows as you edit.');
 $('#format-note').style.color=layout.warnings.length?'#a56d41':'';applyZoom();
}
function applyZoom(){document.querySelectorAll('.paper-wrapper').forEach(el=>{el.style.width=zoom==='fit'?'100%':612*zoom/100+'px';el.style.maxWidth=zoom==='fit'?'850px':'none'});$('#pages').style.overflowX=zoom==='fit'?'visible':'auto';$('#pages').style.alignItems=zoom==='fit'?'center':'flex-start';$('#zoom-level').textContent=zoom==='fit'?'Fit':zoom+'%'}
function updateHistory(){$('#undo').disabled=!undo.length;$('#redo').disabled=!redo.length;}
function checkpoint(){undo.push(clone(data));if(undo.length>50)undo.shift();redo=[];updateHistory()}
function save(){clearTimeout(saveTimer);$('#save-status').textContent='Saving…';saveTimer=setTimeout(()=>{try{localStorage.setItem(key,JSON.stringify(data));storageFailed=false;$('#save-status').textContent='Saved on this device'}catch{storageFailed=true;$('#save-status').textContent='Download a backup to save';toast('Browser storage is full or unavailable. Download a backup to keep your edits.')}},350)}
function changed(rerender=false){save();if(rerender){rememberOpen();renderEditor()}clearTimeout(previewTimer);previewTimer=setTimeout(renderPreview,40);}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('visible'),3500)}
function downloadBytes(bytes,name,type){const url=URL.createObjectURL(new Blob([bytes],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000)}
const filename=()=>data.personal.name.trim().replace(/[^\p{L}\p{N}]+/gu,'_').replace(/^_|_$/g,'')||'Resume';
async function downloadPDF(){
 clearTimeout(previewTimer);renderPreview();if(layout.warnings.some(x=>x.startsWith('This template'))){toast(layout.warnings.find(x=>x.startsWith('This template')));return}
 const b=$('#download');b.disabled=true;b.innerHTML=icon('download')+'Preparing…';
 try{const bytes=await buildPDF(layout,metrics,async file=>{const r=await fetch('assets/fonts/'+file);if(!r.ok)throw Error('Could not load a resume font. Please retry.');return new Uint8Array(await r.arrayBuffer())},createResumeFile(data,{visibleOnly:true}));downloadBytes(bytes,filename()+'_Resume.pdf','application/pdf');toast('PDF downloaded. Upload this copy later to keep editing.')}catch(e){toast(e.message||'Export failed. Please try again.')}finally{b.disabled=false;b.innerHTML=icon('download')+'Download PDF'}
}
function modal(title,body,actions=''){const dialog=$('#dialog');dialog.style.maxWidth='480px';$('#dialog-body').innerHTML=`<h2>${esc(title)}</h2>${body}${actions?`<div class="dialog-actions">${actions}</div>`:''}`;dialog.showModal()}
function confirmAction(title,description,fn){modal(title,`<p>${esc(description)}</p>`,`<button class="button secondary" data-action="close-dialog">Cancel</button><button class="button primary" id="confirm-action">Continue</button>`);$('#confirm-action').onclick=()=>{$('#dialog').close();checkpoint();fn();changed(true)}}
function formatTextStyle(path,style='bold'){
 const input=[...document.querySelectorAll('.bullet-row textarea[data-path], .format-field input[data-path], .format-field textarea[data-path]')].find(el=>el.dataset.path===path);
 if(!input)return;
 try{
  const toggle=style==='italic'?toggleBulletItalic:toggleBulletBold;
  const result=toggle(get(path),input.selectionStart,input.selectionEnd);
  checkpoint();set(path,result.text);editing=false;clearTimeout(historyTimer);
  input.value=result.text;const links=input.closest('.bullet-row')?.querySelector('.bullet-links');if(links)links.innerHTML=bulletLinkControls(result.text,path);
  input.focus();input.setSelectionRange(result.start,result.end);changed();
 }catch(err){toast(err.message);input.focus()}
}
function editBulletLink(path,button){
 const input=[...document.querySelectorAll('textarea[data-path]')].find(el=>el.dataset.path===path);
 if(!input)return;
 const text=get(path),links=parseInlineLinks(text).filter(r=>r.href);
 let start=input.selectionStart,end=input.selectionEnd;
 const existing=button.dataset.linkStart!==undefined?links.find(r=>r.start===Number(button.dataset.linkStart)):links.find(r=>start>=r.start&&end<=r.end);
 if(!existing&&links.some(r=>start<r.end&&end>r.start)){toast('Select plain words, or click an existing link below the bullet to edit it.');return}
 if(existing){start=existing.start;end=existing.end}
 const selected=existing?.text??text.slice(start,end);
 modal(existing?'Edit bullet link':'Add a bullet link',`<p>Select words in your bullet before adding a link, or enter display text below to insert at the cursor. A supplied display name is blue and underlined. Leave it blank to show the URL.</p><label class="field"><span>Display text (optional)</span><input id="bullet-link-text" value="${esc(selected)}" maxlength="2000"></label><label class="field"><span>Website URL</span><input id="bullet-link-url" type="url" placeholder="https://example.com" value="${esc(existing?.href||'')}"></label><p id="bullet-link-error" role="alert"></p>`,`<button class="button secondary" data-action="close-dialog">Cancel</button>${existing?'<button class="button secondary" id="remove-bullet-link">Remove link</button>':''}<button class="button primary" id="save-bullet-link">${existing?'Save link':'Add link'}</button>`);
 const commit=replacement=>{
  checkpoint();set(path,text.slice(0,start)+replacement+text.slice(end));editing=false;clearTimeout(historyTimer);$('#dialog').close();changed(true);
  const next=[...document.querySelectorAll('textarea[data-path]')].find(el=>el.dataset.path===path);next?.focus();next?.setSelectionRange(start+replacement.length,start+replacement.length);
 };
 $('#save-bullet-link').onclick=()=>{
  try{const replacement=inlineLinkMarkup($('#bullet-link-text').value,$('#bullet-link-url').value);if(text.length-(end-start)+replacement.length>20000)throw Error('This bullet is too long. Shorten it before adding a link.');commit(replacement)}catch(err){$('#bullet-link-error').textContent=err.message}
 };
 if(existing)$('#remove-bullet-link').onclick=()=>commit(existing.text);
 (selected?$('#bullet-link-url'):$('#bullet-link-text')).focus();
}
function chooseSection(){modal('Add a section','<p>Choose a structure. It will use the same fonts, headings, and spacing as your original.</p><div class="section-choices">'+[['experience','Experience','Companies, role timelines & projects'],['projects','Projects','Projects, stacks & bullets'],['education','Education','Institutions & qualifications'],['skills','Technical skills','Categories & skills'],['bullets','Custom section','Achievements, links & more']].map(([type,title,desc])=>`<button class="section-choice" data-action="new-section" data-type="${type}">${title}<span>${desc}</span></button>`).join('')+'</div>','<button class="button secondary" data-action="close-dialog">Cancel</button>')}
const blankBullet=()=>({text:''});
const templates={company:()=>({name:'',url:'',dates:'',location:'',stack:'',roles:[templates.role()]}),role:()=>({title:'',dates:'',entityName:'',entityUrl:'',entityDates:'',entityLocation:'',entityStack:'',projects:[{name:'',stack:'',dates:'',bullets:[blankBullet()]}]}),project:()=>({name:'',stack:'',dates:'',bullets:[blankBullet()]}),education:()=>({name:'',location:'',qualification:'',score:'',dates:''}),skill:()=>({label:'',value:''}),bullet:blankBullet};
function action(action,path,button){
 if(action==='toggle-company'){
  const company=get(path),collapsed=!collapsedCompanies.has(company);
  if(collapsed)collapsedCompanies.add(company);else collapsedCompanies.delete(company);
  button.closest('.company-card').querySelector('.company-content').hidden=collapsed;
  button.setAttribute('aria-expanded',String(!collapsed));
  const label=(collapsed?'Expand':'Collapse')+' company '+(company.name||'Untitled company');
  button.setAttribute('aria-label',label);button.title=label;return;
 }
 if(action==='bullet-bold'||action==='bullet-italic'){formatTextStyle(path,action==='bullet-italic'?'italic':'bold');return}
 if(action==='bullet-link'){editBulletLink(path,button);return}
 if(action==='close-dialog'){$('#dialog').close();return}
 if(action==='backup'){const stamp=new Date().toISOString().slice(0,19).replace(/[T:]/g,'-');downloadBytes(JSON.stringify(createResumeFile(data),null,2),filename()+'_Resume_'+stamp+'.json','application/json');toast('Editable file downloaded. Upload it here to continue later.');return}
 if(action==='paste-json'){
  modal('Import JSON content',`<p>Paste a Resume Studio JSON export. Review the resume name before replacing this draft.</p><label class="field"><span>Resume JSON</span><textarea id="paste-json-content" rows="10" spellcheck="false" placeholder='{"format":"resume-studio", ...}'></textarea></label><p id="paste-json-error" role="alert"></p>`,`<button class="button secondary" data-action="close-dialog">Cancel</button><button class="button primary" id="review-pasted-json">Review import</button>`);
  $('#review-pasted-json').onclick=()=>{
   try{
    const text=$('#paste-json-content').value;
    if(text.length>2*1024*1024)throw Error('The editable resume data is too large to open.');
    const next=validateBackup(unwrapResumeFile(JSON.parse(text)));
    const sections=next.sections.filter(section=>section.enabled).length;
    modal('Import this resume?',`<p><strong>${esc(next.personal.name||'Untitled resume')}</strong> · ${sections} sections</p><p>This replaces the current draft. You can undo the change.</p>`,`<button class="button secondary" data-action="close-dialog">Cancel</button><button class="button primary" id="confirm-pasted-json">Import resume</button>`);
    $('#confirm-pasted-json').onclick=()=>{checkpoint();data=next;editing=false;clearTimeout(historyTimer);openSections=new Set(['personal']);$('#dialog').close();switchTab('content');changed(true);toast('JSON imported and saved on this device.');};
   }catch(err){$('#paste-json-error').textContent=err instanceof SyntaxError?'The pasted text is not valid JSON.':(err.message||'Could not open this resume.');}
  };
  $('#paste-json-content').focus();return;
 }
 if(action==='import'){$('#import-file').click();return}
 if(action==='print'){renderPreview();document.fonts.ready.then(()=>window.print());return}
 if(action==='new-section'){const type=button.dataset.type;checkpoint();const titles={experience:'Experience',projects:'Projects',education:'Education',skills:'Technical Skills',bullets:'New Section'};const kinds={experience:'company',projects:'project',education:'education',skills:'skill',bullets:'bullet'};const id='section-'+Date.now();data.sections.push({id,type,title:titles[type],enabled:true,pageBreak:false,items:[templates[kinds[type]]()]});openSections.add(id);$('#dialog').close();changed(true);return}
 if(action==='restore'){confirmAction('Restore the original?','This replaces your current content with the uploaded resume. You can undo this change.',()=>{data=clone(seed);toast('Original resume restored.')});return}
 if(action==='blank'){confirmAction('Start a new resume?','Your current content will be cleared, keeping the original template. Download a backup first if you want a separate copy. You can also undo this change.',()=>{data=clone(seed);data.personal={name:'',role:'',location:'',phone:'',email:'',linkedin:'',portfolio:'',phoneName:'',emailName:'',linkedinName:'',portfolioName:''};data.sections.forEach(s=>{const kinds={experience:'company',projects:'project',education:'education',skills:'skill',bullets:'bullet'};s.items=[templates[kinds[s.type]]()];s.pageBreak=false});toast('A clean page, in your original format.')});return}
 if(action==='reset-layout'){checkpoint();data.layout=clone(seed.layout);changed(true);return}
 if(action==='remove'){const item=get(path);const isSection=/^sections\.\d+$/.test(path);const isBullet=/\.(bullets|items)\.\d+$/.test(path)&&item?.text!==undefined;
  const remove=()=>{const parts=path.split('.'),index=Number(parts.pop());get(parts.join('.')).splice(index,1)};
  if(isBullet&&!item.text.trim()){checkpoint();remove();changed(true)}else confirmAction(isSection?'Remove this section?':isBullet?'Remove this bullet?':'Remove this entry?','This removes the selected content from the resume. You can undo the change.',remove);return}
 checkpoint();
 if(action==='move-up'||action==='move-down'){const parts=path.split('.'),index=Number(parts.pop()),array=get(parts.join('.')),next=index+(action==='move-up'?-1:1);if(next>=0&&next<array.length)[array[index],array[next]]=[array[next],array[index]];}
 if(action.startsWith('add-')){const type=action.slice(4);get(path).push(templates[type]());if(type==='project'&&path.includes('.roles.'))openProjects.add(path+'.'+(get(path).length-1));}
 changed(true);
}
const validateBackup=raw=>{const next=normalizeResume(raw,seed);return Number(raw.version??1)<3?flattenCompanyEntities(groupSpecbeeExperience(next)):next};

function undoAction(){if(!undo.length)return;redo.push(clone(data));data=undo.pop();editing=false;clearTimeout(historyTimer);changed(true);toast('Change undone.')}
function redoAction(){if(!redo.length)return;undo.push(clone(data));data=redo.pop();editing=false;clearTimeout(historyTimer);changed(true);toast('Change redone.')}
// Events preserve input focus; only the preview changes while typing.
document.addEventListener('input',e=>{const el=e.target;if(!el.dataset.path||!['INPUT','TEXTAREA'].includes(el.tagName))return;if(!editing){checkpoint();editing=true}clearTimeout(historyTimer);historyTimer=setTimeout(()=>editing=false,700);const value=el.type==='checkbox'?el.checked:el.type==='range'?Number(el.value):el.value;set(el.dataset.path,value);const companyCard=el.closest('.company-card');if(companyCard&&el.dataset.path===companyCard.dataset.path+'.name'){
 const toggle=companyCard.querySelector('.company-toggle'),name=value||'Untitled company';
 toggle.querySelector('.company-name').textContent=name;
 const label=(toggle.getAttribute('aria-expanded')==='true'?'Collapse':'Expand')+' company '+name;toggle.setAttribute('aria-label',label);toggle.title=label;
}const linkControls=el.closest('.bullet-row')?.querySelector('.bullet-links');if(linkControls)linkControls.innerHTML=bulletLinkControls(value,el.dataset.path);const project=el.closest('.experience-project');if(project&&el.dataset.path===project.dataset.path+'.name')project.querySelector('summary>span').textContent=value||'Untitled project';if(el.type==='range')el.parentElement.querySelector('output').textContent=value+'%';changed();});
document.addEventListener('change',e=>{const el=e.target;if(el.tagName==='SELECT'&&el.dataset.path){checkpoint();set(el.dataset.path,Number(el.value));changed()}if(el.type==='checkbox'&&el.dataset.path){rememberOpen();renderEditor()}});
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b){editing=false;action(b.dataset.action,b.dataset.path,b)}});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&!e.altKey&&['b','i'].includes(e.key.toLowerCase())&&document.activeElement.matches('.bullet-row textarea[data-path], .format-field input[data-path], .format-field textarea[data-path]')){e.preventDefault();formatTextStyle(document.activeElement.dataset.path,e.key.toLowerCase()==='i'?'italic':'bold');return}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();e.shiftKey?redoAction():undoAction()}});
$('#undo').onclick=undoAction;$('#redo').onclick=redoAction;$('#download').onclick=downloadPDF;
$('#add-section').onclick=chooseSection;$('#add-section').innerHTML=icon('plus')+'Add a section';
$('#content-tab').onclick=()=>switchTab('content');$('#layout-tab').onclick=()=>switchTab('layout');
function switchTab(tab){['content','layout'].forEach(t=>{$('#'+t+'-tab').setAttribute('aria-selected',String(t===tab));$('#'+t+'-panel').hidden=t!==tab})}
$('#content-tab').onkeydown=$('#layout-tab').onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const t=e.target.id==='content-tab'?'layout':'content';switchTab(t);$('#'+t+'-tab').focus()}};
$('#reference').innerHTML=icon('eye')+'View original';$('#reference').onclick=()=>{modal('Your original resume','<p>The uploaded PDF is the template for this builder.</p><div style="max-height:65vh;overflow:auto;background:#eef0e9;padding:12px"><img src="assets/reference-1.png" alt="Original resume, page 1" style="display:block;width:100%;margin-bottom:15px"><img src="assets/reference-2.png" alt="Original resume, page 2" style="display:block;width:100%"></div>','<a class="button secondary" href="assets/original.pdf" target="_blank" rel="noopener">Open PDF</a><button class="button primary" data-action="close-dialog">Back to editing</button>');$('#dialog').style.maxWidth='760px'};
$('#zoom-out').innerHTML=icon('minus');$('#zoom-in').innerHTML=icon('plus');$('#zoom-out').onclick=()=>{zoom=Math.max(50,(zoom==='fit'?100:zoom)-10);applyZoom()};$('#zoom-in').onclick=()=>{zoom=Math.min(150,(zoom==='fit'?100:zoom)+10);applyZoom()};$('#zoom-level').onclick=()=>{zoom='fit';applyZoom()};
$('#undo').innerHTML=icon('undo');$('#redo').innerHTML=icon('redo');$('#download').innerHTML=icon('download')+'Download PDF';$('.lock-icon').innerHTML=icon('lock');$('.upload-icon').innerHTML=icon('upload');$('.portable-icon').innerHTML=icon('file');
$('#import-file').addEventListener('change',async e=>{
 const file=e.target.files[0];if(!file)return;
 const uploads=document.querySelectorAll('[data-action="import"]');uploads.forEach(button=>button.disabled=true);
 try{
  toast('Opening your resume…');
  const next=validateBackup(await readResumeFile(file));
  const sections=next.sections.filter(section=>section.enabled).length;
  modal('Open this resume?',`<p><strong>${esc(file.name)}</strong><br>${esc(next.personal.name||'Untitled resume')} · ${sections} sections</p><p>This replaces the current draft. Your uploaded file is kept on your device, and you can undo the change.</p>`,`<button class="button secondary" data-action="close-dialog">Cancel</button><button class="button primary" id="confirm-import">Open resume</button>`);
  $('#confirm-import').onclick=()=>{
   checkpoint();data=next;editing=false;clearTimeout(historyTimer);openSections=new Set(['personal']);
   $('#dialog').close();switchTab('content');changed(true);toast('Resume opened. You can now edit content or add bullets.');
  };
 }catch(err){toast(err.message||'Could not open this resume. Choose a Resume Studio PDF or JSON file.');}
 finally{uploads.forEach(button=>button.disabled=false);e.target.value='';}
});
$('#dialog').addEventListener('click',e=>{if(e.target===$('#dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close()}});
try{
 const responses=await Promise.all([fetch(updatedResume?'assets/resume-2026-11-17-corrected.json':'assets/seed.json'),fetch('assets/fonts/metrics.json')]);if(responses.some(r=>!r.ok))throw Error('Could not load the resume template.');[seed,metrics]=await Promise.all(responses.map(r=>r.json()));seed=normalizeResume(seed,seed);data=clone(seed);
 try{const saved=localStorage.getItem(key);if(saved){const raw=JSON.parse(saved);data=validateBackup(raw)}}catch{toast('Could not open the saved draft. The original resume has been loaded.')}
 await Promise.all(['CMRoman','CMBold','CMItalic','CMBoldItalic','CMSmallCaps'].map(f=>document.fonts.load(`12px ${f}`)));renderEditor();renderPreview();
}catch(err){$('#section-editor').innerHTML=`<div style="padding:25px"><p>${esc(err.message)}</p><button class="button secondary" onclick="location.reload()">Reload</button></div>`;$('#download').disabled=true;}
window.addEventListener('pagehide',()=>{if(data)try{localStorage.setItem(key,JSON.stringify(data))}catch{}});
