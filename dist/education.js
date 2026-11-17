// Keep scores entered during the separate-score version in the original inline row.
export function inlineEducationQualification(entry){
 const qualification=String(entry.qualification??''),score=String(entry.score??'').trim();
 if(!score||entry.scoreInQualification)return qualification;
 const match=qualification.match(/^(.*?)(?:\s*[—–|]\s*|\s+-\s+|\s*\(\s*)((?:CGPA|GPA|Percentage|Percent|Marks|Score)\s*[:=]?\s*\d+(?:[.,]\d+)?\s*(?:%|\/\s*\d+(?:[.,]\d+)?|out of\s+\d+(?:[.,]\d+)?)?)\s*\)?$/i);
 if(qualification.includes(score))return qualification;
 const degree=match?match[1].trimEnd():qualification;
 return degree?degree+' — '+score:score;
}
