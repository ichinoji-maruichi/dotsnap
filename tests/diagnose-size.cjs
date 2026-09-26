const fs=require('node:fs'),{decode}=require('./verify-png.cjs');
require('../engine.js');require('../processor.js');
const image=decode(fs.readFileSync(require('node:path').join(__dirname,'../test.png'))),engine=DotSnapProcessor(DotSnapPrimitives);
for(const split of ['auto','uniform'])for(const tolerance of [0,10,36,80,160]){
 const r=engine.process({image,params:{background:'key',key:'#00ff00',tolerance,split,cols:5,rows:3,width:64,height:64}});
 const f=r.variants[r.selected].frames[0];console.log(JSON.stringify({split,tolerance,layout:[r.cols,r.rows],pitch:f.pitch,bbox:f.bbox,origin:[f.originX,f.originY],output:[r.params.width,r.params.height]}));
}
