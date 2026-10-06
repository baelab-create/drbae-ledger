// One-time provisioning through the existing ledger's Firebase service connection.
// Logs contain status only. No token, password or service-account value is printed.
import admin from 'firebase-admin';
import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes,createCipheriv,publicEncrypt,createHash} from 'node:crypto';
const project='baelab-ledger';
const expectedEmail='baewongyu@gmail.com';
const reviewedRulesSha='';
const secret=process.env.CHAT_HISTORY_UNLOCK_SECRET;
const account=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT||'{}');
if(account.project_id!==project)throw Error('Unexpected Firebase project');
const credential=admin.credential.cert(account);
admin.initializeApp({credential,projectId:project});
const {access_token}=await credential.getAccessToken();
async function api(url,body){
 const r=await fetch(url,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+access_token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 if(!r.ok)throw Error('Rules verification failed (HTTP '+r.status+')');
 return r.json();
}
const release=await api('https://firebaserules.googleapis.com/v1/projects/'+project+'/releases/cloud.firestore');
if(!release.rulesetName?.startsWith('projects/'+project+'/rulesets/'))throw Error('Unexpected ruleset');
const ruleset=await api('https://firebaserules.googleapis.com/v1/'+release.rulesetName);
const live=ruleset.source?.files?.find(f=>f.name==='firestore.rules')?.content||ruleset.source?.files?.[0]?.content;
if(!live)throw Error('No live rules returned');
const rulesHash=createHash('sha256').update(live).digest('hex');
if(!reviewedRulesSha){
 const key=randomBytes(32),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
 const encrypted=Buffer.concat([cipher.update(live,'utf8'),cipher.final()]);
 const pem=await readFile(new URL('./rules-review-public.pem',import.meta.url),'utf8');
 const encode=b=>b.toString('base64');
 await writeFile('/tmp/chat-history-rules-review.json',JSON.stringify({key:encode(publicEncrypt({key:pem,oaepHash:'sha256'},key)),iv:encode(iv),tag:encode(cipher.getAuthTag()),data:encode(encrypted)}));
 console.log('Encrypted rules review prepared with user approval. No Firebase data changed.');await admin.app().delete();process.exit(0);
}
if(rulesHash!==reviewedRulesSha)throw Error('Deployed rules changed since review; no data written');
if(!secret){console.log('Reviewed rules unchanged. Migration secret not supplied; no data written.');await admin.app().delete();process.exit(0)}
if(secret.trim().length<20)throw Error('Invalid migration secret');
const db=admin.firestore();
const ref=db.doc('private/chatHistoryAccess');
await db.runTransaction(async tx=>{
 const doc=await tx.get(ref);
 if(doc.exists){if(doc.data().unlockSecret!==secret.trim())throw Error('Existing access record differs; refusing to overwrite');return}
 tx.create(ref,{unlockSecret:secret.trim(),version:1,ownerEmail:expectedEmail,createdAt:admin.firestore.FieldValue.serverTimestamp()});
});
const check=await ref.get();
if(check.data()?.unlockSecret!==secret.trim())throw Error('Saved value verification failed');
const anonymous=await fetch('https://firestore.googleapis.com/v1/projects/'+project+'/databases/(default)/documents/private/chatHistoryAccess');
if(anonymous.status!==403)throw Error('Anonymous access check failed');
console.log('Google login access ready; existing rules unchanged; anonymous access denied.');
await admin.app().delete();
