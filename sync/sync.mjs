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

const partners = (await db.collection('partners').get()).docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.key && p.active !== false && !p.demo && !p.group);   // 샘플(교육용) 파트너는 동기화 제외
const shops = [];
const led = {};
for (const p of partners) {
  const ref = db.collection('ledgers').doc(p.key);
  const [s, o] = await Promise.all([ref.collection('shops').get(), ref.collection('orders').get()]);
  led[p.key] = { shops: s.docs.map(d => ({ id: d.id, ...d.data() })), orders: o.docs.map(d => ({ id: d.id, ...d.data() })) };
  led[p.key].shops.forEach(x => shops.push({ ...x, ledgerKey: p.key, partner: p.name }));
}
console.log('파트너', partners.length, '거래처', shops.length);

// 거래처 마스터(shop_master) — 컨트롤 타워가 정한 거래처ID → 파트너 거래처 연결. 없으면 예전 이름·주소 매칭
const masters = (await db.collection('shop_master').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const link = C.masterLink(masters);
console.log('거래처 마스터', masters.length, '곳 · 파트너 연결', Object.keys(link).length);

// 마이크로젝션 수료 정보(마스터 cert)를 파트너 거래처 문서에 복사 — 파트너 화면 표시용 (파트너는 읽기만)
{
  const b = db.batch(); let n = 0;
  for (const ms of masters) {
    if (!ms.partner || ms.mergedInto || ms.status === 'excluded') continue;
    const L = led[ms.partner.ledgerKey]; if (!L) continue;
    const sh = L.shops.find(x => x.id === ms.partner.shopId); if (!sh) continue;
    const want = ms.cert ? { last: ms.cert.last, count: ms.cert.count, name: ms.cert.name || '', masterId: ms.id } : null;
    if (JSON.stringify(sh.cert || null) !== JSON.stringify(want)) { b.update(db.collection('ledgers').doc(ms.partner.ledgerKey).collection('shops').doc(sh.id), { cert: want }); n++; }
  }
  if (n) await b.commit();
  console.log('수료 정보 갱신', n, '건');
}

const m = C.syncPlan(rows, shops, link);
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
// 묶음 조회 링크(여러 파트너를 한 화면에서 보는 조회 전용 대시보드)의 복사본 갱신.
// ledgers/{묶음키}/orders/{파트너ID} 는 규칙상 본사만 쓸 수 있어 조회자가 고칠 수 없다.
{
  const all = (await db.collection('partners').get()).docs.map(d => ({ id: d.id, ...d.data() }));
  const groups = all.filter(g => g.group && g.key && g.active !== false);
  const ymOf = d => String(d || '').slice(0, 7);
  const now = new Date(Date.now() + 9 * 3600 * 1000); now.setUTCMonth(now.getUTCMonth() - 12);
  const from = now.toISOString().slice(0, 7);
  for (const g of groups) {
    const gref = db.collection('ledgers').doc(g.key).collection('orders');
    const ids = g.members || [];
    for (const pid of ids) {
      const mp = all.find(x => x.id === pid); if (!mp || !mp.key || mp.group) continue;
      const ref = db.collection('ledgers').doc(mp.key);
      const [s, a, o] = await Promise.all([ref.collection('shops').get(), ref.collection('acts').get(), ref.collection('orders').get()]);
      await gref.doc(pid).set({
        kind: 'snap', partnerId: mp.id, partner: mp.name, order: mp.order || 0, at: kstStamp(),
        shops: s.docs.map(d => { const x = d.data(); return { id: d.id, name: x.name || '', owner: x.owner || '', addr: x.addr || '', regDate: x.regDate || '', createdAt: x.createdAt || '', status: x.status || '정상', edu: x.edu || null, cert: x.cert || null }; }),
        acts: a.docs.map(d => d.data()).filter(x => ymOf(x.date) >= from).map(x => ({ shopId: x.shopId || '', date: x.date || '', method: x.method || '', attempt: !!x.attempt, auto: !!x.auto, note: String(x.note || '').slice(0, 300) })),
        orders: o.docs.map(d => d.data()).filter(x => ymOf(x.date) >= from).map(x => ({ shopId: x.shopId || '', date: x.date || '', amount: +x.amount || 0, qty: +x.qty || 0, product: x.product || '', option: x.option || '' }))
      });
    }
    for (const d of (await gref.get()).docs) if (!ids.includes(d.id)) await d.ref.delete();
    console.log('묶음 현황 갱신:', g.name, ids.length, '곳');
  }
}
console.log('저장', writes, '삭제', dels, '완료', kstStamp());
