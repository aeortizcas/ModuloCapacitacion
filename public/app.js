const state = {
  modules: [],
  stats: {},
  selectedId: null,
  activeView: "learning"
};

const els = {
  moduleList: document.querySelector("#moduleList"),
  detailPanel: document.querySelector("#detailPanel"),
  template: document.querySelector("#moduleCardTemplate"),
  heroPercent: document.querySelector("#heroPercent"),
  heroMeter: document.querySelector("#heroMeter"),
  statModules: document.querySelector("#statModules"),
  statCompleted: document.querySelector("#statCompleted"),
  statHours: document.querySelector("#statHours"),
  statScore: document.querySelector("#statScore")
};

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.activeView = button.dataset.view;
    renderDetail();
  });
});

async function api(path, options = {}) {
  const headers = options.body instanceof FormData ? {} : { "Content-Type": "application/json" };
  const response = await fetch(path, {
    headers,
    ...options
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "No se pudo completar la accion");
  }

  return response.json();
}

async function loadDashboard() {
  const data = await api("/api/dashboard");
  state.modules = data.modules;
  state.stats = data.stats;
  state.selectedId ??= state.modules[0]?.id;
  render();
}

function render() {
  renderStats();
  renderModules();
  renderDetail();
}

function renderStats() {
  els.heroPercent.textContent = `${state.stats.percent || 0}%`;
  els.heroMeter.style.width = `${state.stats.percent || 0}%`;
  els.statModules.textContent = state.stats.totalModules || 0;
  els.statCompleted.textContent = state.stats.completedModules || 0;
  els.statHours.textContent = ((state.stats.totalMinutes || 0) / 60).toFixed(1);
  els.statScore.textContent = `${state.stats.averageScore || 0}%`;
}

function renderModules() {
  els.moduleList.replaceChildren();

  for (const module of state.modules) {
    const fragment = els.template.content.cloneNode(true);
    const card = fragment.querySelector(".module-card");
    const chip = fragment.querySelector(".module-chip");
    const title = fragment.querySelector("strong");
    const meta = fragment.querySelector("small");
    const progress = fragment.querySelector(".module-progress");

    card.classList.toggle("active", module.id === state.selectedId);
    card.style.setProperty("--blue", module.accent);
    chip.style.background = module.accent;
    title.textContent = module.title;
    meta.textContent = `${module.category} | ${module.duration_minutes} min | ${module.level}`;
    progress.textContent = module.completed ? "Finalizado" : "Pendiente";

    card.addEventListener("click", () => {
      state.selectedId = module.id;
      render();
    });

    els.moduleList.appendChild(fragment);
  }
}

function selectedModule() {
  return state.modules.find((module) => module.id === state.selectedId);
}

function renderDetail() {
  const module = selectedModule();
  if (!module) return;

  if (state.activeView === "progress") {
    renderProgressView(module);
    return;
  }

  if (state.activeView === "resources") {
    renderResourcesView(module);
    return;
  }

  if (state.activeView === "admin") {
    renderAdminView(module);
    return;
  }

  renderLearningView(module);
}

function renderLearningView(module) {
  els.detailPanel.innerHTML = `
    <div class="video-frame">
      ${videoMarkup(module)}
    </div>

    <div class="detail-header">
      <div class="detail-meta">
        <span class="pill">${module.category}</span>
        <span class="pill">${module.duration_minutes} minutos</span>
        <span class="pill">${module.level}</span>
        <span class="pill">${module.video_path ? "Archivo cargado" : "YouTube"}</span>
      </div>
      <h2>${module.title}</h2>
      <p>${module.description}</p>
    </div>

    <div class="lesson-list">
      ${module.lessons.map((lesson, index) => `
        <div class="lesson">
          <strong>${index + 1}. ${lesson.title}</strong>
          <span>${lesson.minutes} min | ${lesson.summary}</span>
        </div>
      `).join("")}
    </div>

    <textarea class="notes-box" id="notesBox" maxlength="1500" placeholder="Escribe notas, dudas o acuerdos de aplicacion...">${escapeHtml(module.note || "")}</textarea>

    <div class="detail-actions">
      <input class="score-input" id="scoreInput" type="number" min="0" max="100" value="${module.score ?? ""}" placeholder="Puntaje de evaluacion 0-100">
      <button class="ghost-btn" id="saveNoteBtn">Guardar nota</button>
      <button class="primary-btn" id="completeBtn">${module.completed ? "Actualizar progreso" : "Marcar completado"}</button>
    </div>
  `;

  document.querySelector("#saveNoteBtn").addEventListener("click", () => saveNote(module.id));
  document.querySelector("#completeBtn").addEventListener("click", () => saveProgress(module.id));
}

