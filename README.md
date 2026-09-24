# InnovaCampus Campus

Plataforma de capacitación para call center con interfaz en español, cuentas de capacitadores y participantes, cursos compartidos, videos de YouTube y evaluaciones calificadas en el servidor.

## Hosting básico: PHP + SQLite

La versión para hosting básico está en `php/`: backend MVC en PHP puro, con SQLite y la misma interfaz. No requiere Node.js, MySQL, Laravel ni Composer en el servidor. Necesita PHP 8.2 o superior con `pdo_sqlite` y almacenamiento persistente fuera de la carpeta pública.

Ejecuta `C:\xampp\php\php.exe scripts/build-php.php` para preparar `build/php-hosting/`. Consulta [HOSTING-PHP.md](HOSTING-PHP.md) para instalar, configurar la clave del primer administrador y migrar una base existente. El paquete usa registro cerrado por defecto y valida permisos dentro de la transacción de escritura.

La base existente no se modifica al preparar el paquete. Las contraseñas anteriores se conservan al iniciar sesión si PHP tiene Sodium; de lo contrario deben restablecerse mediante la herramienta privada descrita en la guía. El backend Node se conserva como alternativa y para las pruebas de compatibilidad; el paquete PHP no lo incluye.

## Demostración en GitHub Pages

Publicación desde `main`, carpeta `/docs`: https://aeortizcas.github.io/ModuloCapacitacion/

- Selecciona uno de los tres perfiles de ejemplo; no se solicitan contraseñas.
- Crea cursos como capacitador y cambia a participante para estudiar y resolver evaluaciones.
- Los cursos, notas y resultados se guardan únicamente en el navegador. La selección de perfil dura la sesión de la pestaña.
- No hay cuentas reales, privacidad entre personas que usan ese navegador, sincronización ni calificaciones protegidas. Usa datos de prueba. Borrar los datos del sitio elimina los cambios locales.
- Los datos del servidor Node.js no se publican en esta demostración.

Para actualizarla, ejecuta `node scripts/build-pages.mjs` después de modificar la interfaz y sube también los archivos generados en `docs/`. Pages sirve únicamente esa carpeta.

## Ejecutar la versión alternativa con Node.js

Requiere Node.js 24 o superior. No necesita instalar dependencias.

```powershell
node server.mjs
```

Abre http://127.0.0.1:3000. También puedes ejecutar `iniciar.cmd` en Windows.

En el primer acceso crea tu cuenta de administrador. No hay contraseñas predeterminadas. Desde **Usuarios y permisos**, el administrador crea cuentas con nombre, correo, contraseña inicial y nivel de acceso. El registro público sigue creando únicamente capacitados. Los capacitadores gestionan sus propios cursos y resultados según los permisos asignados; no administran usuarios.

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

Una instalación nueva empieza sin las cuentas y resultados locales. Antes de compartir el enlace, configura el administrador: el primer registro de configuración obtiene el nivel de administrador. Si necesitas conservar los datos locales, migra la base de datos de forma privada antes de habilitar el servicio; no la subas al repositorio.

Guía de Render: https://render.com/docs/infrastructure-as-code

Esta versión reemplaza la aplicación estática: **GitHub Pages no ejecuta este servidor ni comparte su base de datos**. Se necesita un alojamiento que ejecute Node.js 24 y proporcione almacenamiento persistente para SQLite. No se ha desplegado una versión en Internet. El runtime de Sites/Cloudflare Workers requiere adaptar este servidor Node y su SQLite local a sus servicios antes de publicar allí.

Variables opcionales del proceso:

- `PORT`: puerto, por defecto `3000`.
- `HOST`: interfaz de escucha, por defecto `127.0.0.1`; para una red interna se puede configurar `0.0.0.0` y permitir el acceso en el firewall.
- `DB_PATH`: ruta del archivo de base de datos.
- `APP_ORIGIN`: origen HTTPS exacto del alojamiento (por ejemplo, `https://campus.empresa.com`). Activa cookies Secure y permite ese origen detrás de un proxy HTTPS.

Usa HTTPS para el acceso remoto. Mantén la base de datos en un volumen persistente y realiza copias de seguridad con el servicio detenido, incluyendo los archivos WAL/SHM si existen. No publiques la carpeta `data` como contenido estático. El servidor solo entrega los archivos públicos incluidos en su lista de rutas autorizadas.

## Verificación

```powershell
npm.cmd run build:pages
npm.cmd run check
npm.cmd test
```

La prueba de integración usa una base temporal y cubre configuración inicial, autenticación, roles, borradores, publicación, validación de YouTube, aislamiento de notas, corrección real de respuestas, historial, versiones de pruebas y cierre de sesión. La validación visual en navegador sigue pendiente porque no hay un navegador conectado disponible.

## Arquitectura MVC

El servidor y el cliente están organizados por responsabilidad, sin dependencias externas adicionales:

