/* ============================================================================
   닥터배 제품 SKU 분류 — 공유 규칙 (Single Source of Truth)
   ----------------------------------------------------------------------------
   이 파일이 유일한 원본입니다. 아래 두 프로그램이 같은 규칙을 씁니다.
     · 발송 명세서 포장 프로그램 : packing/…html 이 <script src>로 직접 로드
     · 납품처 분포 지도(drbae-map): publish_map_data.py 가 게시할 때 자동 주입
   ⚠ 제품·규칙을 바꿀 때는 반드시 이 파일만 고치세요.
      (한쪽에만 고쳐 두 프로그램의 분류가 어긋나던 사고가 2026-09-08에 있었습니다.)
   ============================================================================ */
/* ══════════════ 제품 SKU 분류 (닥터배 납품처 분포 앱과 동일 로직·팔레트 — 두 차트 색 구성 일치) ══════════════ */
const SKU_NAME = {
  EXO_BLUE:'엑소토카인 블루', PDRN:'피디로엔 핑크',
  LIQMASK:'엑소토카인 리퀴드 마스크', GEL500:'엑소토카인 에센스겔 500ml', GEL150:'엑소토카인 에센스겔 150ml',
  FIRM:'퍼밍크림 (장벽 크림)', CALM:'카밍 마스크 (크레이 팩)',
  EXO_BLACK:'엑소토카인 블랙', TOCO_LIQ:'토코포르테 (액상)', SCALP_B:'스칼프 부스터 500ml', SCALP_S:'스칼프 샴푸 500ml',
  HAIR_T:'헤어 토닉 500ml',
  CALCI:'칼리파우더', MJ:'마이크로젝션', DERMA:'더마커런트 세트', AIR:'에어스프레이', ADAPTER:'더블 어댑터',
  SUMMER_SET:'여름 피부열 관리 3종 세트', TEST_SKIN:'스킨부스터 5종 테스트', TEST_SCALP:'두피 테스트 구성',
  DEMO:'첫구매 데모 테스트', BANNER:'미니배너 세트 (홍보물)',
  SEMINAR:'오프라인 세미나', EDU:'교육 과정',
  SB_ETC:'스킨부스터 (구성 미표기)', BASE:'기타 (택배비·브로셔 등)',
  TOCO_BRN:'토코포르테 (액상)'   // 구버전 코드 호환용 별칭 (TOCO_LIQ로 통일됨)
};
const SKU_COLOR = {
  EXO_BLUE:'#2F80D0', PDRN:'#D34E86', CALCI:'#71747B',
  GEL500:'#A9763F', GEL150:'#C79A5B', LIQMASK:'#22355F', EXO_BLACK:'#111111',
  TOCO_LIQ:'#7A4A1E', MJ:'#E03131', DERMA:'#7048E8', AIR:'#4DABF7', ADAPTER:'#64748B',
  FIRM:'#2F9E44', CALM:'#82C91E', SCALP_B:'#B197FC', SCALP_S:'#FF8787', HAIR_T:'#0B7285',
  SUMMER_SET:'#FCC419', TEST_SKIN:'#ADB5BD', TEST_SCALP:'#868E96',
  DEMO:'#D0BFFF', BANNER:'#F783AC',
  SEMINAR:'#CED4DA',             // 오프라인 세미나 (기존 '기타' 회색 유지 요청)
  EDU:'#D9480F',                 // 교육 과정 (진한 테라코타 — 차트 내 고유색)
  SB_ETC:'#868E96',              // 스킨부스터인데 옵션에 구성 표기가 없는 주문
  BASE:'#B0AAA2',                // 기타는 따뜻한 회색으로 구분
  TOCO_BRN:'#7A4A1E'             // 구버전 코드 호환용 별칭
};
/* 네이버 옵션명 오타 교정 — 스토어 옵션에 오타가 있으면 분류가 '기타'로 빠지고 명세서에도 그대로 찍힌다.
   (2026-10-06: '에소토카인-블랙(두피용)' 2건). 스토어에서 옵션명을 고쳐도 지난 주문 텍스트는 그대로이므로 여기서 교정한다. */
