import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
function scripts(dir) {
  return readdirSync(dir,{withFileTypes:true}).flatMap(entry => {
    if(['.git','node_modules','data','uploads'].includes(entry.name)) return [];
    const path=dir+'/'+entry.name;
    return entry.isDirectory()?scripts(path):/\.(?:mjs|js)$/.test(path)?[path]:[];
  });
}
for(const path of scripts('.')) {
  const result=spawnSync(process.execPath,['--check',path],{stdio:'inherit'});
  if(result.status!==0) process.exit(result.status||1);
}
console.log('Sintaxis verificada en todos los módulos JavaScript.');
