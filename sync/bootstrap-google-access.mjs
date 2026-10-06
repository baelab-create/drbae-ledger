// One-time provisioning through the existing ledger's Firebase service connection.
// Logs contain status only. No token, password or service-account value is printed.
import admin from 'firebase-admin';
import {readFile} from 'node:fs/promises';
const project='baelab-ledger';
const expectedEmail='baewongyu@gmail.com';
const secret=process.env.CHAT_HISTORY_UNLOCK_SECRET;
const account=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT||'{}');
if(account.project_id!==project)throw Error('Unexpected Firebase project');
const credential=admin.credential.cert(account);
admin.initializeApp({credential,projectId:project});
const {access_token}=await credential.getAccessToken();
async function api(url){
 const r=await fetch(url,{headers:{Authorization:'Bearer '+access_token}});
 if(!r.ok)throw Error('Rules verification failed (HTTP '+r.status+')');
 return r.json();
}
const release=await api('https://firebaserules.googleapis.com/v1/projects/'+project+'/releases/cloud.firestore');
if(!release.rulesetName?.startsWith('projects/'+project+'/rulesets/'))throw Error('Unexpected ruleset');
const ruleset=await api('https://firebaserules.googleapis.com/v1/'+release.rulesetName);
const live=ruleset.source?.files?.find(f=>f.name==='firestore.rules')?.content||ruleset.source?.files?.[0]?.content;
const expected=await readFile(new URL('../firestore.rules',import.meta.url),'utf8');
const normalize=s=>s.replace(/\r/g,'').trim();
if(!live||normalize(live)!==normalize(expected))throw Error('Live rules differ from reviewed repository rules; no data written');
if(!live.includes(expectedEmail))throw Error('Owner restriction missing');
if(!secret){console.log('Preflight verified: existing service connection can read the deployed owner-only rules. No data written.');await admin.app().delete();process.exit(0)}
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
