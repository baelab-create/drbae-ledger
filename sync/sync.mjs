// 자동 주문 동기화 — GitHub Actions에서 실행
// drbae-map/data.csv → 파트너 거래처와 대조 → 각 파트너 대장의 orders 컬렉션 갱신
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const C = require('../shared/core.js');

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (!sa.project_id) { console.error('FIREBASE_SERVICE_ACCOUNT 비밀값이 없습니다.'); process.exit(1); }
initializeApp({ credential: cert(sa) });
const db = getFirestore();

function kstStamp() {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  const p = n => (n < 10 ? '0' : '') + n;
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
const sub = o => ({ shopId: o.shopId, orderNo: o.orderNo, date: o.date, datetime: o.datetime, product: o.product, option: o.option, qty: o.qty, amount: o.amount, repName: o.repName, recv: o.recv, addr: o.addr });

const mref = db.collection('private').doc('mapdata');
const mdoc = await mref.get();
if (!mdoc.exists) { console.error('private/mapdata가 없습니다. 발송 데이터가 아직 게시되지 않았습니다.'); process.exit(1); }
let text = '';
for (let i = 0; i < (mdoc.data().chunks || 0); i++) { const c = await mref.collection('chunks').doc(String(i)).get(); text += c.exists ? c.data().t : ''; }
const rows = C.parseCSV(text);
console.log('발송 데이터 게시 시각', mdoc.data().at);
console.log('발송 행', rows.length);

const partners = (await db.collection('partners').get()).docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.key && p.active !== false && !p.demo);   // 샘플(교육용) 파트너는 동기화 제외
const shops = [];
const led = {};
for (const p of partners) {
  const ref = db.collection('ledgers').doc(p.key);
  const [s, o] = await Promise.all([ref.collection('shops').get(), ref.collection('orders').get()]);
  led[p.key] = { shops: s.docs.map(d => ({ id: d.id, ...d.data() })), orders: o.docs.map(d => ({ id: d.id, ...d.data() })) };
  led[p.key].shops.forEach(x => shops.push({ ...x, ledgerKey: p.key, partner: p.name }));
}
console.log('파트너', partners.length, '거래처', shops.length);

const m = C.syncPlan(rows, shops);
console.log('매칭 주문', m.orders.length, '미매칭 발송처', m.unmatched.length, '충돌', m.conflicts.length, '본사 확인 대기', m.pending.length);
if (m.newPending.length) {
  const b = db.batch();
  for (const np of m.newPending) b.update(db.collection('ledgers').doc(np.ledgerKey).collection('shops').doc(np.id), { pendingTransfer: true });
  await b.commit();
}

const byKey = {};
m.orders.forEach(o => (byKey[o.ledgerKey] = byKey[o.ledgerKey] || []).push(o));
let writes = 0, dels = 0;
for (const p of partners) {
  const L = led[p.key];
  const want = byKey[p.key] || [];
  const have = Object.fromEntries(L.orders.map(o => [o.id, o]));
  const ops = [];
  for (const o of want) {
    const e = have[o.id];
    const doc = sub(o);
    if (!e || JSON.stringify(sub(e)) !== JSON.stringify(doc)) ops.push({ t: 'set', id: o.id, d: doc });
    delete have[o.id];
  }
  for (const id of Object.keys(have)) ops.push({ t: 'del', id });
  const ref = db.collection('ledgers').doc(p.key).collection('orders');
  for (let i = 0; i < ops.length; i += 400) {
    const b = db.batch();
    for (const op of ops.slice(i, i + 400)) {
      if (op.t === 'set') { b.set(ref.doc(op.id), op.d); writes++; } else { b.delete(ref.doc(op.id)); dels++; }
    }
    await b.commit();
  }
}
const at = kstStamp();
const pname = Object.fromEntries(partners.map(p => [p.key, p.name]));
await db.collection('private').doc('sync').set({
  at, by: '자동', rows: rows.length, matched: m.orders.length,
  unmatchedCount: m.unmatched.length, conflicts: m.conflicts,
  pending: m.pending.map(p => ({ partner: pname[p.ledgerKey] || '', ...p }))
}, { merge: true });
// 공개 문서에는 시각만 둔다 (파트너 화면 상단 표시용). 상세는 private/sync에만.
await db.collection('meta').doc('sync').set({ at, by: '자동' });
console.log('저장', writes, '삭제', dels, '완료', kstStamp());
