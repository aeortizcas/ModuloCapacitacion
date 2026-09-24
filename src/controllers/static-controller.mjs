import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { root } from '../config.mjs';
import { fail } from '../lib/http.mjs';
export function serveStatic(req,res,path) {
if(!path.startsWith('/api/')){if(req.method!=='GET')fail(405,'Método no permitido.');const files={'/client/controllers/campus-controller.js':'client/controllers/campus-controller.js','/client/models/campus-model.js':'client/models/campus-model.js','/client/models/http-api.js':'client/models/http-api.js','/client/views/campus-view.js':'client/views/campus-view.js','/':'views/index.html','/index.html':'views/index.html','/app.js':'app.js','/styles.css':'styles.css','/navigation.css':'navigation.css','/access.mjs':'access.mjs'};if(!files[path])fail(404,'No encontrado.');res.setHeader('Content-Type',(path.endsWith('.js')||path.endsWith('.mjs'))?'text/javascript; charset=utf-8':path.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8');res.end(readFileSync(resolve(root,files[path])));return;}

}
