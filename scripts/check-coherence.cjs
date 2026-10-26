const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync(require('node:path').resolve(__dirname,'../figures.js'),'utf8');
const a=code.indexOf('  function measurementDistribution'),b=code.indexOf('  function buildMeasurement',a);
const density=vm.runInNewContext(code.slice(a,b)+'\nmeasurementDistribution');
let maxNormalizationError=0,minDensity=Infinity,maxDecoheredDifference=0;
for(const g of [.1,.4,2,4])for(const p of [0,.3,.5,1])for(const eta of [0,.5,1]){
 let area=0;const dx=.005;
 for(let x=-16;x<16;x+=dx){const d=density(x,g,p,eta,true);area+=d.total*dx;minDensity=Math.min(minDensity,d.total);}
 maxNormalizationError=Math.max(maxNormalizationError,Math.abs(area-1));
 for(let x=-7;x<7;x+=.1){const d=density(x,g,p,0,true),direct=density(x,g,p,1,false);maxDecoheredDifference=Math.max(maxDecoheredDifference,Math.abs(d.total-direct.total));}
}
assert(minDensity>=-1e-13);assert(maxNormalizationError<1e-8);assert(maxDecoheredDifference<1e-13);
assert(density(0,.4,.5,1).interference>0);
assert(density(Math.PI/5,.4,.5,1).interference<0);
assert(Math.abs(density(0,4,.5,1).interference)<Math.abs(density(0,.4,.5,1).interference)*.001);
console.log(JSON.stringify({maxNormalizationError,minDensity,maxDecoheredDifference}));
