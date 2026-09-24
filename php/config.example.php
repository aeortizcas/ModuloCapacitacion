<?php
// Copy to config.local.php OUTSIDE public_html and fill in your own values.
return [
    'db_path' => __DIR__ . '/storage/training.db',
    'setup_token' => '', // At least 32 random characters; remove after creating the administrator.
    'allow_registration' => false,
    'app_origin' => '', // Production example: https://campus.example.com (without a trailing slash).
];
