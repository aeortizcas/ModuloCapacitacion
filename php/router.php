<?php
// Development server only; document root must be public_html.
declare(strict_types=1);
$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
$public=__DIR__ . '/public_html';
$file=realpath($public . rawurldecode($path));
if ($file && str_starts_with($file,realpath($public) . DIRECTORY_SEPARATOR) && is_file($file) && preg_match('/\.(?:css|js|mjs)$/D',$file)) return false;
require $public . '/index.php';