const PRODUCT_TYPOS = [[/에소토카인/g, '엑소토카인']];
function fixProductTypos(s){
  let t = String(s == null ? '' : s);
  for(const [re, to] of PRODUCT_TYPOS) t = t.replace(re, to);
  return t;
}
function optPairs(o){
  if(typeof o!=='string') return [];
  o = fixProductTypos(o);
  return o.split(' / ').filter(p=>p.includes(':')).map(p=>{
    const i=p.indexOf(':'); return [p.slice(0,i).trim(), p.slice(i+1).trim()];
  });
}
function productsOfSku(opt, nm){
  nm = fixProductTypos(nm);
  const ps=new Set();
  for(const [k,v] of optPairs(opt)){
    if(k.includes('샵')) continue;
    const kv=k+' '+v;
    if(k.includes('교육')||/^\s*CASE\s*\d/.test(v)||k.includes('파트너 원장님')) ps.add('EDU');   // 교육 과정·파트너 선택 행 — 'CASE 2 [피부] 마이크로젝션-심화'가 MJ 로 잡히지 않게 맨 앞에서
    else if(kv.includes('마이크로젝션')) ps.add('MJ');
    else if(kv.includes('더마커런트')) ps.add('DERMA');
    else if(k.includes('퍼밍 재생크림')) ps.add('FIRM');
    else if(k.includes('더블')) ps.add('ADAPTER');
    else if(k.includes('에어')) ps.add('AIR');
    else if(/^스킨부스터\s*\d+\s*종/.test(k.replace(/\s/g,' '))){
      // 스킨부스터 N종 (교차선택 등) — 4종·5종·6종… 종수와 무관하게 옵션값으로 SKU 판정
      // ⚠ 순서 주의: 구체적 제품명을 먼저 판정한다.
      //   '칼리파우더-(피부&두피)'가 부위 단어('두피')에, '리퀴드 필링'이 '필링'(칼리)에 걸리면 안 됨.
      if(v.includes('피디로엔')) ps.add('PDRN');
      else if(v.includes('엑소-토코포르테')||v.includes('토코포르테')) ps.add('TOCO_LIQ');
      else if(v.includes('리퀴드')) ps.add('LIQMASK');
      else if(v.includes('칼리')||v.includes('마이크로파우더')||v.includes('필링')) ps.add('CALCI');
      else if(v.includes('에센스겔')||v.includes('에센스 겔')) ps.add(v.includes('150')?'GEL150':'GEL500');
      else if(v.includes('블랙')) ps.add('EXO_BLACK');
      // 엑소토카인은 부위로 갈림: 두피·포 스칼프 = 블랙, 그 외(피부·페이스) = 블루
      else if(v.includes('엑소토카인')) ps.add((v.includes('두피')||v.includes('포 스칼프')) ? 'EXO_BLACK' : 'EXO_BLUE');
      else if(v.includes('포 스칼프')||v.includes('두피')) ps.add('EXO_BLACK');   // 부위 표기만 있을 때
    }
    else if(k.includes('엑소토카인 블랙')) ps.add('EXO_BLACK');
    else if(k.includes('엑소토카인')) ps.add('EXO_BLUE');
    else if(k.includes('피디로엔')) ps.add('PDRN');
    else if(k.includes('토코포르테')) ps.add('TOCO_LIQ');   // 브라운/액상 = 같은 제품 → 통일
    else if(k.includes('칼리파우더')) ps.add('CALCI');
    else if(k.includes('리퀴드마스크')) ps.add('LIQMASK');
    else if(k.includes('에센스겔')||k.includes('에센스 겔')){
      if(kv.includes('150')&&kv.includes('500')){ps.add('GEL500');ps.add('GEL150');}
      else if(kv.includes('150')) ps.add('GEL150');
      else ps.add('GEL500');
    }
    else if(k.includes('퍼밍')) ps.add('FIRM');
    else if(k.includes('카밍')) ps.add('CALM');
    else if(k.includes('재생크림+크레이팩')){ps.add('FIRM');ps.add('CALM');}
    else if(k.includes('스칼프 부스터')) ps.add('SCALP_B');
    else if(k.includes('스칼프 샴푸')||k.includes('헤어 샴푸')) ps.add('SCALP_S');   // 두피 샴푸 500 (표기 2종)
    else if(k.includes('토닉')) ps.add('HAIR_T');                                   // 헤어 토닉 500
    // ⚠ '수료증'은 세미나 옵션(성함(수료증용))에도 쓰이므로 근거로 삼지 않는다
    else if(k.includes('교육')) ps.add('EDU');   // 예: "교육 과정 선택: CASE 2 [피부] + 두피 기초"
    else if(k.includes('[피부] 스킨부스터')) ps.add('TEST_SKIN');
    else if(k.includes('[두피] 테스트')) ps.add('TEST_SCALP');
    else if(k==='옵션 선택'){                          // 24년도 결제창
      if(v.includes('피디로엔')) ps.add('PDRN');
      else if(v.includes('엑소토카인')) ps.add('EXO_BLUE');
      else if(v.includes('토코포르테')) ps.add('TOCO_LIQ');
      else if(v.includes('칼리')) ps.add('CALCI');
    }
    else if(k==='구성 옵션'){                          // 예: 엑소3+피디3 (복수 가능)
      if(v.includes('엑소')) ps.add('EXO_BLUE');
      if(v.includes('피디')) ps.add('PDRN');
      if(v.includes('토코')) ps.add('TOCO_LIQ');
    }
    else if(/^스킨부스터(_두피| 5종| 3종)?$/.test(k) || k==='닥터배_필수 선택' || k==='닥터배_두피'){
      if(v.includes('피디로엔')) ps.add('PDRN');
      else if(v.includes('엑소-토코포르테')||v.includes('토코포르테')) ps.add('TOCO_LIQ');
      else if(v.includes('포 스칼프')||v.includes('두피')||v.includes('스칼프 부스터')) ps.add('EXO_BLACK');
      else if(v.includes('엑소토카인')) ps.add('EXO_BLUE');
      else if(v.includes('마이크로파우더')||v.includes('필링')) ps.add('CALCI');
    }
  }
  if(!ps.size){                                        // 옵션으로 판정 실패 → 상품명 폴백
    nm=String(nm||'');
    if(nm.includes('첫구매')||nm.includes('데모')) ps.add('DEMO');
    else if(nm.includes('교육')||/전문점.?할인\s*세트|세트\s*구성/.test(nm)) ps.add('EDU');   // 교육 과정 ('[닥터배 (공인) 파트너] 교육 구성', 2026-10 '[닥터배 파트너] 전문점-할인 세트 구성')
    else if(nm.includes('세미나')) ps.add('SEMINAR');   // 오프라인 세미나 결제 건
    else if(nm.includes('여름 피부열')) ps.add('SUMMER_SET');
    // "샴푸, 에센스겔, 토닉"처럼 구성만 나열된 결제창 기본 항목(3천원)은 제품이 아니라 기타.
    // 실제 발송 제품은 같은 주문의 다른 행(500ml 헤어 샴푸/토닉 등)으로 따로 들어오므로
    // 여기서 제품으로 세면 이중 계상이 된다.
    else if(nm.includes('샴푸') && nm.includes('토닉')) ps.add('BASE');
    else if(nm.includes('토닉')) ps.add('HAIR_T');
    else if(nm.includes('샴푸')) ps.add('SCALP_S');
    else if(nm.includes('리퀴드')&&nm.includes('마스크')) ps.add('LIQMASK');
    else if(nm.includes('에센스겔')||nm.includes('에센스 겔'))
      ps.add(nm.includes('150')?'GEL150':'GEL500');       // 예: [26년도 결제창] 에센스 겔 (첫 오픈 특가)
    else if(nm.includes('토코포르테')) ps.add('TOCO_LIQ');
    else if(nm.includes('칼리파우더')) ps.add('CALCI');
    else if(nm.includes('퍼밍')&&nm.includes('카밍')){ps.add('FIRM');ps.add('CALM');}
    else if(nm.includes('마이크로젝션')) ps.add('MJ');
    else if(nm.includes('퍼밍')) ps.add('FIRM');
    else if(nm.includes('더마커런트')) ps.add('DERMA');
    else if(nm.includes('배너')) ps.add('BANNER');
    // 스킨부스터인데 옵션에 구성 표기가 없는 주문 (두피는 블랙이 기본 구성)
    else if(nm.includes('스킨부스터')) ps.add(nm.includes('두피') ? 'EXO_BLACK' : 'SB_ETC');
    else ps.add('BASE');
  }
  return [...ps];
}

