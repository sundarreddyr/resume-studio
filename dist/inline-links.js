import {normalizeWebUrl} from './links.js';

// Keep links in the existing text field so older drafts need no migration.
export function parseInlineLinks(value){
 const text=String(value??''),runs=[];
 const pattern=/\[([^\[\]\n]+)\]\(([^\s()]+)\)/g;
 let at=0;
 for(const match of text.matchAll(pattern)){
  const href=normalizeWebUrl(match[2]);
  if(!href)continue;
  if(match.index>at)runs.push({text:text.slice(at,match.index)});
  runs.push({text:match[1],href,named:match[1]!==match[2],start:match.index,end:match.index+match[0].length});
  at=match.index+match[0].length;
 }
 if(at<text.length)runs.push({text:text.slice(at)});
 return runs;
}
export function inlineLinkMarkup(label,url){
 if(/[\[\]\n\r]/.test(label))throw Error('Choose link text without square brackets or line breaks.');
 const href=normalizeWebUrl(url);
 if(!href)throw Error('Enter a valid http or https website URL.');
 return '['+(label.trim()?label:href)+']('+href.replace(/\(/g,'%28').replace(/\)/g,'%29')+')';
}
