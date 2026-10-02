const context=$('Prepare GA4 Reports').first().json;
if($json.error||!Array.isArray($json.reports)||$json.reports.length!==context.labels.length)return [{json:{ok:false,error:'GA4 report unavailable. Check credential, property access and Analytics Data API enablement.'}}];
const result={ok:true,property_id:'474681565',schema_version:context.schema_version,exclusions:context.exclusions||[],start:context.start,end:context.end,updated_at:new Date().toISOString(),reports:{}};
$json.reports.forEach((report,i)=>{
 const rows=(report.rows||[]).map(row=>{const out={};(report.dimensionHeaders||[]).forEach((h,j)=>out[h.name]=row.dimensionValues[j].value);(report.metricHeaders||[]).forEach((h,j)=>out[h.name]=Number(row.metricValues[j].value));return out;});
 result.reports[context.labels[i]]={metadata:report.metadata||{},rowCount:Number(report.rowCount||0),truncated:Number(report.rowCount||0)>rows.length,rows};
});
return [{json:result}];
