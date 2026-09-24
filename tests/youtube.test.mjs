import test from 'node:test';
import assert from 'node:assert/strict';
import { createViews } from '../client/views/campus-view.js';
import { state } from '../client/models/campus-model.js';

test('YouTube displays inside participant lessons and trainer previews; editing preserves the link',()=>{
  const elements=Object.fromEntries(['#workspace','#lesson-body','#course-form','#add-question','#import-text'].map(key=>[key,{innerHTML:''}]));
  const previous=globalThis.document;
  globalThis.document={querySelector:selector=>elements[selector] ??= {innerHTML:''}};
  const course={id:1,owner:1,title:'Video de prueba',description:'Descripción',category:'Test',content:'Material',video:'abcdefghijk',minutes:10,pass:80,revision:1,published:1,trainer:'Administrador',questions:[],progress:{completed:0,notes:''},attempts:[]};
  state.courses=[course];state.selected=1;state.tab='content';state.user={id:2,role:'learner'};
  const views=createViews({api:()=>{},guarded:()=>{},loadCourses:()=>{},refresh:()=>{}});
  try {
    views.renderLearnerDetail();
    assert.match(elements['#lesson-body'].innerHTML,/<iframe src="https:\/\/www.youtube-nocookie.com\/embed\/abcdefghijk"/);
    assert.match(elements['#lesson-body'].innerHTML,/href="https:\/\/www.youtube.com\/watch\?v=abcdefghijk"/);
    state.user={id:1,role:'trainer'};views.renderDetail();
    assert.match(elements['#workspace'].innerHTML,/<iframe src="https:\/\/www.youtube-nocookie.com\/embed\/abcdefghijk"/);
    views.renderEditor();
    assert.match(elements['#workspace'].innerHTML,/name="video" type="url" value="https:\/\/www.youtube.com\/watch\?v=abcdefghijk"/);
    course.video='';state.user={id:2,role:'learner'};views.renderLearnerDetail();
    assert.doesNotMatch(elements['#lesson-body'].innerHTML,/<iframe/);
  } finally {globalThis.document=previous;}
});
