import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudioAuthenticator} from '../lib/studio-auth.js';

const token=(exp,sub='user')=>'header.'+Buffer.from(JSON.stringify({exp,sub})).toString('base64url')+'.signature';
const now=()=>1000000;

test('Studio rejects missing, malformed, expired, forged and anonymous credentials',async()=>{
    let calls=0;
    const auth=createStudioAuthenticator({url:'https://auth.example.invalid',anonKey:'public',now,fetchImpl:async()=>{calls++;return{ok:false};}});
    for(const input of [undefined,'not-a-token',token(900),token(2000)])assert.equal(await auth.authorize({},input),false);
    assert.equal(calls,1);
    const anonymous=createStudioAuthenticator({url:'https://auth.example.invalid',anonKey:'public',now,fetchImpl:async()=>({ok:true,json:async()=>({id:'anon',is_anonymous:true})})});
    assert.equal(await anonymous.authorize({},token(2000)),false);
});

test('Studio accepts only remotely verified users, coalesces checks and stops access at expiry',async()=>{
    let time=1000000,calls=0;
    const auth=createStudioAuthenticator({url:'https://auth.example.invalid',anonKey:'public',now:()=>time,fetchImpl:async(url,options)=>{
        calls++;assert.equal(url,'https://auth.example.invalid/auth/v1/user');assert.equal(options.headers.Authorization,'Bearer '+token(2000));
        return{ok:true,json:async()=>({id:'account-user'})};
    }}),socket={};
    assert.deepEqual(await Promise.all([auth.authorize(socket,token(2000)),auth.authorize(socket,token(2000))]),[true,true]);
    assert.equal(calls,1);assert.equal(socket.studioAuth.userId,'account-user');
    assert.equal(await auth.authorize(socket,token(2000)),true);assert.equal(calls,1);
    time+=61000;assert.equal(await auth.authorize(socket,token(2000)),true);assert.equal(calls,2);
    time=2000000;assert.equal(auth.isAuthorized(socket),false);assert.equal(await auth.authorize(socket,token(2000)),false);
});

test('Studio does not reuse another connection or token and fails closed on an Auth outage',async()=>{
    let calls=0;
    const auth=createStudioAuthenticator({url:'https://auth.example.invalid',anonKey:'public',now,fetchImpl:async()=>{calls++;if(calls>1)throw Error('offline');return{ok:true,json:async()=>({id:'user'})};}}),socket={};
    assert.equal(await auth.authorize(socket,token(2000)),true);
    assert.equal(await auth.authorize(socket,token(2000,'different')),false);
    assert.equal(await auth.authorize({},token(2000)),false);
});
