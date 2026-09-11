/* 배랩 관리대장 공통 로직 — 브라우저(파트너·본사 화면)와 Node(동기화)에서 함께 사용 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LedgerCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FIREBASE_CONFIG = {
    apiKey: "AIzaSyBXE4UNgFmlnfQ5TkpR6h4DIKE2rjbI0_Q",
    authDomain: "baelab-ledger.firebaseapp.com",
    projectId: "baelab-ledger",
    storageBucket: "baelab-ledger.firebasestorage.app",
    messagingSenderId: "301215647344",
    appId: "1:301215647344:web:9026cd464a9403629516b5"
  };
  var OWNER_EMAILS = ['baewongyu@gmail.com'];
  var SITE_BASE = 'https://baelab-create.github.io/drbae-ledger/';
  var CSV_URL = 'https://raw.githubusercontent.com/baelab-create/drbae-map/main/data.csv';
  var METHODS = ['전화', '카톡', '문자', '대면'];
  var NO_ORDER_DAYS = 90;

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function nowStamp() { var d = new Date(); return today() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function ym(s) { return s ? String(s).slice(0, 7) : ''; }
  function addMonths(m, n) { var y = +m.slice(0, 4), mo = +m.slice(5, 7) - 1 + n; y += Math.floor(mo / 12); mo = ((mo % 12) + 12) % 12; return y + '-' + pad(mo + 1); }
  function daysAgo(dateStr) {
    if (!dateStr) return Infinity;
    var d = new Date(String(dateStr).slice(0, 10) + 'T00:00:00');
    if (isNaN(d.getTime())) return Infinity;
    var t = new Date(today() + 'T00:00:00');
    return Math.floor((t - d) / 86400000);
  }
  /* 밀리초 → 한국 날짜 문자열 (실행 환경의 시간대와 무관) */
  function kstDate(ms) {
    var d = new Date(ms + 9 * 3600 * 1000);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function won(n) { n = Math.round(+n || 0); return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  /* ── 정규화 키 ── */
  function nameKey(s) {
    if (!s) return '';
    return String(s).toLowerCase()
      .replace(/\(.*?\)/g, '')
      .replace(/[^0-9a-z가-힣]/g, '');
  }
  function addrKey(s) {
    if (!s) return '';
    var t = String(s).replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim();
    var toks = t.split(' ');
    var out = [];
    for (var i = 0; i < toks.length; i++) {
      out.push(toks[i]);
      // 도로명 + 건물번호까지 잡히면 거기서 자름 (예: 안산천남1로 70)
      if (i > 0 && /^\d+(-\d+)?$/.test(toks[i]) && /(로|길)\d*$/.test(toks[i - 1])) break;
      // "안산천남1로70" 처럼 붙어 쓴 경우
      if (/(로|길)\d*\s*\d+(-\d+)?$/.test(toks[i]) && /\d$/.test(toks[i])) break;
      if (out.length >= 6) break;
    }
    return out.join('').replace(/[^0-9a-z가-힣]/gi, '').toLowerCase()
      .replace(/^(서울특별시|서울시|서울|부산광역시|부산시|부산|대구광역시|대구시|대구|인천광역시|인천시|인천|광주광역시|광주시|광주|대전광역시|대전시|대전|울산광역시|울산시|울산|세종특별자치시|세종시|세종|경기도|경기|강원특별자치도|강원도|강원|충청북도|충북|충청남도|충남|전라북도|전북특별자치도|전북|전라남도|전남|경상북도|경북|경상남도|경남|제주특별자치도|제주도|제주)/, '');
  }
  function addrMatch(a, b) {
    if (!a || !b) return false;
    if (a.length < 8 || b.length < 8) return false;
    return a === b || a.slice(-b.length) === b && b.length >= 10 || b.slice(-a.length) === a && a.length >= 10;
  }

  /* ── 이행 판정 ──
     m: 'YYYY-MM', shop: {regDate,status}, acts: 그 거래처의 활동 배열
     결과: na(대상 아님) | init(등록 달) | hit(소통 완료) | try(시도 2회) | miss(미이행) */
  function judge(shop, m, acts) {
    if (!shop || shop.status === '제외') return 'na';
    var r = ym(shop.regDate || shop.createdAt);
    if (!r || m < r) return 'na';
    var d = 0, t = 0;
    for (var i = 0; i < acts.length; i++) {
      var a = acts[i];
      if (a.shopId !== shop.id || ym(a.date) !== m) continue;
      if (a.attempt) t++; else d++;
    }
    if (d >= 1) return m === r ? 'init' : 'hit';
    if (m === r) return 'init';
    if (d + t >= 2) return 'try';
    return 'miss';
  }
  var LBL = { hit: '소통 완료', try: '시도 2회', init: '등록 달', miss: '미이행', na: '대상 아님' };
  var CLS = { hit: 'ok', try: 'ok', init: 'ok', miss: 'crit', na: 'idle' };
  function isDone(v) { return v === 'hit' || v === 'try' || v === 'init'; }

  /* 주문 요약: shop별 최근 주문일·이번 달 금액·최근 N개월 */
  function orderStats(shopId, orders, m) {
    var last = '', mAmt = 0, mCnt = 0, total12 = 0, cnt12 = 0;
    var from12 = addMonths(m, -11);
    for (var i = 0; i < orders.length; i++) {
      var o = orders[i]; if (o.shopId !== shopId) continue;
      var d = String(o.date || '').slice(0, 10);
      if (d > last) last = d;
      if (ym(d) === m) { mAmt += +o.amount || 0; mCnt++; }
      if (ym(d) >= from12 && ym(d) <= m) { total12 += +o.amount || 0; cnt12++; }
    }
    return { last: last, mAmt: mAmt, mCnt: mCnt, total12: total12, cnt12: cnt12 };
  }
  /* 3개월 무주문(주요 관리 대상) 여부 */
  function noOrderFlag(shop, stats) {
    if (shop.status === '제외') return false;
    if (stats.last) return daysAgo(stats.last) > NO_ORDER_DAYS;
    return daysAgo(shop.regDate || shop.createdAt) > NO_ORDER_DAYS;
  }

  /* ── CSV ── */
  function parseCSV(text) {
    text = String(text).replace(/^﻿/, '');
    var rows = [], row = [], cur = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (c === '\r') { }
      else cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    if (!rows.length) return [];
    var h = rows[0];
    return rows.slice(1).filter(function (r) { return r.length > 1; }).map(function (r) {
      var o = {}; for (var j = 0; j < h.length; j++) o[h[j]] = r[j] == null ? '' : r[j]; return o;
    });
  }
  function toCSV(rows) {
    return '﻿' + rows.map(function (r) {
      return r.map(function (c) { c = c == null ? '' : String(c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(',');
    }).join('\r\n');
  }

  /* ── 주문 매칭 ──
     rows: data.csv 행, shops: [{id, ledgerKey, name, addr, owner, aliases[], createdAt}]
     반환: {orders:[{ledgerKey, shopId, ...}], unmatched:[{name, addr, count, last, amount}], conflicts:[...]} */
  function extractOptionShop(opt) {
    var m = /샵\s*상호명\s*[:：]\s*([^\/|]+)/.exec(opt || '');
    return m ? m[1].trim() : '';
  }
  function hashId(s) {
    var h1 = 0x811c9dc5, h2 = 0x01000193;
    for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 + c, 2246822519) >>> 0; }
    return ('00000000' + h1.toString(16)).slice(-8) + ('00000000' + h2.toString(16)).slice(-8);
  }
  function matchOrders(rows, shops) {
    var byName = {}, addrList = [];
    shops.forEach(function (s) {
      if (s.status === '제외') return;
      var keys = [nameKey(s.name)].concat((s.aliases || []).map(nameKey)).filter(Boolean);
      keys.forEach(function (k) { (byName[k] = byName[k] || []).push(s); });
      var ak = addrKey(s.addr); if (ak) addrList.push({ k: ak, s: s });
    });
    function pick(cands) {
      if (!cands.length) return null;
      var uniq = []; cands.forEach(function (s) { if (uniq.indexOf(s) < 0) uniq.push(s); });
      uniq.sort(function (a, b) { return String(a.createdAt || '') < String(b.createdAt || '') ? -1 : 1; });
      return { shop: uniq[0], conflict: uniq.length > 1 ? uniq : null };
    }
    var orders = [], conflicts = {}, unmatched = {}, prior = {};
    rows.forEach(function (r) {
      if (r['구분'] && r['구분'] !== '주문') return;
      var rep = r['대표샵명'] || '', shopOpt = extractOptionShop(r['옵션정보']), recv = r['수취인명'] || '';
      var addr = r['통합배송지'] || '';
      var cands = [];
      [rep, shopOpt, recv].forEach(function (n) { var k = nameKey(n); if (k && byName[k]) cands = cands.concat(byName[k]); });
      if (!cands.length) {
        var ak = addrKey(addr);
        addrList.forEach(function (e) { if (addrMatch(e.k, ak)) cands.push(e.s); });
      }
      var res = pick(cands);
      var date = String(r['발송일'] || '').slice(0, 10);
      var amount = +String(r['최종 상품별 총 주문금액'] || '0').replace(/[^0-9.-]/g, '') || 0;
      if (!res) {
        var b2b = !!shopOpt || (rep && recv && nameKey(rep) !== nameKey(recv));
        if (b2b) {
          var u = unmatched[rep] = unmatched[rep] || { name: rep, addr: addr, count: 0, last: '', amount: 0, opt: shopOpt };
          u.count++; u.amount += amount; if (date > u.last) { u.last = date; u.addr = addr; }
        }
        return;
      }
      if (res.conflict) conflicts[res.conflict.map(function (s) { return s.id; }).join('+')] = res.conflict;
      var s = res.shop;
      // 등록(관리 시작) 전 주문은 본사 정보이므로 파트너 대장에 넣지 않고 집계만 한다
      if (s.cutoff && date && date < s.cutoff) {
        var pk = s.ledgerKey + '/' + s.id;
        var pr = prior[pk] = prior[pk] || { ledgerKey: s.ledgerKey, shopId: s.id, name: s.name, count: 0, amount: 0, first: '', last: '' };
        pr.count++; pr.amount += amount; if (!pr.first || date < pr.first) pr.first = date; if (date > pr.last) pr.last = date;
        return;
      }
      // 본사 확인 대기 중(기존 본사 거래처를 파트너가 등록)인 거래처에는 주문을 넣지 않는다
      if (s.blockOrders) return;
      var oid = hashId([r['주문번호'], r['상품명'], r['옵션정보'], r['수량'], r['발송일']].join('|'));
      orders.push({ id: oid, ledgerKey: s.ledgerKey, shopId: s.id, orderNo: r['주문번호'] || '', date: date, datetime: r['발송일'] || '',
        product: r['상품명'] || '', option: r['옵션정보'] || '', qty: +r['수량'] || 0, amount: amount, repName: rep, recv: recv, addr: addr });
    });
    var un = Object.keys(unmatched).map(function (k) { return unmatched[k]; }).sort(function (a, b) { return a.last < b.last ? 1 : -1; });
    var cf = Object.keys(conflicts).map(function (k) { return conflicts[k].map(function (s) { return { id: s.id, name: s.name, ledgerKey: s.ledgerKey }; }); });
    var pl = Object.keys(prior).map(function (k) { return prior[k]; });
    return { orders: orders, unmatched: un, conflicts: cf, prior: pl };
  }

  /* 거래처의 관리 시작일(컷오프). 서버가 찍은 createdAtTs를 우선 사용 → 파트너가 조작 불가 */
  function shopCutoff(s) {
    var ts = s.createdAtTs, ms = null;
    if (ts && typeof ts.toMillis === 'function') ms = ts.toMillis();
    else if (ts && typeof ts.seconds === 'number') ms = ts.seconds * 1000;
    else if (ts && typeof ts._seconds === 'number') ms = ts._seconds * 1000;
    if (ms) return kstDate(ms);
    return String(s.regDate || s.createdAt || '').slice(0, 10);
  }
  /* 동기화 계획: 1차 매칭으로 등록 전 주문이 있는 거래처(기존 본사 거래처)를 찾아 보류시키고, 2차 매칭으로 최종 주문을 정한다 */
  function syncPlan(rows, shops) {
    shops.forEach(function (s) { s.cutoff = shopCutoff(s); s.blockOrders = !!(s.pendingTransfer && !s.transferOk); });
    var r1 = matchOrders(rows, shops);
    var byKey = {}; shops.forEach(function (s) { byKey[s.ledgerKey + '/' + s.id] = s; });
    var newPending = [];
    r1.prior.forEach(function (p) {
      var s = byKey[p.ledgerKey + '/' + p.shopId]; if (!s || s.status === '제외' || s.transferOk) return;
      if (!s.pendingTransfer) newPending.push({ ledgerKey: s.ledgerKey, id: s.id });
      s.blockOrders = true;
    });
    var r2 = newPending.length ? matchOrders(rows, shops) : r1;
    var pending = r1.prior.filter(function (p) { var s = byKey[p.ledgerKey + '/' + p.shopId]; return s && s.blockOrders && s.status !== '제외'; });
    return { orders: r2.orders, unmatched: r2.unmatched, conflicts: r2.conflicts, prior: r1.prior, pending: pending, newPending: newPending };
  }

  function randomKey(n) {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789', out = '';
    var arr = new Uint8Array(n || 28);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(arr);
    else for (var i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
    for (var j = 0; j < arr.length; j++) out += chars[arr[j] % chars.length];
    return out;
  }

  return {
    FIREBASE_CONFIG: FIREBASE_CONFIG, OWNER_EMAILS: OWNER_EMAILS, SITE_BASE: SITE_BASE, CSV_URL: CSV_URL,
    METHODS: METHODS, NO_ORDER_DAYS: NO_ORDER_DAYS,
    pad: pad, today: today, kstDate: kstDate, nowStamp: nowStamp, ym: ym, addMonths: addMonths, daysAgo: daysAgo, uid: uid, esc: esc, won: won,
    nameKey: nameKey, addrKey: addrKey, addrMatch: addrMatch,
    judge: judge, LBL: LBL, CLS: CLS, isDone: isDone, orderStats: orderStats, noOrderFlag: noOrderFlag,
    parseCSV: parseCSV, toCSV: toCSV, matchOrders: matchOrders, shopCutoff: shopCutoff, syncPlan: syncPlan, extractOptionShop: extractOptionShop, randomKey: randomKey
  };
});
