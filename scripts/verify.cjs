const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'..');
const report = {verifiedAt:new Date().toISOString(),branch:cp.execFileSync('git',['branch','--show-current'],{cwd:root,encoding:'utf8'}).trim(),checks:[]};
const manifest = JSON.parse(fs.readFileSync(path.join(root,'RELEASE-MANIFEST.json'),'utf8'));
for(const f of manifest.files){
 const data=fs.readFileSync(path.join(root,f.path));
 assert.equal(data.length,f.bytes,f.path+' size changed');
 assert.equal(crypto.createHash('sha256').update(data).digest('hex'),f.sha256,f.path+' hash changed');
}
report.checks.push({name:'website-manifest',passed:true,files:manifest.files.length});
function list(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.name==='.git'?[]:e.isDirectory()?list(path.join(d,e.name)):[path.relative(root,path.join(d,e.name)).replaceAll('\\','/')]);}
const privateFiles=list(root).filter(n=>/\.docx$|pined.*\.pdf$|(?:^|\/)(?:sources|backups|site-source|node_modules)(?:\/|$)|pined-net-text|原文保留/i.test(n));
assert.deepEqual(privateFiles,[]);
report.checks.push({name:'excluded-private-and-temporary-files',passed:true});
for(const name of ['check-site.cjs','check-topic.cjs','check-associations.cjs','check-soliton.cjs','check-coherence.cjs']){
 const output=cp.execFileSync(process.execPath,[path.join(__dirname,name)],{cwd:root,encoding:'utf8'}).trim();
 report.checks.push({name,passed:true,output}); console.log(name+': '+output);
}
const scripts=fs.readdirSync(root).filter(n=>n.endsWith('.js'));
for(const name of scripts)cp.execFileSync(process.execPath,['--check',path.join(root,name)],{cwd:root,encoding:'utf8'});
report.checks.push({name:'javascript-syntax',passed:true,files:scripts.length});
cp.execFileSync('git',['-c','core.autocrlf=false','diff','--check'],{cwd:root,encoding:'utf8'});
cp.execFileSync('git',['-c','core.autocrlf=false','diff','--cached','--check'],{cwd:root,encoding:'utf8'});
report.checks.push({name:'git-diff-whitespace',passed:true});
cp.execFileSync('git',['fsck','--full','--no-dangling'],{cwd:root,encoding:'utf8'});
report.checks.push({name:'git-object-integrity',passed:true});
report.allPassed=true;
report.browserCoverage='Prior integration checks: 1400px desktop and 390px bilingual layouts, key interactions and cumulative DMD reveal. Not rerun for this file-identical package.';
report.notPerformed=['commit','push','deployment','remote fetch','complete all-page interaction regression','physical touch hardware test','OS reduced-motion preference test','external link revalidation'];
fs.writeFileSync(path.join(root,'VALIDATION.json'),JSON.stringify(report,null,2)+'\n');
console.log('PASS: all package checks. Report: VALIDATION.json');
