const STORAGE_KEY = "modulo-capacitacion-static-v1";

const modules = [
  {
    id: 1,
    title: "Induccion y cultura de servicio",
    description: "Conoce el proposito del equipo, estandares de atencion y rituales para dar seguimiento con claridad.",
    category: "Onboarding",
    duration_minutes: 28,
    level: "Inicial",
    video_url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    accent: "#2563eb",
    lessons: [
      { title: "Bienvenida al programa", minutes: 6, summary: "Objetivos, reglas del recorrido y expectativas de participacion." },
      { title: "Momentos de verdad", minutes: 10, summary: "Como reconocer situaciones criticas en la experiencia del cliente." },
      { title: "Cierre con compromiso", minutes: 12, summary: "Definir una accion concreta para aplicar durante la semana." }
    ]
  },
  {
    id: 2,
    title: "Comunicacion efectiva",
    description: "Practica mensajes breves, escucha activa y escalamiento oportuno para equipos operativos.",
    category: "Habilidades",
    duration_minutes: 34,
    level: "Intermedio",
    video_url: "https://www.youtube.com/embed/jNQXAC9IVRw",
    accent: "#059669",
    lessons: [
      { title: "Escucha activa", minutes: 9, summary: "Tecnicas para confirmar entendimiento sin frenar la conversacion." },
      { title: "Mensajes claros", minutes: 11, summary: "Estructura de contexto, accion requerida y fecha limite." },
      { title: "Escalamiento", minutes: 14, summary: "Cuando pedir apoyo y que informacion incluir." }
    ]
  },
  {
    id: 3,
    title: "Seguridad de informacion",
    description: "Aprende buenas practicas para proteger datos, accesos, equipos y documentos internos.",
    category: "Cumplimiento",
    duration_minutes: 31,
    level: "Obligatorio",
    video_url: "https://www.youtube.com/embed/3JZ_D3ELwOQ",
    accent: "#dc2626",
    lessons: [
      { title: "Datos sensibles", minutes: 8, summary: "Identificar informacion que requiere resguardo especial." },
      { title: "Accesos y contrasenas", minutes: 10, summary: "Practicas minimas para cuentas y dispositivos." },
      { title: "Incidentes", minutes: 13, summary: "Como reportar alertas sin retrasar la respuesta." }
    ]
  },
  {
    id: 4,
    title: "Excelencia operativa",
    description: "Convierte procesos repetibles en resultados medibles con indicadores, controles y retrospectivas.",
    category: "Operacion",
    duration_minutes: 42,
    level: "Avanzado",
    video_url: "https://www.youtube.com/embed/tgbNymZ7vqY",
    accent: "#7c3aed",
    lessons: [
      { title: "Indicadores utiles", minutes: 12, summary: "Distinguir indicadores de actividad, calidad y resultado." },
      { title: "Control diario", minutes: 15, summary: "Rutina breve para detectar desviaciones temprano." },
      { title: "Mejora continua", minutes: 15, summary: "Cerrar ciclos con aprendizaje y responsable asignado." }
    ]
  }
];

const state = {
  selectedId: 1,
  activeView: "learning",
  localVideoUrl: null,
  saved: loadSaved()
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

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.saved));
}

function moduleState(moduleId) {
  state.saved[moduleId] ||= {
    completed: false,
    score: null,
    note: "",
    videoUrl: modules.find((module) => module.id === moduleId)?.video_url || ""
  };
  return state.saved[moduleId];
}

function dashboardStats() {
  const completed = modules.filter((module) => moduleState(module.id).completed);
  const scored = modules
    .map((module) => Number(moduleState(module.id).score))
    .filter((score) => Number.isFinite(score));

  return {
    totalModules: modules.length,
    completedModules: completed.length,
    totalMinutes: modules.reduce((sum, module) => sum + module.duration_minutes, 0),
    percent: Math.round((completed.length / modules.length) * 100),
    averageScore: scored.length ? Math.round(scored.reduce((sum, score) => sum + score, 0) / scored.length) : 0
  };
}

