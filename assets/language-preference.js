// UI preference only. Account language lives in existing Auth user metadata.
export const validLanguage=value=>value==='ro'||value==='en';
export function createLanguagePreference({storage,getUser,updateUser,apply,requested=null}){
 const globalKey='tikinteract_language',ownerKey='tikinteract_language_owner',guestKey='tikinteract_language_guest';
 const accountKey=id=>'tikinteract_language_account:'+id;
 const read=key=>{try{return storage.getItem(key);}catch{return null;}};
 const write=(key,value)=>{try{storage.setItem(key,value);}catch{}};
 const remove=key=>{try{storage.removeItem(key);}catch{}};
 let owner,queue=Promise.resolve();
 const initial=()=>validLanguage(requested)?requested:validLanguage(read(globalKey))?read(globalKey):'en';
 function current(value,id){write(globalKey,value);if(id)write(ownerKey,id);else remove(ownerKey);apply(value);}
 function syncRemote(id,value){
  queue=queue.catch(()=>{}).then(async()=>{
   if(getUser()?.id!==id)return;
   try{const result=await updateUser({data:{tikinteract_language:value}});if(result?.error)throw result.error;if(read(accountKey(id)+':pending')===value)remove(accountKey(id)+':pending');}catch{/* Local account preference is retried at the next sign-in. */}
  });return queue;
 }
 function record(value){
  if(!validLanguage(value))return;const id=getUser()?.id;
  write(globalKey,value);
  if(id){write(ownerKey,id);write(accountKey(id),value);write(accountKey(id)+':pending',value);syncRemote(id,value);}
  else{remove(ownerKey);write(guestKey,value);}
 }
 function restore(){
  const user=getUser(),id=user?.id||null;if(owner===id)return;owner=id;
  let value;
  if(id){const pending=read(accountKey(id)+':pending'),remote=user.user_metadata?.tikinteract_language,cached=read(accountKey(id));value=validLanguage(requested)?requested:validLanguage(pending)?pending:validLanguage(remote)?remote:validLanguage(cached)?cached:'en';if(validLanguage(pending))syncRemote(id,pending);write(accountKey(id),value);}
  else{const guest=read(guestKey),legacy=!read(ownerKey)?read(globalKey):null;value=validLanguage(requested)?requested:validLanguage(guest)?guest:validLanguage(legacy)?legacy:'en';}
  current(value,id);
 }
 function external(value){const id=getUser()?.id||null;if(validLanguage(value)&&(read(ownerKey)||null)===id)apply(value);}
 return{initial,record,restore,external,settled:()=>queue};
}
