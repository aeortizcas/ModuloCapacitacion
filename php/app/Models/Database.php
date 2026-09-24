<?php
declare(strict_types=1);
namespace Campus\Models;

use PDO;

final class Database {
    public readonly PDO $pdo;

    public function __construct(string $path) {
        if (!extension_loaded('pdo_sqlite')) throw new \RuntimeException('El hosting necesita PDO_SQLITE.');
        $directory = dirname($path);
        if (!is_dir($directory) && !mkdir($directory, 0700, true)) throw new \RuntimeException('No se pudo crear el almacenamiento.');
        $this->pdo = new PDO('sqlite:' . $path, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
        $this->pdo->exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
        $this->pdo->exec(file_get_contents(__DIR__ . '/schema.sql'));
        $columns = array_column($this->all('PRAGMA table_info(users)'), 'name');
        if (!in_array('access_level', $columns, true)) {
            $this->transaction(function (): void {
                $this->pdo->exec("ALTER TABLE users ADD COLUMN access_level TEXT; ALTER TABLE users ADD COLUMN permissions TEXT; UPDATE users SET access_level=role; UPDATE users SET access_level='admin' WHERE id=(SELECT MIN(id) FROM users WHERE role='trainer');");
            });
        }
        // Old Node sessions must not remain valid after switching runtimes.
        $this->transaction(function (): void {
            if (!$this->one("SELECT name FROM migrations WHERE name='php-sessions-v1'")) {
                $this->run('DELETE FROM sessions');
                $this->run("INSERT INTO migrations(name) VALUES('php-sessions-v1')");
            }
        });
    }

    public function run(string $sql, array $args = []): \PDOStatement {
        $statement = $this->pdo->prepare($sql);
        foreach (array_values($args) as $i => $value) {
            $statement->bindValue($i + 1, $value, is_int($value) ? PDO::PARAM_INT : ($value === null ? PDO::PARAM_NULL : PDO::PARAM_STR));
        }
        $statement->execute();
        return $statement;
    }
    public function one(string $sql, array $args = []): ?array { return $this->run($sql, $args)->fetch() ?: null; }
    public function all(string $sql, array $args = []): array { return $this->run($sql, $args)->fetchAll(); }
    public function insert(string $sql, array $args): int { $this->run($sql, $args); return (int)$this->pdo->lastInsertId(); }
    public function transaction(callable $operation): mixed {
        $this->pdo->exec('BEGIN IMMEDIATE');
        try { $result = $operation(); $this->pdo->exec('COMMIT'); return $result; }
        catch (\Throwable $error) { $this->pdo->exec('ROLLBACK'); throw $error; }
    }
}
