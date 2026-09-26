// Optional localhost preview. Only application assets are exposed.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const types={'manual.js':'text/javascript; charset=utf-8','dotsnap.html':'text/html; charset=utf-8','styles.css':'text/css; charset=utf-8','app.js':'text/javascript; charset=utf-8','engine.js':'text/javascript; charset=utf-8','processor.js':'text/javascript; charset=utf-8','zip.js':'text/javascript; charset=utf-8','help.js':'text/javascript; charset=utf-8'};
const server=http.createServer((req,res)=>{
 const name=req.url.split('?')[0]==='/'?'dotsnap.html':req.url.split('?')[0].slice(1);
 if(!Object.hasOwn(types,name)){res.writeHead(404);res.end('Not found');return;}
 res.writeHead(200,{'Content-Type':types[name],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 fs.createReadStream(path.join(__dirname,name)).pipe(res);
});
server.listen(4173,'127.0.0.1',()=>console.log('dotsnap: http://127.0.0.1:4173'));
