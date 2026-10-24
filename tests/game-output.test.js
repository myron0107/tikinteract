import test from 'node:test';
import assert from 'node:assert/strict';
import {createOutputIdentity,outputLink,parseOutputLink,sealSignal,openSignal} from '../assets/game-output-protocol.js';
test('Game output URLs contain only playback capabilities, and signed handshakes cannot be forged by viewers',async()=>{
 const publisher=await createOutputIdentity(),link=outputLink(publisher,'portrait','https://example.invalid'),viewer=parseOutputLink(new URL(link).hash);
 assert.equal(viewer.privateKey,undefined);assert.equal(viewer.publicKey.d,undefined);assert.equal(new URL(link).searchParams.get('format'),'portrait');
 const answer={type:'answer',id:crypto.randomUUID(),sdp:'fixture SDP',at:Date.now()},packet=await sealSignal(answer,publisher,true);
 assert(!JSON.stringify(packet).includes('fixture SDP'));
 assert.deepEqual(await openSignal(packet,viewer,true),answer);
 const forged=await sealSignal(answer,viewer);await assert.rejects(openSignal(forged,viewer,true),/OUTPUT_INVALID_SIGNATURE/);
 await assert.rejects(openSignal(packet,await createOutputIdentity(),true));
 await assert.rejects(openSignal(await sealSignal({...answer,at:Date.now()-60000},publisher,true),viewer,true),/OUTPUT_EXPIRED_SIGNAL/);
 const changed=structuredClone(packet);changed.data=(changed.data[0]==='A'?'B':'A')+changed.data.slice(1);await assert.rejects(openSignal(changed,viewer,true));
});
test('Output validates links and accepts only encrypted fresh viewer signaling',async()=>{
 const identity=await createOutputIdentity(),viewer=parseOutputLink(new URL(outputLink(identity,'landscape','https://example.invalid')).hash);
 const offer={type:'offer',id:crypto.randomUUID(),sdp:'viewer recvonly',at:Date.now()};
 assert.deepEqual(await openSignal(await sealSignal(offer,viewer),identity),offer);
 assert.throws(()=>parseOutputLink('#invalid'));assert.throws(()=>parseOutputLink('#'+'x'.repeat(2001)));
 await assert.rejects(openSignal({iv:'invalid',data:'x'},identity),/OUTPUT_INVALID_SIGNAL/);
});
