<?php
// Packaging only. The hosting needs neither Node.js, Composer nor a build step.
declare(strict_types=1);
$root=dirname(__DIR__);
$output=$argv[1] ?? $root . '/build/php-hosting';
function copyTree(string $source,string $target): void {
    if (!is_dir($target) && !mkdir($target,0755,true)) throw new RuntimeException('No se pudo crear ' . $target);
    foreach (new DirectoryIterator($source) as $entry) {
        if ($entry->isDot()) continue;
        $destination=$target . '/' . $entry->getFilename();
        if ($entry->isDir()) copyTree($entry->getPathname(),$destination);
        elseif (!copy($entry->getPathname(),$destination)) throw new RuntimeException('Error copiando ' . $entry->getPathname());
    }
}
copyTree($root . '/php/app',$output . '/app');
copyTree($root . '/php/public_html',$output . '/public_html');
copyTree($root . '/php/bin',$output . '/bin');
copyTree($root . '/client',$output . '/public_html/client');
foreach (['bootstrap.php','config.example.php','router.php'] as $file) copy($root . '/php/' . $file,$output . '/' . $file);
foreach (['access.mjs','styles.css','navigation.css'] as $file) copy($root . '/' . $file,$output . '/public_html/' . $file);
if (!is_dir($output . '/app/Views')) mkdir($output . '/app/Views',0755,true);
copy($root . '/views/index.html',$output . '/app/Views/index.html');
file_put_contents($output . '/public_html/app.js',"import { startCampus } from './client/controllers/campus-controller.js';\nawait startCampus({apiBase:'./index.php?route=/api'});\n");
copy($root . '/HOSTING-PHP.md',$output . '/LEEME.md');
echo "Paquete PHP listo en $output\n";
