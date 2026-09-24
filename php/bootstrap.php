<?php
declare(strict_types=1);

spl_autoload_register(function (string $class): void {
    if (str_starts_with($class, 'Campus\\')) {
        $file = __DIR__ . '/app/' . str_replace('\\', '/', substr($class, 7)) . '.php';
        if (is_file($file)) require $file;
    }
});

function campus_config(): array {
    $local = is_file(__DIR__ . '/config.local.php') ? require __DIR__ . '/config.local.php' : [];
    return array_replace([
        'db_path' => getenv('DB_PATH') ?: __DIR__ . '/storage/training.db',
        'setup_token' => getenv('SETUP_TOKEN') ?: '',
        'allow_registration' => getenv('ALLOW_REGISTRATION') === 'true',
        'app_origin' => rtrim(getenv('APP_ORIGIN') ?: '', '/'),
    ], $local);
}
