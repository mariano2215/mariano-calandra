// Servidor estático mínimo para la escena (vista previa y render).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css' };

export function iniciarServidor(puerto = 0) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const archivo = path.join(RAIZ, url === '/' ? '/escena/index.html' : url);
      if (!archivo.startsWith(RAIZ) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) {
        res.writeHead(404); res.end('no encontrado'); return;
      }
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(archivo).pipe(res);
    });
    srv.listen(puerto, '127.0.0.1', () => resolve({ srv, puerto: srv.address().port }));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { puerto } = await iniciarServidor(Number(process.env.PUERTO || 8080));
  console.log(`Vista previa: http://127.0.0.1:${puerto}/escena/index.html`);
}
