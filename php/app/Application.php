<?php
declare(strict_types=1);
namespace Campus;

use Campus\Models\{Database,Repository};
use Campus\Controllers\{AuthController,CoursesController,ReportsController,TeamController};

final class Application {
    public static function run(array $config): void {
        header('X-Content-Type-Options: nosniff');
        header('Referrer-Policy: strict-origin-when-cross-origin');
        header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-src https://www.youtube-nocookie.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
        try {
            $method=$_SERVER['REQUEST_METHOD'] ?? 'GET';
            $queryPath=$_GET['route'] ?? null;
            $requestPath=parse_url($_SERVER['REQUEST_URI'] ?? '/',PHP_URL_PATH);
            if ($queryPath === null && ($requestPath === '/' || str_ends_with($requestPath,'/index.php'))) {
                if ($method !== 'GET') Http::fail(405,'Método no permitido.');
                header('Content-Type: text/html; charset=utf-8');
                readfile(__DIR__ . '/Views/index.html'); return;
            }
            $path=$queryPath ?? $requestPath;
            if (!is_string($path) || !str_starts_with($path,'/api/')) Http::fail(404,'No encontrado.');
            $path=substr($path,4);
            if (!in_array($method,['GET','POST','PUT'],true)) Http::fail(405,'Método no permitido.');
            $body=[];
            if ($method !== 'GET') {
                $origin=$_SERVER['HTTP_ORIGIN'] ?? null;
                $expected=$config['app_origin'] ?: ((!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? ''));
                if ($origin !== null && $origin !== $expected) Http::fail(403,'Origen no permitido.');
                // Read completely BEFORE authenticating; slow requests cannot retain revoked rights.
                $body=Http::body();
            }
            $repo=new Repository(new Database($config['db_path']));
            $token=is_string($_COOKIE['session'] ?? null) && preg_match('/^[a-f0-9]{64}$/D',$_COOKIE['session']) ? $_COOKIE['session'] : '';
            $currentUser=fn()=> $token ? $repo->sessionUser(hash('sha256',$token),(int)floor(microtime(true)*1000)) : null;
            if (in_array($path,['/session','/setup','/login','/register'],true)) {
                $data=(new AuthController($repo,$config))->handle($path,$method,$body,$currentUser(),$token);
            } else {
                $operation=function () use ($repo,$config,$currentUser,$path,$method,$body,$token): array {
                    $user=$currentUser();
                    if (!$user) Http::fail(401,'Inicia sesión para continuar.');
                    if ($path === '/logout') return (new AuthController($repo,$config))->handle($path,$method,$body,$user,$token);
                    if ($path === '/dashboard' && $method === 'GET') return (new ReportsController($repo))->handle($user);
                    if (preg_match('~^/team(?:/\d+)?$~D',$path)) return (new TeamController($repo))->handle($path,$method,$body,$user);
                    if (preg_match('~^/courses(?:/\d+(?:/(?:progress|attempt))?)?$~D',$path)) return (new CoursesController($repo))->handle($path,$method,$body,$user);
                    Http::fail(404,'No encontrado.');
                };
                // Permission checks and writes share one transaction, including session invalidation.
                $data=$method === 'GET' ? $operation() : $repo->db->transaction($operation);
            }
            Http::json($data,http_response_code() ?: 200);
        } catch (\Throwable $error) {
            $status=$error instanceof \RuntimeException && $error->getCode()>=400 && $error->getCode()<=499 ? $error->getCode() : 500;
            if ($status === 500) error_log((string)$error);
            Http::json(['error'=>$status === 500 ? 'No se pudo completar la operación. Revisa la configuración del servidor.' : $error->getMessage()],$status);
        }
    }
}