function render() {
  renderStats();
  renderModules();
  renderDetail();
}

function renderStats() {
  const stats = dashboardStats();
  els.heroPercent.textContent = `${stats.percent}%`;
  els.heroMeter.style.width = `${stats.percent}%`;
  els.statModules.textContent = stats.totalModules;
  els.statCompleted.textContent = stats.completedModules;
  els.statHours.textContent = (stats.totalMinutes / 60).toFixed(1);
  els.statScore.textContent = `${stats.averageScore}%`;
}

function renderModules() {
  els.moduleList.replaceChildren();

  for (const module of modules) {
    const saved = moduleState(module.id);
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
    progress.textContent = saved.completed ? "Finalizado" : "Pendiente";

    card.addEventListener("click", () => {
      state.selectedId = module.id;
      clearLocalVideo();
      render();
    });

    els.moduleList.appendChild(fragment);
  }
}

function selectedModule() {
  return modules.find((module) => module.id === state.selectedId);
}

function renderDetail() {
  const module = selectedModule();
  if (!module) return;

  if (state.activeView === "progress") return renderProgressView(module);
  if (state.activeView === "resources") return renderResourcesView(module);
  if (state.activeView === "admin") return renderAdminView(module);

  renderLearningView(module);
}

function renderLearningView(module) {
  const saved = moduleState(module.id);
  els.detailPanel.innerHTML = `
    <div class="video-frame">${videoMarkup(module)}</div>

    <div class="detail-header">
      <div class="detail-meta">
        <span class="pill">${module.category}</span>
        <span class="pill">${module.duration_minutes} minutos</span>
        <span class="pill">${module.level}</span>
        <span class="pill">${state.localVideoUrl ? "Archivo local" : "YouTube"}</span>
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

    <textarea class="notes-box" id="notesBox" maxlength="1500" placeholder="Escribe notas, dudas o acuerdos de aplicacion...">${escapeHtml(saved.note || "")}</textarea>

    <div class="detail-actions">
      <input class="score-input" id="scoreInput" type="number" min="0" max="100" value="${saved.score ?? ""}" placeholder="Puntaje de evaluacion 0-100">
      <button class="ghost-btn" id="saveNoteBtn">Guardar nota</button>
      <button class="primary-btn" id="completeBtn">${saved.completed ? "Actualizar progreso" : "Marcar completado"}</button>
    </div>
  `;

  document.querySelector("#saveNoteBtn").addEventListener("click", () => saveNote(module.id));
  document.querySelector("#completeBtn").addEventListener("click", () => saveProgress(module.id));
}

function videoMarkup(module) {
  const saved = moduleState(module.id);
  if (state.localVideoUrl) {
    return `
      <video controls preload="metadata">
        <source src="${state.localVideoUrl}" type="video/mp4">
        Tu navegador no puede reproducir este video.
      </video>
    `;
  }

  return `
    <iframe
      src="${saved.videoUrl || module.video_url}"
      title="Video de ${escapeHtml(module.title)}"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen>
    </iframe>
  `;
}

function renderProgressView(module) {
  const stats = dashboardStats();
  const completed = modules.filter((item) => moduleState(item.id).completed);
  const pending = modules.filter((item) => !moduleState(item.id).completed);

  els.detailPanel.innerHTML = `
    <div class="detail-header">
      <span class="eyebrow">Panel de avance</span>
      <h2>${stats.percent}% completado</h2>
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
        <span>${stats.averageScore}% guardado en este navegador.</span>
      </div>
    </div>
  `;
}

