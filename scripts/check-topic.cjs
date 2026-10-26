const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
function pages(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()&&['en','members'].includes(e.name)?pages(path.join(d,e.name)):e.isFile()&&e.name.endsWith('.html')?[path.join(d,e.name)]:[])}
let count=0;
for(const file of pages(root)){
 const s=fs.readFileSync(file,'utf8'),nav=s.match(/<header[^]*?<nav[^>]*>([^]*?)<\/nav>/)?.[1];
 if(nav){assert.equal((nav.match(/href="[^"]*ai4s.html"/g)||[]).length,1,file);count++}
}
for(const prefix of ['','en/']){
 const file=path.join(root,prefix+'ai4s.html'),s=fs.readFileSync(file,'utf8');
 const ids=[...s.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
 for(const id of ['dmd','pined','localization','s4ai','papers'])assert.ok(ids.includes(id));
 assert.ok(s.includes('canonical" href="https://life-group.cn/'+prefix+'ai4s.html'));
 assert.ok(!/\.docx|pined-net-text|sources\/pined|200 keV|64 mm|Backpropagation/.test(s));
 const r=fs.readFileSync(path.join(root,prefix+'research.html'),'utf8');assert.ok(r.includes('ai4s-research-entry'));assert.ok(!r.includes('ai4s-research-banner'));assert.ok(r.includes('id="pinem-process"'));
 for(const m of s.matchAll(/href="([^"#:]*)(#[^"]+)"/g)){
  const [_,local,fragment]=m;if(/^https?:/.test(local))continue;
  const target=local ? path.resolve(local.startsWith('/')?root:path.dirname(file),local.startsWith('/')?'.'+local:local):file;
  const html=fs.readFileSync(target,'utf8');assert.ok(html.includes(`id="${fragment.slice(1)}"`),m[0]);
 }
}
const report={pagesWithTopicNavigation:count,duplicateIds:0,bilingualMetadata:true,localAnchorsValid:true,compactResearchEntries:true,noPrivatePinedMaterials:true};
console.log(report);
