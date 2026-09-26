const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
require('../engine.js');require('../processor.js');
const app=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
// Exercise the actual UI registration and callback, then pass its settings to the processor.
const registration=app.slice(app.indexOf("for(const el of $$('[data-p]'))el.addEventListener"),app.indexOf("for(const el of $$('input[type="));
test('color input switches every background mode to global keying and removes enclosed green',()=>{
 for(const mode of ['auto','alpha','edge','none','key']){
  const listeners={},el={type:'color',value:'#00ff00',dataset:{p:'key'},addEventListener:(name,fn)=>listeners[name]=fn};
  const context={P:{background:mode,key:'#ff00ff',tolerance:36},$$:()=>[el],mutate:fn=>fn(),setView:()=>{}};
  vm.runInNewContext(registration,context);assert.equal(typeof listeners.input,'function');listeners.input();
  assert.equal(context.P.background,'key');assert.equal(context.P.key,'#00ff00');
  const processor=DotSnapProcessor(DotSnapPrimitives),data=new Uint8ClampedArray(24*24*4);
  for(let y=0;y<24;y++)for(let x=0;x<24;x++){const ring=x>=4&&x<20&&y>=4&&y<20&&!(x>=8&&x<16&&y>=8&&y<16);data.set(ring?[20,20,40,255]:[0,255,0,255],(y*24+x)*4);}
  const result=processor.process({image:{width:24,height:24,data},params:{...context.P,width:24,height:24,split:'single',pitchMode:'manual',pitch:1,repair:true}});
  for(const variant of result.variants){const f=variant.frames[0],x=Math.floor((12-f.originX)/f.pitch),y=Math.floor((12-f.originY)/f.pitch);assert.equal(f.data[(y*24+x)*4+3],0);assert.ok(!variant.palette.includes('#00ff00'));}
 }
});
test('apply button activates the displayed key even when its color did not change',()=>{
 const button={},context={$:()=>button,P:{background:'auto',key:'#00ff00'},mutate:fn=>fn()};
 const handler=app.split('\n').find(line=>line.startsWith("$('#applyKey').onclick="));
 vm.runInNewContext(handler,context);button.onclick();assert.equal(context.P.background,'key');assert.equal(context.P.key,'#00ff00');
});