/* 제품 그룹 (지도 앱의 제품 분류 표에서 사용) — skin=피부 / scalp=두피 / common=공통 / device=디바이스 / etc=세트·기타 */
const GROUP_OF = {
  EXO_BLUE:'skin', PDRN:'skin', LIQMASK:'skin', GEL500:'skin', GEL150:'skin', FIRM:'skin', CALM:'skin',
  EXO_BLACK:'scalp', TOCO_LIQ:'scalp', SCALP_B:'scalp', SCALP_S:'scalp', HAIR_T:'scalp',
  CALCI:'common',
  MJ:'device', DERMA:'device', AIR:'device', ADAPTER:'device',
  SUMMER_SET:'etc', TEST_SKIN:'etc', TEST_SCALP:'etc', DEMO:'etc', BANNER:'etc',
  SEMINAR:'etc', EDU:'etc', SB_ETC:'etc', BASE:'etc'
};

/* ══════════════ 마이크로젝션 구매 규칙 (공통 운영규칙 v1.0.0, 2026-10-07 — MJ-SHIP-001/002) ══════════════
   ▶ 마이크로젝션 단독 주문 불가(교육을 받았어도 취소 대상). 최소 동시 구매 = 마이크로젝션 1박스 + 스킨부스터 1박스 이상.
     그 이상의 비율(MJ 2박스일 때 SB 몇 박스, 엄격한 MJ<SB 등)은 미확정(U01·U02) → 자동 거절하지 않고 본사 확인.
   ▶ 발송 명세서: 구매 수량 안내는 고객 인쇄물에 포함, 출고 점검표(교육·단독·비율·파트너)는 본사 화면 전용.
   스킨부스터 박스로 세는 것 = '스킨부스터 N종 교차선택' 라인
       엑소토카인 블루 · 피디로엔 핑크 · 엑소토카인 블랙 · 토코포르테 · 리퀴드 필링 · 칼리파우더,
       구성 미표기 스킨부스터(SB_ETC), 더마커런트 세트 안의 '스킨부스터 … N박스'
   박스 수 = 수량 × 옵션의 묶음 박스 수("(3+1)4박스" = 4박스, "3+3 (6박스)" = 6박스)
   세지 않는 것 = 에센스겔 · 테스트 구성 · 두피 샴푸/토닉/스칼프 부스터 · 크림/팩,
       서비스(무상) 제공분, 교육 과정·키트 주문 행(CASE n / 교육 과정 선택 / 교육 구성) */
