import { LEVELS, PERMISSIONS, defaultPermissions, accessLevel, can } from '../access.mjs';
// Demonstration data only. This is not an authentication or authorization system.
const KEY = 'innovacampus-pages-demo-v1';
const SESSION = KEY + '-profile';
const initial = () => ({
  users: [
    { id: 1, name: 'Capacitador Demo', email: 'capacitador@example.invalid', role: 'trainer' },
    { id: 2, name: 'Participante Demo', email: 'participante@example.invalid', role: 'learner' },
    { id: 3, name: 'Alex Demo', email: 'alex@example.invalid', role: 'learner' }
  ],
  courses: [
    ['Tu primera llamada, paso a paso', 'Inducción', 'Conoce la estructura de una llamada y empieza con seguridad.', '1. Saluda con tu nombre y el de la empresa.\n2. Escucha el motivo de la llamada sin interrumpir.\n3. Confirma lo que entendiste.\n4. Resuelve o escala según el proceso de tu campaña.\n5. Resume los acuerdos y agradece el tiempo del cliente.', 20],
    ['Escucha activa y empatía', 'Habilidades', 'Transforma conversaciones difíciles en una atención cercana.', 'Deja que el cliente termine de explicar su situación. Confirma su necesidad con tus propias palabras.\n\nEvita prometer resultados que no puedes garantizar. Explica el siguiente paso con claridad y confirma que el cliente lo comprendió.', 25],
    ['Protección de datos del cliente', 'Calidad', 'Practica el cuidado de la información en cada llamada.', 'Verifica la identidad según el protocolo de tu campaña antes de compartir información.\n\nNo copies datos del cliente a cuentas personales. Bloquea tu sesión al ausentarte y reporta los incidentes por el canal interno.', 15]
  ].map(([title, category, description, content, minutes], i) => ({
    id: i + 1, owner: 1, title, category, description, content, minutes,
    video: '', published: 1, pass: 80, revision: 1,
    questions: [{ text: i === 2 ? '¿Qué debes hacer antes de compartir información del cliente?' : '¿Qué debes hacer antes de proponer una solución?', options: i === 2 ? ['Verificar la identidad según el protocolo', 'Copiar los datos al correo personal', 'Compartirlos sin verificación'] : ['Confirmar la necesidad del cliente', 'Interrumpir para reducir el tiempo', 'Prometer cualquier resultado'], correct: 0 }]
  })),
  progress: [], attempts: []
});
const fail = message => { throw Error(message); };
const copy = value => structuredClone(value);
export function createDemoApi(storage, sessionStorage) {
  function read() {
    const saved = storage.getItem(KEY);
    if (!saved) return initial();
    try {
      const data = JSON.parse(saved);
      if (!['users', 'courses', 'progress', 'attempts'].every(k => Array.isArray(data[k]))) throw Error();
      return data;
    } catch { fail('No se pudieron leer los datos de esta demostración. Prueba en otro perfil de navegador.'); }
  }
  function save(data) {
    try { storage.setItem(KEY, JSON.stringify(data)); }
    catch { fail('El navegador no pudo guardar los cambios. Revisa el espacio disponible y los permisos de almacenamiento.'); }
  }
  return async function api(path, method = 'GET', body = {}) {
    const db = read();
    if(!db.users.some(u=>u.accessLevel)) {
      const first=db.users.find(u=>u.role==='trainer');
      for(const u of db.users){u.accessLevel=u===first?'admin':u.role;u.permissions=defaultPermissions(u.accessLevel);}
    }
    const user = db.users.find(u => u.id === Number(sessionStorage.getItem(SESSION)));
    if (path === '/session') return { user: user ? copy(user) : null, needsSetup: false };
    if (path === '/demo/profiles') return { users: copy(db.users) };
    if (path === '/login' && method === 'POST') {
      const profile = db.users.find(u => u.id === Number(body.id));
      if (!profile) fail('Selecciona un perfil de demostración.');
      save(db);
      sessionStorage.setItem(SESSION, String(profile.id));
      return { user: copy(profile) };
    }
    if (path === '/logout') { sessionStorage.removeItem(SESSION); return { ok: true }; }
    if (!user) fail('Selecciona un perfil para continuar.');
    const trainer = () => { if (user.role !== 'trainer') fail('Selecciona un perfil de capacitador para esta acción.'); };
    const ownCourses = db.courses.filter(c => c.owner === user.id);
    if (path === '/courses' && method === 'GET') return { courses: db.courses.filter(c => c.published || c.owner === user.id).map(c => ({
      ...copy(c), trainer: db.users.find(u => u.id === c.owner)?.name || 'Capacitador Demo',
      questions: c.questions.map(q => user.role === 'trainer' && c.owner === user.id ? copy(q) : { text: q.text, options: [...q.options] }),
      progress: copy(db.progress.find(p => p.user_id === user.id && p.course_id === c.id) || { completed: 0, notes: '' }),
      attempts: copy(db.attempts.filter(a => a.user_id === user.id && a.course_id === c.id).reverse())
    })) };
    if (path === '/team' && method === 'GET') {
      if(!can(user,'users.manage')&&!can(user,'reports.view'))fail('Sin permiso.');
      return { users: can(user,'users.manage')?copy(db.users):[], results: db.attempts.filter(a => ownCourses.some(c => c.id === a.course_id)).reverse().map(a => ({ ...copy(a), name: db.users.find(u => u.id === a.user_id).name, title: db.courses.find(c => c.id === a.course_id).title })) };
    }
    if ((path === '/team' && method === 'POST') || (/^\/team\/\d+$/.test(path) && method === 'PUT')) {
      if(!can(user,'users.manage'))fail('Solo el administrador puede gestionar usuarios.');
      const level=body.accessLevel??body.role, permissions=body.permissions??defaultPermissions(level);
      if(!Object.hasOwn(LEVELS,level)||!Array.isArray(permissions)||permissions.some(p=>!Object.hasOwn(PERMISSIONS,p)))fail('Acceso inválido.');
      if(['learner','advisor'].includes(level)&&permissions.length)fail('Este perfil solo accede a su aprendizaje.');
      if(permissions.includes('courses.publish')&&!permissions.includes('courses.manage'))fail('Publicar requiere crear y editar cursos.');
      const access={role:['admin','trainer'].includes(level)?'trainer':'learner',accessLevel:level,permissions:level==='admin'?defaultPermissions(level):permissions};
      if(method==='PUT') {
        const target=db.users.find(u=>u.id===Number(path.split('/').pop()));
        if(!target||target.id===user.id)fail('No puedes modificar ese usuario.');
        Object.assign(target,access);save(db);return {user:copy(target)};
      }
      const name=String(body.name||'').trim().slice(0,100),email=String(body.email||'').trim().toLowerCase();
      if(!name||!/^\S+@\S+\.\S+$/.test(email))fail('Ingresa nombre y correo de prueba válidos.');
      if(db.users.some(u=>u.email===email))fail('Este correo ya existe.');
      const created={id:Math.max(0,...db.users.map(u=>u.id))+1,name,email,...access};
      db.users.push(created);save(db);return {user:copy(created)};
    }
    if (path === '/dashboard') {
      if(!can(user,'reports.view'))fail('Sin permiso para consultar resultados.');
      const users = db.users.filter(u => u.role === 'learner');
      const active = ownCourses.filter(c => c.published);
      const rows = db.attempts.filter(a => ownCourses.some(c => c.id === a.course_id) && users.some(u => u.id === a.user_id)).reverse();
      const learners = users.map(u => ({ ...copy(u), courses: active.map(c => {
        const attempts = rows.filter(a => a.user_id === u.id && a.course_id === c.id && a.revision === c.revision);
        const completed = db.progress.find(p => p.user_id === u.id && p.course_id === c.id)?.completed;
        return { id: c.id, title: c.title, score: attempts[0]?.score ?? null, attempts: attempts.length, status: attempts.some(a => a.passed) ? 'passed' : attempts.length ? 'retry' : completed ? 'ready' : 'pending' };
      }) }));
      const entries = learners.flatMap(u => u.courses);
      return {
        learners,
        courses: ownCourses.map(c => ({ ...copy(c), participants: c.published ? users.length : 0, passed: entries.filter(e => e.id === c.id && e.status === 'passed').length, pending: entries.filter(e => e.id === c.id && e.status !== 'passed').length })),
        stats: { learners: users.length, published: active.length, drafts: ownCourses.length - active.length, passed: entries.filter(e => e.status === 'passed').length, pending: entries.filter(e => e.status !== 'passed').length },
        recent: rows.slice(0, 6).map(a => ({ ...copy(a), name: users.find(u => u.id === a.user_id).name, title: ownCourses.find(c => c.id === a.course_id).title }))
      };
    }
    if ((path === '/courses' && method === 'POST') || (/^\/courses\/\d+$/.test(path) && method === 'PUT')) {
      trainer();
      if(!can(user,'courses.manage'))fail('Sin permiso para editar cursos.');
      const previous = method === 'PUT' ? ownCourses.find(c => c.id === Number(path.split('/').pop())) : null;
      if((body.published||previous?.published)&&!can(user,'courses.publish'))fail('Sin permiso para publicar.');
      if (method === 'PUT' && !previous) fail('Capacitación no encontrada.');
      if (!body.title?.trim() || !body.content?.trim()) fail('Agrega un título y contenido.');
      if (!Number.isInteger(body.minutes) || body.minutes < 1 || body.minutes > 1000 || !Number.isInteger(body.pass) || body.pass < 1 || body.pass > 100) fail('Revisa la duración y la nota mínima.');
      if (!Array.isArray(body.questions) || body.questions.length > 50 || (body.published && !body.questions.length)) fail('Agrega preguntas para publicar.');
      if (body.questions.some(q => !q.text?.trim() || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6 || q.options.some(o => !o.trim()) || !Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.options.length)) fail('Revisa las preguntas y sus respuestas.');
      let video = '';
      if (body.video) {
        let url; try { url = new URL(body.video); } catch { fail('Ingresa un enlace válido de YouTube.'); }
        if (url.protocol === 'https:') {
          if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) video = url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1] || '';
          if (url.hostname === 'youtu.be') video = url.pathname.slice(1);
        }
        if (!/^[\w-]{11}$/.test(video)) fail('Ingresa un enlace HTTPS válido de YouTube.');
      }
      const course = { id: previous?.id || Math.max(0, ...db.courses.map(c => c.id)) + 1, owner: user.id, title: body.title.trim(), description: body.description || '', content: body.content, category: body.category || 'General', minutes: body.minutes, pass: body.pass, published: body.published ? 1 : 0, video, questions: copy(body.questions), revision: previous ? previous.revision + Number(previous.pass !== body.pass || JSON.stringify(previous.questions) !== JSON.stringify(body.questions)) : 1 };
      if (previous) db.courses[db.courses.findIndex(c => c.id === previous.id)] = course;
      else db.courses.push(course);
      save(db); return { id: course.id };
    }
    const match = path.match(/^\/courses\/(\d+)\/(progress|attempt)$/);
    if (match && method === 'POST') {
      if (user.role !== 'learner') fail('Selecciona un participante para registrar avances.');
      const course = db.courses.find(c => c.id === Number(match[1]) && c.published);
      if (!course) fail('Capacitación no disponible.');
      if (match[2] === 'progress') {
        let progress = db.progress.find(p => p.user_id === user.id && p.course_id === course.id);
        if (!progress) { progress = { user_id: user.id, course_id: course.id, notes: '', completed: 0 }; db.progress.push(progress); }
        if (body.notes !== undefined) progress.notes = String(body.notes).slice(0, 10000);
        if (body.completed !== undefined) progress.completed = Number(Boolean(body.completed));
        save(db); return { ok: true };
      }
      if (body.revision !== course.revision) fail('La evaluación cambió. Vuelve a abrir la capacitación.');
      if (!course.questions.length || !Array.isArray(body.answers) || body.answers.length !== course.questions.length || body.answers.some((a, i) => !Number.isInteger(a) || a < 0 || a >= course.questions[i].options.length)) fail('Responde todas las preguntas.');
      const correct = course.questions.filter((q, i) => q.correct === body.answers[i]).length;
      const score = Math.round(correct / course.questions.length * 100), passed = score >= course.pass;
      db.attempts.push({ id: Math.max(0, ...db.attempts.map(a => a.id)) + 1, user_id: user.id, course_id: course.id, score, passed, revision: course.revision, created: new Date().toISOString().slice(0, 19).replace('T', ' ') });
      save(db); return { score, passed, correct, total: course.questions.length };
    }
    fail('Esta acción no está disponible en la demostración.');
  };
}

export async function renderDemoLogin(api, onLogin) {
  const { users } = await api('/demo/profiles');
  const app = document.querySelector('#app');
  app.innerHTML = `<main class="demo-welcome"><span class="eyebrow">INNOVACAMPUS · CAMPUS DE FORMACIÓN</span><h1>Prueba tu próximo<br>espacio de aprendizaje.</h1><p>Explora capacitaciones, crea contenido y resuelve evaluaciones. Elige un perfil de ejemplo para comenzar.</p><div class="demo-profiles"></div><p class="field-help">Sin registro ni contraseñas. Los cambios se guardan en este navegador. Usa únicamente datos de prueba.</p><p id="demo-error" class="error" role="alert"></p></main>`;
  for (const user of users) {
    const button = document.createElement('button');
    button.className = 'secondary';
    button.textContent = `${user.name} · ${LEVELS[accessLevel(user)]||'Participante'}`;
    button.onclick = async () => {
      button.disabled = true;
      try { await onLogin((await api('/login', 'POST', { id: user.id })).user); }
      catch (error) { document.querySelector('#demo-error').textContent = error.message; button.disabled = false; }
    };
    app.querySelector('.demo-profiles').append(button);
  }
}
