import { repository } from '../models/repository.mjs';
import { seed } from '../models/seed.mjs';
import { randomBytes } from 'node:crypto';
import { hash, verify, digest, publicUser, fail, str, attemptsByIp, body } from '../lib/http.mjs';

export async function authController({req,res,path,json,user,token}) {
if(path==='/api/session'&&req.method==='GET')return json({user:user?publicUser(user):null,needsSetup:!repository.firstUser()});
if(['/api/setup','/api/login','/api/register'].includes(path)&&req.method==='POST'){
const ip=req.socket.remoteAddress;const rate=attemptsByIp.get(ip)||{count:0,until:Date.now()+900000};if(rate.until<Date.now()){rate.count=0;rate.until=Date.now()+900000;}rate.count++;attemptsByIp.set(ip,rate);if(rate.count>30)fail(429,'Demasiados intentos. Intenta en 15 minutos.');
const b=await body(req),email=str(b.email,200).toLowerCase(),password=typeof b.password==='string'?b.password:'';if(password.length>200)fail(400,'Contraseña demasiado larga.');let account;
if(path==='/api/login'){account=repository.userByEmail(email);if(!account||!verify(password,account.password))fail(401,'Correo o contraseña incorrectos.');if(b.portal && b.portal!==account.role)fail(403,account.role==='trainer'?'Tu cuenta es de capacitador. Selecciona ese acceso.':'Tu cuenta es de participante. Selecciona ese acceso.');}
else {if(path==='/api/setup'&&repository.firstUser())fail(403,'La cuenta principal ya está configurada.');if(path==='/api/register'&&!repository.firstUser())fail(400,'Primero configura el capacitador.');if(!str(b.name,100)||!/^\S+@\S+\.\S+$/.test(email)||password.length<10)fail(400,'Escribe tu nombre, un correo válido y una contraseña de al menos 10 caracteres.');if(repository.userIdByEmail(email))fail(409,'Este correo ya está registrado.');const role=path==='/api/setup'?'trainer':'learner';const result=repository.createUser(str(b.name,100),email,hash(password),role);repository.setAccessLevel(role==='trainer'?'admin':'learner',result.lastInsertRowid);account=repository.userById(result.lastInsertRowid);if(role==='trainer')seed(account.id);}
const session=randomBytes(32).toString('hex');repository.deleteExpiredSessions(Date.now());repository.createSession(digest(session),account.id,Date.now()+86400000);res.setHeader('Set-Cookie',`session=${session}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400${process.env.APP_ORIGIN?.startsWith('https:')?'; Secure':''}`);return json({user:publicUser(account)});}
if(path==='/api/logout'&&req.method==='POST'){repository.deleteSession(digest(token));res.setHeader('Set-Cookie','session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');return json({ok:true});}

fail(405,'Método no permitido.');
}
