/* Serializable factory: also runs in a Blob Worker when opened from file://. */
(function(root){
function createProcessor(createPrimitives){
  const {estimatePitch, medianCut, kmeans, nearest} = createPrimitives();
  const defaults = {width:64,height:64,colors:16,background:'auto',key:'#00ff00',tolerance:36,split:'auto',cols:4,rows:2,margin:0,gap:0,pitchMode:'common',pitch:5,anchor:'source',fit:'contain',style:'auto',repair:true,repairScope:'all',outline:'none',outlineColor:'#202330',fixedPalette:'',lockedPalette:'',zoom:4};
  defaults.despill=true; defaults.extraKeys='';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const rgb=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
  const hex=c=>'#'+c.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
  function parse(s){const tokens=s.trim().split(/[\s,;]+/).filter(Boolean); if(tokens.some(t=>!/^#?[0-9a-f]{6}$/i.test(t))) throw Error('パレットは #rrggbb を空白で区切って入力してください。'); return [...new Set(tokens.map(t=>'#'+t.replace('#','').toLowerCase()))].map(rgb);}
  function params(raw){
    const p={...defaults,...raw};
    for(const [k,a,b] of [['width',8,512],['height',8,512],['colors',2,256],['cols',1,32],['rows',1,32],['tolerance',0,442],['margin',0,4096],['gap',0,4096]]){
      if(!Number.isFinite(+p[k])) throw Error('数値を確認してください: '+k); p[k]=Math.round(clamp(+p[k],a,b));
    }
    if(typeof p.extraKeys!=='string'||parse(p.extraKeys).length>32)throw Error('追加の抜き色は32色以下にしてください。');
    p.pitch=clamp(Number(p.pitch)||5,1,128);
    const choices={background:['auto','alpha','edge','key','none'],split:['auto','uniform','single','custom'],pitchMode:['common','frame','manual','fit'],anchor:['source','bottom','center'],fit:['contain','crop'],style:['auto','faithful','detail','clean'],outline:['none','inner','outer']};
    choices.repairScope=['edge','all'];
    for(const [k,values] of Object.entries(choices)) if(!values.includes(p[k])) throw Error('設定が不正です: '+k);
    if(!/^#[0-9a-f]{6}$/i.test(p.key)||!/^#[0-9a-f]{6}$/i.test(p.outlineColor)) throw Error('色の指定が不正です。');
    if(parse(p.fixedPalette).length>256) throw Error('固定パレットは256色以下にしてください。');
    if(!p.fixedPalette.trim()&&parse(p.lockedPalette).length>p.colors) throw Error('保護色が指定色数を超えています。');
    return p;
  }
  function background(img,p){
    const {width:w,height:h,data:d}=img,n=w*h,mask=new Uint8Array(n),work=new Uint8ClampedArray(d),bins=new Map();
    let transparent=0;
    for(let i=0;i<n;i++) if(d[i*4+3]<128) transparent++;
    const add=i=>{const j=i*4;if(d[j+3]<128)return;const k=((d[j]>>4)<<8)|((d[j+1]>>4)<<4)|(d[j+2]>>4);let b=bins.get(k);if(!b)bins.set(k,b=[0,0,0,0]);b[0]+=d[j];b[1]+=d[j+1];b[2]+=d[j+2];b[3]++;};
    for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}for(let y=0;y<h;y++){add(y*w);add(y*w+w-1);}
    let best=[0,0,0,1];for(const b of bins.values())if(b[3]>best[3])best=b;
    const key=p.background==='key'?rgb(p.key):best.slice(0,3).map(v=>Math.round(v/best[3]));
    const mode=p.background==='auto'?(transparent>0?'alpha':'edge'):p.background;
    const keyMin=Math.min(...key),keyMax=Math.max(...key),keyChroma=keyMax-keyMin;
    const keyHue=key.map(v=>(v-keyMin)/(keyChroma||1));
    const dominant=key.indexOf(keyMax),others=[0,1,2].filter(k=>k!==dominant);
    const cleanKey=p.despill!==false&&(mode==='key'||mode==='edge')&&keyChroma>=80;
    const extraKeys=parse(p.extraKeys||'');
    const eligible=new Uint8Array(n);
    for(let i=0;i<n;i++){
      const j=i*4;mask[i]=d[j+3]>=128?1:0;
      const lo=Math.min(d[j],d[j+1],d[j+2]),hi=Math.max(d[j],d[j+1],d[j+2]),chroma=hi-lo;
      // RGB distance alone misses dark shades of a bright chroma key.
      const sameHue=cleanKey&&chroma>=12&&chroma/Math.max(1,hi)>=.72&&
        Math.hypot((d[j]-lo)/chroma-keyHue[0],(d[j+1]-lo)/chroma-keyHue[1],(d[j+2]-lo)/chroma-keyHue[2])<=.10+p.tolerance/800;
      eligible[i]=!mask[i]||sameHue||extraKeys.some(c=>Math.hypot(d[j]-c[0],d[j+1]-c[1],d[j+2]-c[2])<=p.tolerance)||Math.hypot(d[j]-key[0],d[j+1]-key[1],d[j+2]-key[2])<=p.tolerance?1:0;
    }
    if(mode==='key'){for(let i=0;i<n;i++)if(eligible[i])mask[i]=0;}
    if(mode==='edge'){
      const q=new Int32Array(n),seen=new Uint8Array(n);let head=0,tail=0;
      const push=i=>{if(!seen[i]&&eligible[i]){seen[i]=1;mask[i]=0;q[tail++]=i;}};
      for(let x=0;x<w;x++){push(x);push((h-1)*w+x);}for(let y=0;y<h;y++){push(y*w);push(y*w+w-1);}
      while(head<tail){const i=q[head++],x=i%w;if(x)push(i-1);if(x<w-1)push(i+1);if(i>=w)push(i-w);if(i<n-w)push(i+w);}
    }
    let despilled=0;
    if(cleanKey&&keyMax-Math.max(key[others[0]],key[others[1]])>=48){
      // Restrict color decontamination to a narrow band adjoining removed pixels.
      // Read the original mask throughout: the operation must not erode the silhouette.
      const distance=new Uint8Array(n),queue=new Int32Array(n);let head=0,tail=0;
      const radius=Math.min(16,Math.max(2,Math.ceil(Math.max(w,h)/128)));
      const seed=i=>{if(!distance[i]){distance[i]=1;queue[tail++]=i;}};
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(mask[i]&&((x>0&&!mask[i-1])||(x<w-1&&!mask[i+1])||(y>0&&!mask[i-w])||(y<h-1&&!mask[i+w])))seed(i);}
      while(head<tail){
        const i=queue[head++],j=i*4,otherMax=Math.max(d[j+others[0]],d[j+others[1]]);
        if(d[j+dominant]>otherMax+4){work[j+dominant]=otherMax;despilled++;}
        if(distance[i]>=radius)continue;
        const x=i%w;
        for(const next of [x>0?i-1:-1,x<w-1?i+1:-1,i>=w?i-w:-1,i<n-w?i+w:-1])if(next>=0&&mask[next]&&!distance[next]){distance[next]=distance[i]+1;queue[tail++]=next;}
      }
    }
    return {mask,work,key:hex(key),mode,despilled};
  }
  function split(mask,w,h,p,custom){
    if(p.split==='single')return {cols:1,rows:1,cells:[{x:0,y:0,w,h}]};
    if(p.split==='custom'){
      if(!Array.isArray(custom)||!custom.length||custom.length>1024)throw Error('元画像をドラッグしてコマ範囲を追加してください。');
      const cells=custom.map(c=>{if(![c.x,c.y,c.w,c.h].every(Number.isFinite))throw Error('コマ範囲が不正です。');const x=clamp(Math.round(c.x),0,w-1),y=clamp(Math.round(c.y),0,h-1);return{x,y,w:clamp(Math.round(c.w),1,w-x),h:clamp(Math.round(c.h),1,h-y)};});
      return {cells,cols:Math.min(p.cols,cells.length),rows:Math.ceil(cells.length/Math.min(p.cols,cells.length))};
    }
    if(p.split==='auto'){
      const cx=new Uint32Array(w),cy=new Uint32Array(h);
      for(let i=0;i<w*h;i++)if(mask[i]){cx[i%w]++;cy[Math.floor(i/w)]++;}
      const ranges=a=>{const out=[];let start=-1,last=-1;for(let i=0;i<a.length;i++){if(a[i]){if(start<0)start=i;last=i;}else if(start>=0&&i-last>Math.max(3,a.length*.008)){out.push([start,last]);start=-1;}}if(start>=0)out.push([start,last]);return out;};
      const xs=ranges(cx),ys=ranges(cy);
      if(xs.length&&ys.length&&xs.length<=32&&ys.length<=32){
        const bounds=(rs,n)=>[0,...rs.slice(1).map((r,i)=>Math.round((rs[i][1]+r[0])/2)),n];
        const xb=bounds(xs,w),yb=bounds(ys,h),cells=[];
        for(let y=0;y<ys.length;y++)for(let x=0;x<xs.length;x++)cells.push({x:xb[x],y:yb[y],w:xb[x+1]-xb[x],h:yb[y+1]-yb[y]});
        return {cells,cols:xs.length,rows:ys.length};
      }
    }
    const usableW=w-2*p.margin-(p.cols-1)*p.gap,usableH=h-2*p.margin-(p.rows-1)*p.gap;
    if(usableW<p.cols||usableH<p.rows)throw Error('列・行・余白・間隔が画像サイズを超えています。');
    const cells=[];for(let y=0;y<p.rows;y++)for(let x=0;x<p.cols;x++){
      const x0=Math.round(x*usableW/p.cols),y0=Math.round(y*usableH/p.rows);
      cells.push({x:p.margin+x0+x*p.gap,y:p.margin+y0+y*p.gap,w:Math.round((x+1)*usableW/p.cols)-x0,h:Math.round((y+1)*usableH/p.rows)-y0});
    }return {cells,cols:p.cols,rows:p.rows};
  }
  function bbox(mask,w,c){let x0=c.x+c.w,y0=c.y+c.h,x1=-1,y1=-1;for(let y=c.y;y<c.y+c.h;y++)for(let x=c.x;x<c.x+c.w;x++)if(mask[y*w+x]){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}return x1<0?null:{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};}
  function colorDistance(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);}
  function boundaryMask(data,w,h){
    const mask=new Uint8Array(w*h),alpha=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&data[(y*w+x)*4+3]>0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const a=alpha(x,y);if([[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(([xx,yy])=>alpha(xx,yy)!==a))mask[y*w+x]=1;}
    return mask;
  }
  // Repair a small interior color notch only when the same color is present
  // in the original cell and is supported by at least three surrounding cells.
  function repairInterior(data,w,h,alternatives,shares,edge,style){
    const old=new Uint8ClampedArray(data);let count=0;
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
      const i=y*w+x,j=i*4;if(edge[i]||!old[j+3]||shares[i]<(style==='detail'?.25:style==='clean'?.3:.35))continue;
      const col=alternatives.slice(i*3,i*3+3),neighbors=[i-1,i+1,i-w,i+w];
      if(neighbors.some(n=>!old[n*4+3]))continue;
      const support=neighbors.filter(n=>colorDistance(col,old.slice(n*4,n*4+3))<32).length;
      if(support>=3&&colorDistance(col,old.slice(j,j+3))>40){data.set(col,j);count++;}
    }
    return count;
  }
  function sample(img,bg,f,p,style,ov){
    const W=p.width,H=p.height,n=W*H,d=new Uint8ClampedArray(n*4),base=new Uint8ClampedArray(n*4),coverage=new Float32Array(n),features=[],sourceColors=new Uint8ClampedArray(n*3);
    const alternatives=new Uint8ClampedArray(n*3),shares=new Float32Array(n);
    const pitch=f.pitch,dx=clamp(Number(ov?.dx)||0,-512,512),dy=clamp(Number(ov?.dy)||0,-512,512),c=f.cell;
    let ox=f.originX+dx*pitch,oy=f.originY+dy*pitch;
    if(p.pitchMode!=='fit'&&f.est?.conf>.15&&!f.resized){
      const phase=(pos,b,offset)=>Math.round((pos-b-offset)/pitch)*pitch+b+offset;
      ox=phase(ox,f.gridX??f.bbox.x,f.gridPhaseX??f.est.ox);oy=phase(oy,f.gridY??f.bbox.y,f.gridPhaseY??f.est.oy);
      if(p.fit==='contain'){const border=p.outline==='outer'?pitch:0;ox=clamp(ox,f.bbox.x+f.bbox.w-W*pitch+border,f.bbox.x-border);oy=clamp(oy,f.bbox.y+f.bbox.h-H*pitch+border,f.bbox.y-border);}
    }
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const i=y*W+x,j=i*4,xa=Math.max(c.x,Math.ceil(ox+x*pitch)),xb=Math.min(c.x+c.w,Math.ceil(ox+(x+1)*pitch)),ya=Math.max(c.y,Math.ceil(oy+y*pitch)),yb=Math.min(c.y+c.h,Math.ceil(oy+(y+1)*pitch));
      let total=0,count=0,rs=0,gs=0,bs=0;const bins=new Map();
      for(let yy=ya;yy<yb;yy++)for(let xx=xa;xx<xb;xx++){
        total++;const si=yy*img.width+xx;if(!bg.mask[si])continue;const sj=si*4,r=bg.work[sj],g=bg.work[sj+1],b=bg.work[sj+2];count++;rs+=r;gs+=g;bs+=b;
        const k=((r>>4)<<8)|((g>>4)<<4)|(b>>4);let v=bins.get(k);if(!v)bins.set(k,v=[0,0,0,0]);v[0]+=r;v[1]+=g;v[2]+=b;v[3]++;
      }
      if(!total||!count)continue;coverage[i]=count/total;
      const sorted=[...bins.values()].sort((a,b)=>b[3]-a[3]);const dominant=sorted[0].slice(0,3).map(v=>v/sorted[0][3]);sourceColors.set(dominant,i*3);
      // Baseline uses a majority silhouette; repair can only add source-supported cells.
      if(coverage[i]>=.5){base.set([...dominant,255],j);d.set([...dominant,255],j);}
      if(sorted.length>1){const v=sorted[1],col=v.slice(0,3).map(t=>t/v[3]);alternatives.set(col,i*3);shares[i]=v[3]/count;const contrast=colorDistance(col,dominant);if(v[3]/count>=.18&&contrast>75)features.push({i,col,weight:contrast*v[3]/count});}
    }
    const edge=boundaryMask(base,W,H),edgeOnly=p.repairScope==='edge';
    let repaired=0;
    if(p.repair){
      const threshold=style==='detail'?.18:style==='clean'?.4:.29;
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){
        const i=y*W+x,j=i*4;if(d[j+3]||coverage[i]<threshold||(edgeOnly&&!edge[i]))continue;
        const ns=[x>0?i-1:-1,x<W-1?i+1:-1,y>0?i-W:-1,y<H-1?i+W:-1].filter(t=>t>=0);
        const near=ns.filter(t=>base[t*4+3]).length;
        const opposite=(x>0&&x<W-1&&base[(i-1)*4+3]&&base[(i+1)*4+3])||(y>0&&y<H-1&&base[(i-W)*4+3]&&base[(i+W)*4+3]);
        if(opposite||near>=1||(style==='detail'&&coverage[i]>.35)){d.set([...sourceColors.slice(i*3,i*3+3),255],j);repaired++;}
      }
      if(!edgeOnly)repaired+=repairInterior(d,W,H,alternatives,shares,edge,style);
      if(style!=='clean')for(const feature of features){
        const {i,col}=feature;if(!d[i*4+3]||(edgeOnly&&!edge[i]))continue;const x=i%W,y=Math.floor(i/W);
        let represented=false;
        for(let yy=Math.max(0,y-1);yy<=Math.min(H-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(W-1,x+1);xx++){const k=(yy*W+xx)*4;if(d[k+3]&&colorDistance(col,d.slice(k,k+3))<45)represented=true;}
        if(!represented&&feature.weight>(style==='detail'?20:38)){d.set(col,i*4);repaired++;}
      }
    }
    return {data:d,baseline:base,coverage,sourceColors,features:edgeOnly?features.filter(f=>edge[f.i]):features,repaired,originX:ox,originY:oy,pitch};
  }
  function makePalette(frames,p){
    const fixed=parse(p.fixedPalette);if(fixed.length)return fixed;
    const locked=parse(p.lockedPalette),outline=rgb(p.outlineColor);
    if(p.outline!=='none'&&!locked.some(c=>hex(c)===hex(outline)))locked.push(outline);
    if(locked.length>p.colors)throw Error('保護色と縁線色の合計が色数を超えています。');
    const bins=new Map();
    for(const f of frames){const data=p.repairScope==='edge'?f.baseline:f.data;for(let i=0;i<data.length;i+=4)if(data[i+3]){const k=(data[i]<<16)|(data[i+1]<<8)|data[i+2];bins.set(k,(bins.get(k)||0)+1);}}
    // Square-root weighting lets small distinctive colors compete with large flat regions.
    const colors=[...bins].map(([k,n])=>[k>>16,(k>>8)&255,k&255,p.repair&&p.repairScope!=='edge'?Math.sqrt(n):n]);
    const free=p.colors-locked.length;
    let generated=[];
    const rest=colors.filter(c=>!locked.some(l=>colorDistance(c,l)<18));
    if(free&&rest.length)generated=rest.length<=free?rest.map(c=>c.slice(0,3)):kmeans(medianCut(rest,free),rest,6);
    return [...new Map([...locked,...generated].map(c=>[hex(c),c])).values()];
  }
  function quantize(d,pal){if(!pal.length)return;const cache=new Map();for(let i=0;i<d.length;i+=4)if(d[i+3]){const k=(d[i]<<16)|(d[i+1]<<8)|d[i+2];let c=cache.get(k);if(!c){c=pal[nearest(pal,d[i],d[i+1],d[i+2])];cache.set(k,c);}d.set(c,i);}}
  function outline(d,p,pal){
    if(p.outline==='none'||!pal.length)return;const target=rgb(p.outlineColor),col=pal[nearest(pal,...target)],old=new Uint8ClampedArray(d),W=p.width,H=p.height;
    const alpha=(x,y)=>x>=0&&y>=0&&x<W&&y<H&&old[(y*W+x)*4+3]>0;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const a=alpha(x,y),ns=[alpha(x-1,y),alpha(x+1,y),alpha(x,y-1),alpha(x,y+1)];
      if((p.outline==='inner'&&a&&ns.some(t=>!t))||(p.outline==='outer'&&!a&&ns.some(Boolean)))d.set([...col,255],(y*W+x)*4);
    }
  }
  function score(frames,p){
    let error=0,count=0;
    for(const f of frames){
      for(let i=0;i<p.width*p.height;i++){
        const a=f.data[i*4+3]?1:0,c=f.coverage[i];
        if(c||a){error+=Math.abs(a-c)*80;if(a&&c)error+=colorDistance(f.data.slice(i*4,i*4+3),f.sourceColors.slice(i*3,i*3+3))*c*.2;count++;}
      }
      // Penalize disappearing high-contrast accents, not just average RGB error.
      if(p.repair)for(const feature of f.features||[]){
        const x=feature.i%p.width,y=Math.floor(feature.i/p.width);let distance=255;
        for(let yy=Math.max(0,y-1);yy<=Math.min(p.height-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(p.width-1,x+1);xx++){
          const k=(yy*p.width+xx)*4;if(f.data[k+3])distance=Math.min(distance,colorDistance(feature.col,f.data.slice(k,k+3)));
        }
        error+=Math.min(1,distance/100)*feature.weight*2;
      }
    }
    return Math.round(1000*(1-error/(Math.max(1,count)*160)))/10;
  }
  function process(input){
    const {image:img,overrides=[],custom=[]}=input,p=params(input.params);
    if(!img||!Number.isInteger(img.width)||!Number.isInteger(img.height)||img.width<1||img.height<1||img.width*img.height>16000000||img.data.length!==img.width*img.height*4)throw Error('画像は1600万画素以内にしてください。');
    const bg=background(img,p);
    // Layout must not depend on a compositing slider. Use a fixed, more
    // permissive key mask for geometry; only sampling uses the user's mask.
    const geometry=(bg.mode==='key'||bg.mode==='edge')?background(img,{...p,tolerance:80,despill:true,extraKeys:''}):bg;
    const layout=split(geometry.mask,img.width,img.height,p,custom);
    if(layout.cells.length*p.width*p.height>8000000)throw Error('出力が大きすぎます。コマ数またはコマサイズを減らしてください（合計800万画素まで）。');
    if(layout.cols*p.width>16384||layout.rows*p.height>16384)throw Error('シートの一辺は16384px以内にしてください。');
    const frames=layout.cells.map((cell,i)=>{const b=bbox(geometry.mask,img.width,cell);return {cell,i,bbox:b,est:b?estimatePitch(geometry.mask,geometry.work,img.width,b):null};});
    const live=frames.filter(f=>f.bbox),ps=live.filter(f=>f.est.p>1&&f.est.conf>.15).map(f=>f.est.p).sort((a,b)=>a-b),common=ps.length?ps[Math.floor(ps.length/2)]:1;
    let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
    for(const f of live){left=Math.min(left,f.bbox.x-f.cell.x);top=Math.min(top,f.bbox.y-f.cell.y);right=Math.max(right,f.bbox.x-f.cell.x+f.bbox.w);bottom=Math.max(bottom,f.bbox.y-f.cell.y+f.bbox.h);}
    const border=p.outline==='outer'?1:0,availableW=p.width-2*border,availableH=p.height-2*border;
    let commonNeed=1;
    const reference=live.filter(f=>f.est.conf>.15).sort((a,b)=>b.est.conf-a.est.conf)[0];
    for(const f of live)commonNeed=Math.max(commonNeed,p.anchor==='source'?Math.max((right-left)/availableW,(bottom-top)/availableH):Math.max(f.bbox.w/availableW,f.bbox.h/availableH));
    for(const f of live){
      const raw=p.pitchMode==='manual'?p.pitch:p.pitchMode==='fit'?commonNeed:p.pitchMode==='frame'?Math.max(1,f.est.p):common;
      f.pitch=p.fit==='contain'?Math.max(raw,commonNeed):raw;f.resized=f.pitch>raw+.001;
      const b=f.bbox;
      if(p.anchor==='source'){f.originX=f.cell.x+(left+right)/2-p.width*f.pitch/2;f.originY=f.cell.y+bottom-(p.height-border)*f.pitch;}
      else {f.originX=b.x+b.w/2-p.width*f.pitch/2;f.originY=p.anchor==='bottom'?b.y+b.h-(p.height-border)*f.pitch:b.y+b.h/2-p.height*f.pitch/2;}
      // A shared phase prevents the estimated grid from drifting between frames.
      if(reference&&p.anchor==='source'&&p.pitchMode==='common'){
        f.gridX=f.cell.x+reference.bbox.x-reference.cell.x;f.gridY=f.cell.y+reference.bbox.y-reference.cell.y;f.gridPhaseX=reference.est.ox;f.gridPhaseY=reference.est.oy;
      }
    }
    const variants=[];
    for(const style of ['faithful','detail','clean']){
      const outs=frames.map(f=>f.bbox?{...f,...sample(img,bg,f,p,style,overrides[f.i])}:{...f,data:new Uint8ClampedArray(p.width*p.height*4),baseline:new Uint8ClampedArray(p.width*p.height*4),coverage:new Float32Array(p.width*p.height),sourceColors:new Uint8ClampedArray(p.width*p.height*3)});
      const pal=makePalette(outs,p);let changes=0,clipped=0;
      for(const f of outs){
        quantize(f.data,pal);quantize(f.baseline,pal);outline(f.data,p,pal);outline(f.baseline,p,pal);
        f.changes=0;for(let i=0;i<f.data.length;i+=4)if(f.data[i+3]!==f.baseline[i+3]||(f.data[i+3]&&(f.data[i]!==f.baseline[i]||f.data[i+1]!==f.baseline[i+1]||f.data[i+2]!==f.baseline[i+2]))){f.changes++;changes++;}
        f.clipped=!!(f.bbox&&(f.bbox.x<f.originX-.01||f.bbox.y<f.originY-.01||f.bbox.x+f.bbox.w>f.originX+p.width*f.pitch+.01||f.bbox.y+f.bbox.h>f.originY+p.height*f.pitch+.01));if(f.clipped)clipped++;
      }
      // A source consistency score, not an artistic quality or confidence percentage.
      const rating=score(outs,p);
      for(const f of outs){delete f.coverage;delete f.sourceColors;delete f.features;if(f.est){f.est={p:f.est.p,conf:f.est.conf,ox:f.est.ox,oy:f.est.oy};}}
      const used=new Set();for(const f of outs)for(let i=0;i<f.data.length;i+=4)if(f.data[i+3])used.add(hex(f.data.slice(i,i+3)));
      variants.push({style,frames:outs,palette:pal.map(hex),usedColors:used.size,changes,clipped,score:rating});
    }
    let selected=p.style==='auto'?variants.reduce((best,v,i)=>v.score>variants[best].score?i:best,0):['faithful','detail','clean'].indexOf(p.style);
    return {params:p,cols:layout.cols,rows:layout.rows,variants,selected,background:{mode:bg.mode,key:bg.key},warnings:[...(!live.length?['背景除去後に不透明な部分がありません。背景設定を確認してください。']:[]),...(live.some(f=>f.est.conf<.25)?['格子が不明瞭なコマがあります。候補を比較するか、詳細設定でピッチを指定できます。']:[]),...(live.some(f=>f.resized)&&p.fit==='contain'?['指定サイズに収めるため、共通の倍率と配置を適用しています。']:[])]};
  }
  return {process,defaults,params,parse,background,boundaryMask,repairInterior};
}
root.DotSnapProcessor=createProcessor;
})(typeof globalThis!=='undefined'?globalThis:this);
