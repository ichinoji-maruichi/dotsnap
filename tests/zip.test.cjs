const {test}=require('node:test'),assert=require('node:assert/strict');require('../zip.js');
test('ZIP checksums, UTF-8 filenames and central directory point to original bytes',async()=>{
 const content=new TextEncoder().encode('123456789');assert.equal(DotSnapZip.crc32(content),0xcbf43926);
 const zip=new Uint8Array(await DotSnapZip.zip([{name:'コマ.png',data:content},{name:'two.png',data:new Uint8Array([1,2,3])}]).arrayBuffer());
 const view=new DataView(zip.buffer),end=zip.length-22;assert.equal(view.getUint32(end,true),0x06054b50);assert.equal(view.getUint16(end+10,true),2);
 let central=view.getUint32(end+16,true);
 for(const [name,bytes] of [['コマ.png',content],['two.png',new Uint8Array([1,2,3])]]){
  assert.equal(view.getUint32(central,true),0x02014b50);const offset=view.getUint32(central+42,true),len=view.getUint16(offset+26,true);
  assert.equal(new TextDecoder().decode(zip.slice(offset+30,offset+30+len)),name);assert.deepEqual(zip.slice(offset+30+len,offset+30+len+bytes.length),bytes);assert.equal(view.getUint32(offset+14,true),DotSnapZip.crc32(bytes));
  central+=46+view.getUint16(central+28,true);
 }
});
