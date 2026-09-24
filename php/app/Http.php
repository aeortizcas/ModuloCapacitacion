<?php
declare(strict_types=1);
namespace Campus;

final class Http {
    public static function fail(int $status, string $message): never { throw new \RuntimeException($message, $status); }
    public static function text(mixed $value, int $limit = 10000): string {
        if (!is_string($value)) return '';
        $value = trim($value);
        return function_exists('mb_substr') ? mb_substr($value, 0, $limit, 'UTF-8') : substr($value, 0, $limit);
    }
    public static function body(): array {
        if (!preg_match('/^application\/json(?:\s*;|$)/i', $_SERVER['CONTENT_TYPE'] ?? '')) self::fail(415, 'Se requiere JSON.');
        $input = fopen('php://input', 'rb');
        $value = stream_get_contents($input, 300001);
        fclose($input);
        if (strlen($value) > 300000) self::fail(413, 'El contenido es demasiado grande.');
        try { $object = json_decode($value ?: '{}', false, 64, JSON_THROW_ON_ERROR); }
        catch (\JsonException) { self::fail(400, 'Solicitud inválida.'); }
        if (!$object instanceof \stdClass) self::fail(400, 'Se requiere un objeto JSON.');
        return json_decode($value ?: '{}', true, 64, JSON_THROW_ON_ERROR);
    }
    public static function youtube(mixed $value): string {
        $value = self::text($value, 500);
        if ($value === '') return '';
        $url = parse_url($value);
        if (!$url || ($url['scheme'] ?? '') !== 'https') self::fail(400, 'Usa un enlace HTTPS de YouTube.');
        $id = ''; $host = strtolower($url['host'] ?? ''); $path = $url['path'] ?? '';
        if (in_array($host, ['youtube.com','www.youtube.com','m.youtube.com'], true)) {
            parse_str($url['query'] ?? '', $query);
            $id = $query['v'] ?? '';
            if (!$id && preg_match('~^/(?:embed|shorts|live)/([^/]+)~', $path, $match)) $id = $match[1];
        }
        if ($host === 'youtu.be') $id = substr($path, 1);
        if (!is_string($id) || !preg_match('/^[\w-]{11}$/D', $id)) self::fail(400, 'El enlace de YouTube no es válido.');
        return $id;
    }
    public static function json(array $data, int $status = 200): void {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }
}
