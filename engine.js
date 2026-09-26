/* Local, deterministic image processing. No network or model calls. */
(function(root){
function createEngine(){
const MAXL=400;
function edgesAndRuns(mask,work,w,bb){
  const Ex=new Float64Array(bb.w), Ey=new Float64Array(bb.h), H=new Float64Array(MAXL+1), T=30;
  const g=new Float64Array(Math.max(bb.w,bb.h)+2);
  const dist=(i,j)=>{ if(mask[i]!==mask[j]) return 999; if(!mask[i]) return 0; const a=i*4,b=j*4;
    return Math.hypot(work[a]-work[b],work[a+1]-work[b+1],work[a+2]-work[b+2]); };
  const scan=(n,idx,E)=>{ g[0]=0; for(let t=1;t<n;t++) g[t]=dist(idx(t),idx(t-1)); g[n]=0; let last=-1;
    for(let t=1;t<n;t++){ if(g[t]>T&&g[t]>=g[t-1]&&g[t]>g[t+1]){ E[t]++; if(last>=0){ const L=t-last; if(L<=MAXL) H[L]++; } last=t; } } };
  for(let yy=0;yy<bb.h;yy++){ const base=(bb.y+yy)*w+bb.x; scan(bb.w,t=>base+t,Ex); }
  for(let xx=0;xx<bb.w;xx++){ const base=bb.y*w+bb.x+xx; scan(bb.h,t=>base+t*w,Ey); }
  return {Ex,Ey,H};
}
function pickPitch(H,maxD){
  let total=0; for(let L=2;L<=MAXL;L++) total+=H[L]; if(total<8) return null;
  // baseline: how much a smoothed (structure-free) histogram would match by chance at this p
  const Hs=new Float64Array(MAXL+1); let stot=0;
  for(let L=2;L<=MAXL;L++){ let s=0,n=0; for(let d=-3;d<=3;d++){ const j=L+d; if(j>=2&&j<=MAXL){s+=H[j];n++;} } Hs[L]=s/n; stot+=Hs[L]; }
  const ps=[],sc=[];
  for(let p=2;p<=maxD+1e-9;p+=0.05){ let s=0,b=0;
    for(let L=2;L<=MAXL;L++){ const q=L/p, k=Math.round(q); if(k>=1&&Math.abs(q-k)<=0.15){ s+=H[L]; b+=Hs[L]; } }
    ps.push(p); sc.push(s-(b/(stot||1))*total); }
  const peaks=[]; for(let i=0;i<sc.length;i++) if((i===0||sc[i]>=sc[i-1])&&(i===sc.length-1||sc[i]>=sc[i+1])) peaks.push(i);
  let best=peaks[0]; for(const i of peaks) if(sc[i]>sc[best]) best=i;
  if(sc[best]<=0) return null;
  let pick=best; for(const i of peaks) if(sc[i]>=0.85*sc[best]&&ps[i]>ps[pick]) pick=i;
  let p=ps[pick];
  for(let it=0;it<3;it++){ let num=0,den=0; for(let L=2;L<=MAXL;L++){ const h=H[L]; if(!h) continue; const q=L/p,k=Math.round(q); if(k>=1&&Math.abs(q-k)<=0.15){num+=h*L;den+=h*k;} } if(den) p=num/den; }
  return {p:Math.round(p*100)/100, conf:sc[pick]/(0.7*total)};
}
function phaseAt(E,p){ const w=2*Math.PI/p; let re=0,im=0; for(let i=0;i<E.length;i++){ const e=E[i]; if(e!==0){re+=e*Math.cos(w*i); im-=e*Math.sin(w*i);} }
  const ph=Math.atan2(im,re); return ((-ph/w)%p+p)%p; }
function estimatePitch(mask,work,w,bb){
  const m=Math.min(bb.w,bb.h); if(m<12) return {p:1,ox:0,oy:0,conf:0,dx:null,dy:null};
  const maxD=Math.max(3,Math.min(96,Math.floor(m/4)));
  const {Ex,Ey,H}=edgesAndRuns(mask,work,w,bb);
  const r=pickPitch(H,maxD);
  if(!r) return {p:1,ox:0,oy:0,conf:0,dx:Ex,dy:Ey};
  return {p:r.p, ox:phaseAt(Ex,r.p), oy:phaseAt(Ey,r.p), conf:r.conf, dx:Ex, dy:Ey};
}

function medianCut(cols,N){
  const boxes=[cols];
  const stats=b=>{ let mn=[255,255,255],mx=[0,0,0]; for(const c of b) for(let k=0;k<3;k++){ if(c[k]<mn[k])mn[k]=c[k]; if(c[k]>mx[k])mx[k]=c[k]; }
    const r=[mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2]]; const ch=r[0]>=r[1]&&r[0]>=r[2]?0:(r[1]>=r[2]?1:2); return {range:r[ch],ch}; };
  while(boxes.length<N){ let bi=-1,bs=-1,bch=0;
    boxes.forEach((b,i)=>{ if(b.length<2) return; const s=stats(b); if(s.range>bs){bs=s.range;bi=i;bch=s.ch;} });
    if(bi<0||bs===0) break;
    const b=boxes[bi]; b.sort((a,c)=>a[bch]-c[bch]); const total=b.reduce((a,c)=>a+c[3],0); let acc=0,cut=0;
    for(;cut<b.length-1;cut++){ acc+=b[cut][3]; if(acc*2>=total) {cut++;break;} } if(cut>=b.length) cut=b.length-1; if(cut<1) cut=1;
    boxes.splice(bi,1,b.slice(0,cut),b.slice(cut)); }
  return boxes.map(b=>{ let r=0,g=0,bl=0,n=0; for(const c of b){r+=c[0]*c[3];g+=c[1]*c[3];bl+=c[2]*c[3];n+=c[3];} return [r/n,g/n,bl/n]; });
}
function nearest(pal,r,g,b){ let bi=0,bd=1e18; for(let i=0;i<pal.length;i++){ const p=pal[i]; const d=(p[0]-r)**2+(p[1]-g)**2+(p[2]-b)**2; if(d<bd){bd=d;bi=i;} } return bi; }
function kmeans(pal,cols,iters){ for(let it=0;it<iters;it++){ const acc=pal.map(()=>[0,0,0,0]);
    for(const c of cols){ const i=nearest(pal,c[0],c[1],c[2]); const a=acc[i]; a[0]+=c[0]*c[3];a[1]+=c[1]*c[3];a[2]+=c[2]*c[3];a[3]+=c[3]; }
    pal=pal.map((p,i)=>acc[i][3]?[acc[i][0]/acc[i][3],acc[i][1]/acc[i][3],acc[i][2]/acc[i][3]]:p); }
  return pal.map(p=>p.map(Math.round)); }

return {estimatePitch, medianCut, kmeans, nearest};
}
root.DotSnapPrimitives = createEngine;
})(typeof globalThis !== 'undefined' ? globalThis : this);