- `src/models/`: conexión SQLite, migraciones aditivas, consultas del repositorio y contenido inicial. Conserva la base existente en `data/training.db` o en `DB_PATH`.
- `src/controllers/`: controladores de autenticación, cursos y evaluaciones, usuarios y permisos, reportes y archivos públicos. Validan las solicitudes y consultan los modelos.
- `src/application.mjs`: enrutamiento HTTP, sesión, cabeceras de seguridad y manejo de errores. `server.mjs` es el punto de arranque compatible con `npm start` y Render.
- `views/index.html`: documento HTML principal.
- `client/models/`: estado del campus, cálculo de avance y adaptador HTTP.
- `client/views/`: presentación del campus y formularios.
- `client/controllers/`: inicialización, navegación y coordinación entre modelos y vistas. `app.js` inicia este controlador.

La demo inyecta su API local y su pantalla de selección de perfiles en el mismo controlador. `npm run build:pages` copia los módulos compartidos a `docs/`; los archivos de esa carpeta son generados y se actualizan desde las fuentes. El servidor publica únicamente una lista explícita de recursos: los modelos del servidor, la base de datos y la configuración no son accesibles por HTTP.

Las pruebas automatizadas verifican los flujos de capacitación, la migración de permisos, la demo, la navegación, el arranque real del controlador del cliente, las dependencias de los módulos y el rechazo de acceso a archivos internos. Las pruebas de PHP ejecutan además el mismo recorrido de capacitación, los controles de instalación, registro y permisos, y la conservación de datos y contraseñas. Si PHP no está disponible se omiten explícitamente; configura `PHP_BIN` para ejecutarlas. En Windows se usa `npm.cmd` si PowerShell bloquea `npm.ps1`.

## Experiencias por rol

- **Capacitador:** ingresa a su panel de gestión, crea y edita sus capacitaciones, revisa borradores y consulta las pruebas con su clave de respuestas en vista previa. Puede dar seguimiento a los participantes que no han estudiado, tienen una prueba pendiente, necesitan repasar o ya aprobaron. Los indicadores se calculan sobre sus cursos publicados y las versiones vigentes de las pruebas; cada aprobación corresponde a una combinación participante/capacitación. Todas las capacitaciones publicadas están disponibles para todos los participantes.
- **Participante:** ingresa a su inicio personal, ve su siguiente capacitación y los pendientes de su ruta, estudia y consulta sus propios resultados. No tiene acceso al panel, al editor ni a las respuestas correctas.
- El selector de acceso en el inicio de sesión verifica el rol existente; no otorga permisos. El registro sigue creando únicamente participantes. Solo los administradores pueden cambiar niveles y permisos desde Usuarios y permisos.
- La vista previa del capacitador no guarda notas, avances ni intentos. El servidor rechaza esas operaciones si la cuenta no es de participante.

Las pruebas de integración también cubren el acceso por rol, los estados del seguimiento, la exclusión de notas privadas del panel y el aislamiento de datos entre capacitadores.

## Usuarios, niveles y permisos

- **Capacitado:** estudia, guarda notas privadas, responde evaluaciones y consulta sus propios resultados.
- **Asesor:** tiene el mismo acceso de aprendizaje personal; se distingue como perfil operativo.
- **Capacitador:** puede recibir permisos para crear/editar cursos propios, publicar cursos propios y consultar resultados de sus cursos. Cada permiso se selecciona al crear o editar la cuenta. Publicar requiere también crear/editar. Sin permiso de publicación no puede modificar cursos ya publicados, aunque puede preparar borradores.
- **Administrador:** crea usuarios, cambia niveles y asigna permisos. También gestiona sus cursos y resultados. Este nivel no da acceso a notas privadas ni a editar cursos de otros autores.

Para crear una cuenta, ingresa por **Capacitador / Admin**, abre **Usuarios y permisos**, completa el formulario y selecciona el nivel. En las cuentas de capacitador aparecen las casillas de permisos. Las cuentas de capacitado y asesor ingresan por **Participante**. La selección del portal no concede permisos.

Al editar el nivel o los permisos de otra persona, se invalidan sus sesiones: debe volver a ingresar. Un administrador no puede cambiar sus propios permisos, lo que evita eliminar el último acceso administrativo. Los cambios de nivel conservan el historial, las notas y la propiedad de cursos; cada vista muestra los datos correspondientes al rol actual.

La actualización de SQLite es automática y agrega columnas sin borrar registros. En una base existente, el capacitador con el menor ID se convierte en administrador; los demás conservan su rol con los permisos de capacitación habituales. No se agregan contraseñas predeterminadas.

La demo de Pages permite crear perfiles de prueba y simular niveles y permisos, sin contraseñas ni seguridad real. No ingreses datos personales reales. Ejecuta `node scripts/build-pages.mjs` para actualizarla.

Las pruebas de acceso cubren la migración de cuentas anteriores, creación de los cuatro niveles, rechazo de elevación de privilegios, permisos de publicación, protección de resultados, cierre de sesiones y conservación de historial.
