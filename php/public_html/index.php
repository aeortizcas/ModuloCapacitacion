<?php
declare(strict_types=1);
ini_set('display_errors', '0');
ini_set('log_errors', '1');
require dirname(__DIR__) . '/bootstrap.php';
Campus\Application::run(campus_config());
