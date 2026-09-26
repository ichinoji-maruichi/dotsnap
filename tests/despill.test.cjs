const {test}=require('node:test'),assert=require('node:assert/strict');
require('../engine.js');require('../processor.js');
const engine=DotSnapProcessor(DotSnapPrimitives);
function fixture(){
 const width=24,height=24,data=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)data.set(x>=4&&x<20&&y>=4&&y<20?[16,16,28,255]:[0,255,0,255],(y*width+x)*4);
 const set=(x,y,c)=>data.set([...c,255],(y*width+x)*4);
 set(4,10,[0,55,0]); // dark but saturated green
 set(5,10,[6,30,15]); // mixed green contamination of a dark outline
 set(12,12,[0,65,3]); // enclosed dark key color
 set(12,13,[10,10,18]); // true dark detail
 set(13,13,[200,202,220]); // pale blue hair
 return {width,height,data};
}
const settings={...engine.defaults,background:'key',key:'#00ff00',tolerance:36};
test('dark key shades are removed even inside enclosed regions',()=>{
 const im=fixture(),result=engine.background(im,settings);
 assert.equal(result.mask[10*24+4],0);assert.equal(result.mask[12*24+12],0);
});
test('mixed green outline is decontaminated without deleting the pixel',()=>{
 const im=fixture(),result=engine.background(im,settings),i=10*24+5;
 assert.equal(result.mask[i],1);assert.deepEqual([...result.work.slice(i*4,i*4+4)],[6,15,15,255]);
 assert.deepEqual([...im.data.slice(i*4,i*4+4)],[6,30,15,255]);assert.ok(result.despilled>0);
 for(const i of [13*24+12,13*24+13])assert.deepEqual(result.work.slice(i*4,i*4+4),im.data.slice(i*4,i*4+4));
});
test('OFF and alpha-only modes preserve original colors',()=>{
 const im=fixture();for(const p of [{...settings,despill:false},{...settings,background:'alpha'},{...settings,background:'none'}]){
  const result=engine.background(im,p);assert.equal(result.mask[12*24+12],1);assert.deepEqual(result.work,im.data);
 }
});
test('edge-connected mode still preserves enclosed key regions in its mask',()=>{
 const result=engine.background(fixture(),{...settings,background:'edge'});
 assert.equal(result.mask[10*24+4],0);assert.equal(result.mask[12*24+12],1);
});
test('neutral keys do not activate hue-based removal',()=>{
 const im=fixture(),result=engine.background(im,{...settings,key:'#ffffff'});
 assert.equal(result.mask[12*24+12],1);assert.deepEqual(result.work,im.data);
});
test('full pipeline cannot restore removed dark green through automatic repair',()=>{
 const result=engine.process({image:fixture(),params:{...settings,width:24,height:24,split:'single',pitchMode:'manual',pitch:1,anchor:'center',repair:true}});
 for(const v of result.variants){
  const f=v.frames[0],x=Math.floor((12-f.originX)/f.pitch),y=Math.floor((12-f.originY)/f.pitch);
  assert.equal(f.data[(y*24+x)*4+3],0);
  assert.ok(!v.palette.some(c=>{const r=parseInt(c.slice(1,3),16),g=parseInt(c.slice(3,5),16),b=parseInt(c.slice(5,7),16);return g>Math.max(r,b)+4;}));
 }
});
