// Disposable, in-memory PostgreSQL only. Never imported or used by the website.
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
export async function createAdminQABridge(origin){
const db=new PGlite();
const ids={owner:'10000000-0000-0000-0000-000000000001',editor:'10000000-0000-0000-0000-000000000002',visitor:'10000000-0000-0000-0000-000000000004'};
await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,storage to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
 insert into auth.users(id,email,email_confirmed_at) values('${ids.owner}','mironsergiuflorin@gmail.com',now()),('${ids.editor}','editor@example.invalid',now()),('${ids.visitor}','visitor@example.invalid',now());`);
await db.exec(await readFile(new URL('../supabase/admin.sql',import.meta.url),'utf8'));
await db.exec(await readFile(new URL('../supabase/support.sql',import.meta.url),'utf8'));
await db.exec(`set request.jwt.claim.sub='${ids.owner}';select public.manage_site_admin('editor@example.invalid','editor');`);
const routes={site_admin_role:[],get_site_public_config:[],get_site_admin_state:[],list_site_admins:[],save_site_config:['p_config','p_revision','p_publish'],restore_site_config:['p_version','p_revision'],manage_site_admin:['p_email','p_role'],list_support_team:[],list_support_tickets:['p_filter','p_search','p_limit','p_offset'],get_support_thread:['p_ticket','p_before'],mark_support_read:['p_ticket','p_seen'],create_support_ticket:['p_topic','p_subject','p_body','p_area','p_request_id'],send_support_message:['p_ticket','p_body','p_internal','p_request_id'],update_support_ticket:['p_ticket','p_state','p_priority','p_assigned','p_version']};
let queue=Promise.resolve();
const server=createServer(async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Content-Type','application/json');
 if(req.method==='OPTIONS'){res.writeHead(204).end();return;}
 const parts=[];for await(const chunk of req)parts.push(chunk);
 let body;try{body=JSON.parse(Buffer.concat(parts));}catch{res.writeHead(400).end('{}');return;}
 const run=async()=>{try{
  if(!Object.hasOwn(routes,body.name)){res.end(JSON.stringify({data:body.name?.startsWith('get_')?[]:null,error:null}));return;}
  const role=Object.hasOwn(ids,body.role)?'authenticated':'anon',id=ids[body.role]||'';await db.exec(`reset role;set request.jwt.claim.sub='${id}';set role ${role}`);
  const args=routes[body.name].map(key=>body.args?.[key]);
  const result=await db.query(`select public.${body.name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as data`,args.map(x=>typeof x==='object'&&x!==null?JSON.stringify(x):x));
  res.end(JSON.stringify({data:result.rows[0].data,error:null}));
 }catch(error){res.end(JSON.stringify({data:null,error:{message:error.message,code:error.code}}));}finally{await db.exec('reset role');}};
 queue=queue.then(run,run);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
return {url:'http://127.0.0.1:'+server.address().port+'/',async close(){await new Promise(resolve=>server.close(resolve));await db.close();}};
}

