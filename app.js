(() => {
'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const processor=DotSnapProcessor(DotSnapPrimitives);
let P={...processor.defaults},source=null,sourceURL='',sourceName='',result=null,selected=0,view='result',overrides=[],custom=[],worker=null,workerURL=null,timer=null,revision=0,busy=false,started=0,picking=false,dragStart=null;
let history=[],future=[],playing=false,animationIndex=0,animationTimer=null,toastTimer,loadRevision=0,pendingRow=null;
let manual=null,manualVariant=null,pendingManual=null,stroke=null,paintColor=null,blinkPhase=true;
let cursorPoint=null,cursorKeys={shiftKey:false,altKey:false};
const labels={faithful:'原画に忠実',detail:'細部をくっきり',clean:'すっきり整理'};
const descriptions={faithful:'輪郭と原画の色を重視',detail:'細線・小さな色を積極的に補修',clean:'確かな形を優先して補修'};
const current=()=>manualVariant||result?.variants[result.selected];
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4000);}
function sync(){for(const el of $$('[data-p]')){if(el===document.activeElement&&['number','textarea'].includes(el.type))continue;const v=P[el.dataset.p];if(el.type==='checkbox')el.checked=v;else el.value=v;}$$('[data-v]').forEach(el=>el.textContent=P[el.dataset.v]);$('#customHint').hidden=P.split!=='custom';$('#undo').disabled=!history.length;$('#redo').disabled=!future.length;}
function snapshot(){return JSON.stringify({params:P,overrides,custom});}
function remember(){history.push(snapshot());if(history.length>40)history.shift();future=[];}
function restore(s){const v=JSON.parse(s);P=v.params;overrides=v.overrides;custom=v.custom;sync();schedule();}
function undo(){if(stroke)return;if(manual){const i=manual.undo();if(i!==null)selected=i;refreshManual();return;}if(!history.length)return;future.push(snapshot());restore(history.pop());}
function redo(){if(stroke)return;if(manual){const i=manual.redo();if(i!==null)selected=i;refreshManual();return;}if(!future.length)return;history.push(snapshot());restore(future.pop());}
$('#undo').onclick=undo;$('#redo').onclick=redo;
function mutate(fn){if(manual)return;remember();fn();sync();schedule();}
for(const el of $$('[data-p]'))el.addEventListener(['number','range','textarea','color'].includes(el.type)?'input':'change',()=>{
  if(el.type==='number'&&el.value==='')return;
  const k=el.dataset.p,v=el.type==='checkbox'?el.checked:el.type==='number'||el.type==='range'?+el.value:el.value;
  mutate(()=>{P[k]=v;if(k==='key')P.background='key';if(['split','cols','rows','margin','gap'].includes(k)){overrides=[];selected=0;}});
  if(k==='split'&&v==='custom')setView('source');
});
for(const el of $$('input[type="number"][data-p]'))el.addEventListener('blur',()=>{el.value=P[el.dataset.p];});
$$('[data-size]').forEach(b=>b.onclick=()=>mutate(()=>{P.width=P.height=+b.dataset.size;}));
function setBusy(value){busy=value;$('#status').classList.toggle('busy',value);$('#status').textContent=value?'整えています…':result?'READY · '+current().usedColors+' COLORS':'READY';for(const id of ['export','exportFrame','exportMeta','copyPalette','exportZip'])$('#'+id).disabled=value||!result;for(const b of $$('.candidate,.frame,.swatch'))b.disabled=value;}
function stopWorker(){if(worker){worker.terminate();worker=null;}if(workerURL){URL.revokeObjectURL(workerURL);workerURL=null;}}
function schedule(){if(manual)return;revision++;stopWorker();clearTimeout(timer);if(!source)return;setBusy(true);timer=setTimeout(run,100);}
function run(){
  if(!source)return;const id=revision;started=performance.now();setBusy(true);
  let input;try{P=processor.params(P);sync();input={image:source,params:P,overrides,custom};}catch(e){fail(e.message,id);return;}
  const finish=payload=>{if(id!==revision)return;stopWorker();if(payload.error){fail(payload.error,id);return;}result=payload.result;selected=Math.min(selected,current().frames.length-1);$('#processingTime').textContent=((performance.now()-started)/1000).toFixed(2)+'s · LOCAL';setBusy(false);if(pendingManual){try{startManual(pendingManual);}catch(e){toast(e.message);}pendingManual=null;}render();};
  try{
    const code='const createPrimitives='+DotSnapPrimitives.toString()+';const processor=('+DotSnapProcessor.toString()+')(createPrimitives);onmessage=e=>{try{postMessage({result:processor.process(e.data)});}catch(error){postMessage({error:error.message});}};';
    workerURL=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));worker=new Worker(workerURL);
    worker.onmessage=e=>finish(e.data);worker.onerror=e=>{e.preventDefault();finish({error:'画像処理を開始できませんでした。ブラウザを更新して再度お試しください。'});};worker.postMessage(input);
  }catch(e){stopWorker();setTimeout(()=>{try{finish({result:processor.process(input)});}catch(error){finish({error:error.message});}},0);}
}
function fail(message,id){if(id!==revision)return;result=null;stopWorker();setBusy(false);$('#status').textContent='設定を確認してください';$('#warnings').replaceChildren();const d=document.createElement('div');d.className='warning';d.textContent=message;$('#warnings').append(d);$('#candidates').replaceChildren();$('#frames').replaceChildren();$('#palette').replaceChildren();toast(message);}
function canvasFor(data){const c=document.createElement('canvas');c.width=result.params.width;c.height=result.params.height;c.getContext('2d').putImageData(new ImageData(data,c.width,c.height),0,0);return c;}
function sheet(baseline=false){const c=document.createElement('canvas');c.width=result.cols*result.params.width;c.height=result.rows*result.params.height;const ctx=c.getContext('2d');for(const f of current().frames)ctx.putImageData(new ImageData(baseline?f.baseline:f.data,result.params.width,result.params.height),(f.i%result.cols)*result.params.width,Math.floor(f.i/result.cols)*result.params.height);return c;}
function setView(v){view=v;document.body.classList.toggle('source-view',v==='source');$$('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===v);b.setAttribute('aria-selected',b.dataset.view===v?'true':'false');});drawMain();}
$$('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
$('#grid').onchange=$('#dotGrid').onchange=$('#changes').onchange=drawMain;
let shownZoom=+$('#zoom').value;
function syncComparison(from){
  if(view!=='compare')return;
  const to=from===$('#beforeViewport')?$('#afterViewport'):$('#beforeViewport');
  if(Math.abs(to.scrollLeft-from.scrollLeft)>.5)to.scrollLeft=from.scrollLeft;
  if(Math.abs(to.scrollTop-from.scrollTop)>.5)to.scrollTop=from.scrollTop;
}
for(const pane of [$('#beforeViewport'),$('#afterViewport')]){
  pane.addEventListener('scroll',()=>syncComparison(pane),{passive:true});
  let pan=null,moved=false;
  pane.addEventListener('pointerdown',e=>{
    if(view!=='compare'||e.button!==0||e.target!==pane.querySelector('canvas'))return;
    pan={x:e.clientX,y:e.clientY,left:pane.scrollLeft,top:pane.scrollTop};moved=false;
    pane.setPointerCapture(e.pointerId);pane.classList.add('dragging');e.preventDefault();
  });
  pane.addEventListener('pointermove',e=>{if(!pan)return;const dx=e.clientX-pan.x,dy=e.clientY-pan.y;if(Math.hypot(dx,dy)>3)moved=true;pane.scrollLeft=pan.left-dx;pane.scrollTop=pan.top-dy;syncComparison(pane);});
  const end=()=>{pan=null;pane.classList.remove('dragging');};
  pane.addEventListener('pointerup',end);pane.addEventListener('pointercancel',end);
  pane.addEventListener('click',e=>{if(moved){e.stopPropagation();moved=false;}},true);
}
$('#zoom').onchange=()=>{
  const pane=$('#afterViewport'),next=+$('#zoom').value;
  const x=(pane.scrollLeft+pane.clientWidth/2)/shownZoom,y=(pane.scrollTop+pane.clientHeight/2)/shownZoom;
  drawMain();shownZoom=next;
  pane.scrollLeft=x*next-pane.clientWidth/2;pane.scrollTop=y*next-pane.clientHeight/2;syncComparison(pane);
};
function drawMain(){
  updateToolCursor();
  if(busy&&view!=='source')return;
  $$('.preview-grid').forEach(el=>el.hidden=true);
  const c=$('#mainCanvas'),before=$('#beforeCanvas'),compare=view==='compare';
  before.hidden=$('#beforeLabel').hidden=$('#afterLabel').hidden=$('#beforePane').hidden=!compare||!result;
  $('#stage').classList.toggle('comparing',compare&&!!result);
  if(manual&&view!=='source'){drawEditor();return;}
  $('#empty').hidden=!!source;if(!source){c.width=c.height=1;return;}
  if(view==='source'){
    c.width=source.width;c.height=source.height;const ctx=c.getContext('2d');ctx.putImageData(source,0,0);
    const scale=Math.min(1,Math.max(200,$('#stage').clientWidth-56)/source.width);
    c.style.width=c.width*scale+'px';c.style.height=c.height*scale+'px';
    const cells=P.split==='custom'?custom:current()?.frames.map(f=>f.cell)||[];
    ctx.lineWidth=2/scale;ctx.font=12/scale+'px monospace';
    cells.forEach((cell,i)=>{ctx.strokeStyle=i===selected?'#df6b35':'#386b50';ctx.strokeRect(cell.x,cell.y,cell.w,cell.h);ctx.fillStyle='#273a36';ctx.fillRect(cell.x,cell.y,30/scale,19/scale);ctx.fillStyle='white';ctx.fillText(String(i+1),cell.x+5/scale,cell.y+14/scale);});
    if(dragStart?.end){ctx.strokeStyle='#df6b35';ctx.strokeRect(dragStart.x,dragStart.y,dragStart.end.x-dragStart.x,dragStart.end.y-dragStart.y);}
    c.style.cursor=picking?'crosshair':P.split==='custom'?'crosshair':'pointer';return;
  }
  if(!result){c.width=c.height=1;return;}
  c.style.cursor='pointer';const s=sheet(),zoom=+$('#zoom').value;c.width=s.width;c.height=s.height;const ctx=c.getContext('2d');ctx.drawImage(s,0,0);c.style.width=c.width*zoom+'px';c.style.height=c.height*zoom+'px';
  if(compare){const b=sheet(true);before.width=b.width;before.height=b.height;before.getContext('2d').drawImage(b,0,0);before.style.width=b.width*zoom+'px';before.style.height=b.height*zoom+'px';}

  if($('#changes').checked){const copy=document.createElement('canvas');copy.width=c.width;copy.height=c.height;copy.getContext('2d').drawImage(c,0,0);c.width=copy.width*zoom;c.height=copy.height*zoom;ctx.imageSmoothingEnabled=false;ctx.drawImage(copy,0,0,c.width,c.height);ctx.scale(zoom,zoom);drawChanges(c,current().frames,false);}
  drawSheetGrids(c,zoom);
  if(compare){drawSheetGrids(before,zoom);syncComparison($('#afterViewport'));}
}
function render(){
  if(!result||busy)return;const v=current();$('#status').textContent='READY · '+v.usedColors+' COLORS';$('#imageInfo').textContent=sourceName+' · '+source.width+'×'+source.height+' → '+result.cols+'×'+result.rows+'コマ / '+P.width+'×'+P.height+'px';
  $('#candidateSummary').textContent=P.repair?(P.repairScope==='edge'?'縁だけ · ':'全体 · ')+v.changes+'ドットを補修':'自動補修 OFF';
  $('#warnings').replaceChildren();const warnings=[...result.warnings];if(v.clipped)warnings.unshift(v.clipped+'コマが枠からはみ出しています。「全体を収める」または位置補正を確認してください。');
  for(const message of warnings){const d=document.createElement('div');d.className='warning';d.textContent=message;$('#warnings').append(d);}
  $('#candidates').replaceChildren();result.variants.forEach((variant,i)=>{const b=document.createElement('button');b.className='candidate'+(result.selected===i?' active':'');b.setAttribute('aria-pressed',result.selected===i?'true':'false');const c=canvasFor(variant.frames[selected]?.data||variant.frames[0].data);const t=document.createElement('div');const title=document.createElement('strong');title.textContent=labels[variant.style];const desc=document.createElement('small');desc.textContent=descriptions[variant.style];const tag=document.createElement('small');tag.className='tag';tag.textContent=(result.selected===i?(P.style==='auto'?'おまかせ選択 · ':'選択中 · '):'')+variant.changes+'ドット補修';t.append(title,desc,tag);b.append(c,t);b.onclick=()=>{if(manual)return;remember();P.style=variant.style;result.selected=i;sync();render();};$('#candidates').append(b);});
  $('#frames').replaceChildren();v.frames.forEach(f=>{const b=document.createElement('button');b.className='frame'+(f.i===selected?' active':'');b.setAttribute('aria-label','コマ '+(f.i+1));b.append(canvasFor(f.data));const label=document.createElement('span');label.textContent=String(f.i+1).padStart(2,'0')+(f.clipped?' !':'');b.append(label);b.onclick=()=>{selected=f.i;animationIndex=f.i;render();};$('#frames').append(b);});
  $('#frameCount').textContent=v.frames.length+' FRAMES';const f=v.frames[selected];$('#frameInfo').textContent='#'+(selected+1)+' · '+(f.pitch?'ピッチ '+f.pitch.toFixed(2)+' · ':'')+(f.changes||0)+'ドット補修';$('#dx').value=overrides[selected]?.dx||0;$('#dy').value=overrides[selected]?.dy||0;
  const oldRow=pendingRow??$('#animationRow').value;pendingRow=null;$('#animationRow').replaceChildren(new Option('全コマ','all'));for(let r=0;r<result.rows;r++)$('#animationRow').append(new Option((r+1)+'行目',String(r)));$('#animationRow').value=[...$('#animationRow').options].some(o=>o.value===oldRow)?oldRow:'all';
  $('#palette').replaceChildren();const locked=new Set(processor.parse(P.lockedPalette).map(c=>'#'+c.map(v=>v.toString(16).padStart(2,'0')).join('')));for(const color of v.palette){const b=document.createElement('button');b.className='swatch'+(locked.has(color)?' locked':'');b.style.background=color;b.title=color+' · クリックで保護を切替';b.setAttribute('aria-label',color+' を保護');b.onclick=()=>{if(manual){paintColor=color;updateModeUI();return;}if(P.fixedPalette.trim()){toast('固定パレット使用中です。固定パレット欄で編集できます。');return;}mutate(()=>{if(locked.has(color))locked.delete(color);else locked.add(color);P.lockedPalette=[...locked].join(' ');});};$('#palette').append(b);}
  $('#colorCount').textContent=v.usedColors+'色使用 / '+v.palette.length+'色のパレット'+(P.fixedPalette.trim()?' · 固定':'');
  updateModeUI();drawMain();drawAnimation();
}
for(const k of ['dx','dy'])$('#'+k).oninput=e=>mutate(()=>{overrides[selected]={...overrides[selected],[k]:Math.max(-512,Math.min(512,Number(e.target.value)||0))};});
$('#resetFrame').onclick=()=>mutate(()=>{overrides[selected]={dx:0,dy:0};});
function animationFrames(){if(!result)return[];const row=$('#animationRow').value;return current().frames.filter(f=>row==='all'||Math.floor(f.i/result.cols)===+row);}
function drawAnimation(){if(!result||busy)return;const frames=animationFrames();if(!frames.length)return;const at=playing?animationIndex%frames.length:Math.max(0,frames.findIndex(f=>f.i===selected));const c=$('#animationCanvas');c.width=P.width;c.height=P.height;const ctx=c.getContext('2d');if($('#onion').checked&&frames.length>1){ctx.globalAlpha=.25;ctx.drawImage(canvasFor(frames[(at+frames.length-1)%frames.length].data),0,0);ctx.globalAlpha=1;}ctx.drawImage(canvasFor(frames[at].data),0,0);}
function animationTick(){clearTimeout(animationTimer);if(!playing)return;drawAnimation();animationIndex++;animationTimer=setTimeout(animationTick,1000/Math.max(1,Math.min(30,+$('#fps').value||8)));}
$('#play').onclick=()=>{playing=!playing;$('#play').textContent=playing?'Ⅱ 停止':'▶ 再生';$('#play').setAttribute('aria-label',playing?'停止':'再生');animationTick();};
$('#animationRow').onchange=()=>{animationIndex=0;drawAnimation();};$('#onion').onchange=drawAnimation;
function sourcePoint(e){const c=$('#mainCanvas'),r=c.getBoundingClientRect();return{x:Math.max(0,Math.min(source.width,Math.round((e.clientX-r.left)/r.width*source.width))),y:Math.max(0,Math.min(source.height,Math.round((e.clientY-r.top)/r.height*source.height)))};}
$('#mainCanvas').onpointerdown=e=>{
  if(manual){editDown(e);return;}
  if(!source||view!=='source')return;const point=sourcePoint(e);
  if(picking){const i=(Math.min(source.height-1,point.y)*source.width+Math.min(source.width-1,point.x))*4;const color='#'+[...source.data.slice(i,i+3)].map(v=>v.toString(16).padStart(2,'0')).join('');mutate(()=>{if(picking==='add'){const keys=new Set((P.extraKeys||'').split(' ').filter(Boolean));if(keys.size>=32){toast('追加は32色までです');return;}keys.add(color);P.extraKeys=[...keys].join(' ');}else P.key=color;P.background='key';});picking=false;updateModeUI();toast('キー色を設定しました');return;}
  if(P.split==='custom'){dragStart=point;$('#mainCanvas').setPointerCapture(e.pointerId);e.preventDefault();}
};
$('#mainCanvas').onpointermove=e=>{if(stroke){editMove(e);return;}if(dragStart){dragStart.end=sourcePoint(e);drawMain();}};
$('#mainCanvas').onpointerup=e=>{if(stroke){stroke=null;refreshManual();return;}if(!dragStart)return;const end=sourcePoint(e),start=dragStart;dragStart=null;const rect={x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),w:Math.abs(start.x-end.x),h:Math.abs(start.y-end.y)};if(rect.w>2&&rect.h>2)mutate(()=>{custom.push(rect);});drawMain();};
$('#mainCanvas').onpointercancel=()=>{if(stroke){stroke=null;refreshManual();return;}dragStart=null;drawMain();};
$('#mainCanvas').onclick=e=>{if(manual)return;if(!result||busy||P.split==='custom'||picking)return;if(view==='source'){const pt=sourcePoint(e);const f=current().frames.find(f=>pt.x>=f.cell.x&&pt.x<f.cell.x+f.cell.w&&pt.y>=f.cell.y&&pt.y<f.cell.y+f.cell.h);if(f)selected=f.i;}else{const r=e.currentTarget.getBoundingClientRect();selected=Math.floor((e.clientY-r.top)/r.height*result.rows)*result.cols+Math.floor((e.clientX-r.left)/r.width*result.cols);selected=Math.min(selected,current().frames.length-1);}render();};
$('#pickKey').onclick=()=>{if(!source){toast('先に画像を開いてください');return;}setView('source');picking=true;toast('元画像の背景色をクリックしてください');};
$('#applyKey').onclick=()=>mutate(()=>{P.background='key';});
$('#clearRects').onclick=()=>mutate(()=>{custom=[];overrides=[];});
function decode(url){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{if(im.naturalWidth*im.naturalHeight>16000000){reject(Error('画像は1600万画素以内にしてください。'));return;}const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);resolve({image:c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height),url:c.toDataURL('image/png')});};im.onerror=()=>reject(Error('画像を読み込めませんでした。'));im.src=url;});}
async function loadBlob(blob,name){if(manual&&!confirm('画像を開くと手仕上げを破棄します。必要なら先に作業を保存してください。続けますか？'))return;const id=++loadRevision,url=URL.createObjectURL(blob);try{const decoded=await decode(url);if(id!==loadRevision)return;adopt(decoded,name); }catch(e){toast(e.message);}finally{URL.revokeObjectURL(url);}}
function adopt(decoded,name,project){manual=null;manualVariant=null;pendingManual=project?.manual||null;stroke=null;revision++;stopWorker();source=decoded.image;sourceURL=decoded.url;sourceName=name||'image';result=null;selected=Number.isInteger(project?.selected)?Math.max(0,project.selected):0;overrides=project?.overrides||[];custom=project?.custom||[];P=project?processor.params(project.params):{...P,split:P.split==='custom'?'auto':P.split};pendingRow=project?.animation?.row??'all';history=[];future=[];sync();updateModeUI();drawMain();schedule();}
$('#file').onchange=e=>{if(e.target.files[0])loadBlob(e.target.files[0],e.target.files[0].name);e.target.value='';};
document.addEventListener('paste',e=>{if(['INPUT','TEXTAREA'].includes(e.target.tagName))return;for(const item of e.clipboardData.items)if(item.type.startsWith('image/')){e.preventDefault();loadBlob(item.getAsFile(),'貼り付け画像');break;}});
let dragDepth=0;document.addEventListener('dragenter',e=>{e.preventDefault();if([...e.dataTransfer.types].includes('Files')){dragDepth++;$('#dropOverlay').hidden=false;}});document.addEventListener('dragover',e=>e.preventDefault());document.addEventListener('dragleave',()=>{if(--dragDepth<=0){dragDepth=0;$('#dropOverlay').hidden=true;}});document.addEventListener('drop',e=>{e.preventDefault();dragDepth=0;$('#dropOverlay').hidden=true;const file=[...e.dataTransfer.files].find(f=>f.type.startsWith('image/'));if(file)loadBlob(file,file.name);});
document.addEventListener('keydown',e=>{
 const typing=e.target.isContentEditable||e.target.tagName==='TEXTAREA'||e.target.tagName==='INPUT'&&!['radio','checkbox','button'].includes(e.target.type);
 if(typing)return;
 const key=e.key.toLowerCase();
 if((e.ctrlKey||e.metaKey)&&(key==='z'||key==='y')){e.preventDefault();key==='y'||e.shiftKey?redo():undo();return;}
 if(manual&&view!=='source'&&!e.altKey&&['+','=','-','_'].includes(e.key)){e.preventDefault();stepZoom(['+','='].includes(e.key)?1:-1);return;}
 if(e.target.tagName==='SELECT'||e.target.type==='radio')return;
 if(manual&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();moveEdit(...({ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key]));}
});
const baseName=()=>sourceName.replace(/\.[^.]+$/,'').replace(/[<>:"/\\|?*]/g,'_')||'sprite';
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function png(c,name){c.toBlob(blob=>{if(blob){download(blob,name);toast('PNGを書き出しました');}else toast('PNGの作成に失敗しました。');},'image/png');}
$('#export').onclick=()=>{if(result&&!busy)png(sheet(),baseName()+'_'+P.width+'x'+P.height+'_'+current().usedColors+'c.png');};
$('#exportFrame').onclick=()=>{if(result&&!busy)png(canvasFor(current().frames[selected].data),baseName()+'_frame'+String(selected+1).padStart(2,'0')+'.png');};
$('#exportZip').onclick=async()=>{if(!result||busy)return;const variant=current(),width=result.params.width,height=result.params.height,name=baseName(),button=$('#exportZip');button.disabled=true;try{const files=[];for(const f of variant.frames){const c=document.createElement('canvas');c.width=width;c.height=height;c.getContext('2d').putImageData(new ImageData(f.data,width,height),0,0);const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));if(!blob)throw Error('PNGの生成に失敗しました');files.push({name:'frame'+String(f.i+1).padStart(3,'0')+'.png',data:new Uint8Array(await blob.arrayBuffer())});}download(DotSnapZip.zip(files),name+'_frames.zip');toast(variant.frames.length+'コマをZIPに保存しました');}catch(e){toast(e.message);}finally{button.disabled=busy||!result;}};
$('#exportMeta').onclick=()=>{if(!result||busy)return;const metadata={version:1,image:baseName()+'_'+P.width+'x'+P.height+'_'+current().usedColors+'c.png',frameWidth:P.width,frameHeight:P.height,columns:result.cols,rows:result.rows,palette:current().palette,fps:Math.max(1,Math.min(30,+$('#fps').value||8)),frames:current().frames.map(f=>({index:f.i,x:f.i%result.cols*P.width,y:Math.floor(f.i/result.cols)*P.height,width:P.width,height:P.height,source:f.cell,sourceOrigin:{x:f.originX??null,y:f.originY??null},sourcePixelsPerDot:f.pitch??null,clipped:f.clipped}))};download(new Blob([JSON.stringify(metadata,null,2)],{type:'application/json'}),baseName()+'.frames.json');};
$('#copyPalette').onclick=async()=>{try{await navigator.clipboard.writeText(current().palette.join('\n'));toast('パレットをコピーしました');}catch(e){toast('コピーできませんでした。作業保存またはJSON出力から取得できます。');}};
$('#saveProject').onclick=()=>{if(stroke)return;if(!source){toast('先に画像を開いてください');return;}const project={format:'dotsnap',version:2,manual:manual?.save()||null,name:sourceName,image:sourceURL,params:P,overrides,custom,selected,animation:{fps:+$('#fps').value||8,row:$('#animationRow').value}};download(new Blob([JSON.stringify(project)],{type:'application/json'}),baseName()+'.dotsnap');toast('画像・設定・手仕上げを保存しました');};
$('#projectFile').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;if(manual&&!confirm('現在の手仕上げを破棄して作業を再開しますか？'))return;const id=++loadRevision;try{if(file.size>100000000)throw Error('作業ファイルが大きすぎます。');const data=JSON.parse(await file.text());if(data.format!=='dotsnap'||![1,2].includes(data.version)||typeof data.image!=='string'||!/^data:image\/png;base64,/.test(data.image))throw Error('対応するdotsnap作業ファイルではありません。');processor.params(data.params);if(!Array.isArray(data.overrides)||!Array.isArray(data.custom))throw Error('作業ファイルの設定が不正です。');const decoded=await decode(data.image);if(id!==loadRevision)return;adopt(decoded,data.name,data);$('#fps').value=Math.max(1,Math.min(30,data.animation?.fps||8));toast('作業を再開しました');}catch(error){toast(error.message);}};
function makeSample(){
  const c=document.createElement('canvas');c.width=768;c.height=384;const ctx=c.getContext('2d');ctx.fillStyle='#e7f0d9';ctx.fillRect(0,0,c.width,c.height);
  const sp=document.createElement('canvas');sp.width=32;sp.height=32;const g=sp.getContext('2d');
  for(let f=0;f<8;f++){g.clearRect(0,0,32,32);const bob=f===3?-3:f===4?-1:0;const rect=(color,x,y,w,h)=>{g.fillStyle=color;g.fillRect(x,y+bob,w,h);};const dark='#263d3b',green='#66865b',light='#afbf78',cream='#f7d898',orange='#d88147';
    rect(dark,9,7,15,17);rect(dark,6,12,22,9);rect(green,10,8,13,15);rect(green,7,13,20,7);rect(light,10,8,7,8);rect(cream,10,16,13,5);rect(dark,11,13,2,2);rect(dark,21,13,2,2);rect('#fff8d8',11,13,1,1);rect(orange,14,17,5,2);rect(dark,12,24,4,3);rect(dark,21,24+(f%2),4,3);rect(orange,11,25,4,2);rect(orange,22,25+(f%2),4,2);rect(dark,8,4,3,6);rect(dark,23,4,3,6);rect(light,9,5,1,3);rect(light,24,5,1,3);if(f>3){rect(dark,27,10,1,15);rect(orange,26,7,3,4);}
    ctx.save();ctx.imageSmoothingEnabled=true;ctx.filter='blur(0.45px)';const scale=4.35;ctx.drawImage(sp,(f%4)*192+25+(f%3),Math.floor(f/4)*192+28,32*scale,32*scale);ctx.restore();
  }return c;
}
$('#sample').onclick=async()=>{if(manual&&!confirm('手仕上げを破棄してデモを開きますか？'))return;const id=++loadRevision;const decoded=await decode(makeSample().toDataURL());if(id!==loadRevision)return;P={...processor.defaults,width:32,height:32,split:'uniform',cols:4,rows:2};adopt(decoded,'forest-friends-demo.png');};
window.addEventListener('beforeunload',()=>{stopWorker();clearTimeout(animationTimer);});
function startManual(saved){
 const v=result.variants[result.selected];
 manual=DotSnapManual.create(P.width,P.height,v.frames.map(f=>f.data),v.palette,saved);
 manualVariant={...v,palette:manual.palette,frames:v.frames.map((f,i)=>({...f,baseline:manual.frames[i].base}))};
 paintColor=manual.palette[0]||null;picking=false;view='result';$('#showEdits').checked=true;$('#zoom').value='12';shownZoom=12;
 refreshManual();setView('result');
}
function refreshManual(){
 if(!manual)return;
 const used=new Set();manualVariant.frames.forEach((f,i)=>{f.data=manual.data(i);for(let p=0;p<f.data.length;p+=4)if(f.data[p+3])used.add(f.data.slice(p,p+3).join(','));});
 manualVariant.usedColors=used.size;render();
}
function updateModeUI(){
 document.body.classList.toggle('source-view',view==='source');
 $('#modeLabel').textContent=manual?'手仕上げモード · コマ '+(selected+1):'変換モード';
 $('#manualMode').textContent=manual?'変換設定に戻る':'確定して手仕上げへ';$('#manualMode').disabled=busy||!result||!!stroke;
 $$('[data-manual-zoom]').forEach(o=>{o.hidden=o.disabled=!manual;});if(!manual&&+$('#zoom').value>12){$('#zoom').value='12';shownZoom=12;}
 updateToolCursor();
 $('#editUndo').disabled=!manual||!manual.canUndo;$('#editRedo').disabled=!manual||!manual.canRedo;
 $('#editFrame').replaceChildren();if(manual){manual.frames.forEach((f,i)=>$('#editFrame').append(new Option('コマ '+(i+1),i)));$('#editFrame').value=selected;}
 $('#conversionControls').hidden=!!manual;$('#editTools').hidden=!manual;document.body.classList.toggle('editing',!!manual);
 for(const el of $$('#conversionControls input,#conversionControls select,#conversionControls textarea,#conversionControls button,.candidate,#dx,#dy,#resetFrame'))el.disabled=!!manual;
 $('#undo').disabled=manual?!manual.canUndo:!history.length;$('#redo').disabled=manual?!manual.canRedo:!future.length;
 $('#editColor').textContent=paintColor||'色なし';$('#editColor').style.borderLeft='18px solid '+(paintColor||'transparent');
 $('#editPalette').replaceChildren();if(manual)for(const color of manual.palette){const b=document.createElement('button');b.className='swatch';b.style.background=color;b.setAttribute('aria-label',color+' で描く');b.setAttribute('aria-pressed',String(color===paintColor));b.onclick=()=>{paintColor=color;selectEditTool('pen');updateModeUI();};$('#editPalette').append(b);}
 $('#extraKeys').replaceChildren();for(const color of (P.extraKeys||'').split(' ').filter(Boolean)){const b=document.createElement('button');b.className='swatch';b.style.background=color;b.title=color+' を解除';b.setAttribute('aria-label',b.title);b.disabled=!!manual;b.onclick=()=>{mutate(()=>{P.extraKeys=P.extraKeys.split(' ').filter(c=>c!==color).join(' ');});updateModeUI();};$('#extraKeys').append(b);}
 $('[data-view="compare"]').textContent=manual?'確定時 / 手仕上げ':'補修前 / 後';
 $('#beforeLabel').textContent=manual?'確定時':'補修前';$('#afterLabel').textContent=manual?'手仕上げ（比較中はドラッグで移動）':'自動補修後';
}
$('#manualMode').onclick=()=>{
 if(busy||!result)return;
 if(!manual){if(confirm('現在の変換結果を確定して手仕上げを開始します。手仕上げ中は変換設定を変更できません。続けますか？'))startManual();}
 else if(confirm('変換設定に戻ると手仕上げを破棄します。必要なら先に「作業を保存」してください。戻りますか？')){manual=null;manualVariant=null;stroke=null;updateModeUI();render();}
};
$('#addKey').onclick=()=>{if(!source)return;setView('source');picking='add';toast('追加で抜きたい色を元画像から選んでください');};
$('#editUndo').onclick=undo;$('#editRedo').onclick=redo;$('#editSave').onclick=()=>$('#saveProject').click();$('#editFrame').onchange=e=>{if(stroke)return;selected=+e.target.value;render();};
$('#showEdits').onchange=drawMain;
$('#resetEdits').onclick=()=>{if(manual&&!stroke){manual.remember(selected);manual.reset(selected);refreshManual();}};
function moveEdit(x,y){if(!manual||stroke||!$('#showEdits').checked)return;manual.remember(selected);manual.move(selected,x,y);refreshManual();}
$$('[data-move]').forEach(b=>b.onclick=()=>moveEdit(...b.dataset.move.split(',').map(Number)));
function editPoint(e){const r=$('#mainCanvas').getBoundingClientRect();return {x:Math.floor((e.clientX-r.left)/r.width*P.width),y:Math.floor((e.clientY-r.top)/r.height*P.height)};}
function editDown(e){
 if(e.button!==0||view!=='result'||!$('#showEdits').checked)return;
 const pt=editPoint(e);if(pt.x<0||pt.y<0||pt.x>=P.width||pt.y>=P.height)return;
 const tool=effectiveTool(e);
 if(tool==='pick'){const d=current().frames[selected].data,i=(pt.y*P.width+pt.x)*4;if(d[i+3]){paintColor='#'+Array.from(d.slice(i,i+3),v=>v.toString(16).padStart(2,'0')).join('');updateModeUI();}e.preventDefault();return;}
 manual.remember(selected);stroke={...pt,i:selected,tool,color:tool==='erase'?null:paintColor};
 $('#mainCanvas').setPointerCapture(e.pointerId);e.preventDefault();manual.paint(selected,pt.x,pt.y,stroke.color);refreshManual();
}
function editMove(e){
 const pt=editPoint(e),x=Math.max(-1,Math.min(P.width,pt.x)),y=Math.max(-1,Math.min(P.height,pt.y));
 let a=stroke.x,b=stroke.y;const dx=Math.abs(x-a),dy=-Math.abs(y-b),sx=a<x?1:-1,sy=b<y?1:-1;let err=dx+dy;
 for(;;){manual.paint(stroke.i,a,b,stroke.color);if(a===x&&b===y)break;const e2=2*err;if(e2>=dy){err+=dy;a+=sx;}if(e2<=dx){err+=dx;b+=sy;}}
 stroke.x=x;stroke.y=y;manualVariant.frames[stroke.i].data=manual.data(stroke.i);drawMain();
}
function drawChanges(c,frames,single){
 if(manual)return;
 if(!$('#changes').checked||($('#blinkChanges').checked&&!blinkPhase))return;
 const ctx=c.getContext('2d');for(const f of frames)for(let i=0;i<f.data.length;i+=4){if(f.data[i+3]===f.baseline[i+3]&&(!f.data[i+3]||f.data[i]===f.baseline[i]&&f.data[i+1]===f.baseline[i+1]&&f.data[i+2]===f.baseline[i+2]))continue;
 const x=(single?0:f.i%result.cols*P.width)+(i/4%P.width),y=(single?0:Math.floor(f.i/result.cols)*P.height)+Math.floor(i/4/P.width);
 ctx.fillStyle='#000';ctx.fillRect(x,y,1,1);ctx.fillStyle='#fff';ctx.fillRect(x+.2,y+.2,.6,.6);
 }
}
function effectiveTool(e=cursorKeys){const selectedTool=$('input[name="editTool"]:checked').value;return selectedTool==='pen'?(e.altKey?'pick':e.shiftKey?'erase':'pen'):selectedTool;}
function updateToolCursor(){
 const badge=$('#toolCursor');if(!badge)return;
 badge.hidden=!manual||view!=='result'||!cursorPoint;if(badge.hidden)return;
 const tool=stroke?.tool||effectiveTool();badge.textContent=!$('#showEdits').checked?'閲覧中':({pen:'✎ ペン',erase:'▱ 消しゴム',pick:'⌾ スポイト'}[tool]);badge.dataset.tool=tool;
 badge.style.left=Math.min(window.innerWidth-120,cursorPoint.x+18)+'px';badge.style.top=Math.min(window.innerHeight-35,cursorPoint.y+18)+'px';
}
$('#mainCanvas').addEventListener('pointermove',e=>{cursorPoint={x:e.clientX,y:e.clientY};cursorKeys=e;updateToolCursor();});
$('#mainCanvas').addEventListener('pointerenter',e=>{cursorPoint={x:e.clientX,y:e.clientY};cursorKeys=e;updateToolCursor();});
$('#mainCanvas').addEventListener('pointerleave',()=>{cursorPoint=null;updateToolCursor();});
for(const event of ['keydown','keyup'])document.addEventListener(event,e=>{cursorKeys={shiftKey:e.shiftKey,altKey:e.altKey};updateToolCursor();});
window.addEventListener('blur',()=>{cursorPoint=null;cursorKeys={};updateToolCursor();});
$$('input[name="editTool"]').forEach(el=>el.addEventListener('change',updateToolCursor));
function stepZoom(direction){if(stroke||!manual||view==='source')return;const values=[...$('#zoom').options].filter(o=>!o.disabled).map(o=>+o.value),index=values.indexOf(+$('#zoom').value),next=values[Math.max(0,Math.min(values.length-1,index+direction))];$('#zoom').value=next;$('#zoom').onchange();}
for(const viewport of [$('#afterViewport'),$('#beforeViewport')])viewport.addEventListener('wheel',e=>{if(manual&&view!=='source'&&(e.ctrlKey||e.metaKey)){e.preventDefault();if(e.deltaY)stepZoom(e.deltaY<0?1:-1);}},{passive:false});
function selectEditTool(value){$('input[name="editTool"][value="'+value+'"]').checked=true;}
$('#editGrid').onchange=drawMain;
function drawSheetGrids(canvas,zoom){
 previewGrid(canvas,$('#dotGrid').checked,zoom,1,1);
 previewGrid(canvas,$('#grid').checked,zoom,P.width,P.height,'frames');
}
function previewGrid(canvas,visible,zoom,stepX,stepY,kind='dots'){
 let grid=canvas.parentElement.querySelector('.preview-grid[data-kind="'+kind+'"]');
 if(!grid){grid=document.createElement('div');grid.className='preview-grid';grid.dataset.kind=kind;grid.setAttribute('aria-hidden','true');canvas.parentElement.append(grid);}
 grid.hidden=!visible;if(!visible)return;
 grid.style.setProperty('--grid-line',Math.min(1,zoom/4)+'px');
 grid.style.width=canvas.style.width;grid.style.height=canvas.style.height;
 grid.style.backgroundSize=(zoom*stepX)+'px '+(zoom*stepY)+'px';
}
function drawEditor(){
 const c=$('#mainCanvas'),compare=view==='compare',z=+$('#zoom').value,f=current().frames[selected];
 // Keep the bitmap at native size; CSS scales pixels and the grid stays a separate overlay.
 const draw=(canvas,data,marks)=>{canvas.width=P.width;canvas.height=P.height;canvas.style.width=P.width*z+'px';canvas.style.height=P.height*z+'px';const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(canvasFor(data),0,0,canvas.width,canvas.height);if(marks)drawChanges(canvas,[f],true);};
 draw(c,$('#showEdits').checked?f.data:f.baseline,$('#showEdits').checked);if(compare)draw($('#beforeCanvas'),f.baseline,false);previewGrid(c,$('#editGrid').checked,z,1,1);if(compare)previewGrid($('#beforeCanvas'),$('#editGrid').checked,z,1,1);c.style.cursor=view==='result'?'crosshair':'grab';$('#empty').hidden=true;
}
setInterval(()=>{if(!document.hidden&&$('#changes').checked&&$('#blinkChanges').checked&&!stroke){blinkPhase=!blinkPhase;drawMain();}},650);
$('#blinkChanges').onchange=()=>{blinkPhase=true;drawMain();};
$('#maximize').onclick=()=>{const on=document.body.classList.toggle('preview-max');$('.canvas-panel').classList.toggle('maximized',on);$('#maximize').textContent=on?'通常サイズに戻す':'プレビューを最大化';};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.body.classList.remove('preview-max');$('.canvas-panel').classList.remove('maximized');$('#maximize').textContent='プレビューを最大化';picking=false;}});
let resizeStart=null;
$('#previewResize').onpointerdown=e=>{resizeStart={y:e.clientY,h:$('#stage').clientHeight};e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();};
$('#previewResize').onpointermove=e=>{if(resizeStart)$('#stage').style.height=Math.max(200,Math.min(1600,resizeStart.h+e.clientY-resizeStart.y))+'px';};
$('#previewResize').onpointerup=$('#previewResize').onpointercancel=()=>{resizeStart=null;};
$('#previewResize').onkeydown=e=>{if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();e.stopPropagation();$('#stage').style.height=Math.max(200,Math.min(1600,$('#stage').clientHeight+(e.key==='ArrowUp'?-20:20)))+'px';}};
sync();setBusy(false);updateModeUI();drawMain();
})();
