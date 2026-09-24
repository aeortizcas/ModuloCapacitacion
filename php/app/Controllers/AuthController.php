<?php
declare(strict_types=1);
namespace Campus\Controllers;

use Campus\Http;
use Campus\Models\{Repository,Access,Passwords};

final class AuthController {
    public function __construct(private Repository $repo, private array $config) {}

    public function handle(string $path, string $method, array $body, ?array $user, string $token): array {
        if ($path === '/session' && $method === 'GET') return [
            'user'=>$user ? Access::publicUser($user) : null, 'needsSetup'=>!$this->repo->firstUser(),
            'requiresSetupToken'=>true, 'allowRegistration'=>$this->config['allow_registration'],
        ];
        if ($path === '/logout' && $method === 'POST') {
            if (!$user) Http::fail(401, 'Inicia sesión para continuar.');
            $this->repo->deleteSession(hash('sha256', $token)); $this->cookie('', time()-3600);
            return ['ok'=>true];
        }
        if (!in_array($path, ['/setup','/login','/register'], true) || $method !== 'POST') Http::fail(405, 'Método no permitido.');
        $email = strtolower(Http::text($body['email'] ?? '', 200));
        $password = is_string($body['password'] ?? null) ? $body['password'] : '';
        if (strlen($password) > 200) Http::fail(400, 'Contraseña demasiado larga.');
        // Different accounts behind the same corporate proxy do not share a lockout bucket.
        $key = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . "\0" . $email . "\0" . $path);
        $this->repo->rateLimit($key);
        if ($path === '/login') {
            $account = $this->repo->userByEmail($email);
            if (!$account || !Passwords::verify($password, $account['password'])) Http::fail(401, 'Correo o contraseña incorrectos.');
            if (!empty($body['portal']) && $body['portal'] !== $account['role']) Http::fail(403, 'Selecciona el acceso correspondiente a tu cuenta.');
            if (!str_starts_with($account['password'], 'php-sha256:')) $this->repo->setPassword($account['id'], Passwords::hash($password));
        } else {
            if ($path === '/setup') {
                $secret = $this->config['setup_token'];
                if (strlen($secret) < 32 || !is_string($body['setupToken'] ?? null) || !hash_equals($secret, $body['setupToken'])) Http::fail(403, 'La clave de instalación no es válida.');
            } elseif (!$this->config['allow_registration']) Http::fail(403, 'El registro público está desactivado. Solicita una cuenta al administrador.');
            $name = Http::text($body['name'] ?? '', 100);
            if (!$name || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 10) Http::fail(400, 'Escribe tu nombre, un correo válido y una contraseña de al menos 10 caracteres.');
            $passwordHash = Passwords::hash($password);
            $account = $this->repo->db->transaction(function () use ($path,$name,$email,$passwordHash): array {
                $exists = $this->repo->firstUser();
                if ($path === '/setup' && $exists) Http::fail(403, 'La cuenta principal ya está configurada.');
                if ($path === '/register' && !$exists) Http::fail(400, 'Primero configura el administrador.');
                if ($this->repo->userIdByEmail($email)) Http::fail(409, 'Este correo ya está registrado.');
                $role = $path === '/setup' ? 'trainer' : 'learner';
                $id = $this->repo->createUser($name,$email,$passwordHash,$role);
                $this->repo->setAccessLevel($role === 'trainer' ? 'admin' : 'learner', $id);
                if ($role === 'trainer') $this->repo->seed($id);
                return $this->repo->userById($id);
            });
        }
        $this->repo->clearLimit($key);
        $session = bin2hex(random_bytes(32)); $now = (int)floor(microtime(true)*1000);
        $this->repo->deleteExpiredSessions($now);
        $this->repo->createSession(hash('sha256',$session),$account['id'],$now+86400000);
        $this->cookie($session,time()+86400);
        return ['user'=>Access::publicUser($account)];
    }
    private function cookie(string $value, int $expires): void {
        $secure = str_starts_with($this->config['app_origin'], 'https://') || (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
        setcookie('session',$value,['expires'=>$expires,'path'=>'/','secure'=>$secure,'httponly'=>true,'samesite'=>'Lax']);
    }
}
