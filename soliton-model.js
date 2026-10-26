/* Real-field initial-value solver for Zhang, Fan & Pan, PRResearch 8, 023107
 * (2026), Eq. (7): (1-d_tt)(1-d_xx) psi - 4 g psi^3 = 0.
 * g=1 is the paper's normalization; g=0 is a linear comparison.
 * Fourier inverse Helmholtz + velocity Verlet, periodic domain [-32,32).
 * No relaxation, gain saturation, or artificial interpolation is applied.
 */
(function (root) {
  'use strict';
  function create({ n=512, dt=0.005, amplitude=0.0005/Math.sqrt(2), width=1, profile='localized', nonlinear=1, velocity=0 }={}) {
    if (n < 16 || (n & (n-1))) throw new Error('FFT size must be a power of two');
    const length=64, dx=length/n, u=new Float64Array(n), v=new Float64Array(n);
    const re=new Float64Array(n), im=new Float64Array(n), filter=new Float64Array(n), rev=new Uint32Array(n);
    const bits=Math.log2(n), cosine=new Float64Array(n/2), sine=new Float64Array(n/2);
    for(let j=0;j<n;j++) {
      const x=-length/2+j*dx;
      u[j]=amplitude*(profile==='uniform'?1:1/Math.cosh(x/width)); v[j]=velocity*u[j];
      const k=2*Math.PI*(j<=n/2?j:j-n)/length; filter[j]=1/(1+k*k);
      let a=j,b=0; for(let k=0;k<bits;k++){b=(b<<1)|(a&1);a>>=1;} rev[j]=b;
      if(j<n/2){cosine[j]=Math.cos(2*Math.PI*j/n);sine[j]=Math.sin(2*Math.PI*j/n);}
    }
    function fft(inverse) {
      for(let j=0;j<n;j++){const k=rev[j];if(k>j){[re[j],re[k]]=[re[k],re[j]];[im[j],im[k]]=[im[k],im[j]];}}
      for(let size=2;size<=n;size*=2){const half=size/2,stride=n/size;
        for(let start=0;start<n;start+=size)for(let j=0;j<half;j++){
          const c=cosine[j*stride],s=(inverse?1:-1)*sine[j*stride],a=start+j,b=a+half;
          const r=re[b]*c-im[b]*s,i=re[b]*s+im[b]*c;
          re[b]=re[a]-r;im[b]=im[a]-i;re[a]+=r;im[a]+=i;
        }
      }
      if(inverse)for(let j=0;j<n;j++){re[j]/=n;im[j]/=n;}
    }
    function acceleration(out) {
      if(nonlinear===0){out.set(u);return;}
      for(let j=0;j<n;j++){re[j]=u[j]**3;im[j]=0;}
      fft(false);for(let j=0;j<n;j++){re[j]*=filter[j];im[j]*=filter[j];}fft(true);
      for(let j=0;j<n;j++)out[j]=u[j]-4*nonlinear*re[j];
    }
    let acc=new Float64Array(n),next=new Float64Array(n),time=0,limited=false;
    acceleration(acc);
    const sample=()=>{
      const values=[],positions=[];let peak=0;
      for(let j=0;j<n;j++){const x=-length/2+j*dx;if(Math.abs(x)<=8){positions.push(x);values.push(u[j]*u[j]);}peak=Math.max(peak,u[j]*u[j]);}
      const center=n/2;
      return {time,values,positions,peak,center:u[center],speed:v[center],linear:u[center],nonlinear:acc[center]-u[center],limited};
    };
    return {sample,step(count=1){
      for(let step=0;step<count&&!limited;step++){
        for(let j=0;j<n;j++)u[j]+=dt*v[j]+0.5*dt*dt*acc[j];
        acceleration(next);
        for(let j=0;j<n;j++)v[j]+=0.5*dt*(acc[j]+next[j]);
        [acc,next]=[next,acc];time+=dt;
        // End a linear runaway visibly; never normalize it into a bounded pulse.
        limited=u.some(x=>!Number.isFinite(x)||Math.abs(x)>8);
      }
      return sample();
    }};
  }
  const api={create};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.LifeSolitonModel=api;
})(typeof window!=='undefined'?window:globalThis);
