<?php
// Run locally, or through the hosting terminal. Never expose this file under public_html.
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__) . '/bootstrap.php';
if (!isset($argv[1])) { fwrite(STDERR,"Uso: php bin/password.php correo@empresa.com (contraseña por entrada estándar)\n"); exit(1); }
fwrite(STDERR,"Nueva contraseña (10 a 200 caracteres; la entrada puede ser visible en tu terminal): ");
$password=rtrim(fgets(STDIN) ?: '',"\r\n");
if (strlen($password)<10 || strlen($password)>200) { fwrite(STDERR,"Longitud inválida.\n"); exit(1); }
$repo=new Campus\Models\Repository(new Campus\Models\Database(campus_config()['db_path']));
$user=$repo->userByEmail(strtolower(trim($argv[1])));
if (!$user) { fwrite(STDERR,"Usuario no encontrado.\n"); exit(1); }
$repo->db->transaction(function () use ($repo,$user,$password): void {
    $repo->setPassword($user['id'],Campus\Models\Passwords::hash($password));
    $repo->deleteUserSessions($user['id']);
});
echo "Contraseña actualizada y sesiones cerradas.\n";
