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
// 쓰기 묶음: 400건씩 나눠 커밋 (Firestore 배치 한도 500)
async function commitOps(ops) {
  for (let i = 0; i < ops.length; i += 400) {
    const b = db.batch();
    ops.slice(i, i + 400).forEach(f => f(b));
    await b.commit();
  }
  return ops.length;
}

const mref = db.collection('private').doc('mapdata');
const mdoc = await mref.get();
if (!mdoc.exists) { console.error('private/mapdata가 없습니다. 발송 데이터가 아직 게시되지 않았습니다.'); process.exit(1); }
let text = '';
for (let i = 0; i < (mdoc.data().chunks || 0); i++) {
  const c = await mref.collection('chunks').doc(String(i)).get();
  if (!c.exists) { console.error(`발송 데이터 조각 ${i}번이 없습니다 (게시 중이거나 손상). 아무것도 바꾸지 않고 멈춥니다.`); process.exit(1); }
  text += c.data().t;
}
const rows = C.parseCSV(text);
console.log('발송 데이터 게시 시각', mdoc.data().at);
console.log('발송 행', rows.length);
const prevSync = await db.collection('private').doc('sync').get();
const rowsBad = C.rowsProblem(rows.length, prevSync.exists ? (+prevSync.data().rows || 0) : 0);
if (rowsBad) console.error('⚠ 주문 동기화 중단: ' + rowsBad + '. 주문은 그대로 두고 수료·태그·묶음 현황만 갱신합니다. 발송 데이터 게시를 확인하세요.');

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
  const ops = [];
  for (const ms of masters) {
    if (!ms.partner || ms.mergedInto || ms.status === 'excluded') continue;
    const L = led[ms.partner.ledgerKey]; if (!L) continue;
    const sh = L.shops.find(x => x.id === ms.partner.shopId); if (!sh) continue;
    const want = ms.cert ? { last: ms.cert.last || '', count: ms.cert.count || 1, name: ms.cert.name || '', masterId: ms.id } : null;
    const cur = sh.cert || null;
    const same = !want ? !cur : !!cur && cur.last === want.last && cur.count === want.count && (cur.name || '') === want.name && cur.masterId === want.masterId;
    if (!same) ops.push(b => b.update(db.collection('ledgers').doc(ms.partner.ledgerKey).collection('shops').doc(sh.id), { cert: want }));
  }
  console.log('수료 정보 갱신', await commitOps(ops), '건');
}
// 파트너가 관리대장에서 누른 '마이크로젝션 납품점 · 멘토링 완료'(거래처 mjEdu) → 거래처 마스터 partnerEdu.
// 분류기(drbae-map mj_program)가 이것으로 납품점을 정하고, 발송 명세서가 '납품점 · 멘토링 완료'로 표시한다. 취소하면 null.
{
  const ops = [];
  for (const ms of masters) {
    if (!ms.partner || ms.mergedInto || ms.status === 'excluded') continue;
    const L = led[ms.partner.ledgerKey]; if (!L) continue;
    const sh = L.shops.find(x => x.id === ms.partner.shopId); if (!sh) continue;
    const want = sh.mjEdu && sh.mjEdu.date ? { date: sh.mjEdu.date, partner: ms.partner.partnerName || '', ledgerKey: ms.partner.ledgerKey, shopId: sh.id } : null;
    const cur = ms.partnerEdu || null, same = (!cur && !want) || (cur && want && cur.date === want.date && cur.partner === want.partner && cur.ledgerKey === want.ledgerKey && cur.shopId === want.shopId);
    if (!same) ops.push(b => b.set(db.collection('shop_master').doc(ms.id), { partnerEdu: want }, { merge: true }));
  }
  console.log('파트너 멘토링 완료 반영', await commitOps(ops), '건');
}
// 사용 구분 태그(useTag) 복사 — 본사 분류기(drbae-map mj_program)가 거래처 마스터에 정한 값.
// 스킨부스터만 사용 / 마이크로젝션 납품점(피부·두피) / 마이크로젝션 전문점(피부·두피). 주문 전 MICRO BLACK 은 mj_sites 의 ledger 링크로
{
  const want = new Map();
  for (const ms of masters) {
    if (!ms.partner || ms.mergedInto || ms.status === 'excluded' || !ms.useTag) continue;
    want.set(ms.partner.ledgerKey + '/' + ms.partner.shopId, ms.useTag);
  }
  for (const d of (await db.collection('mj_sites').get()).docs) {
    const x = d.data(); if (x.masterId || !x.ledger || !x.tag) continue;
    const k = x.ledger.ledgerKey + '/' + x.ledger.shopId; if (!want.has(k)) want.set(k, x.tag);
  }
  const ops = [];
  for (const [key, L] of Object.entries(led)) for (const sh of L.shops) {
    const w = want.get(key + '/' + sh.id) || null;
    if (C.stable(sh.useTag || null) !== C.stable(w)) ops.push(b => b.update(db.collection('ledgers').doc(key).collection('shops').doc(sh.id), { useTag: w }));
  }
  console.log('사용 구분 태그 갱신', await commitOps(ops), '건');
}

