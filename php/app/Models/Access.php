<?php
declare(strict_types=1);
namespace Campus\Models;

final class Access {
    public const LEVELS = ['learner'=>'Capacitado','advisor'=>'Asesor','trainer'=>'Capacitador','admin'=>'Administrador'];
    public const PERMISSIONS = ['courses.manage'=>'Crear y editar cursos propios','courses.publish'=>'Publicar cursos propios','reports.view'=>'Consultar resultados de cursos propios'];
    public static function level(array $user): string { return $user['access_level'] ?: $user['role']; }
    public static function defaults(string $level): array { return in_array($level, ['admin','trainer'], true) ? array_keys(self::PERMISSIONS) : []; }
    public static function permissions(array $user): array {
        $level = self::level($user);
        if ($level === 'admin') return [...array_keys(self::PERMISSIONS), 'users.manage'];
        return $user['permissions'] === null ? self::defaults($level) : json_decode($user['permissions'], true, 512, JSON_THROW_ON_ERROR);
    }
    public static function can(array $user, string $permission): bool { return in_array($permission, self::permissions($user), true); }
    public static function publicUser(array $user): array {
        return ['id'=>$user['id'],'name'=>$user['name'],'email'=>$user['email'],'role'=>$user['role'],'accessLevel'=>self::level($user),'permissions'=>self::permissions($user)];
    }
}
