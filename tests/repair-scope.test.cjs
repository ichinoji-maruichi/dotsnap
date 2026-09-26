const {test}=require('node:test'),assert=require('node:assert/strict');
require('../engine.js');require('../processor.js');
const engine=DotSnapProcessor(DotSnapPrimitives);
function fixture(mixed=true){
 const data=new Uint8ClampedArray(64*64*4);
 const paint=(x,y,c)=>data.set([...c,255],(y*64+x)*4);
 for(let y=8;y<56;y++)for(let x=8;x<56;x++)paint(x,y,[40,120,60]);
 // One interior cell has a blue majority with green evidence (6 of 16 pixels).
 for(let y=20;y<24;y++)for(let x=20;x<24;x++)if(!mixed||y<22||(y===22&&x<22))paint(x,y,[30,40,220]);
 return {width:64,height:64,data};
}
function run(image,repairScope,repair=true){
 return engine.process({image,params:{width:16,height:16,colors:4,background:'alpha',split:'single',pitchMode:'manual',pitch:4,anchor:'center',fixedPalette:'#28783c #1e28dc',repairScope,repair}});
}
test('full repair fixes a supported interior color notch; edge repair leaves it alone',()=>{
 const image=fixture(),all=run(image,'all'),edge=run(image,'edge');
 for(let v=0;v<3;v++){
  const a=all.variants[v].frames[0],e=edge.variants[v].frames[0];
  const x=Math.floor((22-a.originX)/a.pitch),y=Math.floor((22-a.originY)/a.pitch),i=(y*16+x)*4;
  assert.deepEqual([...e.data.slice(i,i+3)],[30,40,220]);
  assert.deepEqual([...a.data.slice(i,i+3)],[40,120,60]);
  assert.ok(a.changes>0);
 }
});
test('edge mode never modifies interior pixels relative to its baseline',()=>{
 const result=run(fixture(),'edge');
 for(const v of result.variants){const f=v.frames[0],edge=engine.boundaryMask(f.baseline,16,16);for(let i=0;i<edge.length;i++)if(!edge[i])assert.deepEqual(f.data.slice(i*4,i*4+4),f.baseline.slice(i*4,i*4+4));}
});
test('a genuine solid interior accent is retained even in full repair',()=>{
 const result=run(fixture(false),'all');
 for(const v of result.variants){const f=v.frames[0],i=(Math.floor((22-f.originY)/f.pitch)*16+Math.floor((22-f.originX)/f.pitch))*4;assert.deepEqual([...f.data.slice(i,i+3)],[30,40,220]);}
});
test('repair OFF bypasses both scopes and scope values are validated',()=>{
 for(const scope of ['edge','all'])for(const v of run(fixture(),scope,false).variants){assert.equal(v.changes,0);assert.deepEqual(v.frames[0].data,v.frames[0].baseline);}
 assert.equal(engine.params({}).repairScope,'all');
 assert.equal(engine.params(JSON.parse(JSON.stringify({repairScope:'edge'}))).repairScope,'edge');
 assert.throws(()=>engine.params({repairScope:'invalid'}),/不正/);
});
