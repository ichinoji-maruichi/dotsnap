const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {decode}=require('./verify-png.cjs');
require('../engine.js');require('../processor.js');
const engine=DotSnapProcessor(DotSnapPrimitives);
const geometry=r=>({cols:r.cols,rows:r.rows,frames:r.variants[0].frames.map(f=>({cell:f.cell,bbox:f.bbox,pitch:f.pitch,x:f.originX,y:f.originY}))});
test('test.png keeps its 15 frames and scale across the whole key tolerance range',()=>{
 const image=decode(fs.readFileSync(path.join(__dirname,'fixtures/test.png')));
 for(const split of ['auto','uniform']){
  let reference;
  for(const tolerance of [0,10,36,80,160,300,442]){
   const r=engine.process({image,params:{background:'key',key:'#00ff00',tolerance,split,cols:5,rows:3,width:64,height:64}});
   assert.equal(r.cols,5);assert.equal(r.rows,3);
   if(reference)assert.deepEqual(geometry(r),reference);else reference=geometry(r);
   for(const variant of r.variants)for(const f of variant.frames)assert.equal(f.data.length,64*64*4);
  }
 }
});
test('key tolerance still changes removal without changing layout or scale',()=>{
 const image={width:32,height:32,data:new Uint8ClampedArray(32*32*4)};
 for(let y=0;y<32;y++)for(let x=0;x<32;x++)image.data.set(x>=8&&x<24&&y>=8&&y<24?[20,20,40,255]:[2,246,56,255],(y*32+x)*4);
 const a=engine.process({image,params:{background:'key',key:'#00ff00',tolerance:0,split:'single',width:32,height:32,despill:false}});
 const b=engine.process({image,params:{...a.params,tolerance:80}});
 assert.deepEqual(geometry(a),geometry(b));
 assert.notDeepEqual(a.variants[0].frames[0].data,b.variants[0].frames[0].data);
 const c=engine.process({image,params:{...a.params,despill:true}});
 assert.deepEqual(geometry(a),geometry(c));
});
