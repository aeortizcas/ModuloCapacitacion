import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { accessLevel, permissionsFor } from '../../access.mjs';
const hash = p => {const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(p,salt,64).toString('hex');};
const verify = (p,h) => {const [salt,value]=h.split(':');return timingSafeEqual(scryptSync(p,salt,64),Buffer.from(value,'hex'));};
const digest = t=>createHash('sha256').update(t).digest('hex');
const publicUser=u=>({id:u.id,name:u.name,email:u.email,role:u.role,accessLevel:accessLevel(u),permissions:permissionsFor(u)});
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const str=(v,max=10000)=>typeof v==='string'?v.trim().slice(0,max):'';
const attemptsByIp=new Map();
function youtube(value){if(!value)return '';let u;try{u=new URL(value);}catch{fail(400,'Ingresa un enlace válido de YouTube.');}if(u.protocol!=='https:')fail(400,'Usa un enlace HTTPS de YouTube.');let id='';if(['youtube.com','www.youtube.com','m.youtube.com'].includes(u.hostname))id=u.searchParams.get('v')||u.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1];if(u.hostname==='youtu.be')id=u.pathname.slice(1);if(!/^[\w-]{11}$/.test(id||''))fail(400,'El enlace de YouTube no es válido.');return id;}
async function body(req){let value='';for await(const chunk of req){value+=chunk;if(Buffer.byteLength(value)>300000)fail(413,'El contenido es demasiado grande.');}try{return JSON.parse(value||'{}');}catch{fail(400,'Solicitud inválida.');}}

export { hash, verify, digest, publicUser, fail, str, attemptsByIp, youtube, body };
