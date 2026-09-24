import { startCampus } from './client/controllers/campus-controller.js';
import { createDemoApi, renderDemoLogin } from './local-api.mjs';
await startCampus({api: createDemoApi(localStorage, sessionStorage), authView: renderDemoLogin});
