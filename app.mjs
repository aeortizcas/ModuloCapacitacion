import { createServer } from "node:http";
import { readFile, mkdir, writeFile, stat, unlink } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";

const PORT = process.env.PORT || 3000;
const ROOT = process.cwd();
const PUBLIC_DIR = join(ROOT, "public");
const DATA_DIR = join(ROOT, "data");
const UPLOAD_DIR = join(ROOT, "uploads");
const DB_PATH = join(DATA_DIR, "capacitacion.db");
const MAX_UPLOAD_BYTES = 600 * 1024 * 1024;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v"
};

await mkdir(DATA_DIR, { recursive: true });
await mkdir(UPLOAD_DIR, { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS modules (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    level TEXT NOT NULL,
    video_url TEXT NOT NULL,
    video_path TEXT,
    video_name TEXT,
    video_type TEXT,
    video_size INTEGER,
    accent TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS lessons (
    id INTEGER PRIMARY KEY,
    module_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    minutes INTEGER NOT NULL,
    summary TEXT NOT NULL,
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS progress (
    module_id INTEGER PRIMARY KEY,
    completed INTEGER NOT NULL DEFAULT 0,
    score INTEGER,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notes (
    module_id INTEGER PRIMARY KEY,
    body TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
  );
`);

const moduleColumns = db.prepare("PRAGMA table_info(modules)").all().map((column) => column.name);
const migrations = [
  ["video_path", "ALTER TABLE modules ADD COLUMN video_path TEXT"],
  ["video_name", "ALTER TABLE modules ADD COLUMN video_name TEXT"],
  ["video_type", "ALTER TABLE modules ADD COLUMN video_type TEXT"],
  ["video_size", "ALTER TABLE modules ADD COLUMN video_size INTEGER"]
];

for (const [column, statement] of migrations) {
  if (!moduleColumns.includes(column)) db.exec(statement);
}

const moduleCount = db.prepare("SELECT COUNT(*) AS count FROM modules").get().count;

if (moduleCount === 0) {
  const insertModule = db.prepare(`
    INSERT INTO modules (id, title, description, category, duration_minutes, level, video_url, accent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertLesson = db.prepare(`
    INSERT INTO lessons (module_id, title, minutes, summary)
    VALUES (?, ?, ?, ?)
  `);

  const seed = [
    {
      id: 1,
      title: "Induccion y cultura de servicio",
      description: "Conoce el proposito del equipo, estandares de atencion y rituales para dar seguimiento con claridad.",
      category: "Onboarding",
      duration: 28,
      level: "Inicial",
      video: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      accent: "#2563eb",
      lessons: [
        ["Bienvenida al programa", 6, "Objetivos, reglas del recorrido y expectativas de participacion."],
        ["Momentos de verdad", 10, "Como reconocer situaciones criticas en la experiencia del cliente."],
        ["Cierre con compromiso", 12, "Definir una accion concreta para aplicar durante la semana."]
      ]
    },
    {
      id: 2,
      title: "Comunicacion efectiva",
      description: "Practica mensajes breves, escucha activa y escalamiento oportuno para equipos operativos.",
      category: "Habilidades",
      duration: 34,
      level: "Intermedio",
      video: "https://www.youtube.com/embed/jNQXAC9IVRw",
      accent: "#059669",
      lessons: [
        ["Escucha activa", 9, "Tecnicas para confirmar entendimiento sin frenar la conversacion."],
        ["Mensajes claros", 11, "Estructura de contexto, accion requerida y fecha limite."],
        ["Escalamiento", 14, "Cuando pedir apoyo y que informacion incluir."]
      ]
    },
    {
      id: 3,
      title: "Seguridad de informacion",
      description: "Aprende buenas practicas para proteger datos, accesos, equipos y documentos internos.",
      category: "Cumplimiento",
      duration: 31,
      level: "Obligatorio",
      video: "https://www.youtube.com/embed/3JZ_D3ELwOQ",
      accent: "#dc2626",
      lessons: [
        ["Datos sensibles", 8, "Identificar informacion que requiere resguardo especial."],
        ["Accesos y contrasenas", 10, "Practicas minimas para cuentas y dispositivos."],
        ["Incidentes", 13, "Como reportar alertas sin retrasar la respuesta."]
      ]
    },
    {
      id: 4,
      title: "Excelencia operativa",
      description: "Convierte procesos repetibles en resultados medibles con indicadores, controles y retrospectivas.",
      category: "Operacion",
      duration: 42,
      level: "Avanzado",
      video: "https://www.youtube.com/embed/tgbNymZ7vqY",
      accent: "#7c3aed",
      lessons: [
        ["Indicadores utiles", 12, "Distinguir indicadores de actividad, calidad y resultado."],
        ["Control diario", 15, "Rutina breve para detectar desviaciones temprano."],
        ["Mejora continua", 15, "Cerrar ciclos con aprendizaje y responsable asignado."]
      ]
    }
  ];

  db.exec("BEGIN");
  try {
    for (const item of seed) {
      insertModule.run(item.id, item.title, item.description, item.category, item.duration, item.level, item.video, item.accent);
      for (const lesson of item.lessons) {
        insertLesson.run(item.id, ...lesson);
      }
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function jsonResponse(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function readBody(req) {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_UPLOAD_BYTES) {
      throw new Error("El archivo supera el limite de 600 MB");
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

function parseMultipart(buffer, contentType) {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) throw new Error("Formulario multipart invalido");

  const boundary = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`);
  const parts = [];
  let cursor = buffer.indexOf(boundary);

  while (cursor !== -1) {
    const next = buffer.indexOf(boundary, cursor + boundary.length);
    if (next === -1) break;

    let part = buffer.subarray(cursor + boundary.length + 2, next - 2);
    cursor = next;

    if (part.length === 0 || part.includes(Buffer.from("--"))) continue;
    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd === -1) continue;

    const rawHeaders = part.subarray(0, headerEnd).toString("utf8");
    const content = part.subarray(headerEnd + 4);
    const name = rawHeaders.match(/name="([^"]+)"/)?.[1];
    const filename = rawHeaders.match(/filename="([^"]*)"/)?.[1];
    const type = rawHeaders.match(/Content-Type:\s*([^\r\n]+)/i)?.[1]?.trim();

    if (name) parts.push({ name, filename, type, content });
  }

  return parts;
}

function safeVideoExtension(filename, type) {
  const extension = extname(filename || "").toLowerCase();
  const allowed = new Set([".mp4", ".webm", ".mov", ".m4v"]);
  if (allowed.has(extension)) return extension;
  if (type === "video/mp4") return ".mp4";
  if (type === "video/webm") return ".webm";
  if (type === "video/quicktime") return ".mov";
  throw new Error("Formato no permitido. Usa MP4, WebM, MOV o M4V.");
}

function youtubeEmbedUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || "").trim());
  } catch {
    throw new Error("Ingresa un enlace valido de YouTube");
  }

  const host = parsed.hostname.replace(/^www\./, "");
  let videoId = "";

  if (host === "youtu.be") {
    videoId = parsed.pathname.split("/").filter(Boolean)[0] || "";
  }

  if (host === "youtube.com" || host === "m.youtube.com") {
    if (parsed.pathname === "/watch") videoId = parsed.searchParams.get("v") || "";
    if (parsed.pathname.startsWith("/embed/")) videoId = parsed.pathname.split("/")[2] || "";
    if (parsed.pathname.startsWith("/shorts/")) videoId = parsed.pathname.split("/")[2] || "";
  }

  if (!/^[a-zA-Z0-9_-]{6,}$/.test(videoId)) {
    throw new Error("No pude reconocer el ID del video de YouTube");
  }

  return `https://www.youtube.com/embed/${videoId}`;
}

function getDashboard() {
  const modules = db.prepare(`
    SELECT
      m.*,
      COALESCE(p.completed, 0) AS completed,
      p.score,
      p.updated_at AS progress_updated_at,
      COALESCE(n.body, '') AS note
    FROM modules m
    LEFT JOIN progress p ON p.module_id = m.id
    LEFT JOIN notes n ON n.module_id = m.id
    ORDER BY m.id
  `).all();

  const lessons = db.prepare("SELECT * FROM lessons ORDER BY module_id, id").all();
  const lessonsByModule = Map.groupBy(lessons, (lesson) => lesson.module_id);

  const enriched = modules.map((module) => ({
    ...module,
    completed: Boolean(module.completed),
    lessons: lessonsByModule.get(module.id) || []
  }));

  const totalMinutes = enriched.reduce((sum, module) => sum + module.duration_minutes, 0);
  const completedCount = enriched.filter((module) => module.completed).length;
  const averageScore = enriched
    .filter((module) => Number.isFinite(module.score))
    .reduce((sum, module, _, scored) => sum + module.score / scored.length, 0);

  return {
    modules: enriched,
    stats: {
      totalModules: enriched.length,
      completedModules: completedCount,
      totalMinutes,
      percent: enriched.length ? Math.round((completedCount / enriched.length) * 100) : 0,
      averageScore: Math.round(averageScore || 0)
    }
  };
}

async function handleApi(req, res, url) {
  try {
    if (req.method === "GET" && url.pathname === "/api/dashboard") {
      return jsonResponse(res, 200, getDashboard());
    }

    const progressMatch = url.pathname.match(/^\/api\/modules\/(\d+)\/progress$/);
    if (req.method === "POST" && progressMatch) {
      const moduleId = Number(progressMatch[1]);
      const body = await readJson(req);
      const completed = body.completed ? 1 : 0;
      const score = body.score === null || body.score === undefined ? null : Number(body.score);
      const updatedAt = new Date().toISOString();

      db.prepare(`
        INSERT INTO progress (module_id, completed, score, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(module_id) DO UPDATE SET
          completed = excluded.completed,
          score = excluded.score,
          updated_at = excluded.updated_at
      `).run(moduleId, completed, Number.isFinite(score) ? score : null, updatedAt);

      return jsonResponse(res, 200, getDashboard());
    }

    const notesMatch = url.pathname.match(/^\/api\/modules\/(\d+)\/notes$/);
    if (req.method === "POST" && notesMatch) {
      const moduleId = Number(notesMatch[1]);
      const body = await readJson(req);
      const note = String(body.note || "").slice(0, 1500);
      const updatedAt = new Date().toISOString();

      db.prepare(`
        INSERT INTO notes (module_id, body, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(module_id) DO UPDATE SET
          body = excluded.body,
          updated_at = excluded.updated_at
      `).run(moduleId, note, updatedAt);

      return jsonResponse(res, 200, { ok: true, updatedAt });
    }

    const uploadMatch = url.pathname.match(/^\/api\/modules\/(\d+)\/video$/);
    if (req.method === "POST" && uploadMatch) {
      const moduleId = Number(uploadMatch[1]);
      const module = db.prepare("SELECT id FROM modules WHERE id = ?").get(moduleId);
      if (!module) return jsonResponse(res, 404, { error: "Modulo no encontrado" });

      const body = await readBody(req);
      const parts = parseMultipart(body, req.headers["content-type"] || "");
      const video = parts.find((part) => part.name === "video" && part.filename);

      if (!video || video.content.length === 0) {
        return jsonResponse(res, 400, { error: "Selecciona un archivo de video" });
      }

      if (!video.type?.startsWith("video/")) {
        return jsonResponse(res, 400, { error: "El archivo debe ser un video" });
      }

      const extension = safeVideoExtension(video.filename, video.type);
      const storedName = `${randomUUID()}${extension}`;
      const uploadPath = join(UPLOAD_DIR, storedName);
      await writeFile(uploadPath, video.content);

      db.prepare(`
        UPDATE modules
        SET video_path = ?, video_name = ?, video_type = ?, video_size = ?
        WHERE id = ?
      `).run(`/uploads/${storedName}`, video.filename, video.type, video.content.length, moduleId);

      return jsonResponse(res, 200, getDashboard());
    }

    const youtubeMatch = url.pathname.match(/^\/api\/modules\/(\d+)\/youtube$/);
    if (req.method === "POST" && youtubeMatch) {
      const moduleId = Number(youtubeMatch[1]);
      const body = await readJson(req);
      const embedUrl = youtubeEmbedUrl(body.url);

      const module = db.prepare("SELECT video_path FROM modules WHERE id = ?").get(moduleId);
      if (!module) return jsonResponse(res, 404, { error: "Modulo no encontrado" });

      if (module.video_path) {
        const filename = module.video_path.replace("/uploads/", "");
        const filePath = resolve(join(UPLOAD_DIR, filename));
        if (filePath.startsWith(resolve(UPLOAD_DIR))) {
          await unlink(filePath).catch(() => {});
        }
      }

      db.prepare(`
        UPDATE modules
        SET video_url = ?, video_path = NULL, video_name = NULL, video_type = NULL, video_size = NULL
        WHERE id = ?
      `).run(embedUrl, moduleId);

      return jsonResponse(res, 200, getDashboard());
    }

    if (req.method === "DELETE" && uploadMatch) {
      const moduleId = Number(uploadMatch[1]);
      const module = db.prepare("SELECT video_path FROM modules WHERE id = ?").get(moduleId);
      if (!module) return jsonResponse(res, 404, { error: "Modulo no encontrado" });

      if (module.video_path) {
        const filename = module.video_path.replace("/uploads/", "");
        const filePath = resolve(join(UPLOAD_DIR, filename));
        if (filePath.startsWith(resolve(UPLOAD_DIR))) {
          await unlink(filePath).catch(() => {});
        }
      }

      db.prepare(`
        UPDATE modules
        SET video_path = NULL, video_name = NULL, video_type = NULL, video_size = NULL
        WHERE id = ?
      `).run(moduleId);

      return jsonResponse(res, 200, getDashboard());
    }

    return jsonResponse(res, 404, { error: "Ruta API no encontrada" });
  } catch (error) {
    return jsonResponse(res, 500, { error: error.message });
  }
}

async function serveUpload(req, res, url) {
  const requestedPath = decodeURIComponent(url.pathname.replace("/uploads/", ""));
  const filePath = normalize(join(UPLOAD_DIR, requestedPath));
  const resolvedPath = resolve(filePath);

  if (!resolvedPath.startsWith(resolve(UPLOAD_DIR))) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const fileStat = await stat(resolvedPath);
    const contentType = MIME_TYPES[extname(resolvedPath)] || "application/octet-stream";
    const range = req.headers.range;

    if (range) {
      const [startText, endText] = range.replace(/bytes=/, "").split("-");
      const start = Number(startText);
      const end = endText ? Number(endText) : fileStat.size - 1;

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileStat.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
        "Content-Type": contentType
      });
      createReadStream(resolvedPath, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, {
      "Content-Length": fileStat.size,
      "Content-Type": contentType,
      "Accept-Ranges": "bytes"
    });
    createReadStream(resolvedPath).pipe(res);
  } catch {
    res.writeHead(404);
    res.end("Video no encontrado");
  }
}

async function serveStatic(req, res, url) {
  const requestedPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = normalize(join(PUBLIC_DIR, requestedPath));
  const resolvedPath = resolve(filePath);

  if (!resolvedPath.startsWith(resolve(PUBLIC_DIR))) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const content = await readFile(resolvedPath);
    const contentType = MIME_TYPES[extname(resolvedPath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  } catch {
    const fallback = await readFile(join(PUBLIC_DIR, "index.html"));
    res.writeHead(404, { "Content-Type": MIME_TYPES[".html"] });
    res.end(fallback);
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith("/api/")) {
    await handleApi(req, res, url);
    return;
  }

  if (url.pathname.startsWith("/uploads/")) {
    await serveUpload(req, res, url);
    return;
  }

  await serveStatic(req, res, url);
});

server.listen(PORT, () => {
  const created = existsSync(DB_PATH) ? DB_PATH : "pendiente";
  console.log(`Modulo de capacitacion listo en http://localhost:${PORT}`);
  console.log(`SQLite: ${created}`);
});
