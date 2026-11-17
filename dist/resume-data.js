import {inlineEducationQualification} from './education.js';
export function normalizeResume(raw,seed){
 if(!raw||typeof raw!=='object'||!raw.personal||!Array.isArray(raw.sections)||raw.sections.length>30)throw Error('This is not a Resume Studio backup.');
 const str=(v,max=20000)=>{if(typeof v!=='string'||v.length>max)throw Error('The backup contains an invalid text field.');return v};
 const list=(arr,fn)=>{if(!Array.isArray(arr)||arr.length>150)throw Error('The backup contains an invalid list.');return arr.map(fn)};
 const bullet=b=>({text:str(b.text)});
 const project=p=>({name:str(p.name),stack:str(p.stack??''),dates:str(p.dates??''),bullets:list(p.bullets,bullet)});
 const role=r=>({title:str(r.title),dates:str(r.dates),entityName:str(r.entityName??''),entityUrl:str(r.entityUrl??'',2000),entityDates:str(r.entityDates??''),entityLocation:str(r.entityLocation??''),entityStack:str(r.entityStack??''),projects:r.projects===undefined?[{name:'Other',stack:'',dates:'',bullets:list(r.bullets,bullet)}]:list(r.projects,project)});
 const entity=e=>({name:str(e.name),url:str(e.url??'',2000),dates:str(e.dates??''),location:str(e.location??''),stack:str(e.stack??''),roles:list(e.roles??[],role)});
 const section=(s,i)=>{if(!['experience','projects','education','skills','bullets'].includes(s.type))throw Error('Unrecognized section type.');let fn;
  if(s.type==='experience')fn=c=>({name:str(c.name),url:str(c.url??'',2000),dates:str(c.dates??''),location:str(c.location??''),stack:str(c.stack??''),roles:list(c.roles??[],role),entities:list(c.entities??[],entity)});
  if(s.type==='projects')fn=p=>({name:str(p.name),stack:str(p.stack),dates:str(p.dates),bullets:list(p.bullets,bullet)});
  if(s.type==='education')fn=e=>{
   const original=str(e.qualification),score=str(e.score??''),qualification=str(inlineEducationQualification({...e,qualification:original,score}));
   return {name:str(e.name),location:str(e.location),qualification,score,scoreInQualification:true,...(e.previousQualification!==undefined?{previousQualification:str(e.previousQualification)}:qualification!==original?{previousQualification:original}:{}),dates:str(e.dates)};
  };
  if(s.type==='skills')fn=e=>({label:str(e.label),value:str(e.value)});
  if(s.type==='bullets')fn=bullet;
  return {id:'imported-'+i,type:s.type,title:str(s.title,150),enabled:s.enabled!==false,pageBreak:!!s.pageBreak,items:list(s.items,fn)};
 };
 const l=raw.layout||{},clamp=(n,min,max,def)=>typeof n==='number'&&Number.isFinite(n)?Math.min(max,Math.max(min,n)):def;
 const out={version:4,personal:Object.fromEntries(['name','role','location','phone','email','linkedin','portfolio','phoneName','emailName','linkedinName','portfolioName'].map(k=>[k,str(raw.personal[k]??(k==='role'?'Technical Lead | Backend systems':''),1000)])),layout:{fontScale:clamp(l.fontScale,90,110,100),spacing:clamp(l.spacing,85,115,100),margin:[36,45,54].includes(l.margin)?l.margin:36},sections:raw.sections.map(section)};
 // Reattach measured line positions to unchanged original bullet text.
 const originals=new Map();
 const visitRoles=(resume,fn)=>resume?.sections.filter(s=>s.type==='experience').forEach(s=>s.items.forEach(c=>[...(c.roles||[]),...(c.entities||[]).flatMap(e=>e.roles||[])].forEach(fn)));
 visitRoles(seed,r=>(r.projects?r.projects.flatMap(p=>p.bullets):r.bullets||[]).forEach(b=>originals.set(b.text,b)));
 visitRoles(out,r=>r.projects.forEach(p=>p.bullets=p.bullets.map(b=>originals.has(b.text)?structuredClone(originals.get(b.text)):b)));
 return flattenCompanyEntities(out);
}

// One-time migration of the owner's earlier separate company entries. Never discard projects or edited bullets.
export function groupSpecbeeExperience(resume){
 for(const section of resume.sections.filter(s=>s.type==='experience')){
  const candidates=section.items.filter(c=>/^trumetric\.ai(?:\s|$)/i.test(c.name)||/^livine(?:\s|$)/i.test(c.name));
  if(!candidates.length)continue;
  let parent=section.items.find(c=>/^specbee$/i.test(c.name.trim()));
  const first=section.items.indexOf(candidates[0]);
  if(!parent)parent={name:'Specbee',url:'https://www.specbee.com/',dates:'Apr 2022 - Oct 2026',location:candidates[0].location||'Bengaluru, IN',stack:'',roles:[],entities:[]};
  parent.entities??=[];
  for(const company of candidates){
   const trumetric=/^trumetric/i.test(company.name);
   const entity={...company,name:trumetric?'Trumetric.AI':company.name,dates:trumetric?'Apr 2026 - Oct 2026':'Apr 2022 - Mar 2026',url:company.url||(!trumetric?'https://www.livine.io/':''),roles:structuredClone(company.roles||[])};
   delete entity.entities;
   if(trumetric)entity.roles.forEach(r=>r.dates=r.dates.replace(/Present|Current/gi,'Oct 2026'));
   // Correct the original template's open-ended Livine lead tenure while preserving other role dates.
   if(!trumetric)entity.roles.forEach(r=>r.dates=r.dates.replace(/Present|Current/gi,'Mar 2026'));
   parent.entities.push(entity);
  }
  section.items=section.items.filter(c=>!candidates.includes(c));
  if(!section.items.includes(parent))section.items.splice(first,0,parent);
 }
 return resume;
}

// Version 4: an entity is optional metadata on a role, never an extra printed heading.
export function flattenCompanyEntities(resume){
 for(const section of resume.sections.filter(s=>s.type==='experience'))for(const company of section.items){
  company.roles??=[];
  for(const entity of company.entities||[]){
   const roles=entity.roles.length?entity.roles:[{title:'',dates:'',projects:[]}];
   for(const role of roles)company.roles.push({...role,entityName:role.entityName||entity.name||'',entityUrl:role.entityUrl||entity.url||'',entityDates:role.entityDates||entity.dates||'',entityLocation:role.entityLocation||entity.location||'',entityStack:role.entityStack||entity.stack||''});
  }
  delete company.entities;
 }
 return resume;
}
