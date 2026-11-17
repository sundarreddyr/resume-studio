import {parseInlineLinks} from './inline-links.js';

const boldPattern=()=>/\*\*(?=\S)([\s\S]*?\S)\*\*/g;
const underscorePattern=()=>/(?<![\p{L}\p{N}_])_(?=\S)([\s\S]*?\S)_(?![\p{L}\p{N}_])/gu;
const italicPattern=()=>/(?<!\*)\*(?![\s*])([\s\S]*?\S)(?<!\*)\*(?!\*)/g;

// Carry styles through each pass so nested emphasis and links compose.
function applyEmphasis(chars,pattern,style,markerLength){
 const text=chars.map(c=>c.text).join(''),result=[];let at=0;
 for(const match of text.matchAll(pattern)){
  result.push(...chars.slice(at,match.index));
  result.push(...chars.slice(match.index+markerLength,match.index+match[0].length-markerLength).map(c=>({...c,[style]:true})));
  at=match.index+match[0].length;
 }
 result.push(...chars.slice(at));return result;
}
export function parseInlineFormatting(value){
 let chars=parseInlineLinks(value).flatMap(run=>run.text.split('').map(text=>({text,href:run.href,named:run.named,bold:false,italic:false})));
 chars=applyEmphasis(chars,boldPattern(),'bold',2);
 chars=applyEmphasis(chars,underscorePattern(),'italic',1);
 chars=applyEmphasis(chars,italicPattern(),'italic',1);
 const result=[];
 for(const char of chars){const last=result.at(-1);if(last&&last.href===char.href&&last.named===char.named&&last.bold===char.bold&&last.italic===char.italic)last.text+=char.text;else result.push({...char})}
 return result;
}

export const toggleBulletBold=(text,start,end)=>toggleBulletStyle(text,start,end,'bold');
export const toggleBulletItalic=(text,start,end)=>toggleBulletStyle(text,start,end,'italic');
function toggleBulletStyle(text,start,end,style){
 const prompt='Select the words you want to make '+style+' first.';
 if(start===end)throw Error(prompt);
 const selected=text.slice(start,end),leading=selected.match(/^\s*/)[0].length,trailing=selected.match(/\s*$/)[0].length;
 start+=leading;end-=trailing;
 if(start>=end)throw Error(prompt);
 for(const link of parseInlineLinks(text).filter(r=>r.href)){
  const labelStart=link.start+1,labelEnd=labelStart+link.text.length;
  if(start<link.end&&end>link.start&&!((start>=labelStart&&end<=labelEnd)||(start<=link.start&&end>=link.end)))throw Error('Select words inside the link label, or select the whole link.');
 }
 const own=style==='bold'?['**']:['_','*'],other=style==='bold'?['_','*']:['**'];
 let a=start,b=end;
 // Look through the other style's wrappers when removing one style from both.
 for(let i=0;i<3;i++){
  for(const marker of own){const n=marker.length;if(marker==='*'){const left=(text.slice(0,a).match(/\*+$/)?.[0]||'').length,right=(text.slice(b).match(/^\*+/)?.[0]||'').length;if(!((left===1&&right===1)||(left>=3&&right>=3)))continue}if(text.slice(a-n,a)===marker&&text.slice(b,b+n)===marker)return {text:text.slice(0,a-n)+text.slice(a,b)+text.slice(b+n),start:start-n,end:end-n}}
  const marker=other.find(m=>text.slice(a-m.length,a)===m&&text.slice(b,b+m.length)===m);
  if(!marker)break;a-=marker.length;b+=marker.length;
 }
 const phrase=text.slice(start,end),patterns=style==='bold'?[boldPattern()]:[underscorePattern(),italicPattern()];
 for(const pattern of patterns){
  const matches=[...phrase.matchAll(pattern)];
  if(matches.length===1&&matches[0].index===0&&matches[0][0].length===phrase.length){const n=style==='bold'?2:1;return {text:text.slice(0,start)+phrase.slice(n,-n)+text.slice(end),start,end:end-2*n}}
 }
 if(patterns.some(pattern=>[...text.matchAll(pattern)].some(m=>start<m.index+m[0].length&&end>m.index)))throw Error('Select the complete '+style+' phrase to remove '+style+', or select words without that style.');
 const marker=own[0],next=text.slice(0,start)+marker+phrase+marker+text.slice(end);
 if(next.length>20000)throw Error('This bullet is too long. Shorten it before formatting.');
 return {text:next,start:start+marker.length,end:end+marker.length};
}
