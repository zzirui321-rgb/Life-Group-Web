// Site checks. `node scripts/verify.cjs` only reports.
// `node scripts/verify.cjs --write` also refreshes RELEASE-MANIFEST.json and VALIDATION.json.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'..');
const write = process.argv.includes('--write');
const git = (...args) => cp.execFileSync('git',args,{cwd:root,encoding:'utf8'});
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
const report = {verifiedAt:new Date().toISOString(),branch:git('branch','--show-current').trim(),checks:[]};
const manifestPath = path.join(root,'RELEASE-MANIFEST.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath,'utf8'));
// The manifest covers the published website files, not the delivery documents and scripts.
const outsideManifest = /^(?:scripts\/|CHANGELOG\.md$|PUSH-README\.md$|UPGRADE-CHECKLIST\.md$|RELEASE-MANIFEST\.json$|VALIDATION\.json$)/;
if(write){
 const tracked = git('ls-files','--cached','--others','--exclude-standard').split('\n').filter(Boolean)
  .filter(name=>!outsideManifest.test(name) && fs.existsSync(path.join(root,name))).sort();
 manifest.date = report.verifiedAt.slice(0,10);
 manifest.baseCommit = git('rev-parse','HEAD').trim();
 manifest.source = 'Life-Group-Web main';
 manifest.scope = 'Published website files in the repository root. Delivery documents, scripts and Git metadata are outside this manifest.';
 manifest.files = tracked.map(name=>{const data=fs.readFileSync(path.join(root,name)); return {path:name,bytes:data.length,sha256:sha256(data)};});
 fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
}
for(const f of manifest.files){
 const data=fs.readFileSync(path.join(root,f.path));
 assert.equal(data.length,f.bytes,f.path+' size changed; run with --write after intended edits');
 assert.equal(sha256(data),f.sha256,f.path+' hash changed; run with --write after intended edits');
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
git('-c','core.autocrlf=false','diff','--check');
git('-c','core.autocrlf=false','diff','--cached','--check');
report.checks.push({name:'git-diff-whitespace',passed:true});
git('fsck','--full','--no-dangling');
report.checks.push({name:'git-object-integrity',passed:true});
report.allPassed=true;
report.scope='Automated file, link, metadata, numerical-model and syntax checks only.';
report.notPerformed=['browser layout and interaction regression','physical touch hardware test','OS reduced-motion preference test','external link revalidation'];
if(write){
 fs.writeFileSync(path.join(root,'VALIDATION.json'),JSON.stringify(report,null,2)+'\n');
 console.log('PASS: all checks. Updated RELEASE-MANIFEST.json and VALIDATION.json.');
}else{
 console.log('PASS: all checks. Nothing written; use --write to refresh the manifest and report.');
}
