export const RESUME_ATTACHMENT='ResumeStudio.json';
const FORMAT='resume-studio';
const MAX_FILE_SIZE=10*1024*1024;
const MAX_DATA_SIZE=2*1024*1024;
export function createResumeFile(data,{visibleOnly=false}={}){
 const resume=JSON.parse(JSON.stringify(data,(key,value)=>['originalLines','originalText'].includes(key)?undefined:value));
 if(visibleOnly)resume.sections=resume.sections.filter(section=>section.enabled);
 return {format:FORMAT,schemaVersion:1,savedAt:new Date().toISOString(),resume};
}
export function unwrapResumeFile(value){
 if(value?.format===FORMAT){
  if(value.schemaVersion!==1||!value.resume)throw Error('This resume file uses a format that this version of Resume Studio cannot open.');
  return value.resume;
 }
 // Keep accepting backups downloaded before the portable file format was added.
 if(value?.personal&&Array.isArray(value.sections))return value;
 throw Error('Choose a Resume Studio PDF or editable JSON file.');
}
function decodeText(bytes){
 try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{throw Error('This file does not contain readable resume data. Choose a Resume Studio PDF or JSON file.');}
}
function parseResumeJSON(text){
 if(text.length>MAX_DATA_SIZE)throw Error('The editable resume data is too large to open.');
 let value;try{value=JSON.parse(text)}catch{throw Error('This file does not contain readable resume data. Choose a Resume Studio PDF or JSON file.');}
 return unwrapResumeFile(value);
}
export async function readResumeFile(file){
 if(!file||file.size>MAX_FILE_SIZE)throw Error('Choose a Resume Studio PDF or JSON file smaller than 10 MB.');
 const bytes=new Uint8Array(await file.arrayBuffer());
 if(new TextDecoder().decode(bytes.subarray(0,5))!=='%PDF-')return parseResumeJSON(decodeText(bytes));
 const {PDFDocument,PDFName,PDFDict,PDFArray,PDFRawStream,decodePDFRawStream}=await import('./assets/pdf-lib.esm.min.js');
 let doc;try{doc=await PDFDocument.load(bytes,{updateMetadata:false})}catch{throw Error('Could not read this PDF. If it is password-protected, upload an unlocked copy or the editable JSON file.');}
 const names=doc.catalog.lookupMaybe(PDFName.of('Names'),PDFDict);
 const embedded=names?.lookupMaybe(PDFName.of('EmbeddedFiles'),PDFDict);
 const visit=(tree,depth=0)=>{
  if(!tree||depth>12)return null;
  const pairs=tree.lookupMaybe(PDFName.of('Names'),PDFArray);
  if(pairs){for(let i=0;i+1<pairs.size();i+=2){
   const filename=pairs.lookup(i);if(typeof filename?.decodeText!=='function'||filename.decodeText()!==RESUME_ATTACHMENT)continue;
   const spec=pairs.lookup(i+1,PDFDict);const ef=spec.lookupMaybe(PDFName.of('EF'),PDFDict);
   const stream=ef?.lookupMaybe(PDFName.of('F'),PDFRawStream);if(stream)return stream;
  }}
  const kids=tree.lookupMaybe(PDFName.of('Kids'),PDFArray);
  if(kids){for(let i=0;i<kids.size();i++){const result=visit(kids.lookup(i,PDFDict),depth+1);if(result)return result;}}
  return null;
 };
 const attachment=visit(embedded);
 if(!attachment)throw Error('This PDF has no editable Resume Studio data. Upload a PDF downloaded after this update, or an existing JSON backup.');
 const content=decodePDFRawStream(attachment).decode();
 if(content.length>MAX_DATA_SIZE)throw Error('The editable resume data is too large to open.');
 return parseResumeJSON(decodeText(content));
}
