const fs=require('fs'),path=require('path'),postcss=require('postcss'),parser=require('postcss-selector-parser');
const root=path.resolve(__dirname,'..'),pairs=JSON.parse(fs.readFileSync(path.join(__dirname,'revenue-pages.json'),'utf8'));
const shared=['assets/includes/header.html','assets/includes/footer.html',...fs.readdirSync(path.join(root,'assets/js')).filter(x=>x.endsWith('.js')).map(x=>'assets/js/'+x)];
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
for(const [i,pair] of pairs.entries()){
 const source=[...pair,...shared].map(f=>fs.readFileSync(path.join(root,f),'utf8').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'')).join('\n');
 const extra=pair.some(f=>f.startsWith('tours/'))?fs.readFileSync(path.join(root,'assets/css/pages/tour-collection.css'),'utf8'):'';
 const css=postcss.parse(fs.readFileSync(path.join(root,'assets/css/site.css'),'utf8')+'\n'+extra);
 css.walkRules(rule=>{if(rule.parent.type==='atrule'&&/keyframes$/.test(rule.parent.name))return;const ast=parser().astSync(rule.selector);const nodes=ast.nodes.filter(sel=>{
  if(/:(?:not|is|where)\(/.test(sel.toString()))return true;
  let keep=true;sel.walkAttributes(a=>{if(['data-page-type','data-page-content-group','data-tour-variant'].includes(a.attribute)&&a.operator==='='&&!source.includes(a.attribute+'="'+a.value+'"'))keep=false});
  sel.walkClasses(c=>{if(!new RegExp('(^|[^\\w-])'+esc(c.value)+'([^\\w-]|$)').test(source))keep=false});sel.walkIds(c=>{if(!new RegExp('(^|[^\\w-])'+esc(c.value)+'([^\\w-]|$)').test(source))keep=false});return keep;
 });if(!nodes.length)rule.remove();else rule.selector=nodes.map(x=>x.toString()).join(',');});
 css.walkComments(c=>c.remove());css.walkAtRules(a=>{if(a.name==='import'||(a.nodes&&!a.nodes.length))a.remove()});css.walk(n=>{if(n.raws){n.raws.before='';n.raws.after='';n.raws.between=n.type==='decl'?':':''}});
 const result='/* Generated revenue CSS pair '+i+' */\n'+css.toString();
 fs.writeFileSync(path.join(root,'assets/css/revenue-'+i+'.css'),result);
 for(const name of pair){const file=path.join(root,name);let html=fs.readFileSync(file,'utf8');for(const [kind,id,content] of [['revenue','mbwRevenueCSS',result],['header','mbwHeaderCSS',fs.readFileSync(path.join(root,'assets/css/header.css'),'utf8')],['fonts','mbwFonts',fs.readFileSync(path.join(root,'assets/fonts/brand-fonts.css'),'utf8')]]){
  const pattern=new RegExp('<!-- MBW inline '+kind+' start -->[\\s\\S]*?<!-- MBW inline '+kind+' end -->');if(!pattern.test(html))throw Error('Missing '+kind+' block in '+name);html=html.replace(pattern,()=> '<!-- MBW inline '+kind+' start -->\n<style id="'+id+'">'+content+'</style>\n<!-- MBW inline '+kind+' end -->');
 }fs.writeFileSync(file,html)}console.log(pair[0],Buffer.byteLength(result));
}
