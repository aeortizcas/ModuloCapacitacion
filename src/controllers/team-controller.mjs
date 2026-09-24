import { repository } from '../models/repository.mjs';
import { LEVELS, PERMISSIONS, defaultPermissions, accessLevel, can } from '../../access.mjs';
import { hash, digest, publicUser, fail, str, body } from '../lib/http.mjs';

export async function teamController({req,res,path,json,user,token}) {
if(path==='/api/team'&&req.method==='GET') {
  if(!can(user,'users.manage')&&!can(user,'reports.view'))fail(403,'Sin permiso para consultar el equipo.');
  return json({users:can(user,'users.manage')?repository.users().map(publicUser):[],results:can(user,'reports.view')?repository.teamResults(user.id):[],levels:LEVELS,permissionOptions:PERMISSIONS});
}
if((path==='/api/team'&&req.method==='POST')||(/^\/api\/team\/\d+$/.test(path)&&req.method==='PUT')) {
  if(!can(user,'users.manage'))fail(403,'Solo un administrador puede gestionar usuarios y permisos.');
  const id=req.method==='PUT'?Number(path.split('/').pop()):null;
  const target=id?repository.userById(id):null;
  if(id&&!target)fail(404,'Usuario no encontrado.');
  if(id===user.id)fail(400,'No puedes cambiar tu propio nivel ni tus permisos.');
  const b=await body(req);
  // Recheck after reading the request: another administrator may have revoked this session.
  const currentAdmin=repository.sessionUser(digest(token),Date.now());
  if(!currentAdmin||!can(currentAdmin,'users.manage'))fail(403,'Tu acceso administrativo cambió. Vuelve a iniciar sesión.');
  const level=b.accessLevel??b.role;
  if(!Object.hasOwn(LEVELS,level))fail(400,'Nivel de acceso inválido.');
  const permissions=b.permissions??defaultPermissions(level);
  if(!Array.isArray(permissions)||permissions.some(p=>!Object.hasOwn(PERMISSIONS,p))||new Set(permissions).size!==permissions.length)fail(400,'Permisos inválidos.');
  if(['learner','advisor'].includes(level)&&permissions.length)fail(400,'Los capacitados y asesores tienen acceso a su aprendizaje personal.');
  if(permissions.includes('courses.publish')&&!permissions.includes('courses.manage'))fail(400,'Publicar requiere permiso para crear y editar cursos.');
  const role=['admin','trainer'].includes(level)?'trainer':'learner';
  const stored=JSON.stringify(level==='admin'?defaultPermissions(level):permissions);
  if(id) {
    repository.updateUserAccess(role,level,stored,id);
    repository.deleteUserSessions(id);
    return json({user:publicUser(repository.userById(id))});
  }
  const name=str(b.name,100),email=str(b.email,200).toLowerCase(),password=typeof b.password==='string'?b.password:'';
  if(!name||!/^\S+@\S+\.\S+$/.test(email)||password.length<10||password.length>200)fail(400,'Ingresa nombre, correo válido y una contraseña de 10 a 200 caracteres.');
  if(repository.userIdByEmail(email))fail(409,'Este correo ya está registrado.');
  const result=repository.createManagedUser(name,email,hash(password),role,level,stored);
  return json({user:publicUser(repository.userById(result.lastInsertRowid))},201);
}

fail(405,'Método no permitido.');
}
