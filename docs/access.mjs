export const LEVELS = {
  learner: 'Capacitado',
  advisor: 'Asesor',
  trainer: 'Capacitador',
  admin: 'Administrador'
};
export const PERMISSIONS = {
  'courses.manage': 'Crear y editar cursos propios',
  'courses.publish': 'Publicar cursos propios',
  'reports.view': 'Consultar resultados de cursos propios'
};
export function defaultPermissions(level) {
  return ['admin', 'trainer'].includes(level) ? Object.keys(PERMISSIONS) : [];
}
export function accessLevel(user) { return user.accessLevel || user.access_level || user.role; }
export function permissionsFor(user) {
  if (accessLevel(user) === 'admin') return [...Object.keys(PERMISSIONS), 'users.manage'];
  const value = user.permissions;
  return value == null ? defaultPermissions(accessLevel(user)) : typeof value === 'string' ? JSON.parse(value) : value;
}
export function can(user, permission) { return permissionsFor(user).includes(permission); }
