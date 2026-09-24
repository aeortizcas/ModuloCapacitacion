<?php
declare(strict_types=1);
namespace Campus\Controllers;

use Campus\Http;
use Campus\Models\{Repository,Access,Passwords};

final class TeamController {
    public function __construct(private Repository $repo) {}
    public function handle(string $path, string $method, array $b, array $user): array {
        if ($path === '/team' && $method === 'GET') {
            if (!Access::can($user,'users.manage') && !Access::can($user,'reports.view')) Http::fail(403,'Sin permiso para consultar el equipo.');
            return ['users'=>Access::can($user,'users.manage') ? array_map([Access::class,'publicUser'],$this->repo->users()) : [], 'results'=>Access::can($user,'reports.view') ? $this->repo->teamResults($user['id']) : [],'levels'=>Access::LEVELS,'permissionOptions'=>Access::PERMISSIONS];
        }
        $id = null;
        if ($method === 'PUT' && preg_match('~^/team/(\d+)$~D',$path,$match)) $id = (int)$match[1];
        elseif ($method !== 'POST' || $path !== '/team') Http::fail(405,'Método no permitido.');
        if (!Access::can($user,'users.manage')) Http::fail(403,'Solo un administrador puede gestionar usuarios y permisos.');
        if ($id !== null && !$this->repo->userById($id)) Http::fail(404,'Usuario no encontrado.');
        if ($id === $user['id']) Http::fail(400,'No puedes cambiar tu propio nivel ni tus permisos.');
        $level = $b['accessLevel'] ?? $b['role'] ?? '';
        if (!is_string($level) || !isset(Access::LEVELS[$level])) Http::fail(400,'Nivel de acceso inválido.');
        $permissions = $b['permissions'] ?? Access::defaults($level);
        if (!is_array($permissions) || !array_is_list($permissions)) Http::fail(400,'Permisos inválidos.');
        foreach ($permissions as $permission) if (!is_string($permission) || !isset(Access::PERMISSIONS[$permission])) Http::fail(400,'Permisos inválidos.');
        if (count(array_unique($permissions)) !== count($permissions)) Http::fail(400,'Permisos inválidos.');
        if (in_array($level,['learner','advisor'],true) && $permissions) Http::fail(400,'Los participantes tienen acceso a su aprendizaje personal.');
        if (in_array('courses.publish',$permissions,true) && !in_array('courses.manage',$permissions,true)) Http::fail(400,'Publicar requiere permiso para crear y editar cursos.');
        $role = in_array($level,['admin','trainer'],true) ? 'trainer' : 'learner';
        $stored = json_encode($level === 'admin' ? Access::defaults($level) : $permissions);
        if ($id !== null) {
            $this->repo->updateUserAccess($role,$level,$stored,$id);
            $this->repo->deleteUserSessions($id);
        } else {
            $name=Http::text($b['name'] ?? '',100); $email=strtolower(Http::text($b['email'] ?? '',200));
            $password=is_string($b['password'] ?? null) ? $b['password'] : '';
            if (!$name || !filter_var($email,FILTER_VALIDATE_EMAIL) || strlen($password)<10 || strlen($password)>200) Http::fail(400,'Ingresa nombre, correo válido y una contraseña de 10 a 200 caracteres.');
            if ($this->repo->userIdByEmail($email)) Http::fail(409,'Este correo ya está registrado.');
            $id=$this->repo->createManagedUser($name,$email,Passwords::hash($password),$role,$level,$stored);
            http_response_code(201);
        }
        return ['user'=>Access::publicUser($this->repo->userById($id))];
    }
}
