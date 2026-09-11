# Modulo de Capacitacion

Aplicacion web lista para probar localmente y subir a GitHub. No usa npm ni dependencias externas: solo HTML, CSS, JavaScript, Node.js y SQLite.

## Requisitos

- Node.js 24 o superior

## Ejecutar facil

En Windows, haz doble clic en:

```text
start.bat
```

O ejecuta desde terminal:

```bash
node app.mjs
```

Luego abre:

```text
http://localhost:3000
```

## Que incluye

- Videos por YouTube o archivo local.
- Carga de MP4, WebM, MOV o M4V.
- Progreso por modulo.
- Notas del participante.
- Puntaje de evaluacion.
- Base de datos SQLite creada automaticamente.

## Estructura

- `app.mjs`: servidor, API y SQLite.
- `start.bat`: arranque facil en Windows.
- `public/index.html`: interfaz principal.
- `public/styles.css`: diseno visual responsive.
- `public/app.js`: logica del modulo.
- `data/capacitacion.db`: se crea automaticamente al iniciar.
- `uploads/`: videos cargados localmente; no se suben a GitHub.

## Cargar videos o usar YouTube

1. Abre `http://localhost:3000`.
2. Selecciona un modulo.
3. Entra a la pestana `Videos`.
4. Sube un archivo MP4/WebM/MOV/M4V o pega un enlace de YouTube.

La app acepta enlaces `youtube.com/watch`, `youtu.be`, `shorts` y `embed`.

## Subir a GitHub

```bash
git add .
git commit -m "Crear modulo de capacitacion"
git branch -M main
git remote add origin https://github.com/USUARIO/REPOSITORIO.git
git push -u origin main
```

Nota: GitHub Pages solo publica sitios estaticos. Como este proyecto usa SQLite y subida de videos, debe ejecutarse en una computadora, servidor, Codespaces, Render, Railway o similar.
