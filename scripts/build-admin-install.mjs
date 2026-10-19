import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

// Keep the one-step installer synchronized with the independently rerunnable migrations.
export function composeAdminInstall(admin,support,access){
 const content=sql=>sql.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').replace(/^(?:begin|commit);\s*$/gmi,'').trim();
 return '-- TIKINTERACT: administrare + suport + access keys. Copiază TOT fișierul în Supabase SQL Editor și apasă Run.\n'
  +'-- Contul mironsergiuflorin@gmail.com trebuie să existe și să aibă e-mailul confirmat.\n'
  +'-- Rerularea păstrează configurația, echipa și conversațiile existente.\n'
  +'-- Generat din admin.sql + support.sql + access-keys.sql; o singură tranzacție.\n'
  +'begin;\n\n-- 1. ADMINISTRARE\n'+content(admin)+'\n\n-- 2. SUPORT ȘI MESAJE\n'+content(support)+'\n\n-- 3. ACCESS KEYS\n'+content(access)+'\n\ncommit;\n';
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 const root=new URL('../supabase/',import.meta.url);
 const [admin,support,access]=await Promise.all([readFile(new URL('admin.sql',root),'utf8'),readFile(new URL('support.sql',root),'utf8'),readFile(new URL('access-keys.sql',root),'utf8')]);
 await writeFile(new URL('install-admin.sql',root),composeAdminInstall(admin,support,access));
 console.log('Generated supabase/install-admin.sql');
}
