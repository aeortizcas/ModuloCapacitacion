# Innovatek Campus

Plataforma de capacitación para call center con interfaz en español, cuentas de capacitadores y participantes, cursos compartidos, videos de YouTube y evaluaciones calificadas en el servidor.

## Ejecutar

Requiere Node.js 24 o superior. No necesita instalar dependencias.

```powershell
node server.mjs
```

Abre http://127.0.0.1:3000. También puedes ejecutar `iniciar.cmd` en Windows.

En el primer acceso crea tu cuenta de capacitador. No hay contraseñas predeterminadas. Los siguientes registros son participantes; un capacitador puede cambiar sus roles en **Equipo y resultados**. Todos los capacitadores pueden gestionar roles; cada uno solo puede modificar sus propios cursos y consultar los resultados de sus cursos.

## Recorrido

1. En **Mis contenidos**, crea una capacitación, escribe el material o importa un archivo `.txt` y pega el enlace de YouTube. El video se aloja en YouTube, no en este servidor.
2. Agrega preguntas de selección única, marca la opción correcta y establece la nota mínima. Puedes guardar borradores o publicar para todo el equipo.
3. Los participantes estudian, guardan notas privadas y marcan el contenido como completado.
4. Resuelven la prueba y reciben su calificación automática. Pueden reintentar; se conserva el historial.
5. El capacitador consulta los resultados en **Equipo y resultados**. Si cambia la prueba o su nota mínima, los intentos anteriores conservan su versión y se necesita aprobar la nueva evaluación.

Se incluyen tres capacitaciones iniciales editables. No se agregan videos ficticios: el capacitador debe vincular los videos reales. El 60% del avance corresponde al contenido marcado como completado y el 100% requiere una evaluación aprobada; no se mide el tiempo real de reproducción del video.

## Datos y acceso

- SQLite persiste cuentas, cursos, notas, avances y resultados en `data/training.db`.
- Contraseñas derivadas con scrypt y sal aleatoria; sesiones de 24 horas en cookies HttpOnly y SameSite.
- Roles, propiedad de los cursos y calificaciones se validan en el servidor. Las respuestas correctas no se incluyen en las consultas de los participantes.
- Registro de participantes abierto a quienes puedan acceder al servidor. Configura el primer capacitador localmente antes de exponer el servicio.
- No se implementa recuperación de contraseña por correo ni verificación de correo.
- Los datos de la versión estática anterior permanecen en el navegador; no se migran a las nuevas cuentas automáticamente.

## Uso compartido y publicación

### Publicar en Render

El archivo `render.yaml` prepara un servicio Node.js 24 con plan Starter y un disco persistente de 1 GB (servicios de pago). En Render, selecciona **New > Blueprint**, conecta este repositorio y revisa el costo antes de confirmar la creación.

El despliegue ejecuta las verificaciones y pruebas antes de iniciar. La base de datos se guarda en `/var/data/training.db`; el origen HTTPS se toma de la URL que Render asigna al servicio. Para un dominio propio, configura `APP_ORIGIN` con su origen HTTPS exacto, sin barra final.

Una instalación nueva empieza sin las cuentas y resultados locales. Antes de compartir el enlace, configura el primer capacitador: el primer registro de configuración obtiene ese rol. Si necesitas conservar los datos locales, migra la base de datos de forma privada antes de habilitar el servicio; no la subas al repositorio.

Guía de Render: https://render.com/docs/infrastructure-as-code

Esta versión reemplaza la aplicación estática: **GitHub Pages no ejecuta este servidor ni comparte su base de datos**. Se necesita un alojamiento que ejecute Node.js 24 y proporcione almacenamiento persistente para SQLite. No se ha desplegado una versión en Internet. El runtime de Sites/Cloudflare Workers requiere adaptar este servidor Node y su SQLite local a sus servicios antes de publicar allí.

Variables opcionales del proceso:

- `PORT`: puerto, por defecto `3000`.
- `HOST`: interfaz de escucha, por defecto `127.0.0.1`; para una red interna se puede configurar `0.0.0.0` y permitir el acceso en el firewall.
- `DB_PATH`: ruta del archivo de base de datos.
- `APP_ORIGIN`: origen HTTPS exacto del alojamiento (por ejemplo, `https://campus.empresa.com`). Activa cookies Secure y permite ese origen detrás de un proxy HTTPS.

Usa HTTPS para el acceso remoto. Mantén la base de datos en un volumen persistente y realiza copias de seguridad con el servicio detenido, incluyendo los archivos WAL/SHM si existen. No publiques la carpeta `data` como contenido estático. El servidor solo entrega los tres archivos públicos autorizados.

## Verificación

```powershell
node --check server.mjs
node --check app.js
node --test tests/training.test.mjs
```

La prueba de integración usa una base temporal y cubre configuración inicial, autenticación, roles, borradores, publicación, validación de YouTube, aislamiento de notas, corrección real de respuestas, historial, versiones de pruebas y cierre de sesión. La validación visual en navegador queda pendiente porque no había un navegador conectado disponible.

## Experiencias por rol

- **Capacitador:** ingresa a su panel de gestión, crea y edita sus capacitaciones, revisa borradores y consulta las pruebas con su clave de respuestas en vista previa. Puede dar seguimiento a los participantes que no han estudiado, tienen una prueba pendiente, necesitan repasar o ya aprobaron. Los indicadores se calculan sobre sus cursos publicados y las versiones vigentes de las pruebas; cada aprobación corresponde a una combinación participante/capacitación. Todas las capacitaciones publicadas están disponibles para todos los participantes.
- **Participante:** ingresa a su inicio personal, ve su siguiente capacitación y los pendientes de su ruta, estudia y consulta sus propios resultados. No tiene acceso al panel, al editor ni a las respuestas correctas.
- El selector de acceso en el inicio de sesión verifica el rol existente; no otorga permisos. El registro sigue creando únicamente participantes. Los capacitadores habilitados pueden cambiar roles desde Equipo y resultados.
- La vista previa del capacitador no guarda notas, avances ni intentos. El servidor rechaza esas operaciones si la cuenta no es de participante.

Las pruebas de integración también cubren el acceso por rol, los estados del seguimiento, la exclusión de notas privadas del panel y el aislamiento de datos entre capacitadores.
