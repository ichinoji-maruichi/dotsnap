// Independently decode an exported RGBA8 PNG to verify dimensions, alpha and palette.
const fs=require('node:fs'),zlib=require('node:zlib'),assert=require('node:assert/strict');
function decode(buffer){
 assert.equal(buffer.toString('hex',0,8),'89504e470d0a1a0a');let width,height,colorType,depth;const chunks=[];
 for(let o=8;o<buffer.length;){const n=buffer.readUInt32BE(o),type=buffer.toString('ascii',o+4,o+8),data=buffer.subarray(o+8,o+8+n);if(type==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);depth=data[8];colorType=data[9];}if(type==='IDAT')chunks.push(data);o+=12+n;}
 assert.equal(depth,8);assert.equal(colorType,6);const packed=zlib.inflateSync(Buffer.concat(chunks)),stride=width*4,decoded=new Uint8Array(height*stride);
 const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 for(let y=0;y<height;y++){const filter=packed[y*(stride+1)];for(let x=0;x<stride;x++){const a=x>=4?decoded[y*stride+x-4]:0,b=y?decoded[(y-1)*stride+x]:0,c=y&&x>=4?decoded[(y-1)*stride+x-4]:0,v=packed[y*(stride+1)+x+1];decoded[y*stride+x]=v+(filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):filter===4?paeth(a,b,c):NaN);assert.ok(filter<=4);}}
 return {width,height,data:new Uint8ClampedArray(decoded)};
}
function inspect(buffer){
 const {width,height,data:decoded}=decode(buffer);
 const colors=new Set();let visible=0;for(let i=0;i<decoded.length;i+=4){assert.ok(decoded[i+3]===0||decoded[i+3]===255);if(decoded[i+3]){visible++;colors.add([...decoded.slice(i,i+3)].join(','));}}
 return {width,height,colors:colors.size,visible};
}
module.exports={inspect,decode};
if(require.main===module){const info=inspect(fs.readFileSync(process.argv[2]));if(process.argv[3])assert.ok(info.colors<=+process.argv[3]);console.log(JSON.stringify(info));}
