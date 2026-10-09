const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, 'public');
http.createServer((req,res)=>{let p=decodeURIComponent((req.url||'/').split('?')[0]); if(p==='/'||p==='/index.html') p='/index.html'; const file=path.join(root,p.replace(/^\\/+/,'')); if(!file.startsWith(root)){res.writeHead(403);return res.end('Forbidden')} fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end('Not found')}res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream','Cache-Control':'no-store'});res.end(data)})}).listen(8080,'0.0.0.0',()=>console.log('FundiConnect Pro listening on 0.0.0.0:8080'));