function videoMarkup(module) {
  if (module.video_path) {
    return `
      <video controls preload="metadata">
        <source src="${module.video_path}" type="${module.video_type || "video/mp4"}">
        Tu navegador no puede reproducir este video.
      </video>
    `;
  }

  return `
    <iframe
      src="${module.video_url}"
      title="Video de ${escapeHtml(module.title)}"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen>
    </iframe>
  `;
}

function renderProgressView(module) {
  const completed = state.modules.filter((item) => item.completed);
  const pending = state.modules.filter((item) => !item.completed);

  els.detailPanel.innerHTML = `
    <div class="detail-header">
      <span class="eyebrow">Panel de avance</span>
      <h2>${state.stats.percent}% completado</h2>
      <p>Modulo seleccionado: ${module.title}</p>
    </div>

    <div class="lesson-list">
      <div class="lesson">
        <strong>Finalizados</strong>
        <span>${completed.length ? completed.map((item) => item.title).join(", ") : "Aun no hay modulos finalizados."}</span>
      </div>
      <div class="lesson">
        <strong>Pendientes</strong>
        <span>${pending.length ? pending.map((item) => item.title).join(", ") : "Ruta completa."}</span>
      </div>
      <div class="lesson">
        <strong>Promedio de evaluacion</strong>
        <span>${state.stats.averageScore || 0}% registrado en SQLite.</span>
      </div>
    </div>
  `;
}

function renderResourcesView(module) {
  els.detailPanel.innerHTML = `
    <div class="detail-header">
      <span class="eyebrow">Material de apoyo</span>
      <h2>Recursos para ${module.title}</h2>
      <p>Estos recursos son editables desde la base de datos o pueden ampliarse con archivos descargables.</p>
    </div>

    <ul class="resource-list">
      <li>
        <strong>Guia rapida</strong>
        <span>Resumen operativo para consultar antes de aplicar el modulo.</span>
      </li>
      <li>
        <strong>Checklist de aplicacion</strong>
        <span>Lista de verificacion para supervisores o participantes.</span>
      </li>
      <li>
        <strong>Evidencia sugerida</strong>
        <span>Captura, documento o comentario que demuestre la practica realizada.</span>
      </li>
    </ul>
  `;
}

