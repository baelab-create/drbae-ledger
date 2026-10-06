// One-time provisioning through the existing ledger's Firebase service connection.
// Logs contain status only. No token, password or service-account value is printed.
import admin from 'firebase-admin';
const project='baelab-ledger';
const expectedEmail='baewongyu@gmail.com';
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
// Evaluate the deployed rules inside Firebase without exporting their source.
// These are synthetic rules tests; no user/account/token or document is created.
const cases=[];
for(const [name,email,verified] of [['owner',expectedEmail,true],['other','test-outsider@example.invalid',true],['unverified',expectedEmail,false],['anonymous',null,false]]){
 for(const method of ['get','list','create','update','delete']){
  cases.push({expectation:name==='owner'?'ALLOW':'DENY',request:{path:'/databases/(default)/documents/private/chatHistoryAccess',method,auth:email?{uid:'synthetic-'+name,token:{email,email_verified:verified,firebase:{sign_in_provider:'google.com'}}}:null,resource:{data:{version:1}}},resource:{data:{version:1}},expressionReportLevel:'NONE'});
 }
}
const tests=await api('https://firebaserules.googleapis.com/v1/projects/'+project+':test',{source:ruleset.source,testSuite:{testCases:cases}});
if(tests.issues?.some(i=>i.severity==='ERROR')||tests.testResults?.length!==cases.length||tests.testResults.some(t=>t.state!=='SUCCESS'))throw Error('Deployed access checks failed; no data written (states: '+(tests.testResults||[]).map(t=>t.state).join(',')+')');
if(!secret){console.log('Preflight verified: all 20 owner/anonymous/other/unverified access tests passed. No data written and no rules exported.');await admin.app().delete();process.exit(0)}
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
