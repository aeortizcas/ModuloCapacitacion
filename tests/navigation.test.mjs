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
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8').replace(/^try\{const session=await api\('\/session'\).*$/m, '');
  const context = vm.createContext({ document: { querySelector: selector => elements[selector], addEventListener: (event, handler) => { events[event] = handler; } }, window: { scrollTo() {} }, setTimeout, clearTimeout });
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
