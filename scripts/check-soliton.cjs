const assert=require('node:assert/strict');
const {create}=require('../soliton-model.js');
function run(options,time=16){const model=create(options),samples=[model.sample()];for(let i=0;i<time/.05;i++){const s=model.step(Math.round(.05/(options.dt||.005)));samples.push(s);if(s.limited)break;}return samples;}
const event=run({}),stationary=run({amplitude:1/Math.sqrt(2)}),linear=run({nonlinear:0}),fine=run({dt:.0025});
const peak=event.reduce((a,b)=>a.peak>b.peak?a:b),stationaryError=Math.max(...stationary.map(s=>Math.abs(s.peak-.5)));
const convergence=Math.max(...event.map((s,i)=>Math.abs(s.peak-fine[i].peak)));
// An exact event psi=sech(x)sech(t-4), initialized on its growing branch.
const t0=4,exact=run({amplitude:1/Math.cosh(t0),velocity:Math.tanh(t0)},8);
const exactError=Math.max(...exact.map(s=>Math.abs(s.center-1/Math.cosh(s.time-t0))));
assert(peak.peak>.99&&peak.peak<1.01);
assert(event.at(-1).peak<.001);
assert(stationaryError<1e-5);
assert(convergence<.001);
assert(exactError<.001);
assert(linear.at(-1).limited);
const uniform=run({profile:'uniform',amplitude:.0001});
assert(Math.abs(Math.max(...uniform.map(s=>s.peak))-.5)<.001);
for(const sample of uniform)assert(Math.max(...sample.values)-Math.min(...sample.values)<1e-10);
for(const amplitude of [.0005/Math.sqrt(2)*.5,.0005/Math.sqrt(2)*2,Math.sqrt(2)]){
 const changed=run({amplitude});assert(changed.every(s=>Number.isFinite(s.peak)&&!s.limited));
}
console.log(JSON.stringify({eventPeak:peak.peak,peakTime:peak.time,finalPeak:event.at(-1).peak,stationaryError,convergence,exactError,linearStoppedAt:linear.at(-1).time},null,2));