function renderAdminView(module) {
  els.detailPanel.innerHTML = `
    <div class="detail-header">
      <span class="eyebrow">Carga de videos</span>
      <h2>${module.title}</h2>
      <p>Sube un archivo local o pega un enlace de YouTube. La configuracion queda registrada en SQLite.</p>
    </div>

    <form class="upload-panel" id="uploadForm">
      <label class="upload-box" for="videoInput">
        <strong>${module.video_name ? escapeHtml(module.video_name) : "Seleccionar video"}</strong>
        <span>${module.video_size ? formatBytes(module.video_size) : "MP4, WebM, MOV o M4V hasta 600 MB"}</span>
        <input id="videoInput" name="video" type="file" accept="video/mp4,video/webm,video/quicktime,.m4v" required>
      </label>

      <div class="detail-actions">
        <span class="upload-status" id="uploadStatus">${module.video_path ? "Este modulo ya tiene video cargado." : "Aun usa el video demo."}</span>
        <button class="ghost-btn" id="removeVideoBtn" type="button" ${module.video_path ? "" : "disabled"}>Quitar video</button>
        <button class="primary-btn" type="submit">Subir video</button>
      </div>
    </form>

    <form class="youtube-panel" id="youtubeForm">
      <label class="field-label" for="youtubeInput">Enlace de YouTube</label>
      <div class="url-row">
        <input class="url-input" id="youtubeInput" type="url" value="${escapeHtml(module.video_path ? "" : module.video_url)}" placeholder="https://www.youtube.com/watch?v=...">
        <button class="primary-btn" type="submit">Usar YouTube</button>
      </div>
    </form>

    <div class="video-frame compact-preview">
      ${videoMarkup(module)}
    </div>
  `;

  document.querySelector("#uploadForm").addEventListener("submit", uploadVideo);
  document.querySelector("#youtubeForm").addEventListener("submit", saveYoutubeVideo);
  document.querySelector("#removeVideoBtn").addEventListener("click", removeVideo);
  document.querySelector("#videoInput").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;
    document.querySelector(".upload-box strong").textContent = file.name;
    document.querySelector(".upload-box span").textContent = formatBytes(file.size);
  });
}

async function saveProgress(moduleId) {
  const scoreValue = Number(document.querySelector("#scoreInput").value);
  const score = Number.isFinite(scoreValue) ? Math.max(0, Math.min(100, scoreValue)) : null;

  const data = await api(`/api/modules/${moduleId}/progress`, {
    method: "POST",
    body: JSON.stringify({ completed: true, score })
  });

  state.modules = data.modules;
  state.stats = data.stats;
  render();
  toast("Progreso guardado en SQLite");
}

async function saveNote(moduleId) {
  const note = document.querySelector("#notesBox").value;
  await api(`/api/modules/${moduleId}/notes`, {
    method: "POST",
    body: JSON.stringify({ note })
  });

  const module = selectedModule();
  if (module) module.note = note;
  toast("Nota guardada");
}

async function uploadVideo(event) {
  event.preventDefault();
  const module = selectedModule();
  const input = document.querySelector("#videoInput");
  const status = document.querySelector("#uploadStatus");
  const file = input.files[0];

  if (!module || !file) return;

  status.textContent = "Subiendo video...";
  const form = new FormData();
  form.append("video", file);

  try {
    const data = await api(`/api/modules/${module.id}/video`, {
      method: "POST",
      body: form
    });
    state.modules = data.modules;
    state.stats = data.stats;
    render();
    toast("Video cargado y registrado");
  } catch (error) {
    status.textContent = error.message;
  }
}

async function removeVideo() {
  const module = selectedModule();
  if (!module?.video_path) return;

  const data = await api(`/api/modules/${module.id}/video`, {
    method: "DELETE"
  });

  state.modules = data.modules;
  state.stats = data.stats;
  render();
  toast("Video quitado");
}

async function saveYoutubeVideo(event) {
  event.preventDefault();
  const module = selectedModule();
  const input = document.querySelector("#youtubeInput");
  const status = document.querySelector("#uploadStatus");

  if (!module) return;

  status.textContent = "Guardando enlace de YouTube...";

  try {
    const data = await api(`/api/modules/${module.id}/youtube`, {
      method: "POST",
      body: JSON.stringify({ url: input.value })
    });
    state.modules = data.modules;
    state.stats = data.stats;
    render();
    toast("YouTube guardado");
  } catch (error) {
    status.textContent = error.message;
  }
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function toast(message) {
  const current = document.querySelector(".toast");
  current?.remove();

  const element = document.createElement("div");
  element.className = "toast";
  element.textContent = message;
  document.body.appendChild(element);

  requestAnimationFrame(() => element.classList.add("show"));
  setTimeout(() => element.remove(), 2400);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

loadDashboard().catch((error) => {
  els.detailPanel.innerHTML = `
    <div class="empty-state">
      <strong>No se pudo cargar el modulo</strong>
      <span>${escapeHtml(error.message)}</span>
    </div>
  `;
});
