const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const articles=s=>s.match(/<article\b[\s\S]*?<\/article>/g)||[];
for(const prefix of ['','en/']){
 const jinze=read(prefix+'members/jinze-he.html'), pan=read(prefix+'members/yiming-pan.html'),pub=read(prefix+'publications.html'),home=read(prefix+'index.html');
 assert.equal(articles(jinze).length,4);assert.equal(articles(pan).length,67);
 assert.equal(articles(pub).filter(s=>s.includes('Jinze He')).length,4);
 for(const doc of [jinze,pan,pub])for(const id of ['ae4156','2605.06199'])assert.equal(doc.split(`data-paper-id="${id}"`).length-1,1);
 assert.match(home,/class="member-work-link" href="[^"]*jinze-he.html">[^<]*<!-- -->4<!-- -->/);
 assert.match(jinze,/(?:参与成果|Contributions) · <!-- -->4/);
 const sep=jinze.indexOf('<h3 class="subsection-title">');
 assert.equal(articles(jinze.slice(0,sep)).length,2);assert.equal(articles(jinze.slice(sep)).length,2);
 const panSep=pan.indexOf('<h3 class="subsection-title">');
 assert.equal(articles(pan.slice(0,panSep)).length,53);assert.equal(articles(pan.slice(panSep)).length,14);
 assert.match(pan,/(?:发表与接收成果|Published &amp; accepted work) · 53/);
 assert.equal(home.split('id="ai4s-home-title"').length-1,1);
 assert.equal(read(prefix+'research.html').split('id="ai4s"').length-1,1);
}
console.log('PASS: bilingual Jinze 2 published + 2 preprints; global associations match; Pan 53 + 14; banners linked once.');