function renderResourcesView(module) {
  els.detailPanel.innerHTML = `
    <div class="detail-header">
      <span class="eyebrow">Material de apoyo</span>
      <h2>Recursos para ${module.title}</h2>
      <p>Material de apoyo para presentar el flujo de capacitacion y seguimiento.</p>
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
  const saved = moduleState(module.id);
  els.detailPanel.innerHTML = `
    <div class="detail-header">
      <span class="eyebrow">Videos</span>
      <h2>${module.title}</h2>
      <p>Pega un enlace de YouTube para guardarlo en esta pagina. Tambien puedes probar un archivo local durante la presentacion.</p>
    </div>

    <form class="youtube-panel" id="youtubeForm">
      <label class="field-label" for="youtubeInput">Enlace de YouTube</label>
      <div class="url-row">
        <input class="url-input" id="youtubeInput" type="url" value="${escapeHtml(saved.videoUrl || module.video_url)}" placeholder="https://www.youtube.com/watch?v=...">
        <button class="primary-btn" type="submit">Usar YouTube</button>
      </div>
    </form>

    <div class="upload-panel">
      <label class="upload-box" for="videoInput">
        <strong>Probar archivo local</strong>
        <span>Solo se reproduce en esta sesion del navegador</span>
        <input id="videoInput" name="video" type="file" accept="video/mp4,video/webm,video/quicktime,.m4v">
      </label>
      <div class="detail-actions">
        <span class="upload-status" id="uploadStatus">GitHub Pages no guarda archivos subidos; usa YouTube para publicar.</span>
        <button class="ghost-btn" id="clearLocalVideoBtn" type="button" ${state.localVideoUrl ? "" : "disabled"}>Quitar local</button>
      </div>
    </div>

    <div class="video-frame compact-preview">${videoMarkup(module)}</div>
  `;

  document.querySelector("#youtubeForm").addEventListener("submit", saveYoutubeVideo);
  document.querySelector("#videoInput").addEventListener("change", previewLocalVideo);
  document.querySelector("#clearLocalVideoBtn").addEventListener("click", () => {
    clearLocalVideo();
    render();
    toast("Video local quitado");
  });
}

function saveProgress(moduleId) {
  const saved = moduleState(moduleId);
  const rawScore = document.querySelector("#scoreInput").value.trim();
  const scoreValue = Number(rawScore);
  saved.completed = true;
  saved.score = rawScore && Number.isFinite(scoreValue) ? Math.max(0, Math.min(100, scoreValue)) : null;
  persist();
  render();
  toast("Progreso guardado");
}

function saveNote(moduleId) {
  moduleState(moduleId).note = document.querySelector("#notesBox").value;
  persist();
  toast("Nota guardada");
}

function saveYoutubeVideo(event) {
  event.preventDefault();
  const module = selectedModule();
  const input = document.querySelector("#youtubeInput");
  const embedUrl = youtubeEmbedUrl(input.value);

  if (!embedUrl) {
    document.querySelector("#uploadStatus").textContent = "Ingresa un enlace valido de YouTube.";
    return;
  }

  moduleState(module.id).videoUrl = embedUrl;
  clearLocalVideo();
  persist();
  render();
  toast("YouTube guardado");
}

function previewLocalVideo(event) {
  const file = event.target.files[0];
  if (!file) return;

  clearLocalVideo();
  state.localVideoUrl = URL.createObjectURL(file);
  document.querySelector("#uploadStatus").textContent = `${file.name} listo para reproducir.`;
  renderDetail();
}

function clearLocalVideo() {
  if (state.localVideoUrl) URL.revokeObjectURL(state.localVideoUrl);
  state.localVideoUrl = null;
}

function youtubeEmbedUrl(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl || "").trim());
    const host = parsed.hostname.replace(/^www\./, "");
    let videoId = "";

    if (host === "youtu.be") videoId = parsed.pathname.split("/").filter(Boolean)[0] || "";
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname === "/watch") videoId = parsed.searchParams.get("v") || "";
      if (parsed.pathname.startsWith("/embed/")) videoId = parsed.pathname.split("/")[2] || "";
      if (parsed.pathname.startsWith("/shorts/")) videoId = parsed.pathname.split("/")[2] || "";
    }

    return /^[a-zA-Z0-9_-]{6,}$/.test(videoId) ? `https://www.youtube.com/embed/${videoId}` : "";
  } catch {
    return "";
  }
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

render();
