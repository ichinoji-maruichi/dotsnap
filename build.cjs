const fs=require('node:fs'),path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,file),'utf8');
let html=read('dotsnap.html').replace('<link rel="stylesheet" href="styles.css">','<style>'+read('styles.css')+'</style>');
for(const file of ['engine.js','processor.js','zip.js','manual.js','app.js','help.js'])html=html.replace('<script src="'+file+'"></script>',()=>'<script>\n'+read(file).replace(/<\/script/gi,'<\\/script')+'\n</script>');
fs.writeFileSync(path.join(__dirname,'index.html'),html);
console.log('Built index.html (local CSS/JS inlined)');
