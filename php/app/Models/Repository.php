<?php
declare(strict_types=1);
namespace Campus\Models;

final class Repository {
    private array $queries;
    public function __construct(public readonly Database $db) {
        $this->queries = json_decode(file_get_contents(__DIR__ . '/queries.json'), true, 512, JSON_THROW_ON_ERROR);
    }
    public function __call(string $name, array $args): mixed {
        if (!isset($this->queries[$name])) throw new \LogicException('Consulta desconocida.');
        [$sql, $mode] = $this->queries[$name];
        return match ($mode) {
            'get' => $this->db->one($sql, $args),
            'all' => $this->db->all($sql, $args),
            default => str_starts_with($sql, 'INSERT') ? $this->db->insert($sql, $args) : $this->db->run($sql, $args)->rowCount(),
        };
    }
    public function setPassword(int $id, string $hash): void { $this->db->run('UPDATE users SET password=? WHERE id=?', [$hash, $id]); }
    public function rateLimit(string $key, int $limit = 30): void {
        $this->db->transaction(function () use ($key, $limit): void {
            $now = time();
            $this->db->run('DELETE FROM login_limits WHERE expires < ?', [$now]);
            $row = $this->db->one('SELECT count FROM login_limits WHERE key=?', [$key]);
            if (($row['count'] ?? 0) >= $limit) \Campus\Http::fail(429, 'Demasiados intentos para esta cuenta. Intenta en 15 minutos.');
            $this->db->run('INSERT INTO login_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1', [$key, $now + 900]);
        });
    }
    public function clearLimit(string $key): void { $this->db->run('DELETE FROM login_limits WHERE key=?', [$key]); }
    public function seed(int $owner): void {
        $rows = json_decode(file_get_contents(__DIR__ . '/seed.json'), true, 512, JSON_THROW_ON_ERROR);
        foreach ($rows as [$title,$category,$description,$content,$minutes]) {
            $quality = $category === 'Calidad';
            $questions = [['text'=>$quality ? '¿Qué debes hacer antes de compartir información del cliente?' : '¿Qué debes hacer antes de proponer una solución?', 'options'=>$quality ? ['Verificar la identidad según el protocolo','Copiar los datos a tu correo personal','Compartirlos sin verificación'] : ['Confirmar la necesidad del cliente','Interrumpir para reducir el tiempo','Prometer cualquier resultado'], 'correct'=>0]];
            $this->createCourse($title,$category,$description,$minutes,$content,'',1,80,json_encode($questions, JSON_UNESCAPED_UNICODE),$owner);
        }
    }
}
