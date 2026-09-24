import { can } from '../../access.mjs';
const state={user:null,courses:[],view:'home',portal:'learner',category:'Todas',query:'',selected:null,tab:'content',authMode:'login',team:null};
function currentAttempt(c){return c.attempts.find(a=>a.revision===c.revision);}
function passed(c){return c.attempts.some(a=>a.revision===c.revision&&a.passed);}
function progress(c){return passed(c)?100:c.progress.completed?60:0;}
function editableCourse(c){return can(state.user,"courses.manage")&&(!c.published||can(state.user,"courses.publish"));}

export { state, currentAttempt, passed, progress, editableCourse };
