import { state } from '../models/campus-model.js';
import { createHttpApi } from '../models/http-api.js';
import { createViews } from '../views/campus-view.js';

export async function startCampus({api: suppliedApi, authView}={}) {
const api=suppliedApi||createHttpApi(()=>{if(state.user){state.user=null;renderAuth();}});
const { toast, button, brand, heading, renderView, renderCatalog, renderCards, renderLearnerDetail, renderProgress, formatDate, accessFields, bindAccessFields, accessPayload, renderTeam, questionEditor, renderEditor, renderAuth, toggleNavigation, shell, renderLearnerHome, renderTrainerDashboard, renderFollowRoster, renderDetail, renderAccessHome, $, escape }=createViews({api,guarded,loadCourses,refresh,authView});
async function guarded(button,fn){if(button)button.disabled=true;try{await fn();}catch(e){toast(e.message);}finally{if(button)button.disabled=false;}}
async function loadCourses(){state.courses=(await api('/courses')).courses;}
async function refresh(){await loadCourses();shell();}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-action]');if(!b)return;e.preventDefault();await guarded(b,async()=>{const action=b.dataset.action;if(action==='menu-toggle'){return toggleNavigation();}if(action==='portal'){state.authEmail=$('[name=email]')?.value||'';state.portal=b.dataset.portal;return renderAuth();}if(action==='auth-switch'){state.authMode=state.authMode==='register'?'login':'register';return renderAuth();}if(action==='logout'){await api('/logout','POST',{});state.user=null;state.courses=[];state.view='home';state.authMode='login';return renderAuth();}if(action==='nav'||['back','manage','team'].includes(action)){state.view=action==='nav'?b.dataset.view:action==='back'?(state.returnView||'catalog'):action;state.query='';state.category='Todas';return shell();}if(action==='filter'){state.category=b.dataset.category;return renderCatalog();}if(action==='open'||action==='edit'||action==='open-quiz'){if(state.view!=='detail'&&state.view!=='editor')state.returnView=state.view;state.selected=Number(b.dataset.id);state.view=action==='edit'?'editor':'detail';state.tab=action==='open-quiz'?'quiz':'content';return shell();}if(action==='new'){state.selected=null;state.view='editor';return shell();}if(action==='tab'||action==='quiz'||action==='content'){state.tab=action==='tab'?b.dataset.tab:action;return renderDetail();}if(action==='complete'){await api(`/courses/${state.selected}/progress`,'POST',{completed:true});await loadCourses();renderDetail();return toast('Contenido completado. ¡Continúa con la evaluación!');}if(action==='add-question'){const count=document.querySelectorAll('.editor-question').length;if(count>=50)return toast('Puedes agregar hasta 50 preguntas.');$('#questions').insertAdjacentHTML('beforeend',questionEditor({text:'',options:['','','',''],correct:0},count));$('#questions').lastElementChild.querySelector('input').focus();}if(action==='remove-question'){b.closest('fieldset').remove();document.querySelectorAll('.question-number').forEach((el,i)=>el.textContent=i+1);}});});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&$('.sidebar')?.dataset.open==='true'){
    toggleNavigation(false);$('#navigation-toggle').focus();
  }
});

try{const session=await api('/session');state.user=session.user;state.authMode=session.needsSetup?'setup':'login';if(state.user)await refresh();else renderAuth();}catch(e){$('#app').innerHTML=`<main class="connection-error"><h1>No pudimos conectar con el campus</h1><p>Comprueba que el servidor esté disponible y vuelve a cargar la página.</p><p>${escape(e.message)}</p><a href="/" class="primary">Volver a intentar</a></main>`;}
}
