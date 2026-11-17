const circle='M 22 12 C 22 17.523 17.523 22 12 22 C 6.477 22 2 17.523 2 12 C 2 6.477 6.477 2 12 2 C 17.523 2 22 6.477 22 12 Z';
const paths={
 mail:['M 3 5 L 21 5 L 21 19 L 3 19 Z','M 3 5 L 12 12 L 21 5'],
 phone:['M 6 3 L 3 6 C 3 13 11 21 18 21 L 21 18 L 16 14 L 13 16 C 10 14 8 12 7 9 L 10 7 Z'],
 linkedin:['M 3 3 L 21 3 L 21 21 L 3 21 Z','M 7 10 L 7 17','M 7 7 L 7 7.1','M 11 17 L 11 10 L 11 12 C 13 8 17 10 17 13 L 17 17'],
 portfolio:[circle,'M 2 12 L 22 12','M 12 2 C 6 7 6 17 12 22 C 18 17 18 7 12 2 Z']
};
export function contactIconSVG(n){return `<g transform="translate(${n.x} ${n.y-n.size*.82}) scale(${n.size/24})" fill="none" stroke="#000" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${(paths[n.icon]||paths.portfolio).map(d=>`<path d="${d}"/>`).join('')}</g>`}
export function contactIconPDF(n){
 const commands=(paths[n.icon]||paths.portfolio).map(path=>{let result='',op='',values=[];const emit=()=>{if(op)result+=values.join(' ')+' '+({M:'m',L:'l',C:'c',Z:'h'}[op])+'\n';values=[]};for(const part of path.split(/\s+/)){if(/^[MLCZ]$/.test(part)){emit();op=part}else values.push(part)}emit();return result+'S\n'}).join('');
 return `q ${n.size/24} 0 0 ${-n.size/24} ${n.x} ${792-n.y+n.size*.82} cm 0 G 1.7 w 1 J 1 j\n${commands}Q\n`;
}
