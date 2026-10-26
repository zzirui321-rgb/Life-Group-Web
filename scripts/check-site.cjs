const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const root = path.resolve(__dirname,'..');
const source = fs.readFileSync(path.join(root,'figures.js'),'utf8');
const start = source.indexOf('  function jacobiEigen(');
const end = source.indexOf('\n  function buildFloquet',start);
const eig = vm.runInNewContext(source.slice(start,end)+'; jacobiEigen;');
let maxResidual=0;
for(const matrix of [[[2,1],[1,2]],[[1,0,0],[0,2,0],[0,0,3]], Array.from({length:18},(_,i)=>Array.from({length:18},(_,j)=>i===j ? i/3 : Math.cos(i+j)/(1+Math.abs(i-j))))]) {
  const result=eig(matrix);
  result.values.forEach((lambda,j)=>{
    const vector=result.vec(j);
    const norm=Math.hypot(...vector);
    assert.ok(Math.abs(norm-1)<1e-10);
    for(let i=0;i<matrix.length;i++) maxResidual=Math.max(maxResidual,Math.abs(matrix[i].reduce((sum,a,k)=>sum+a*vector[k],0)-lambda*vector[i]));
  });
}
assert.ok(maxResidual<1e-9);
function list(dir) { return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()&&['en','members'].includes(e.name)?list(path.join(dir,e.name)): e.isFile()&&e.name.endsWith('.html')?[path.join(dir,e.name)]:[]); }
const files=list(root),missing=[];
for(const file of files){
  const html=fs.readFileSync(file,'utf8');
  for(const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const url=m[1].split(/[?#]/)[0];
    if(!url||/^(?:[a-z]+:|\/\/)/i.test(url))continue;
    let target=path.resolve(url.startsWith('/')?root:path.dirname(file),url.startsWith('/')?'.'+url:url);
    if(url.endsWith('/'))target=path.join(target,'index.html');
    if(!fs.existsSync(target)) missing.push({page:path.relative(root,file),url});
  }
}
assert.deepEqual(missing,[]);
const report={htmlPages:files.length,missingLocalReferences:missing.length,jacobiMaxResidual:maxResidual};

console.log(JSON.stringify(report));