let writes = 0, dels = 0;
if (!rowsBad) {
  const m = C.syncPlan(rows, shops, link);
  console.log('매칭 주문', m.orders.length, '미매칭 발송처', m.unmatched.length, '충돌', m.conflicts.length, '본사 확인 대기', m.pending.length);
  await commitOps(m.newPending.map(np => b => b.update(db.collection('ledgers').doc(np.ledgerKey).collection('shops').doc(np.id), { pendingTransfer: true })));

  const byKey = {};
  m.orders.forEach(o => (byKey[o.ledgerKey] = byKey[o.ledgerKey] || []).push(o));
  for (const p of partners) {
    const L = led[p.key];
    const want = byKey[p.key] || [];
    const have = Object.fromEntries(L.orders.map(o => [o.id, o]));
    const ops = [];
    const ref = db.collection('ledgers').doc(p.key).collection('orders');
    for (const o of want) {
      const e = have[o.id];
      const doc = sub(o);
      if (!e || JSON.stringify(sub(e)) !== JSON.stringify(doc)) { ops.push(b => b.set(ref.doc(o.id), doc)); writes++; }
      delete have[o.id];
    }
    for (const id of Object.keys(have)) { ops.push(b => b.delete(ref.doc(id))); dels++; }
    await commitOps(ops);
  }
  const at = kstStamp();
  const pname = Object.fromEntries(partners.map(p => [p.key, p.name]));
  await db.collection('private').doc('sync').set({
    at, by: '자동', rows: rows.length, matched: m.orders.length,
    unmatchedCount: m.unmatched.length, conflicts: m.conflicts,
    pending: m.pending.map(p => ({ partner: pname[p.ledgerKey] || '', ...p })), halted: null
  }, { merge: true });
  // 공개 문서에는 시각만 둔다 (파트너 화면 상단 표시용). 상세는 private/sync에만.
  await db.collection('meta').doc('sync').set({ at, by: '자동' });
} else {
  await db.collection('private').doc('sync').set({ halted: { at: kstStamp(), why: rowsBad, rows: rows.length } }, { merge: true });
}
// 묶음 조회 링크(여러 파트너를 한 화면에서 보는 조회 전용 대시보드)의 복사본 갱신.
// ledgers/{묶음키}/orders/{파트너ID} 는 규칙상 본사만 쓸 수 있어 조회자가 고칠 수 없다. 내용(at 제외)이 같으면 쓰지 않는다.
{
  const all = (await db.collection('partners').get()).docs.map(d => ({ id: d.id, ...d.data() }));
  const groups = all.filter(g => g.group && g.key && g.active !== false);
  const ymOf = d => String(d || '').slice(0, 7);
  const now = new Date(Date.now() + 9 * 3600 * 1000); now.setUTCMonth(now.getUTCMonth() - 12);
  const from = now.toISOString().slice(0, 7);
  const noAt = x => { const { at, ...rest } = x || {}; return C.stable(rest); };
  for (const g of groups) {
    const gref = db.collection('ledgers').doc(g.key).collection('orders');
    const ids = g.members || [];
    const cur = Object.fromEntries((await gref.get()).docs.map(d => [d.id, d.data()]));
    let wrote = 0;
    for (const pid of ids) {
      const mp = all.find(x => x.id === pid); if (!mp || !mp.key || mp.group) continue;
      const ref = db.collection('ledgers').doc(mp.key);
      const [s, a, o] = await Promise.all([ref.collection('shops').get(), ref.collection('acts').get(), ref.collection('orders').get()]);
      const snap = {
        kind: 'snap', partnerId: mp.id, partner: mp.name, order: mp.order || 0,
        shops: s.docs.map(d => { const x = d.data(); return { id: d.id, name: x.name || '', owner: x.owner || '', addr: x.addr || '', regDate: x.regDate || '', createdAt: x.createdAt || '', status: x.status || '정상', edu: x.edu || null, cert: x.cert || null, useTag: x.useTag || null }; }),
        acts: a.docs.map(d => d.data()).filter(x => ymOf(x.date) >= from).map(x => ({ shopId: x.shopId || '', date: x.date || '', method: x.method || '', attempt: !!x.attempt, auto: !!x.auto, note: String(x.note || '').slice(0, 300) })),
        orders: o.docs.map(d => d.data()).filter(x => ymOf(x.date) >= from).map(x => ({ shopId: x.shopId || '', date: x.date || '', amount: +x.amount || 0, qty: +x.qty || 0, product: x.product || '', option: x.option || '' }))
      };
      if (cur[pid] && noAt(cur[pid]) === noAt(snap)) continue;
      await gref.doc(pid).set({ ...snap, at: kstStamp() }); wrote++;
    }
    for (const id of Object.keys(cur)) if (!ids.includes(id)) await gref.doc(id).delete();
    console.log('묶음 현황:', g.name, ids.length, '곳 · 갱신', wrote);
  }
}
console.log('저장', writes, '삭제', dels, '완료', kstStamp());
if (rowsBad) process.exitCode = 1;   // 실행 실패로 표시 → GitHub 알림
