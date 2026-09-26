const {test}=require('node:test'),assert=require('node:assert/strict');
require('../engine.js');require('../processor.js');
const engine=DotSnapProcessor(DotSnapPrimitives);
function image(w,h,bg=[0,0,0,0]){const data=new Uint8ClampedArray(w*h*4);for(let i=0;i<data.length;i+=4)data.set(bg,i);return{width:w,height:h,data};}
function rect(im,x,y,w,h,c){for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)im.data.set(c,(yy*im.width+xx)*4);}
function process(im,p={}){return engine.process({image:im,params:{...engine.defaults,width:16,height:16,split:'single',background:'alpha',pitchMode:'fit',...p}});}
test('fixed dimensions, binary alpha and strict color limit including outline',()=>{
 const im=image(60,60);for(let y=5;y<55;y++)for(let x=5;x<55;x++)im.data.set([x*4,y*4,(x+y)*2,255],(y*60+x)*4);
 const r=process(im,{width:24,height:32,colors:4,outline:'outer',outlineColor:'#ff0000'});
 for(const v of r.variants){assert.ok(v.usedColors<=4);assert.equal(v.frames[0].data.length,24*32*4);assert.equal(v.clipped,0);assert.ok(v.palette.includes('#ff0000'));for(let i=3;i<v.frames[0].data.length;i+=4)assert.ok([0,255].includes(v.frames[0].data[i]));}
});
test('fixed palette is authoritative even with an external outline color',()=>{
 const im=image(40,40);rect(im,5,5,30,30,[100,180,20,255]);const r=process(im,{fixedPalette:'#000000 #ffffff',outline:'outer',outlineColor:'#ff0000'});
 for(const v of r.variants){assert.deepEqual(v.palette,['#000000','#ffffff']);assert.ok(v.usedColors<=2);}
});
test('edge-connected removal preserves an enclosed patch matching the background',()=>{
 const im=image(20,20,[0,255,0,255]);rect(im,4,4,12,12,[0,0,0,255]);rect(im,7,7,5,5,[0,255,0,255]);
 const b=engine.background(im,{...engine.defaults,background:'edge',tolerance:20});assert.equal(b.mask[0],0);assert.equal(b.mask[9*20+9],1);
 const k=engine.background(im,{...engine.defaults,background:'key',key:'#00ff00',tolerance:20});assert.equal(k.mask[9*20+9],0);
});
test('existing alpha does not remove visible pixels with the border RGB',()=>{
 const im=image(20,20);rect(im,7,7,5,5,[0,0,0,255]);const b=engine.background(im,{...engine.defaults});assert.equal(b.mode,'alpha');assert.equal(b.mask[8*20+8],1);
});
test('a thin source-supported extension is restored and no unsupported cells invented',()=>{
 const im=image(64,64);rect(im,8,20,24,24,[40,80,40,255]);rect(im,32,28,24,1,[40,80,40,255]);
 const r=process(im,{width:16,height:16,pitchMode:'manual',pitch:4,anchor:'center'});const detail=r.variants[1].frames[0];
 assert.ok(detail.changes>0);let gained=0;for(let i=3;i<detail.data.length;i+=4)if(detail.data[i]&&!detail.baseline[i])gained++;assert.ok(gained>0);
 for(let i=0;i<detail.data.length;i+=4)if(detail.data[i+3]&&!detail.baseline[i+3]){
  const x=i/4%16,y=Math.floor(i/4/16);let supported=false;
  for(let sy=Math.max(0,Math.ceil(detail.originY+y*detail.pitch));sy<Math.min(im.height,Math.ceil(detail.originY+(y+1)*detail.pitch));sy++)for(let sx=Math.max(0,Math.ceil(detail.originX+x*detail.pitch));sx<Math.min(im.width,Math.ceil(detail.originX+(x+1)*detail.pitch));sx++)if(im.data[(sy*im.width+sx)*4+3])supported=true;
  assert.ok(supported);
 }
});
test('repair off produces exactly the baseline',()=>{
 const im=image(32,32);rect(im,5,5,20,20,[80,120,160,255]);const r=process(im,{repair:false});
 for(const v of r.variants){assert.equal(v.changes,0);assert.deepEqual(v.frames[0].data,v.frames[0].baseline);}
});
test('automatic candidate selection restores a small contrasting accent lost by majority sampling',()=>{
 const im=image(64,64);rect(im,8,8,48,48,[40,120,60,255]);rect(im,20,20,2,2,[240,30,40,255]);
 const r=process(im,{width:16,height:16,colors:4,pitchMode:'manual',pitch:4,anchor:'center'});
 const chosen=r.variants[r.selected].frames[0],hasRed=d=>{for(let i=0;i<d.length;i+=4)if(d[i+3]&&d[i]>200&&d[i+1]<60)return true;return false;};
 assert.equal(hasRed(chosen.baseline),false);assert.equal(hasRed(chosen.data),true);
});
test('shared coordinates preserve vertical jump between frames',()=>{
 const im=image(64,32);rect(im,12,16,8,8,[50,90,140,255]);rect(im,44,8,8,8,[50,90,140,255]);
 const r=process(im,{split:'uniform',cols:2,rows:1,width:32,height:32,pitchMode:'manual',pitch:1,anchor:'source'});
 const firstY=f=>{for(let i=3;i<f.data.length;i+=4)if(f.data[i])return Math.floor(i/4/32);};
 assert.equal(firstY(r.variants[0].frames[0])-firstY(r.variants[0].frames[1]),8);
});
test('empty input, bad palette, oversized output and malformed options are handled',()=>{
 const im=image(16,16);assert.equal(process(im).variants[0].usedColors,0);
 assert.throws(()=>process(im,{fixedPalette:'blue'}),/パレット/);
 assert.throws(()=>process(im,{split:'uniform',cols:32,rows:32,width:512,height:512}));
 assert.throws(()=>process(im,{width:NaN}),/数値/);
 assert.throws(()=>process(im,{background:'bogus'}),/不正/);
});
test('processing is deterministic',()=>{
 const im=image(40,40);rect(im,3,4,20,25,[130,90,60,255]);rect(im,9,10,3,3,[240,50,20,255]);assert.deepEqual(process(im),process(im));
});
test('worker factories run without globals from the main app',()=>{
 const vm=require('node:vm'),sandbox={};vm.createContext(sandbox);vm.runInContext('const engine=('+DotSnapProcessor.toString()+')(('+DotSnapPrimitives.toString()+')); output=engine.process({image:{width:8,height:8,data:new Uint8ClampedArray(256)},params:{split:"single",width:8,height:8}})',sandbox);assert.equal(sandbox.output.variants.length,3);
});
test('manual rectangles retain order and exact source regions',()=>{
 const im=image(50,30);rect(im,1,1,10,10,[50,100,150,255]);rect(im,30,5,10,10,[180,20,70,255]);
 const r=engine.process({image:im,params:{...engine.defaults,split:'custom',cols:2,width:16,height:16,background:'alpha'},custom:[{x:25,y:0,w:25,h:30},{x:0,y:0,w:25,h:30}]});
 assert.equal(r.cols,2);assert.equal(r.rows,1);assert.equal(r.variants[0].frames[0].cell.x,25);
});
