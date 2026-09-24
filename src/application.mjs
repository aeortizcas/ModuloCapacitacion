import { createServer } from 'node:http';
import { repository } from './models/repository.mjs';
import { digest, fail } from './lib/http.mjs';
import { serveStatic } from './controllers/static-controller.mjs';
import { authController } from './controllers/auth-controller.mjs';
import { coursesController } from './controllers/courses-controller.mjs';
import { reportsController } from './controllers/reports-controller.mjs';
import { teamController } from './controllers/team-controller.mjs';
export const server=createServer(async(req,res)=>{
const url=new URL(req.url,'http://localhost');const path=url.pathname;
res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-src https://www.youtube-nocookie.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
const json=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
try{
if(!path.startsWith('/api/')) return serveStatic(req,res,path);
if(!['GET','POST','PUT'].includes(req.method))fail(405,'Método no permitido.');
if(req.method!=='GET'){const origin=req.headers.origin;if(origin&&origin!==`${req.socket.encrypted?'https':'http'}://${req.headers.host}`&&origin!==process.env.APP_ORIGIN)fail(403,'Origen no permitido.');if(!req.headers['content-type']?.startsWith('application/json'))fail(415,'Se requiere JSON.');}
const token=req.headers.cookie?.match(/(?:^|;\s*)session=([a-f0-9]{64})(?:;|$)/)?.[1];
const user=token?repository.sessionUser(digest(token),Date.now()):null;
const context={req,res,path,json,user,token};
if(['/api/session','/api/setup','/api/login','/api/register'].includes(path))return await authController(context);
if(!user)fail(401,'Inicia sesión para continuar.');
if(path==='/api/logout'&&req.method==='POST')return await authController(context);
if(path==='/api/dashboard'&&req.method==='GET')return await reportsController(context);
if(path==='/api/team'||/^\/api\/team\/\d+$/.test(path))return await teamController(context);
if(path==='/api/courses'||/^\/api\/courses\/\d+(?:\/(?:progress|attempt))?$/.test(path))return await coursesController(context);
fail(404,'No encontrado.');
}catch(e){if(!e.status)console.error(e);json({error:e.status?e.message:'No se pudo completar la operación. Intenta nuevamente.'},e.status||500);}
});
