# InnovaCampus: PHP puro y SQLite

El backend PHP mantiene la interfaz MVC, las cuentas y permisos, cursos, videos de YouTube, notas privadas, evaluaciones y reportes. No necesita Node.js, MySQL, Laravel ni Composer en el hosting. La subida de PDF/PPTX todavía no está implementada.

## Requisitos

- PHP 8.2 o superior, en una versión con actualizaciones de seguridad del proveedor.
- Extensión `pdo_sqlite` y almacenamiento local persistente con permisos de escritura para PHP.
- HTTPS en producción. Configurar `app_origin` con el origen exacto, sin ruta ni barra final.
- Poder alojar los archivos privados fuera de la carpeta pública del dominio.
- Sodium es opcional para nuevas cuentas, pero permite conservar el acceso con contraseñas de la versión Node.

## Preparar y subir

1. En este equipo: `C:\xampp\php\php.exe scripts/build-php.php`. Esto copia archivos a `build/php-hosting`; no compila ni cambia tus datos. También puedes ejecutar `php scripts/build-php.php` en otro equipo con PHP disponible.
2. Copia el contenido de `build/php-hosting/public_html/` a la carpeta pública del dominio. Coloca `app/`, `bin/`, `bootstrap.php` y la configuración un nivel por encima de esa carpeta, siguiendo la estructura del paquete. No publiques todo el repositorio ni toda la carpeta del paquete.
3. Copia `config.example.php` a `config.local.php` en esa ubicación privada. Escribe `app_origin` y una `setup_token` aleatoria de al menos 32 caracteres. Puedes generarla localmente con `php -r "echo bin2hex(random_bytes(32));"`. No la subas a GitHub ni la compartas con participantes.
4. La ruta `db_path` por defecto apunta a `storage/training.db`, fuera de la carpeta pública. PHP creará el directorio y la base; si el proveedor no lo permite, crea el directorio desde su panel y asígnale permisos de escritura para PHP. No uses permisos 777.
5. Abre el dominio, escribe la clave de instalación y crea el administrador. Luego vacía `setup_token` en la configuración. La API rechaza crear otro administrador inicial si ya hay usuarios.
6. Crea las cuentas desde **Usuarios y permisos**. El registro público está desactivado por defecto. `allow_registration => true` lo habilita explícitamente; toda persona registrada podrá ver los cursos publicados.

Las solicitudes usan `index.php?route=/api/...`, así que no hace falta `mod_rewrite`. Se admite instalar la interfaz en una subcarpeta siempre que se conserve la relación entre `index.php` y `bootstrap.php`, ajustando el `require` si el proveedor impone otra estructura. `.htaccess` desactiva el listado de directorios en Apache; la protección principal consiste en mantener base y configuración fuera de la raíz pública.

## Conservar una base existente

Haz una copia antes de migrar. No ejecutes Node y PHP simultáneamente sobre la misma base. Detén el servidor Node y copia la base de forma consistente: si hay archivos `-wal` y `-shm`, usa una copia SQLite mediante `VACUUM INTO` o su API de respaldo, no copies únicamente el `.db` mientras esté abierto.

Coloca la copia en la ruta privada `db_path`. La migración es aditiva: conserva IDs, cursos, notas y resultados; cierra las sesiones antiguas. Sin columnas de permisos, asigna el primer capacitador como administrador, igual que la versión anterior.

Las contraseñas antiguas usan scrypt. Con Sodium habilitado en PHP, se verifican y se actualiza su hash al iniciar sesión. Sin Sodium, hay que restablecerlas con `php bin/password.php correo@empresa.com` sobre la copia, localmente antes de subirla o mediante una terminal privada del hosting. Esta herramienta conserva los demás datos. Nunca pone una contraseña predeterminada ni permite restablecerla desde una URL pública.

Después de empezar a usar PHP, no vuelvas a apuntar la versión Node a esa base: Node no entiende los nuevos hashes. Para revertir, conserva y restaura el respaldo anterior.

## Probar localmente

Ejecuta el empaquetado, configura una base de pruebas y una clave de instalación en `build/php-hosting/config.local.php`, y ejecuta:

```powershell
C:\xampp\php\php.exe -S 127.0.0.1:8080 -t build/php-hosting/public_html build/php-hosting/router.php
```

Abre `http://127.0.0.1:8080`. El servidor integrado es únicamente para desarrollo.

Las pruebas PHP automatizadas usan bases temporales; se ejecutan con `node --test tests/php.test.mjs`. Node solo actúa como herramienta local de pruebas y no forma parte del despliegue PHP. La variable `PHP_BIN` permite indicar otra ruta al ejecutable.

## Controles incluidos

Consultas parametrizadas, contraseñas con hash, sesiones HttpOnly/SameSite, validación del origen y del JSON, clave de instalación, registro cerrado por defecto y límites persistentes por combinación cuenta/IP/ruta. Las escrituras validan la sesión después de recibir el cuerpo y dentro de la misma transacción que guarda los cambios. Esto evita que una solicitud lenta conserve permisos ya revocados. Estos controles no sustituyen HTTPS, copias de seguridad ni las actualizaciones del hosting.