const MJ_RULE_SB = new Set(['EXO_BLUE','PDRN','EXO_BLACK','TOCO_LIQ','LIQMASK','CALCI','SB_ETC']);
function mjRuleCount(opt, nm, qty){
  const o = String(opt||''), p = String(nm||''), q = Number(qty)||1;
  if(/^\s*CASE\s*\d/.test(p) || /교육\s*과정\s*선택|파트너\s*원장님\s*선택/.test(o) || /교육\s*구성|전문점.?할인\s*세트/.test(p)) return {mj:0, sb:0};
  if(/^\s*\[서비스\]/.test(p) || /[:：]\s*서비스\s*$/.test(o.trim())) return {mj:0, sb:0};
  const cs = productsOfSku(o, p);
  // 묶음 구성은 옵션에 적힌 박스 수로 센다: "(3+1)4박스" → 4, "3+3 (6박스/50%할인)" → 6, "10 vial (1박스…)" → 1
  const po = o.split(/\s\/\s/).filter(x=>!/샵|인스타|성함/.test(x.split(/[:：]/)[0])).join(' / ');
  const bm = po.match(/(\d+)\s*박스/), per = bm ? Math.max(1, Number(bm[1])) : 1;
  // 박스 수가 적힌 묶음은 SKU 가 여럿이어도(예: "엑소3+피디3 (6박스)") 적힌 박스 수 그대로 — SKU 수를 곱하면 이중 계상
  const nsb = cs.filter(c=>MJ_RULE_SB.has(c)).length;
  let sb = (cs.includes('DERMA') || !nsb) ? 0 : (bm ? per : nsb) * q;
  const dm = o.match(/스킨부스터\)?\s*[:：][^/]*?(\d+)\s*박스/);          // 더마커런트 세트: "특별 구성 (스킨부스터): 피부 구성 4박스"
  if(cs.includes('DERMA') && dm) sb += Number(dm[1]) * q;
  return {mj: cs.includes('MJ') ? q * (cs.length===1 ? per : 1) : 0, sb};
}
