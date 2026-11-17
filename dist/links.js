export const COMPANY_LINK_COLOR='#215fa6';
export function normalizeWebUrl(value){
 const text=String(value??'').trim();
 if(!text||/[\u0000-\u001f\u007f]/.test(text))return '';
 const candidate=/^[a-z][a-z0-9+.-]*:/i.test(text)?text:text.startsWith('//')?'https:'+text:'https://'+text;
 try{
  const url=new URL(candidate);
  if(!['http:','https:'].includes(url.protocol)||!url.hostname||url.username||url.password)return '';
  return url.href;
 }catch{return '';}
}
