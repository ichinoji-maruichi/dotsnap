/* Fixed-size pixel editing with lossless off-canvas movement. */
(function(root){
'use strict';
function create(width,height,bases,palette,saved){
 const validColor=c=>typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c);
 if(saved){
  if(saved.width!==width||saved.height!==height||!Array.isArray(saved.frames)||saved.frames.length!==bases.length||!Array.isArray(saved.palette)||saved.palette.length>256||!saved.palette.every(validColor))throw Error('手仕上げデータが不正です。');
  palette=saved.palette;
 }
 const colorAt=(d,i)=>'#'+Array.from(d.slice(i,i+3),v=>v.toString(16).padStart(2,'0')).join('');
 const frames=bases.map((base,index)=>{
  const raw=saved?.frames[index];
  if(saved&&(!raw||typeof raw!=='object'))throw Error('手仕上げのコマが不正です。');
  if(raw&&(!Array.isArray(raw.base)||raw.base.length!==width*height*4||!raw.base.every((v,i)=>Number.isInteger(v)&&v>=0&&v<=255&&(i%4!==3||v===0||v===255))))throw Error('確定画像が不正です。');
  const data=new Uint8ClampedArray(raw?raw.base:base),pixels=new Map();
  for(let i=0;i<data.length;i+=4)if(data[i+3])pixels.set((i/4%width)+','+Math.floor(i/4/width),colorAt(data,i));
  if(raw){
   if(!Array.isArray(raw.pixels)||raw.pixels.length>8000000||!Number.isSafeInteger(raw.x)||!Number.isSafeInteger(raw.y))throw Error('手仕上げの座標が不正です。');
   pixels.clear();for(const pair of raw.pixels){if(!Array.isArray(pair)||pair.length!==2||typeof pair[0]!=='string'||!/^(-?\d+),(-?\d+)$/.test(pair[0])||!pair[0].split(',').every(v=>Number.isSafeInteger(+v))||!palette.includes(pair[1]))throw Error('手仕上げの画素が不正です。');pixels.set(...pair);}
  }
  return {base:data,pixels,x:raw?.x||0,y:raw?.y||0};
 });
 let past=[],future=[];
 const capture=i=>({i,pixels:[...frames[i].pixels],x:frames[i].x,y:frames[i].y});
 const restore=s=>{Object.assign(frames[s.i],{pixels:new Map(s.pixels),x:s.x,y:s.y});return s.i;};
 return {width,height,palette,frames,
  remember(i){past.push(capture(i));if(past.length>40)past.shift();future=[];},
  undo(){if(!past.length)return null;const s=past.pop();future.push(capture(s.i));return restore(s);},
  redo(){if(!future.length)return null;const s=future.pop();past.push(capture(s.i));return restore(s);},
  get canUndo(){return !!past.length;},get canRedo(){return !!future.length;},
  paint(i,x,y,color){if(x<0||y<0||x>=width||y>=height)return;if(color!==null&&!palette.includes(color))return;const f=frames[i],key=(x-f.x)+','+(y-f.y);if(color===null)f.pixels.delete(key);else f.pixels.set(key,color);},
  move(i,x,y){frames[i].x+=x;frames[i].y+=y;},
  reset(i){const f=frames[i];f.x=f.y=0;f.pixels.clear();for(let p=0;p<f.base.length;p+=4)if(f.base[p+3])f.pixels.set((p/4%width)+','+Math.floor(p/4/width),colorAt(f.base,p));},
  data(i){const f=frames[i],d=new Uint8ClampedArray(width*height*4);for(const [key,color] of f.pixels){const [a,b]=key.split(',').map(Number),x=a+f.x,y=b+f.y;if(x<0||y<0||x>=width||y>=height)continue;d.set([parseInt(color.slice(1,3),16),parseInt(color.slice(3,5),16),parseInt(color.slice(5,7),16),255],(y*width+x)*4);}return d;},
  save(){return {width,height,palette,frames:frames.map(f=>({base:[...f.base],pixels:[...f.pixels],x:f.x,y:f.y}))};}
 };
}
root.DotSnapManual={create};
})(typeof self!=='undefined'?self:globalThis);
