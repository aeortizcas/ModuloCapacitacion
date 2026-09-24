import { repository } from '../models/repository.mjs';
import { can } from '../../access.mjs';
import { fail } from '../lib/http.mjs';

export async function reportsController({req,res,path,json,user,token}) {
if(path==='/api/dashboard'&&req.method==='GET'){
  if(!can(user,'reports.view'))fail(403,'No tienes permiso para consultar resultados.');
  const learners=repository.learners();
  const courses=repository.ownedCourseSummaries(user.id);
  const rows=repository.ownedLearnerAttempts(user.id);
  const progressRows=repository.ownedProgress(user.id);
  const active=courses.filter(c=>c.published);
  const learnerProgress=learners.map(u=>({...u,courses:active.map(c=>{
    const attempts=rows.filter(a=>a.user_id===u.id&&a.course_id===c.id&&a.revision===c.revision);
    const latest=attempts[0];
    const passed=attempts.some(a=>a.passed);
    const completed=Boolean(progressRows.find(p=>p.user_id===u.id&&p.course_id===c.id)?.completed);
    return {id:c.id,title:c.title,score:latest?.score??null,attempts:attempts.length,status:passed?'passed':latest?'retry':completed?'ready':'pending'};
  })}));
  const summary=courses.map(c=>{const entries=learnerProgress.flatMap(u=>u.courses.filter(p=>p.id===c.id));return {...c,participants:c.published?learners.length:0,passed:entries.filter(e=>e.status==='passed').length,pending:entries.filter(e=>e.status!=='passed').length};});
  const entries=learnerProgress.flatMap(u=>u.courses);
  return json({courses:summary,learners:learnerProgress,stats:{learners:learners.length,published:active.length,drafts:courses.length-active.length,passed:entries.filter(e=>e.status==='passed').length,pending:entries.filter(e=>e.status!=='passed').length,retry:entries.filter(e=>e.status==='retry').length},recent:rows.slice(0,6).map(a=>({id:a.id,name:learners.find(u=>u.id===a.user_id)?.name,title:courses.find(c=>c.id===a.course_id)?.title,score:a.score,passed:a.passed,created:a.created}))});
}

fail(405,'Método no permitido.');
}
