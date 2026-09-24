import { LEVELS, PERMISSIONS, defaultPermissions, accessLevel, can } from '../access.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function navigation() {
  const events = {}, attributes = {}, elements = {
    '#app': { innerHTML: '' },
    '#workspace': { focus() {} },
    '.sidebar': { dataset: { open: 'false' } },
    '#navigation-toggle': { setAttribute: (name, value) => { attributes[name] = value; }, querySelector: () => elements.label, focus: () => { attributes.focused = true; } },
    label: { textContent: '' }
  };
  // Load the actual shared navigation without the startup network request.
  const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/^import .*$/gm, '');
  const model = read('../client/models/campus-model.js').replace(/^export .*$/gm, '');
  let view = read('../client/views/campus-view.js');
  view = view.slice(view.indexOf('export function createViews('));
  view = view.slice(view.indexOf('\n')+1, view.lastIndexOf('\nreturn {'));
  const controller = read('../client/controllers/campus-controller.js');
  const eventsSource = controller.slice(controller.indexOf('async function guarded('), controller.indexOf('try{const session='));
  const source = model + '\n' + view + '\n' + eventsSource;
  const context = vm.createContext({ LEVELS, PERMISSIONS, defaultPermissions, accessLevel, can, document: { querySelector: selector => elements[selector], addEventListener: (event, handler) => { events[event] = handler; } }, window: { scrollTo() {} }, setTimeout, clearTimeout });
  vm.runInContext(source + '\nrenderView=()=>{}; globalThis.testState=state;', context);
  return { context, events, elements, attributes, state: context.testState };
}
test('nested pages retain their navigation section and mobile menu supports Escape', () => {
  const { context, events, elements, attributes, state } = navigation();
  state.user = { id: 2, name: 'Participante', role: 'learner' };
  state.view = 'detail'; state.returnView = 'progress';
  context.shell();
  assert.match(elements['#app'].innerHTML, /data-view="progress" aria-current="page"/);
  assert.match(elements['#app'].innerHTML, /aria-controls="navigation-panel" aria-expanded="false"/);
  context.toggleNavigation();
  assert.equal(elements['.sidebar'].dataset.open, 'true');
  assert.equal(attributes['aria-expanded'], 'true');
  events.keydown({ key: 'Escape' });
  assert.equal(elements['.sidebar'].dataset.open, 'false');
  assert.equal(attributes.focused, true);
  state.user.role = 'trainer'; state.view = 'editor';
  context.shell();
  assert.match(elements['#app'].innerHTML, /data-view="manage" aria-current="page"/);
});
test('opening a lesson from results returns to results', async () => {
  const { events, state } = navigation();
  state.user = { id: 2, name: 'Participante', role: 'learner' }; state.view = 'progress';
  const click = dataset => events.click({ target: { closest: () => ({ dataset }) }, preventDefault() {} });
  await click({ action: 'open', id: '1' });
  assert.equal(state.view, 'detail');
  assert.equal(state.returnView, 'progress');
  await click({ action: 'back' });
  assert.equal(state.view, 'progress');
});

test('administration is visible only to administrators and permissions control navigation', () => {
  const { context, elements, state } = navigation();
  state.user={id:1,name:'Admin',role:'trainer',accessLevel:'admin',permissions:[]};
  state.view='team';context.shell();
  assert.match(elements['#app'].innerHTML,/Usuarios y permisos/);
  assert.match(elements['#app'].innerHTML,/Administrador/);
  state.user={id:2,name:'Author',role:'trainer',accessLevel:'trainer',permissions:['courses.manage']};
  state.view='team';context.shell();
  assert.equal(state.view,'home');
  assert.doesNotMatch(elements['#app'].innerHTML,/data-view="team"/);
  state.user.permissions=['reports.view'];state.view='editor';context.shell();
  assert.equal(state.view,'home');
  assert.match(elements['#app'].innerHTML,/Resultados del equipo/);
  state.user={id:3,name:'Asesor',role:'learner',accessLevel:'advisor',permissions:[]};
  context.shell();assert.match(elements['#app'].innerHTML,/Asesor/);
  assert.doesNotMatch(elements['#app'].innerHTML,/Usuarios y permisos/);
});
