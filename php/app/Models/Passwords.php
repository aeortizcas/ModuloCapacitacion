<?php
declare(strict_types=1);
namespace Campus\Models;

final class Passwords {
    public static function hash(string $password): string {
        // A fixed-length prehash preserves the existing 200-byte password limit with bcrypt.
        return 'php-sha256:' . password_hash(hash('sha256', $password), PASSWORD_DEFAULT);
    }
    public static function verify(string $password, string $stored): bool {
        if (str_starts_with($stored, 'php-sha256:')) return password_verify(hash('sha256', $password), substr($stored, 11));
        // Node scrypt defaults: N=16384, r=8, p=1; the salt is the 32-byte ASCII hex string.
        if (preg_match('/^([a-f0-9]{32}):([a-f0-9]{128})$/D', $stored, $match) && function_exists('sodium_crypto_pwhash_scryptsalsa208sha256')) {
            $actual = sodium_crypto_pwhash_scryptsalsa208sha256(64, $password, $match[1], 524288, 16777216);
            return hash_equals($match[2], bin2hex($actual));
        }
        return false;
    }
}
