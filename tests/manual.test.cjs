const {test}=require('node:test'),assert=require('node:assert/strict');
require('../manual.js');require('../engine.js');require('../processor.js');
test('drawing, erasing, movement beyond bounds, history and saved work preserve exact pixels',()=>{
 const base=new Uint8ClampedArray(8*8*4);base.set([255,0,0,255],0);
 const m=DotSnapManual.create(8,8,[base],['#ff0000','#0000ff']);
 m.remember(0);m.paint(0,3,2,'#0000ff');m.paint(0,4,2,'#0000ff');
 const painted=m.data(0);assert.equal(painted[(2*8+3)*4+2],255);
 m.undo();assert.deepEqual(m.data(0),base);m.redo();assert.deepEqual(m.data(0),painted);
 m.remember(0);m.move(0,-8,0);assert.ok(m.data(0).every(v=>v===0));
 const restored=DotSnapManual.create(8,8,[new Uint8ClampedArray(base.length)],[],JSON.parse(JSON.stringify(m.save())));
 restored.move(0,8,0);assert.deepEqual(restored.data(0),painted);
 restored.paint(0,3,2,null);assert.equal(restored.data(0)[(2*8+3)*4+3],0);
 restored.paint(0,2,2,'#ffffff');assert.equal(restored.data(0)[(2*8+2)*4+3],0);
 restored.reset(0);assert.deepEqual(restored.data(0),base);
});
test('history restores the affected frame and branches correctly',()=>{
 const m=DotSnapManual.create(8,8,[new Uint8ClampedArray(256),new Uint8ClampedArray(256)],['#ff0000']);
 m.remember(1);m.paint(1,0,0,'#ff0000');assert.equal(m.undo(),1);assert.equal(m.data(1)[3],0);
 m.remember(0);m.paint(0,0,0,'#ff0000');assert.equal(m.canRedo,false);
});
test('expanded tolerance and additional colors remove targets while respecting background modes',()=>{
 const p=DotSnapProcessor(DotSnapPrimitives),image={width:3,height:3,data:new Uint8ClampedArray(36)};
 for(let i=0;i<9;i++)image.data.set([0,255,0,255],i*4);image.data.set([220,30,80,255],16);
 const settings=p.params({background:'key',key:'#00ff00',tolerance:160,despill:false});
 assert.equal(p.background(image,settings).mask[4],1);
 assert.equal(p.background(image,{...settings,tolerance:442}).mask[4],0);
 assert.equal(p.background(image,{...settings,tolerance:0,extraKeys:'#dc1e50'}).mask[4],0);
 assert.equal(p.background(image,{...settings,background:'alpha',extraKeys:'#dc1e50'}).mask[4],1);
 assert.equal(p.params({tolerance:442}).tolerance,442);
 assert.throws(()=>p.params({extraKeys:'bad'}));
});
