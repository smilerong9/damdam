'use strict';

/* =========================================================
   담담 — 위시템 + 추천템
   모든 데이터는 이 기기의 IndexedDB에만 저장된다.
   ========================================================= */

const DB_NAME = window.DAMDAM_PREVIEW ? 'damdam-preview-5' : 'damdam';
const DB_VER = 1;
const BACKUP_KEY = 'damdam.lastBackup';

const CATS = {
  fashion: '옷·잡화',
  beauty: '화장품·향',
  kitchen: '주방·그릇',
  home: '가구·인테리어',
  living: '생활·가전',
  tech: '전자기기',
  food: '음식',
  drink: '음료·술',
  book: '책·문화',
  place: '장소·여행',
  etc: '기타',
};
const CAT_KEYS = Object.keys(CATS);
/* 추천템·위시템 분류 (단골템은 CATS 그대로) */
const RCATS = { fashion: '옷·잡화', beauty: '화장품·향', kitchen: '주방템', home: '가구', tech: '가전·전자기기', food: '음식', living: '생활', culture: '문화', etc: '기타' };
const WCATS = { fashion: '옷·잡화', beauty: '화장품·향', kitchen: '주방템', home: '가구', tech: '가전·전자기기', food: '음식', etc: '기타' };
const RCAT_KEYS = Object.keys(RCATS);
const WISH_CAT_KEYS = Object.keys(WCATS);
const APPLIANCE = ['드라이기', '전기매트', '청소기', '가습기', '제습기', '선풍기', '히터', '다리미', '안마', '공기청정기', '세탁기', '건조기', '냉장고', '전자레인지', '에어프라이어', '토스터', '오븐'];
// 옛 분류(음료·술, 생활·가전, 책·문화, 장소·여행)를 새 분류로 옮긴다
function toCat(cat, text, labels) {
  if (!cat) return null;
  if (cat === 'living' && APPLIANCE.some(w => (text || '').includes(w))) return 'tech';
  if (labels[cat]) return cat;
  if (cat === 'drink') return 'food';
  if ((cat === 'book' || cat === 'place') && labels.culture) return 'culture';
  return 'etc';
}
const rcatOf = r => toCat(r.cat, r.title, RCATS) || 'etc';
const wcatOf = w => toCat(w.cat, [w.title, w.brand].join(' '), WCATS) || 'etc';
const recGuess = text => toCat(guessCat(text, false), text, RCATS);
const wishGuess = (text, hasSize) => toCat(guessCat(text, hasSize), text, WCATS);
const catLabel = i => i.kind === 'rec' ? RCATS[rcatOf(i)] : i.kind === 'wish' ? WCATS[wcatOf(i)] : CATS[i.cat];

// 품목 추측용 낱말 (소문자 비교). 두 분류가 같은 점수면 먼저 적힌 쪽
const CAT_WORDS = {
  fashion: ['자켓', '재킷', '패딩', '점퍼', '블라우스', '셔츠', '니트', '코트', '바지', '팬츠', '치마', '스커트', '원피스', '신발', '운동화', '구두', '부츠', '샌들', '로퍼', '가방', '백팩', '지갑', '모자', '목걸이', '반지', '귀걸이', '팔찌', '선글라스', '안경', '시계', '벨트', '양말', '후드', '맨투맨', '티셔츠', '조끼', '가디건', '데님', '청바지', '스니커즈', 'jacket', 'shoes', 'bag', '사이즈', '러닝'],
  beauty: ['크림', '크림팩', '마스크팩', '세럼', '앰플', '토너', '스킨', '로션', '쿠션', '파운데이션', '립', '틴트', '선크림', '클렌징', '향수', '향기', '퍼퓸', '샴푸', '바디', '핸드크림', '네일', '섀도', '마스카라', '에센스', '보습', '피부', 'serum', 'cream', 'perfume', 'skin'],
  kitchen: ['냄비', '편수', '양수', '프라이팬', '웍', '컵', '머그', '잔', '그릇', '접시', '식기', '커트러리', '수저', '젓가락', '도마', '식칼', '주전자', '드리퍼', '텀블러', '보온병', '밀폐용기', '오븐', '에어프라이어', '토스터', 'cup', 'mug', 'plate'],
  home: ['소파', '의자', '테이블', '책상', '책장', '선반', '조명', '램프', '러그', '커튼', '침대', '수납', '화병', '액자', '포스터', '인테리어', '가구', '오브제', '거울', 'lamp', 'chair', 'sofa', 'poster'],
  living: ['드라이기', '전기매트', '매트', '이불', '베개', '수건', '타월', '세제', '칫솔', '휴지', '청소기', '가습기', '제습기', '선풍기', '히터', '디퓨저', '캔들', '사이클', '실내자전거', '안마', '마사지', '다리미', '생활', '살림'],
  tech: ['이어폰', '헤드폰', '충전기', '키보드', '마우스', '노트북', '태블릿', '아이패드', '스피커', '카메라', '모니터', '갤럭시', '아이폰', '워치'],
  food: ['맛집', '빵', '케이크', '쿠키', '과자', '초콜릿', '라면', '김치', '반찬', '소스', '레시피', '간식', '디저트', '젤리', '떡', '고기', '밀키트', '칼국수', '육개장', '국밥', '파스타', '피자', '버거', '맛있', 'cookie', 'bakery'],
  drink: ['커피', '원두', '음료', '탄산', '소다', '에이드', '주스', '와인', '맥주', '위스키', '사케', '막걸리', '시드르', '하이볼', '칵테일', '티백', '레몬에이드', '제로', 'wine', 'soda', 'poire', 'poiré', 'cidre', 'cider', 'beer', 'coffee'],
  book: ['책', '소설', '에세이', '전시', '공연', '영화', '앨범', '굿즈', '도서'],
  place: ['여행', '호텔', '숙소', '펜션', '캠핑', '스테이', '전망', '공원', '바다'],
};

const SHOPS = ['네이버', '쿠팡', '무신사', '29CM', '오늘의집', '공식몰', '매장'];
const SHOP_HOSTS = [[/naver|smartstore/, '네이버'], [/coupang/, '쿠팡'], [/musinsa/, '무신사'], [/29cm/, '29CM'], [/ohou/, '오늘의집'], [/kurly/, '컬리'], [/ssg\.com/, 'SSG'], [/11st/, '11번가'], [/gmarket/, 'G마켓'], [/oliveyoung/, '올리브영']];
function shopFromLink(u) {
  if (!u) return '';
  const hit = SHOP_HOSTS.find(([re]) => re.test(u.toLowerCase()));
  return hit ? hit[1] : '공식몰';
}
// 링크에서 추적용 값(fbclid, utm_ 등) 지우기
function cleanLink(u) {
  try {
    const url = new URL(u);
    [...url.searchParams.keys()].forEach(k => { if (/^(fbclid|gclid|igshid|utm_|ref|si$|_ga)/i.test(k)) url.searchParams.delete(k); });
    let s = url.toString();
    if (s.endsWith('?')) s = s.slice(0, -1);
    return s;
  } catch { return u; }
}

const DEFAULT_WHO = ['엄마', '아빠'];
const WHO_WORDS = ['나', '엄마', '아빠', '언니', '오빠', '누나', '형', '동생', '남편', '아내', '친구'];

/* ---------- IndexedDB ---------- */
let dbp;
function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('items')) d.createObjectStore('items', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('photos')) d.createObjectStore('photos', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}
function tx(stores, mode, fn) {
  return db().then(d => new Promise((resolve, reject) => {
    const t = d.transaction(stores, mode);
    let out;
    Promise.resolve(fn(t)).then(v => { out = v; });
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('abort'));
  }));
}
const reqP = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const store = {
  all: () => tx(['items'], 'readonly', t => reqP(t.objectStore('items').getAll())),
  allPhotos: () => tx(['photos'], 'readonly', t => reqP(t.objectStore('photos').getAll())),
  photo: id => tx(['photos'], 'readonly', t => reqP(t.objectStore('photos').get(id))),
  save: (item, addPhotos = [], removeIds = []) => tx(['items', 'photos'], 'readwrite', t => {
    t.objectStore('items').put(item);
    const ps = t.objectStore('photos');
    addPhotos.forEach(p => ps.put(p));
    removeIds.forEach(id => ps.delete(id));
  }),
  remove: item => tx(['items', 'photos'], 'readwrite', t => {
    t.objectStore('items').delete(item.id);
    const ps = t.objectStore('photos');
    (item.photos || []).forEach(p => ps.delete(p.id));
  }),
  putMany: (items, photos) => tx(['items', 'photos'], 'readwrite', t => {
    items.forEach(i => t.objectStore('items').put(i));
    photos.forEach(p => t.objectStore('photos').put(p));
  }),
};

/* ---------- 작은 도우미 ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fmtDate = s => s ? `${Number(s.slice(5, 7))}.${Number(s.slice(8, 10))}` : '';
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* 저장 불가 */ } };
const safeLink = u => /^https?:\/\//i.test(u || '') ? u : '';

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
}

const urlCache = new Map();
async function photoURL(id) {
  if (urlCache.has(id)) return urlCache.get(id);
  const p = await store.photo(id);
  if (!p) return '';
  const u = URL.createObjectURL(p.blob);
  urlCache.set(id, u);
  return u;
}
function dropURL(id) { const u = urlCache.get(id); if (u) { URL.revokeObjectURL(u); urlCache.delete(id); } }
async function hydrate(root) {
  await Promise.all($$('img[data-pid]', root).map(async img => { const u = await photoURL(img.dataset.pid); if (u) img.src = u; }));
}
// 고른 사진을 바로 메모리로 복사한다. 안드로이드는 입력칸을 비우거나 시간이 지나면
// 원본 파일을 다시 못 읽을 때가 있다 ("File could not be read! Code=0")
async function takeFiles(input) {
  const list = Array.from(input.files || []);
  const out = [];
  for (const f of list) {
    try { out.push(new File([await f.arrayBuffer()], f.name || 'photo.jpg', { type: f.type || 'image/jpeg', lastModified: f.lastModified })); }
    catch { out.push(f); }
  }
  input.value = '';
  return out;
}
async function shrink(file, MAX = 1600) {
  let src;
  try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch {
    src = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('img')); im.src = URL.createObjectURL(file); });
  }
  const k = Math.min(1, MAX / Math.max(src.width, src.height));
  const c = document.createElement('canvas');
  c.width = Math.round(src.width * k); c.height = Math.round(src.height * k);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  if (src.close) src.close();
  const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.84));
  return blob || file;
}

/* ---------- 가격·한 줄 해석 ---------- */
function parsePrice(str) {
  if (!str) return 0;
  const s = String(str).replace(/\s/g, '');
  let m = /(\d+(?:\.\d+)?)만(\d{1,4})?/.exec(s);
  if (m) return Math.round(Number(m[1]) * 10000 + (m[2] ? Number(m[2]) : 0));
  m = /(\d{1,3}(?:,\d{3})+|\d+)/.exec(s);
  return m ? Number(m[1].replace(/,/g, '')) : 0;
}
function fmtPrice(n) {
  if (!n) return '';
  if (n >= 10000 && n % 1000 === 0) return `${(n / 10000).toFixed(1).replace(/\.0$/, '')}만`;
  return `${n.toLocaleString('ko-KR')}원`;
}
function guessCat(text, hasSize) {
  const t = (text || '').toLowerCase();
  let best = null, score = 0;
  for (const k of Object.keys(CAT_WORDS)) {
    const s = CAT_WORDS[k].reduce((n, w) => n + (t.includes(w) ? 1 : 0), 0);
    if (s > score) { best = k; score = s; }
  }
  if (!best && hasSize) best = 'fashion';
  return best;
}
const isCode = tok => tok.length >= 5 && /^[A-Za-z0-9-]+$/.test(tok) && (tok.match(/\d/g) || []).length >= 3 && /[A-Za-z]/.test(tok);

function parseLine(line) {
  let s = (line || '').replace(/^[\s\-•·□☐▢*]+|\[\s?\]\s*/g, '').trim();
  const out = { title: '', code: '', size: '', who: '', price: 0, cat: null, link: '', raw: line.trim() };
  if (!s) return out;
  let lm = /https?:\/\/\S+/i.exec(s);
  if (lm) { out.link = cleanLink(lm[0]); s = s.replace(lm[0], ' '); }
  else if ((lm = /(?:^|\s)((?:[a-z0-9-]+\.)+(?:com|co\.kr|kr|net|org|shop|store|io|jp|co)(?:\/\S*)?)(?=\s|$)/i.exec(s))) {
    out.link = cleanLink('https://' + lm[1]);
    const host = lm[1].split('/')[0].split('.');
    const hostStr = lm[1].split('/')[0];
    const name = host[host.length - (/\.co\.kr$/i.test(hostStr) ? 3 : 2)];
    s = s.replace(lm[1], ' ' + (name && !/^(www|shop|store|m)$/i.test(name) ? name : '') + ' ');
  }
  const wm = new RegExp(`^(${WHO_WORDS.join('|')})(?=\\s)`).exec(s);
  if (wm) { out.who = wm[1]; s = s.slice(wm[0].length).trim(); }
  let m = /(\d+(?:\.\d+)?)\s*만\s*(\d{1,4})?\s*원?/.exec(s);
  if (m) { out.price = parsePrice(m[0]); s = s.replace(m[0], ' '); }
  else if ((m = /(\d{1,3}(?:,\d{3})+|\d{4,})\s*원/.exec(s))) { out.price = parsePrice(m[0]); s = s.replace(m[0], ' '); }
  m = /(\d{2,3})\s*사이즈/.exec(s);
  if (m) { out.size = m[1]; s = s.replace(m[0], ' '); }
  else if ((m = /(\d+(?:\.\d+)?(?:\s*[x×*]\s*\d+(?:\.\d+)?)*\s*(?:cm|mm|ml|l|kg|g|인치|호|구|p|인용|단))(?=\s|$|\/)/i.exec(s))) { out.size = m[1].replace(/\s/g, ''); s = s.replace(m[0], ' '); }
  const toks = s.split(/[\s/]+/).filter(Boolean);
  const keep = [];
  toks.forEach(t => {
    if (!out.code && isCode(t)) { out.code = t; return; }
    keep.push(t);
  });
  if (!out.size && guessCat(keep.join(' '), false) !== 'kitchen') {
    for (let i = keep.length - 1; i >= 0; i--) {
      const n = Number(keep[i]);
      if (/^\d{2,3}$/.test(keep[i]) && n >= 44 && n <= 120) { out.size = keep[i]; keep.splice(i, 1); break; }
      if (/^(XS|S|M|L|XL|XXL|FREE|F)$/i.test(keep[i])) { out.size = keep[i].toUpperCase(); keep.splice(i, 1); break; }
    }
  }
  out.title = keep.join(' ').replace(/\s+/g, ' ').replace(/[\s/·,-]+$/, '').trim();
  out.cat = guessCat(out.title, !!out.size);
  return out;
}

/* ---------- 상태 ---------- */
const state = {
  items: [],
  tab: lsGet('damdam.tab') || 'wish',
  q: '',
  who: 'all',
  wcat: 'all',
  wfold: (() => { try { return JSON.parse(lsGet('damdam.wfold') || '{}') || {}; } catch { return {}; } })(),
  cat: 'all',
  pasteShop: '',
  showDone: false,
  draft: null,
  viewId: null,
  pasteRows: [],
  sel: null,
  calc: null,
};
const PEEK = 3;
const saveFold = () => lsSet('damdam.wfold', JSON.stringify(state.wfold));
const wishes = () => state.items.filter(i => i.kind === 'wish');
const recs = () => state.items.filter(i => i.kind === 'rec');
const staples = () => state.items.filter(i => i.kind === 'staple');

async function load() {
  state.items = await store.all();
  state.items.forEach(i => { if (i.status === 'cart') i.status = 'want'; });
  state.items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/* ---------- 화면 전환 ---------- */
const VIEWS = ['home', 'wish', 'paste', 'rec', 'recview', 'settings', 'staple', 'buy', 'calc'];
function showView(name) { VIEWS.forEach(v => { $('#view-' + v).hidden = v !== name; }); window.scrollTo(0, 0); }
function go(name, params = {}) { history.pushState({ view: name, ...params }, ''); route({ view: name, ...params }); }
function back() { if (history.state && history.state.view && history.state.view !== 'home') history.back(); else route({ view: 'home' }); }
function route(s) {
  const v = (s && s.view) || 'home';
  if (v === 'wish') { if (!state.draft || state.draft.kind !== 'wish') startWish(s.id); renderWish(); showView('wish'); }
  else if (v === 'rec') { if (!state.draft || state.draft.kind !== 'rec') startRec(s.id); renderRec(); showView('rec'); }
  else if (v === 'recview') { state.viewId = s.id; renderRecView(); showView('recview'); }
  else if (v === 'paste') { renderPaste(); showView('paste'); }
  else if (v === 'staple') { state.stapleId = s.id; renderStaple(); showView('staple'); }
  else if (v === 'buy') { if (!state.draft || state.draft.kind !== 'buy') startBuy(s); renderBuy(); showView('buy'); }
  else if (v === 'settings') { renderSettings(); showView('settings'); }
  else if (v === 'calc') { startCalc(s.id); renderCalc(); showView('calc'); }
  else { state.draft = null; renderHome(); showView('home'); }
}
window.addEventListener('popstate', e => {
  $('#lightbox').hidden = true;
  const s = e.state || { view: 'home' };
  if (s.view !== 'wish' && s.view !== 'rec' && s.view !== 'buy') state.draft = null;
  route(s);
});
$$('[data-back]').forEach(b => b.addEventListener('click', back));
$$('[data-cancel]').forEach(b => b.addEventListener('click', () => {
  if (state.draft) state.draft.newBlobs.forEach(x => URL.revokeObjectURL(x.url));
  state.draft = null;
  back();
}));

/* ---------- 홈 ---------- */
const catSq = k => `<span class="sq cat-${k || 'etc'}"></span>`;
const matchQ = (i, q) => !q || [i.title, i.brand, i.code, i.size, i.who, i.memo, i.source, i.tryNote, i.shop, catLabel(i)].filter(Boolean).join(' ').toLowerCase().includes(q);
const lowest = w => (w.prices || []).reduce((m, p) => (p.amount && (!m || p.amount < m.amount) ? p : m), null);
const EMPTY_ART = `<svg class="empty-art" viewBox="0 0 84 84" aria-hidden="true"><path d="M42 70S16 54 16 36a13 13 0 0 1 26-6 13 13 0 0 1 26 6c0 18-26 34-26 34z" fill="var(--sun)" stroke="var(--line)" stroke-width="2.6" stroke-linejoin="round"/></svg>`;

function wishRowHTML(w) {
  const low = lowest(w);
  const done = w.status === 'bought';
  const sub = [w.size ? `<span>${esc(w.size)}</span>` : '', w.code ? `<span class="code">${esc(w.code)}</span>` : '', w.link ? '<span class="has-link">링크</span>' : '', w.memo ? `<span>${esc(w.memo.split('\n')[0].slice(0, 22))}</span>` : ''].filter(Boolean).join('');
  return `<div class="wl-row ${done ? 'done' : ''}" data-sid="${esc(w.id)}">
    <button type="button" class="wl-check" data-check="${esc(w.id)}" aria-label="${done ? '샀어요 취소' : '샀어요'}" aria-pressed="${done}">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <button type="button" class="wl-main" data-wish="${esc(w.id)}">
      <span class="wl-title">${catSq(wcatOf(w))}<span>${esc([w.brand, w.title].filter(Boolean).join(' ') || '이름 없음')}</span>${w.who && w.who !== '나' ? `<em class="wl-who">${esc(w.who)}</em>` : ''}</span>
      ${sub ? `<span class="wl-sub">${sub}</span>` : ''}
    </button>
    <div class="wl-price">
      ${low ? `<b>${fmtPrice(low.amount)}</b>` : ''}
      ${!done && w.status === 'sale' ? '<span class="wl-tag">세일 대기</span>' : low && low.where && low.where !== '메모' ? `<small>${esc(low.where)}</small>` : ''}
    </div>
  </div>`;
}

function renderWishHome() {
  const q = state.q.trim().toLowerCase();
  const all = wishes();
  if (!all.length) {
    return `<div class="empty-state">${EMPTY_ART}<h2>갖고 싶은 걸 담아볼까요</h2>
      <p>한 줄로 적으면 품번·사이즈·가격을 알아서 나눠요. 다른 앱에 적어둔 목록도 한 번에 옮길 수 있어요.</p>
      <div class="stack" style="max-width:260px;margin:22px auto 0">
        <button class="primary-btn" data-act="wish-new">위시 추가</button>
        <button class="ghost-btn center" data-act="paste">여러 줄 붙여넣기</button>
      </div></div>`;
  }
  const open = all.filter(w => w.status !== 'bought');
  const ccnt = k => open.filter(w => k === 'all' || wcatOf(w) === k).length;
  const ckeys = ['all', ...WISH_CAT_KEYS.filter(k => ccnt(k))];
  if (!ckeys.includes(state.wcat)) state.wcat = 'all';
  let html = `<div class="cat-filter">${ckeys.map(k => `<button type="button" class="f-btn ${state.wcat === k ? 'is-on' : ''}" data-wcat="${k}">${k === 'all' ? '' : catSq(k)}${k === 'all' ? '전체' : WCATS[k]}<b>${ccnt(k)}</b></button>`).join('')}</div>`;
  const inCat = w => state.wcat === 'all' || wcatOf(w) === state.wcat;
  const todo = all.filter(w => w.status !== 'bought' && inCat(w) && matchQ(w, q));
  const done = all.filter(w => w.status === 'bought' && inCat(w) && matchQ(w, q));
  const grouped = state.wcat === 'all' && !q;
  html += `<div class="wish-tools"><button type="button" class="link-btn" data-act="paste">여러 줄 붙여넣기</button><span class="fold-all">${grouped ? `<button type="button" class="mini-link" data-act="fold-all">모두 접기</button><button type="button" class="mini-link" data-act="open-all">모두 펼치기</button>` : ''}${selLink()}</span></div>`;
  html += `<h2 class="sec-title">사고 싶은 것 <span class="cnt">${todo.length}</span></h2>`;
  if (!todo.length) html += '<p class="hint">여기엔 아직 없어요.</p>';
  else if (!grouped) html += `<div class="wl">${todo.map(wishRowHTML).join('')}</div>`;
  else {
    WISH_CAT_KEYS.forEach(k => {
      const g = todo.filter(w => wcatOf(w) === k);
      if (!g.length) return;
      const st = state.wfold[k] || 'peek';
      const shown = st === 'fold' ? [] : st === 'open' ? g : g.slice(0, PEEK);
      html += `<section class="wsec ${st}">
        <button type="button" class="wsec-head" data-wsec="${k}" aria-expanded="${st !== 'fold'}">${catSq(k)}<span>${WCATS[k]}</span><b>${g.length}</b><i class="chev" aria-hidden="true"></i></button>
        ${shown.length ? `<div class="wl">${shown.map(wishRowHTML).join('')}</div>` : ''}
        ${st === 'peek' && g.length > PEEK ? `<button type="button" class="wsec-more" data-wmore="${k}">${g.length - PEEK}개 더 보기</button>` : ''}
        ${st === 'open' && g.length > PEEK ? `<button type="button" class="wsec-more" data-wless="${k}">줄여 보기</button>` : ''}
      </section>`;
    });
  }
  if (done.length) {
    html += `<button type="button" class="done-toggle" data-act="toggle-done"><span>샀어요 ${done.length}</span><span>${state.showDone ? '접기' : '펼치기'}</span></button>`;
    if (state.showDone) html += `<div class="wl">${done.sort((a, b) => (b.boughtAt || '').localeCompare(a.boughtAt || '')).map(wishRowHTML).join('')}</div>`;
  }
  return html;
}

function recRowHTML(r) {
  const memo = (r.tried && r.tryNote) ? r.tryNote : (r.memo || '');
  return `<button type="button" class="rl-row" data-recview="${esc(r.id)}" data-sid="${esc(r.id)}">
    <span class="rl-main">
      <span class="rl-title">${esc(r.title || '이름 없음')}</span>
      ${memo ? `<span class="rl-memo">${esc(memo.split('\n')[0])}</span>` : ''}
    </span>
    <span class="rl-side">
      ${r.tried ? `<span class="rl-tried" title="해봤어요">${SVG('<circle cx="10" cy="10" r="9" class="f"/><path d="M5.8 10.3l2.8 2.8 5.6-6" class="k"/>')}<span class="sr">해봤어요</span></span>` : ''}
      ${r.source ? `<span class="rl-src">${esc(r.source)}</span>` : ''}
    </span>
  </button>`;
}

function renderRecHome() {
  const q = state.q.trim().toLowerCase();
  const all = recs();
  if (!all.length) {
    return `<div class="empty-state">${EMPTY_ART}<h2>추천 캡처를 모아둘까요</h2>
      <p>인스타, X, 블로그에서 본 걸 캡처해서 넣으면 품목별로 한눈에 정리돼요.</p>
      <div class="stack" style="max-width:260px;margin:22px auto 0"><button class="primary-btn" data-act="rec-new">캡처 넣기</button></div></div>`;
  }
  const cnt = k => all.filter(r => k === 'all' || (k === 'tried' ? r.tried : rcatOf(r) === k)).length;
  const keys = ['all', ...RCAT_KEYS.filter(k => cnt(k)), ...(cnt('tried') ? ['tried'] : [])];
  if (!keys.includes(state.cat)) state.cat = 'all';
  let html = `<div class="cat-filter">${keys.map(k => `<button type="button" class="f-btn cat-${k} ${state.cat === k ? 'is-on' : ''}" data-cat="${k}">${k === 'tried' ? `<span class="rl-tried">${SVG('<circle cx="10" cy="10" r="9" class="f"/><path d="M5.8 10.3l2.8 2.8 5.6-6" class="k"/>')}</span>` : k !== 'all' ? catSq(k) : ''}${k === 'all' ? '전체' : k === 'tried' ? '해봤어요' : RCATS[k]}<b>${cnt(k)}</b></button>`).join('')}</div>`;
  const list = all.filter(r => (state.cat === 'all' || (state.cat === 'tried' ? r.tried : rcatOf(r) === state.cat)) && matchQ(r, q));
  if (!list.length) return html + '<p class="hint" style="margin-top:20px">찾는 추천이 없어요.</p>';
  html += `<div class="wish-tools rec-tools"><span class="fold-all">${state.cat === 'all' && !q ? `<button type="button" class="mini-link" data-act="fold-all">모두 접기</button><button type="button" class="mini-link" data-act="open-all">모두 펼치기</button>` : ''}${selLink()}</span></div>`;
  if (state.cat === 'all' && !q) {
    RCAT_KEYS.forEach(k => {
      const g = list.filter(r => rcatOf(r) === k);
      if (!g.length) return;
      const fk = 'r:' + k;
      const st = state.wfold[fk] || 'peek';
      const shown = st === 'fold' ? [] : st === 'open' ? g : g.slice(0, PEEK);
      html += `<section class="wsec rsec ${st}">
        <button type="button" class="wsec-head" data-wsec="${fk}" aria-expanded="${st !== 'fold'}">${catSq(k)}<span>${RCATS[k]}</span><b>${g.length}</b><i class="chev" aria-hidden="true"></i></button>
        ${shown.length ? `<div class="rl">${shown.map(recRowHTML).join('')}</div>` : ''}
        ${st === 'peek' && g.length > PEEK ? `<button type="button" class="wsec-more" data-wmore="${fk}">${g.length - PEEK}개 더 보기</button>` : ''}
        ${st === 'open' && g.length > PEEK ? `<button type="button" class="wsec-more" data-wless="${fk}">줄여 보기</button>` : ''}
      </section>`;
    });
  } else if (state.cat === 'all') {
    html += `<div class="rl">${list.map(recRowHTML).join('')}</div>`;
  } else {
    html += `<div class="rl">${list.map(recRowHTML).join('')}</div>`;
  }
  return html;
}

function renderHome() {
  $$('.tab').forEach(b => b.classList.toggle('is-on', b.dataset.tab === state.tab));
  const counts = { wish: wishes().filter(w => w.status !== 'bought').length, rec: recs().length, staple: staples().length };
  $$('.tab-n').forEach(s => { s.textContent = counts[s.dataset.n] || ''; });
  const body = $('#home-body');
  body.innerHTML = state.tab === 'rec' ? renderRecHome() : state.tab === 'staple' ? renderStapleHome() : renderWishHome();
  hydrate(body);
  body.classList.toggle('selecting', !!state.sel);
  if (state.sel) $$('[data-sid]', body).forEach(r => r.classList.toggle('is-sel', state.sel.has(r.dataset.sid)));
  renderSelBar();
  const fab = $('#btn-new');
  fab.classList.toggle('is-rec', state.tab === 'rec');
  fab.classList.toggle('is-staple', state.tab === 'staple');
  fab.setAttribute('aria-label', state.tab === 'rec' ? '추천 캡처 넣기' : state.tab === 'staple' ? '단골템 기록' : '위시 추가');
  $('#btn-calc').hidden = state.tab !== 'staple' || !staples().length || !!state.sel;
  fab.hidden = !!state.sel;
}

$$('.tab').forEach(b => b.addEventListener('click', () => { state.tab = b.dataset.tab; state.sel = null; lsSet('damdam.tab', state.tab); renderHome(); }));
$('#q').addEventListener('input', e => { state.q = e.target.value; renderHome(); });
$('#btn-settings').addEventListener('click', () => go('settings'));
$('#btn-new').addEventListener('click', () => {
  state.draft = null;
  if (state.tab === 'rec') { go('rec'); $('#r-photo-input').click(); }
  else if (state.tab === 'staple') { go('buy'); setTimeout(() => $('#b-title').focus(), 50); }
  else { go('wish'); setTimeout(() => $('#w-quick').focus(), 50); }
});

$('#home-body').addEventListener('click', async e => {
  const t = e.target;
  // 선택 모드: 줄을 누르면 고르기만 한다
  if (state.sel) {
    const r = t.closest('[data-sid]');
    if (r) {
      e.preventDefault();
      const id = r.dataset.sid;
      if (state.sel.has(id)) state.sel.delete(id); else state.sel.add(id);
      r.classList.toggle('is-sel', state.sel.has(id));
      return renderSelBar();
    }
  }
  const chk = t.closest('[data-check]');
  if (chk) {
    const w = state.items.find(i => i.id === chk.dataset.check);
    if (!w) return;
    const wasDone = w.status === 'bought';
    w.status = wasDone ? 'want' : 'bought';
    w.boughtAt = wasDone ? '' : today();
    await store.save(w);
    renderHome();
    toast(wasDone ? '다시 사고 싶은 것으로 옮겼어요' : '샀어요! 아래로 옮겼어요');
    return;
  }
  const wb = t.closest('[data-wish]'); if (wb) { state.draft = null; return go('wish', { id: wb.dataset.wish }); }
  const rv = t.closest('[data-recview]'); if (rv) return go('recview', { id: rv.dataset.recview });
  const sv = t.closest('[data-staple]'); if (sv) return go('staple', { id: sv.dataset.staple });
  const wf = t.closest('[data-who]'); if (wf) { state.who = wf.dataset.who; return renderHome(); }
  const ws = t.closest('[data-wsec]');
  if (ws) { const k = ws.dataset.wsec; state.wfold[k] = (state.wfold[k] || 'peek') === 'fold' ? 'peek' : 'fold'; saveFold(); return renderHome(); }
  const wm = t.closest('[data-wmore]'); if (wm) { state.wfold[wm.dataset.wmore] = 'open'; saveFold(); return renderHome(); }
  const wl = t.closest('[data-wless]'); if (wl) { state.wfold[wl.dataset.wless] = 'peek'; saveFold(); wl.closest('.wsec')?.scrollIntoView({ block: 'start' }); return renderHome(); }
  const wcf = t.closest('[data-wcat]'); if (wcf) { state.wcat = wcf.dataset.wcat; return renderHome(); }
  const cf = t.closest('[data-cat]'); if (cf) { state.cat = cf.dataset.cat; return renderHome(); }
  const act = t.closest('[data-act]')?.dataset.act;
  if (act === 'wish-new') { state.draft = null; go('wish'); }
  else if (act === 'rec-new') { state.draft = null; go('rec'); $('#r-photo-input').click(); }
  else if (act === 'paste') go('paste');
  else if (act === 'staple-new') { state.draft = null; go('buy'); }
  else if (act === 'toggle-done') { state.showDone = !state.showDone; renderHome(); }
  else if (act === 'select') { state.sel = state.sel ? null : new Set(); renderHome(); }
  else if (act === 'fold-all' || act === 'open-all') {
    const v = act === 'fold-all' ? 'fold' : 'open';
    const ks = state.tab === 'rec' ? RCAT_KEYS.map(k => 'r:' + k) : WISH_CAT_KEYS;
    ks.forEach(k => { state.wfold[k] = v; }); saveFold(); renderHome();
  }
});

/* ---------- 여러 개 골라서 지우기 ---------- */
function selLink() { return `<button type="button" class="mini-link sel-link" data-act="select">${state.sel ? '선택 끝' : '선택'}</button>`; }
function renderSelBar() {
  const bar = $('#sel-bar'), n = state.sel ? state.sel.size : 0;
  bar.hidden = !state.sel;
  $('#btn-new').hidden = !!state.sel;
  if (state.sel) $('#btn-calc').hidden = true;
  if (!state.sel) return;
  $('#sel-count').textContent = n ? `${n}개 선택` : '지울 것을 눌러 고르세요';
  $('#sel-del').disabled = !n;
  $('#sel-main').hidden = false; $('#sel-ask').hidden = true;
}
$('#sel-cancel').addEventListener('click', () => { state.sel = null; renderHome(); });
$('#sel-del').addEventListener('click', () => {
  if (!state.sel || !state.sel.size) return;
  $('#sel-ask-msg').textContent = `${state.sel.size}개를 지울까요? 사진까지 지워져요.`;
  $('#sel-main').hidden = true; $('#sel-ask').hidden = false;
});
$('#sel-no').addEventListener('click', () => { $('#sel-main').hidden = false; $('#sel-ask').hidden = true; });
$('#sel-yes').addEventListener('click', async () => {
  const ids = [...(state.sel || [])];
  for (const id of ids) {
    const it = state.items.find(i => i.id === id);
    if (it) { await store.remove(it); (it.photos || []).forEach(p => dropURL(p.id)); }
  }
  await load();
  state.sel = null;
  renderHome();
  toast(`${ids.length}개를 지웠어요`);
});

/* ---------- 공용: 사진 칸, 고르기, 삭제 ---------- */
function setSeg(sel, val) { $$(sel + ' button').forEach(b => b.classList.toggle('is-on', b.dataset.v === val)); }
function photosHTML(d, ocr) {
  return d.item.photos.map(p => `<div class="ph" data-ph="${esc(p.id)}">
    <img ${d.newBlobs.has(p.id) ? `src="${d.newBlobs.get(p.id).url}"` : `data-pid="${esc(p.id)}"`} alt="">
    <button type="button" class="ph-x" data-ph-del aria-label="사진 빼기">×</button>
    ${ocr ? '<button type="button" class="ph-ocr" data-ph-ocr>글자 읽기</button>' : ''}
  </div>`).join('');
}
async function addPhotos(files, d) {
  const added = [];
  for (const f of files) {
    try {
      const blob = await shrink(f);
      const id = uid();
      d.newBlobs.set(id, { blob, url: URL.createObjectURL(blob), src: f });
      d.item.photos.push({ id });
      added.push(f);
    } catch { toast('읽을 수 없는 사진이 있어 건너뛰었어요'); }
  }
  return added;
}
function removePhoto(d, id) {
  d.item.photos = d.item.photos.filter(p => p.id !== id);
  if (d.newBlobs.has(id)) { URL.revokeObjectURL(d.newBlobs.get(id).url); d.newBlobs.delete(id); }
  else d.removed.push(id);
}
function catChipsHTML(cur, guess, keys = CAT_KEYS, labels = CATS) {
  return keys.map(k => `<button type="button" class="chip cat-${k} ${cur === k ? 'is-on' : ''} ${guess === k ? 'guess' : ''}" data-v="${k}">${catSq(k)}${labels[k]}</button>`).join('');
}
async function saveDraft() {
  const d = state.draft;
  const add = d.item.photos.filter(p => d.newBlobs.has(p.id)).map(p => ({ id: p.id, itemId: d.item.id, blob: d.newBlobs.get(p.id).blob }));
  d.item.updatedAt = Date.now();
  await store.save(d.item, add, d.removed);
  d.newBlobs.forEach(x => URL.revokeObjectURL(x.url));
  d.removed.forEach(dropURL);
  try { if (navigator.storage?.persist) navigator.storage.persist(); } catch { /* 무시 */ }
  await load();
}
function bindDelete(viewSel) {
  const zone = $(viewSel + ' .danger-zone');
  zone.addEventListener('click', async e => {
    const conf = $('.confirm', zone);
    if (e.target.closest('[data-del]')) { conf.hidden = false; e.target.closest('[data-del]').hidden = true; }
    else if (e.target.closest('[data-del-no]')) { conf.hidden = true; $('[data-del]', zone).hidden = false; }
    else if (e.target.closest('[data-del-yes]')) {
      const src = state.items.find(i => i.id === state.draft.item.id);
      if (src) { await store.remove(src); (src.photos || []).forEach(p => dropURL(p.id)); }
      await load();
      state.draft = null;
      toast('삭제했어요');
      history.replaceState({ view: 'home' }, '');
      route({ view: 'home' });
    }
  });
}
function resetDelete(viewSel, isNew) {
  const zone = $(viewSel + ' .danger-zone');
  zone.hidden = isNew;
  $('.confirm', zone).hidden = true;
  $('[data-del]', zone).hidden = false;
}

/* =========================================================
   내 위시 편집
   ========================================================= */
function startWish(id) {
  const src = id ? state.items.find(i => i.id === id) : null;
  const item = src ? JSON.parse(JSON.stringify(src)) : {
    id: uid(), kind: 'wish', title: '', brand: '', code: '', size: '', link: '', shop: '', who: '나', cat: null,
    prices: [], target: 0, status: 'want', memo: '', photos: [], createdAt: Date.now(),
  };
  state.draft = { kind: 'wish', item, isNew: !src, newBlobs: new Map(), removed: [], catTouched: !!(src && src.cat), shopTouched: !!(src && src.shop) };
}

function renderWish() {
  const d = state.draft, w = d.item;
  $('#wish-title').textContent = d.isNew ? '위시 추가' : '위시';
  $('#view-wish').classList.toggle('saved-item', !d.isNew);
  $('#w-quick').value = '';
  $('#w-quick').closest('.block').hidden = !d.isNew;
  ['title', 'brand', 'code', 'size', 'link', 'memo'].forEach(k => { $('#w-' + k).value = w[k] || ''; });
  setSeg('#w-status', w.status || 'want');
  renderWho(); renderWishCat(); renderShop(); renderPrices(); renderWishSearch();
  d.tagTokens = []; renderWishOcr(); wishOcrStatus('');
  $('#w-photos').innerHTML = photosHTML(d, false);
  hydrate($('#w-photos'));
  resetDelete('#view-wish', d.isNew);
}
function renderWishOcr() {
  const d = state.draft;
  const toks = d.tagTokens || [];
  $('#w-ocr-box').hidden = !toks.length;
  $('#w-ocr-chips').innerHTML = toks.map(t => `<button type="button" class="chip ocr-chip" data-tok="${esc(t)}">${esc(t)}</button>`).join('');
}

/* 옷 태그·품번 라벨 글자에서 품번·사이즈·색상·가격 찾기 */
function parseTag(text) {
  const out = { code: '', size: '', color: '', price: 0 };
  const flat = text.replace(/[|]/g, ' ');
  let m = /(품\s*번|STYLE\s*(?:NO\.?|#)?|ART\.?\s*NO\.?|MODEL|모델명?|제품\s*번호|상품\s*코드|품목\s*코드)\s*[:.#]?\s*([A-Za-z0-9][A-Za-z0-9-]{3,})/i.exec(flat);
  if (m) out.code = m[2];
  if (!out.code) {
    const cands = flat.split(/[\s,:/()]+/).filter(isCode).sort((x, y) => y.length - x.length);
    if (cands.length) out.code = cands[0];
  }
  m = /(사이즈|SIZE|치수)\s*[:.]?\s*([A-Za-z0-9]{1,4}(?:\s*\(\s*\w{1,4}\s*\))?)/i.exec(flat);
  if (m) out.size = m[2].replace(/\s/g, '');
  if (!out.size) {
    const sz = flat.split(/[\s,:/]+/).find(t => /^(XS|S|M|L|XL|XXL|2XL|3XL|FREE)$/i.test(t) || (/^\d{2,3}$/.test(t) && ((+t >= 44 && +t <= 120) || (+t >= 220 && +t <= 300 && +t % 5 === 0))));
    if (sz) out.size = sz.toUpperCase();
  }
  m = /(색상|COLOR|컬러)\s*[:.]?\s*([가-힣A-Za-z]{2,12}(?:\s?\(\w{1,4}\))?)/i.exec(flat);
  if (m) out.color = m[2];
  const prices = [...flat.matchAll(/(?:₩|KRW)?\s*(\d{1,3}(?:,\d{3})+)\s*원?/g)].map(x => +x[1].replace(/,/g, '')).filter(n => n >= 1000);
  if (prices.length) out.price = Math.max(...prices);
  return out;
}
async function readBarcode(blob) {
  try {
    if (!('BarcodeDetector' in window)) return '';
    const bd = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'code_128', 'code_39'] });
    const bmp = await createImageBitmap(blob);
    const res = await bd.detect(bmp);
    if (bmp.close) bmp.close();
    return res && res[0] ? res[0].rawValue : '';
  } catch { return ''; }
}
function wishOcrStatus(msg, busy) { const el = $('#w-ocr-status'); el.textContent = msg; el.classList.toggle('busy', !!busy); }
$('#w-tag-input').addEventListener('change', async e => {
  const files = await takeFiles(e.target);
  const d = state.draft; if (!files.length || !d) return;
  await addPhotos(files, d);
  $('#w-photos').innerHTML = photosHTML(d, false); hydrate($('#w-photos'));
  const w = d.item;
  const found = [];
  const bc = await readBarcode(files[0]);
  ocrReport = wishOcrStatus;
  wishOcrStatus('글자 인식 준비 중…', true);
  let tag = { code: '', size: '', color: '', price: 0 };
  try {
    const worker = await getOcrWorker();
    let text = '';
    for (const f of files) { const { data } = await worker.recognize(f); text += '\n' + ((data && data.text) || ''); }
    if (state.draft !== d) return;
    tag = parseTag(text);
    d.tagTokens = tokenize(text).filter(t => !/^(품번|사이즈|SIZE|색상|COLOR|가격|원산지|제조)/i.test(t)).slice(0, 30);
    renderWishOcr();
  } catch (err) {
    wishOcrStatus(bc ? '' : ocrFailMsg(err));
  }
  if (!tag.code && bc && /[A-Za-z]/.test(bc)) tag.code = bc;
  if (tag.code && !w.code) { w.code = tag.code; found.push(`품번 ${tag.code}`); }
  const opt = [tag.size, tag.color].filter(Boolean).join(' / ');
  if (opt && !w.size) { w.size = opt; found.push(`옵션 ${opt}`); }
  if (tag.price) { w.prices = w.prices || []; w.prices.push({ amount: tag.price, where: '태그 가격', date: today() }); found.push(`가격 ${fmtPrice(tag.price)}`); }
  if (bc && bc !== w.code && /^\d{8,14}$/.test(bc)) { w.memo = [w.memo, `바코드 ${bc}`].filter(Boolean).join('\n'); found.push('바코드'); }
  if (!w.cat) w.cat = 'fashion';
  ['code', 'size', 'memo'].forEach(k => { $('#w-' + k).value = w[k] || ''; });
  renderPrices(); renderWishSearch(); renderWishCat();
  wishOcrStatus(found.length ? `찾았어요: ${found.join(' · ')}` : '품번을 찾지 못했어요. 아래 글자를 누르거나 직접 적어 주세요.');
});
$('#w-ocr-chips').addEventListener('click', e => {
  const c = e.target.closest('[data-tok]'); const d = state.draft; if (!c || !d) return;
  const t = c.dataset.tok;
  if (isCode(t) && !d.item.code) { d.item.code = t; $('#w-code').value = t; }
  else { d.item.title = d.item.title ? `${d.item.title} ${t}` : t; $('#w-title').value = d.item.title; }
  c.classList.add('used');
  renderWishSearch();
});

function renderWho() {
  const w = state.draft.item;
  const used = wishes().map(x => x.who).filter(Boolean);
  const all = [...new Set([...DEFAULT_WHO, ...used, w.who].filter(x => x && x !== '나'))];
  $('#w-who').innerHTML = all.map(x => `<button type="button" class="chip ${w.who === x ? 'is-on' : ''}" data-v="${esc(x)}">${esc(x)}</button>`).join('') + '<button type="button" class="chip add" data-add>+ 직접</button>';
}
function renderWishCat() { $('#w-cat').innerHTML = catChipsHTML(state.draft.item.cat ? wcatOf(state.draft.item) : null, null, WISH_CAT_KEYS, WCATS); }
function shopChipsHTML(cur) {
  const all = [...new Set([...SHOPS, ...state.items.map(i => i.shop).filter(Boolean), cur].filter(Boolean))];
  return all.map(s => `<button type="button" class="chip ${cur === s ? 'is-on' : ''}" data-v="${esc(s)}">${esc(s)}</button>`).join('') + '<button type="button" class="chip add" data-add>+ 직접</button>';
}
function renderShop() { /* 구매처 칸 없음: 링크에서 자동으로만 정해짐 */ }
function bindShopChips(el, get, set, after) {
  el.addEventListener('click', e => {
    if (e.target.closest('[data-add]')) {
      const inp = document.createElement('input');
      inp.className = 'chip-input'; inp.placeholder = '예: 이케아'; inp.enterKeyHint = 'done';
      e.target.closest('[data-add]').replaceWith(inp); inp.focus();
      const commit = () => { const v = inp.value.trim(); if (v) set(v); after(); };
      inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); inp.blur(); } });
      inp.addEventListener('blur', commit, { once: true });
      return;
    }
    const b = e.target.closest('[data-v]'); if (!b) return;
    set(get() === b.dataset.v ? '' : b.dataset.v);
    after();
  });
}
function renderPrices() {
  const w = state.draft.item;
  const low = lowest(w);
  $('#w-prices').innerHTML = (w.prices || []).map((p, i) => `<div class="price-row ${low === p && w.prices.length > 1 ? 'low' : ''}">
    <span><b>${fmtPrice(p.amount)}</b> <span class="where">${esc(p.where || '')}</span></span>
    <small>${fmtDate(p.date)}</small>
    <button type="button" class="price-x" data-pdel="${i}" aria-label="이 가격 지우기">×</button>
  </div>`).join('');
}
function renderWishSearch() {
  const w = state.draft.item;
  const q = (w.code || [w.brand, w.title].filter(Boolean).join(' ')).trim();
  const link = safeLink(w.link);
  $('#w-search').innerHTML = (link ? `<a class="mini-btn sun" href="${esc(link)}" target="_blank" rel="noopener">상품 페이지 열기</a>` : '') + (q ? `
    <a class="mini-btn ${link ? '' : 'sun'}" href="https://search.shopping.naver.com/search/all?query=${encodeURIComponent(q)}" target="_blank" rel="noopener">네이버쇼핑 가격 보기</a>
` : '');
}

// 한 줄로 적기 → 칸 채우기
let quickTimer;
$('#w-quick').addEventListener('input', e => {
  clearTimeout(quickTimer);
  quickTimer = setTimeout(() => applyQuick(e.target.value), 200);
});
$('#w-quick').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } });
function applyQuick(text) {
  const d = state.draft; if (!d) return;
  const w = d.item;
  const p = parseLine(text);
  w.title = p.title; w.code = p.code; w.size = p.size; w.raw = p.raw; w.link = p.link;
  if (!d.shopTouched) w.shop = shopFromLink(p.link);
  if (p.who) w.who = p.who;
  if (!d.catTouched) w.cat = toCat(p.cat, p.title, WCATS);
  w.prices = (w.prices || []).filter(x => !x.quick);
  if (p.price) w.prices.unshift({ amount: p.price, where: '메모', date: today(), quick: true });
  ['title', 'code', 'size', 'link'].forEach(k => { $('#w-' + k).value = w[k] || ''; });
  $('#w-quick-hint').textContent = text.trim()
    ? [p.who && `누구: ${p.who}`, p.size && `옵션: ${p.size}`, p.code && `품번: ${p.code}`, p.price && `가격: ${fmtPrice(p.price)}`, p.link && '링크 있음', p.cat && `분류: ${WCATS[toCat(p.cat, p.title, WCATS)]}`].filter(Boolean).join(' · ') || '아래 칸을 확인해 주세요.'
    : '평소 메모하던 그대로 적으면 아래 칸이 알아서 채워져요.';
  renderWho(); renderWishCat(); renderShop(); renderPrices(); renderWishSearch();
}

['title', 'brand', 'code', 'size', 'link', 'memo'].forEach(k => $('#w-' + k).addEventListener('input', e => {
  if (!state.draft) return;
  const d = state.draft;
  d.item[k] = e.target.value;
  if (k === 'link') {
    d.item.link = e.target.value.trim();
    if (!d.shopTouched) { d.item.shop = shopFromLink(d.item.link); renderShop(); }
  }
  if (k !== 'memo' && k !== 'size') renderWishSearch();
}));
$('#w-link').addEventListener('change', e => {
  const d = state.draft; if (!d || !d.item.link) return;
  let u = d.item.link;
  if (!/^https?:\/\//i.test(u) && /\./.test(u)) u = 'https://' + u;
  d.item.link = cleanLink(u);
  e.target.value = d.item.link;
  renderWishSearch();
});
$('#w-status').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !state.draft) return;
  state.draft.item.status = b.dataset.v;
  if (b.dataset.v === 'bought' && !state.draft.item.boughtAt) state.draft.item.boughtAt = today();
  setSeg('#w-status', b.dataset.v);
});
$('#w-who').addEventListener('click', e => {
  const d = state.draft; if (!d) return;
  if (e.target.closest('[data-add]')) {
    const inp = document.createElement('input');
    inp.className = 'chip-input'; inp.placeholder = '예: 동생'; inp.enterKeyHint = 'done';
    e.target.closest('[data-add]').replaceWith(inp); inp.focus();
    const commit = () => { const v = inp.value.trim(); if (v) d.item.who = v; renderWho(); };
    inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); inp.blur(); } });
    inp.addEventListener('blur', commit, { once: true });
    return;
  }
  const b = e.target.closest('[data-v]'); if (!b) return;
  d.item.who = d.item.who === b.dataset.v ? '나' : b.dataset.v; renderWho();
});
$('#w-cat').addEventListener('click', e => {
  const b = e.target.closest('[data-v]'); if (!b || !state.draft) return;
  const d = state.draft;
  d.item.cat = d.item.cat === b.dataset.v ? null : b.dataset.v;
  d.catTouched = true;
  renderWishCat();
});
function addPriceFromInputs() {
  const d = state.draft; if (!d) return;
  const amount = parsePrice($('#w-p-amount').value);
  if (!amount) { toast('금액을 적어주세요 (예: 34만)'); $('#w-p-amount').focus(); return; }
  d.item.prices = d.item.prices || [];
  d.item.prices.push({ amount, where: $('#w-p-where').value.trim(), date: today() });
  $('#w-p-amount').value = ''; $('#w-p-where').value = '';
  renderPrices();
}
$('#w-p-add').addEventListener('click', addPriceFromInputs);
[$('#w-p-amount'), $('#w-p-where')].forEach(inp => inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addPriceFromInputs(); } }));
$('#w-prices').addEventListener('click', e => {
  const b = e.target.closest('[data-pdel]'); if (!b || !state.draft) return;
  state.draft.item.prices.splice(Number(b.dataset.pdel), 1);
  renderPrices();
});
$('#w-photo-input').addEventListener('change', async e => {
  const files = await takeFiles(e.target);
  if (!files.length || !state.draft) return;
  await addPhotos(files, state.draft);
  $('#w-photos').innerHTML = photosHTML(state.draft, false); hydrate($('#w-photos'));
});
$('#w-photos').addEventListener('click', e => {
  const ph = e.target.closest('[data-ph]'); if (!ph || !e.target.closest('[data-ph-del]')) return;
  removePhoto(state.draft, ph.dataset.ph);
  $('#w-photos').innerHTML = photosHTML(state.draft, false); hydrate($('#w-photos'));
});
$('#btn-wish-save').addEventListener('click', async () => {
  const d = state.draft; if (!d) return;
  const w = d.item;
  ['title', 'brand', 'code', 'size', 'link', 'memo'].forEach(k => { w[k] = (w[k] || '').trim(); });
  if (!w.title && !w.code && !w.brand) { toast('무엇인지 적어주세요'); $('#w-quick').closest('.block').hidden ? $('#w-title').focus() : $('#w-quick').focus(); return; }
  (w.prices || []).forEach(p => { delete p.quick; });
  w.cat = w.cat ? wcatOf(w) : wishGuess([w.title, w.brand, w.memo].join(' '), !!w.size);
  try { await saveDraft(); } catch { toast('저장하지 못했어요. 저장 공간을 확인해 주세요.'); return; }
  state.draft = null;
  state.tab = 'wish';
  toast('위시템에 담았어요');
  history.replaceState({ view: 'home' }, '');
  route({ view: 'home' });
});
bindDelete('#view-wish');

/* =========================================================
   여러 줄 가져오기
   ========================================================= */
function renderPaste() {
  $('#paste-text').value = '';
  $('#paste-status').textContent = '';
  state.pasteRows = [];
  state.pasteShop = '';
  renderPastePreview();
}
function pasteStatus(msg, busy) { const el = $('#paste-status'); el.textContent = msg; el.classList.toggle('busy', !!busy); }

// 장바구니 캡처 글자 → 상품 줄만 골라내기
const CART_JUNK = /(장바구니|전체선택|선택삭제|삭제|주문|결제|배송비|무료배송|배송|도착|쿠폰|할인|적립|포인트|수량|옵션\s*변경|옵션변경|구매하기|찜|품절|판매자|스토어|합계|총\s*상품|상품금액|원\s*이상|혜택|N페이|네이버페이|최대|카드|이벤트|오늘출발|내일|모레)/;
function cartLines(text) {
  const out = [];
  text.split(/\n+/).map(l => l.replace(/[|•·□☐▢✓✔]/g, ' ').replace(/\s+/g, ' ').trim()).forEach(l => {
    if (!l) return;
    const priceOnly = /^[\d,]+\s*원$/.test(l) || /^\d{1,3}(,\d{3})+$/.test(l);
    if (priceOnly) {
      const prev = out[out.length - 1];
      if (prev && !/원|만/.test(prev)) out[out.length - 1] = `${prev} / ${l.replace(/\s/g, '')}${/원$/.test(l) ? '' : '원'}`;
      return;
    }
    if (l.length < 4 || CART_JUNK.test(l) || !/[가-힣A-Za-z]{2}/.test(l)) return;
    if (/^옵션\s*[:：]/.test(l) && out.length) { out[out.length - 1] += ' ' + l.replace(/^옵션\s*[:：]\s*/, ''); return; }
    out.push(l);
  });
  return out.slice(0, 30);
}
$('#paste-shot').addEventListener('change', async e => {
  const files = await takeFiles(e.target);
  if (!files.length) return;
  ocrReport = pasteStatus;
  pasteStatus('글자 인식 준비 중…', true);
  try {
    const worker = await getOcrWorker();
    let lines = [];
    for (const f of files) { const { data } = await worker.recognize(f); lines = lines.concat(cartLines((data && data.text) || '')); }
    if (!lines.length) { pasteStatus('상품 이름을 찾지 못했어요. 직접 적어 주세요.'); return; }
    const ta = $('#paste-text');
    ta.value = (ta.value.trim() ? ta.value.trim() + '\n' : '') + lines.join('\n');
    ta.dispatchEvent(new Event('input'));
    if (!state.pasteShop && /naver|네이버|N페이/i.test(lines.join(' '))) { state.pasteShop = '네이버'; renderPastePreview(); }
    pasteStatus(`${lines.length}줄을 찾았어요. 아래에서 빼고 싶은 줄은 체크를 풀어주세요.`);
  } catch (err) {
    pasteStatus(ocrFailMsg(err));
  }
});
function renderPastePreview() {
  const rows = state.pasteRows;
  $('#paste-preview-wrap').hidden = !rows.length;
  $('#paste-count').textContent = `${rows.filter(r => r.on).length}개`;
  $('#paste-preview').innerHTML = rows.map((r, i) => `<label class="pp-row">
    <input type="checkbox" data-pp="${i}" ${r.on ? 'checked' : ''}>
    <span><span class="pp-title">${catSq(toCat(r.p.cat, r.p.title, WCATS))} ${esc(r.p.title || r.p.code || r.p.raw)}</span>
      <span class="pp-parts">
        ${r.p.who ? `<span><b>누구</b>${esc(r.p.who)}</span>` : ''}
        ${r.p.size ? `<span><b>옵션</b>${esc(r.p.size)}</span>` : ''}
        ${r.p.code ? `<span><b>품번</b>${esc(r.p.code)}</span>` : ''}
        ${r.p.link ? '<span><b>링크</b>있음</span>' : ''}
        ${r.p.price ? `<span><b>가격</b>${fmtPrice(r.p.price)}</span>` : ''}
        ${r.p.cat ? `<span><b>분류</b>${WCATS[toCat(r.p.cat, r.p.title, WCATS)]}</span>` : ''}
      </span></span>
  </label>`).join('');
}
let pasteTimer;
$('#paste-text').addEventListener('input', e => {
  clearTimeout(pasteTimer);
  pasteTimer = setTimeout(() => {
    state.pasteRows = e.target.value.split(/\n+/).map(l => l.trim()).filter(l => l.length > 1).map(l => ({ p: parseLine(l), on: true }));
    renderPastePreview();
  }, 200);
});
$('#paste-preview').addEventListener('change', e => {
  const c = e.target.closest('[data-pp]'); if (!c) return;
  state.pasteRows[Number(c.dataset.pp)].on = c.checked;
  $('#paste-count').textContent = `${state.pasteRows.filter(r => r.on).length}개`;
});
$('#btn-paste-save').addEventListener('click', async () => {
  const rows = state.pasteRows.filter(r => r.on);
  if (!rows.length) { toast('붙여넣은 줄이 없어요'); return; }
  const now = Date.now();
  const items = rows.map((r, i) => ({
    id: uid(), kind: 'wish', title: r.p.title || r.p.raw, brand: '', code: r.p.code, size: r.p.size, who: r.p.who || '나',
    link: r.p.link, shop: state.pasteShop || shopFromLink(r.p.link),
    cat: toCat(r.p.cat, r.p.title, WCATS), prices: r.p.price ? [{ amount: r.p.price, where: state.pasteShop || '메모', date: today() }] : [], target: 0,
    status: 'want', memo: '', raw: r.p.raw, photos: [], createdAt: now - i,
  }));
  await store.putMany(items, []);
  await load();
  state.tab = 'wish';
  toast(`${items.length}개를 위시에 담았어요`);
  history.replaceState({ view: 'home' }, '');
  route({ view: 'home' });
});

/* =========================================================
   추천 저장소 편집
   ========================================================= */
function startRec(id) {
  const src = id ? state.items.find(i => i.id === id) : null;
  const item = src ? JSON.parse(JSON.stringify(src)) : {
    id: uid(), kind: 'rec', title: '', cat: null, source: '', link: '', memo: '', tried: false, tryNote: '', photos: [], createdAt: Date.now(),
  };
  state.draft = { kind: 'rec', item, isNew: !src, newBlobs: new Map(), removed: [], catTouched: !!(src && src.cat), guess: null, target: 'title', tokens: [], ocrText: '' };
}
function renderRec() {
  const d = state.draft, r = d.item;
  $('#rec-title').textContent = d.isNew ? '추천 담기' : '추천 수정';
  $('#view-rec').classList.toggle('saved-item', !d.isNew);
  $('#r-titleinp').value = r.title || '';
  $('#r-link').value = r.link || '';
  $('#ocr-status').textContent = '';
  $('#ocr-status').classList.remove('busy');
  renderRecPhotos(); renderRecCat(); renderOcrChips();
  resetDelete('#view-rec', d.isNew);
}
function renderRecPhotos() { $('#r-photos').innerHTML = photosHTML(state.draft, true); hydrate($('#r-photos')); }
function renderRecCat() {
  const d = state.draft;
  $('#r-cat').innerHTML = catChipsHTML(d.item.cat ? rcatOf(d.item) : null, d.guess, RCAT_KEYS, RCATS);
  $('#r-cat-guess').textContent = d.guess && !d.catTouched ? `캡처를 보고 '${RCATS[d.guess]}'로 골라뒀어요` : '';
}
function regGuess() {
  const d = state.draft; if (!d) return;
  const g = recGuess([d.ocrText, d.item.title, d.item.memo, d.item.link].join(' '));
  d.guess = g;
  if (!d.catTouched && g) d.item.cat = g;
  renderRecCat();
}
$('#r-titleinp').addEventListener('input', e => { if (state.draft) { state.draft.item.title = e.target.value; } });
$('#r-titleinp').addEventListener('change', regGuess);
$('#r-link').addEventListener('input', e => {
  if (!state.draft) return;
  const r = state.draft.item; r.link = e.target.value.trim();
  if (!r.source) {
    const s = /instagram/.test(r.link) ? '인스타' : /(x\.com|twitter)/.test(r.link) ? 'X' : /threads/.test(r.link) ? '스레드' : /blog/.test(r.link) ? '블로그' : r.link ? '웹' : '';
    if (s) r.source = s;
  }
});
$('#r-cat').addEventListener('click', e => {
  const b = e.target.closest('[data-v]'); if (!b || !state.draft) return;
  const d = state.draft;
  d.item.cat = d.item.cat === b.dataset.v ? null : b.dataset.v;
  d.catTouched = true;
  renderRecCat();
});
$('#r-photo-input').addEventListener('change', async e => {
  const files = await takeFiles(e.target);
  const d = state.draft; if (!files.length || !d) return;
  const added = await addPhotos(files, d);
  renderRecPhotos();
  for (const f of added) await readText(f);
});
$('#r-photos').addEventListener('click', async e => {
  const ph = e.target.closest('[data-ph]'); if (!ph) return;
  const d = state.draft, id = ph.dataset.ph;
  if (e.target.closest('[data-ph-del]')) { removePhoto(d, id); renderRecPhotos(); }
  else if (e.target.closest('[data-ph-ocr]')) {
    const nb = d.newBlobs.get(id);
    const blob = nb ? (nb.src || nb.blob) : (await store.photo(id))?.blob;
    if (blob) readText(blob);
  }
});

/* 사진 속 글자 읽기 (기기 안에서 Tesseract) */
const OCR_LIB = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
let ocrWorkerP = null;
function loadScript(src) {
  return new Promise((res, rej) => {
    if (window.Tesseract) return res();
    const s = document.createElement('script');
    s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error('script'));
    document.head.appendChild(s);
  });
}
function ocrStatus(msg, busy) {
  const el = $('#ocr-status');
  if (msg) $('#ocr-box').hidden = false;
  el.textContent = msg; el.classList.toggle('busy', !!busy);
}
let ocrReport = (msg, busy) => ocrStatus(msg, busy);
/* OCR에 넣기 전에 사진 크기 줄이기: 카메라 원본(1200만 화소 이상)을 그대로 넣으면 폰 메모리가 모자라 멈춘다 */
async function ocrPrep(blob) {
  try {
    const src = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    const k = Math.min(1, 2400 / Math.max(src.width, src.height), Math.sqrt(3000000 / (src.width * src.height)));
    // 크기가 작아도 한 번 다시 그려서 새 파일로 만든다 (원본 파일을 다시 읽지 않게)
    const c = document.createElement('canvas');
    c.width = Math.round(src.width * k); c.height = Math.round(src.height * k);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    if (src.close) src.close();
    return (await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92))) || blob;
  } catch { return blob; }
}
// 실패하면 원인을 짧게 함께 보여준다 (다음에 고칠 때 단서)
const ocrFailMsg = err => (navigator.onLine === false
  ? '인터넷이 연결되지 않았어요. 글자 읽기는 처음 한 번 인터넷이 필요해요.'
  : '글자를 읽지 못했어요. 한 번 더 눌러보거나 직접 입력해 주세요.') + (err && err.message ? ` (${String(err.message).slice(0, 60)})` : '');
function getOcrWorker() {
  if (!ocrWorkerP) {
    ocrWorkerP = (async () => {
      await loadScript(OCR_LIB);
      return window.Tesseract.createWorker(['kor', 'eng'], 1, {
        logger: m => {
          if (!m || typeof m.progress !== 'number') return;
          const pct = Math.round(m.progress * 100);
          ocrReport(m.status && m.status.includes('recogniz') ? `글자 읽는 중… ${pct}%` : `글자 인식 준비 중… ${pct}% (처음 한 번만 오래 걸려요)`, true);
        },
      });
    })();
    ocrWorkerP = ocrWorkerP.then(w => {
      // 인식 중 오류가 나면 작업자를 버리고 다음에 새로 만든다
      const orig = w.recognize.bind(w);
      w.recognize = async (img, ...rest) => {
        try { return await orig(await ocrPrep(img), ...rest); }
        catch (e) { ocrWorkerP = null; try { w.terminate(); } catch {} throw e; }
      };
      return w;
    });
    ocrWorkerP.catch(() => { ocrWorkerP = null; });
  }
  return ocrWorkerP;
}
function tokenize(text) {
  const clean = s => s.replace(/[^가-힣A-Za-z0-9@#&'.%,_\- ]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[.\-_, ]+$/, '');
  const lines = text.split(/\n+/).map(clean).filter(l => l.length >= 2 && l.length <= 28);
  const words = text.split(/[\s|/·]+/).map(clean).filter(w => w.length >= 2 && w.length <= 18 && !/^\d+$/.test(w));
  const seen = new Set(), out = [];
  [...lines, ...words].forEach(t => { const k = t.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(t); } });
  return out.slice(0, 50);
}
async function readText(blob) {
  const d = state.draft; if (!d) return;
  ocrReport = (m, b) => ocrStatus(m, b);
  ocrStatus('글자 인식 준비 중…', true);
  try {
    const worker = await getOcrWorker();
    const { data } = await worker.recognize(blob);
    if (state.draft !== d) return;
    const text = (data && data.text) || '';
    d.ocrText += '\n' + text;
    const known = new Set(d.tokens.map(t => t.toLowerCase()));
    tokenize(text).forEach(t => { if (!known.has(t.toLowerCase())) d.tokens.push(t); });
    renderOcrChips();
    regGuess();
    ocrStatus(d.tokens.length ? '찾은 글자예요. 누르면 이름에 들어가요.' : '글자를 찾지 못했어요. 직접 입력해 주세요.');
  } catch (err) {
    ocrStatus(ocrFailMsg(err));
  }
}
function renderOcrChips() {
  const d = state.draft;
  $('#ocr-box').hidden = !d.tokens.length && !$('#ocr-status').textContent;
  $('#ocr-chips').innerHTML = d.tokens.map(t => `<button type="button" class="chip ocr-chip" data-tok="${esc(t)}">${esc(t)}</button>`).join('');
}
$('#ocr-chips').addEventListener('click', e => {
  const c = e.target.closest('[data-tok]'); const d = state.draft;
  if (!c || !d) return;
  const t = c.dataset.tok, r = d.item;
  r.title = r.title ? `${r.title} ${t}` : t; $('#r-titleinp').value = r.title;
  c.classList.add('used');
  regGuess();
});
$('#btn-rec-save').addEventListener('click', async () => {
  const d = state.draft; if (!d) return;
  const r = d.item;
  r.title = (r.title || '').trim(); r.memo = (r.memo || '').trim();
  if (!r.title && !r.photos.length) { toast('캡처를 넣거나 이름을 적어주세요'); return; }
  if (!r.title) r.title = (d.tokens[0] || '').slice(0, 30) || '이름 없는 추천';
  r.cat = r.cat ? rcatOf(r) : (d.guess || 'etc');
  try { await saveDraft(); } catch { toast('저장하지 못했어요. 저장 공간을 확인해 주세요.'); return; }
  state.draft = null;
  state.tab = 'rec';
  toast('추천템에 담았어요');
  history.replaceState({ view: 'home' }, '');
  route({ view: 'home' });
});
bindDelete('#view-rec');

/* =========================================================
   추천 상세
   ========================================================= */
function renderRecView() {
  const r = state.items.find(i => i.id === state.viewId);
  const body = $('#rv-body');
  if (!r) { body.innerHTML = '<div class="empty-state"><h2>추천을 찾지 못했어요</h2></div>'; return; }
  const rc = rcatOf(r);
  $('#rv-top').textContent = RCATS[rc];
  const q = encodeURIComponent(r.title || '');
  const link = safeLink(r.link);
  const moved = wishes().some(w => w.fromRec === r.id);
  body.innerHTML = `
    <div class="rv-head">
      <span class="rv-cat cat-${rc}">${catSq(rc)}${esc(RCATS[rc])}</span>
      <h1 class="rv-title">${esc(r.title || '이름 없음')}</h1>
      <div class="rv-meta">${r.source ? `<span>${esc(r.source)}에서 봄</span>` : ''}<span>${fmtDate(new Date(r.createdAt).toISOString().slice(0, 10))} 담음</span></div>
    </div>
    ${r.memo ? `<p class="rv-memo">${esc(r.memo)}</p>` : ''}
    <div class="rv-actions">
      <button type="button" class="mini-btn sun" data-rv="towish" ${moved ? 'disabled' : ''}>${moved ? '위시템에 있어요' : '위시템으로 옮기기'}</button>
      <button type="button" class="mini-btn" data-rv="tried" aria-pressed="${!!r.tried}">${r.tried ? '해봤어요 ✓' : '해봤어요'}</button>
      ${q ? `<a class="mini-btn" href="https://search.naver.com/search.naver?query=${q}" target="_blank" rel="noopener">네이버 검색</a>
      <a class="mini-btn" href="https://search.shopping.naver.com/search/all?query=${q}" target="_blank" rel="noopener">쇼핑 검색</a>` : ''}
      ${link ? `<a class="mini-btn" href="${esc(link)}" target="_blank" rel="noopener">원문 열기</a>` : ''}
    </div>
    ${r.tried ? `<label class="field rv-tried"><span class="lbl">해보니 어땠나요</span><textarea id="rv-trynote" rows="2" placeholder="예: 탄산 약하고 레몬 향 좋음. 재구매!">${esc(r.tryNote || '')}</textarea></label>` : ''}
    ${(r.photos || []).length ? `<details class="rv-shotbox"><summary>캡처 원본 보기 <span>${r.photos.length}장</span></summary><div class="rv-shots">${r.photos.map(p => `<button type="button" data-lb="${esc(p.id)}"><img data-pid="${esc(p.id)}" alt="캡처"></button>`).join('')}</div></details>` : ''}`;
  hydrate(body);
}
$('#btn-rv-edit').addEventListener('click', () => { state.draft = null; go('rec', { id: state.viewId }); });
$('#rv-body').addEventListener('click', async e => {
  const lb = e.target.closest('[data-lb]');
  if (lb) { $('#lb-img').src = await photoURL(lb.dataset.lb); $('#lightbox').hidden = false; return; }
  const a = e.target.closest('[data-rv]')?.dataset.rv;
  const r = state.items.find(i => i.id === state.viewId);
  if (!a || !r) return;
  if (a === 'tried') {
    r.tried = !r.tried;
    await store.save(r);
    renderRecView();
    toast(r.tried ? '해봤어요로 표시했어요' : '표시를 뺐어요');
  } else if (a === 'towish') {
    const w = { id: uid(), kind: 'wish', title: r.title, brand: '', code: '', size: '', who: '나', cat: toCat(rcatOf(r), r.title, WCATS), prices: [], target: 0, status: 'want', memo: r.memo ? `추천 메모: ${r.memo}` : '', photos: [], fromRec: r.id, createdAt: Date.now() };
    const add = [];
    const first = (r.photos || [])[0];
    if (first) {
      const p = await store.photo(first.id);
      if (p) { const id = uid(); w.photos.push({ id }); add.push({ id, itemId: w.id, blob: p.blob }); }
    }
    await store.save(w, add, []);
    await load();
    renderRecView();
    toast('위시템에 담았어요');
  }
});
let tryTimer;
$('#rv-body').addEventListener('input', e => {
  if (e.target.id !== 'rv-trynote') return;
  const r = state.items.find(i => i.id === state.viewId); if (!r) return;
  r.tryNote = e.target.value;
  clearTimeout(tryTimer);
  tryTimer = setTimeout(() => store.save(r), 400);
});
$('#lb-close').addEventListener('click', () => { $('#lightbox').hidden = true; });
$('#lightbox').addEventListener('click', e => { if (e.target.id === 'lightbox') $('#lightbox').hidden = true; });


/* =========================================================
   단골템 — 주기적으로 사는 것의 구매 가격 기록
   ========================================================= */
const SCATS = { food: '음식·음료', living: '생활용품', body: '바디·헤어', beauty: '화장품', etc: '기타' };
const STAPLE_CATS = Object.keys(SCATS);
const BODY_WORDS = ['샴푸', '린스', '컨디셔너', '트리트먼트', '헤어', '바디', '비누', '치약', '칫솔', '가글', '핸드워시', '핸드크림', '데오', '면도', '입욕', '샤워'];
function staCat(cat, text) {
  if (BODY_WORDS.some(w => (text || '').includes(w))) return 'body';
  if (!cat) return null;
  if (SCATS[cat]) return cat;
  if (cat === 'drink') return 'food';
  if (cat === 'kitchen' || cat === 'home') return 'living';
  return 'etc';
}
// cv 2 = 새 분류로 저장된 것. 그 전 기록은 이름을 보고 옮겨서 보여준다
const scatOf = s => (s.cv === 2 && SCATS[s.cat] ? s.cat : staCat(s.cat, s.title)) || 'etc';
const staChips = cat => catChipsHTML(cat, null, STAPLE_CATS, SCATS);
const UNITS = ['개', '병', '팩', '캔', '롤', '매', '포'];
const won = n => `${Math.round(n).toLocaleString('ko-KR')}원`;
const perUnit = b => (b.qty > 0 ? b.price / b.qty : b.price);
const dAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
/* 비교 기준: 모든 구매에 용량이 적혀 있으면 '용량당'(10ml당·100g당), 아니면 '개당' */
const VOLU = ['ml', 'g'];
const hasVol = b => b.vol > 0;
function metricOf(s, extra) {
  const u = s.unit || '개';
  const bs = (s.buys || []).filter(b => b.price > 0).concat(extra ? [extra] : []);
  const vol = bs.length > 0 && bs.every(hasVol) && new Set(bs.map(b => b.volU || 'ml')).size === 1;
  if (!vol) return { mode: 'unit', f: perUnit, label: v => `${u}당 ${won(v)}`, short: `${u}당` };
  const vu = bs[0].volU || 'ml';
  const f = b => b.price / ((b.qty > 0 ? b.qty : 1) * b.vol);
  const lo = Math.min(...bs.map(f));
  const base = lo * 10 >= 10 ? 10 : lo * 100 >= 10 ? 100 : 1000;
  const bl = base === 1000 ? (vu === 'ml' ? '1L' : '1kg') : `${base}${vu}`;
  return { mode: 'vol', f, label: v => `${bl}당 ${won(v * base)}`, short: `${bl}당` };
}
const volText = (b, u) => (hasVol(b) ? `1${u} ${b.vol.toLocaleString('ko-KR')}${b.volU || 'ml'}` : '');
function stapleStats(s) {
  const buys = (s.buys || []).filter(b => b.price > 0).slice().sort((x, y) => (y.date || '').localeCompare(x.date || ''));
  const m = metricOf(s);
  if (!buys.length) return { buys, best: null, last: null, avg: 0, m };
  const best = buys.reduce((a, b) => (m.f(b) < m.f(a) ? b : a), buys[0]);
  const avg = buys.reduce((n, b) => n + m.f(b), 0) / buys.length;
  return { buys, best, last: buys[0], avg, m };
}
const groupsOf = () => [...new Set(staples().map(s => (s.group || '').trim()).filter(Boolean))];

/* 가격 표시: 글자 없이 화살표로. 최저가면 초록 ↓, 비싸면 빨강 ↑ + % */
const SVG = (inner, cls = '') => `<svg class="${cls}" viewBox="0 0 20 20" aria-hidden="true">${inner}</svg>`;
const bestMark = () => `<span class="pm best">${SVG('<circle cx="10" cy="10" r="9" class="f"/><path d="M10 5.2v9.2M6.2 10.8l3.8 3.8 3.8-3.8" class="k"/>')}<span class="sr">최저가</span></span>`;
function upMark(diff) {
  const pct = Math.max(1, Math.round(diff * 100));
  return `<span class="pm up">${SVG('<circle cx="10" cy="10" r="8.6" class="o"/><path d="M10 14.8V5.6M6.2 9.4L10 5.6l3.8 3.8" class="s"/>')}<b>${pct}%</b><span class="sr">최저보다 ${pct}% 비쌈</span></span>`;
}

function stapleRowHTML(s) {
  const st = stapleStats(s);
  const u = s.unit || '개';
  let tag = '';
  if (st.last && st.buys.length > 1) {
    const diff = st.m.f(st.last) / st.m.f(st.best) - 1;
    tag = diff <= 0.001 ? bestMark() : upMark(diff);
  }
  return `<button type="button" class="sl-row" data-staple="${esc(s.id)}" data-sid="${esc(s.id)}">
    <span class="sl-main">
      <span class="sl-title">${catSq(scatOf(s))}<span>${esc(s.title)}</span></span>
      <span class="sl-sub">${st.last ? `최근 ${fmtDate(st.last.date)}${st.last.shop ? ' · ' + esc(st.last.shop) : ''} · ${st.buys.length}번 샀어요` : '아직 구매 기록 없음'}</span>
    </span>
    <span class="sl-side">
      ${st.best ? `<b>${st.m.label(st.m.f(st.best))}</b>` : ''}
      ${tag}
    </span>
  </button>`;
}

function renderStapleHome() {
  const q = state.q.trim().toLowerCase();
  const all = staples();
  if (!all.length) {
    return `<div class="empty-state">${EMPTY_ART}<h2>자주 사는 걸 기록해볼까요</h2>
      <p>물, 단백질 쉐이크, 제습제, 샴푸처럼 주기적으로 사는 걸 살 때마다 적어두면 개당 가격으로 최저가를 비교해줘요.</p>
      <div class="stack" style="max-width:260px;margin:22px auto 0"><button class="primary-btn" data-act="staple-new">단골템 기록</button></div></div>`;
  }
  const list = all.filter(s => !q || [s.title, s.group, SCATS[scatOf(s)], ...(s.buys || []).map(b => `${b.shop} ${b.memo} ${b.opt || ''}`)].join(' ').toLowerCase().includes(q))
    .sort((x, y) => ((stapleStats(y).last || {}).date || '').localeCompare((stapleStats(x).last || {}).date || ''));
  let html = `<div class="wish-tools"><span class="hint">살 때마다 기록하면 개당·용량당 가격으로 비교해요</span>${selLink()}</div>`;
  html += `<h2 class="sec-title">자주 사는 것 <span class="cnt">${list.length}</span></h2>`;
  if (!list.length) return html + '<p class="hint">찾는 단골템이 없어요.</p>';
  // 묶음이 있는 것은 처음 나오는 자리에 한 줄로 모으고, 펼치면 한 칸 들여서 보여준다
  const done = new Set();
  let rows = '';
  list.forEach(s => {
    const g = (s.group || '').trim();
    const members = g && !q ? list.filter(x => (x.group || '').trim() === g) : [];
    if (members.length < 2) { rows += stapleRowHTML(s); return; }
    if (done.has(g)) return;
    done.add(g);
    const fk = 's:' + g, open = state.wfold[fk] !== 'fold';
    const last = members.map(x => stapleStats(x).last).filter(Boolean).sort((x, y) => (y.date || '').localeCompare(x.date || ''))[0];
    rows += `<button type="button" class="sl-row sl-grp ${open ? 'open' : ''}" data-wsec="${esc(fk)}" aria-expanded="${open}">
      <span class="sl-main">
        <span class="sl-title"><span class="grp-ic" aria-hidden="true"></span><span>${esc(g)}</span></span>
        <span class="sl-sub">${members.length}개 묶음${last ? ` · 최근 ${fmtDate(last.date)}` : ''}</span>
      </span>
      <span class="sl-side"><i class="chev" aria-hidden="true"></i></span>
    </button>`;
    if (open) rows += members.map(x => stapleRowHTML(x).replace('class="sl-row"', 'class="sl-row sub"')).join('');
  });
  html += `<div class="sl">${rows}</div>`;
  return html;
}

function renderStaple() {
  const s = state.items.find(i => i.id === state.stapleId);
  const body = $('#st-body');
  if (!s) { body.innerHTML = '<div class="empty-state"><h2>단골템을 찾지 못했어요</h2></div>'; return; }
  const st = stapleStats(s);
  const u = s.unit || '개';
  $('#st-top').textContent = s.title;
  const q = encodeURIComponent(s.title);
  body.innerHTML = `
    <div class="rv-head">
      <span class="rv-cat cat-${scatOf(s)}">${catSq(scatOf(s))}${esc(SCATS[scatOf(s)])}${s.group ? ' · ' + esc(s.group) : ''} · ${esc(u)} 단위</span>
      <h1 class="rv-title">${esc(s.title)}</h1>
    </div>
    ${st.best ? `<div class="st-sum">
      <div class="st-best"><small>최저</small><b>${st.m.label(st.m.f(st.best))}</b><span>${fmtDate(st.best.date)}${st.best.shop ? ' · ' + esc(st.best.shop) : ''}</span></div>
      <div><small>최근</small><b>${st.m.label(st.m.f(st.last))}</b><span>${fmtDate(st.last.date)}${st.last.shop ? ' · ' + esc(st.last.shop) : ''}</span></div>
      <div><small>평균</small><b>${st.m.label(st.avg)}</b><span>${st.buys.length}번 기록</span></div>
    </div>` : ''}
    <div class="rv-actions">
      <button type="button" class="mini-btn sun" data-st="buy">+ 이번 구매 기록</button>
      <button type="button" class="mini-btn" data-st="calc">가격 확인</button>
      <a class="mini-btn" href="https://search.shopping.naver.com/search/all?query=${q}" target="_blank" rel="noopener">네이버쇼핑 가격 보기</a>
    </div>
    <h2 class="sec-title">구매 기록 <span class="cnt">${st.buys.length}</span></h2>
    ${st.buys.length ? `<div class="bl">${st.buys.map(b => `<button type="button" class="bl-row ${b === st.best && st.buys.length > 1 ? 'best' : ''}" data-buy="${esc(b.id)}">
      <span class="bl-line"><span class="bl-date">${fmtDate(b.date)}</span><span class="bl-shop">${esc(b.shop || '')}</span><b>${won(b.price)}</b>${b === st.best && st.buys.length > 1 ? bestMark() : ''}</span>
      <span class="bl-sub">${[b.opt ? esc(b.opt) : '', b.qty ? `${b.qty}${esc(u)}` : '', `${u}당 ${won(perUnit(b))}`, st.m.mode === 'vol' ? st.m.label(st.m.f(b)) : '', b.memo ? esc(b.memo) : '', (b.photoIds || []).length ? '캡처' : ''].filter(Boolean).join(' · ')}</span>
    </button>`).join('')}</div>` : '<p class="hint">아직 구매 기록이 없어요.</p>'}`;
}
$('#btn-st-edit').addEventListener('click', () => { state.draft = null; go('buy', { id: state.stapleId, edit: true }); });
$('#st-body').addEventListener('click', e => {
  if (e.target.closest('[data-st="buy"]')) { state.draft = null; return go('buy', { id: state.stapleId }); }
  if (e.target.closest('[data-st="calc"]')) return go('calc', { id: state.stapleId });
  const r = e.target.closest('[data-buy]');
  if (r) { state.draft = null; go('buy', { id: state.stapleId, buyId: r.dataset.buy }); }
});

/* 구매 기록 작성 */
function startBuy(s) {
  const src = s.id ? state.items.find(i => i.id === s.id) : null;
  const item = src ? JSON.parse(JSON.stringify(src)) : { id: uid(), kind: 'staple', title: '', unit: '개', cat: null, buys: [], photos: [], createdAt: Date.now() };
  if (src && item.cat) item.cat = scatOf(item);
  const mode = !src ? 'new' : s.edit ? 'edit' : s.buyId ? 'buyedit' : 'buy';
  const last = stapleStats(item).last;
  const lastAny = (item.buys || []).slice().sort((x, y) => (y.date || '').localeCompare(x.date || ''))[0];
  const buy = s.buyId ? item.buys.find(b => b.id === s.buyId) : { id: uid(), date: today(), price: 0, qty: last ? last.qty : 0, shop: last ? last.shop : '', memo: '', photoIds: [],
    vol: lastAny && lastAny.vol > 0 ? lastAny.vol : 0, volU: (lastAny && lastAny.volU) || 'ml', opt: (lastAny && lastAny.opt) || '' };
  state.draft = { kind: 'buy', mode, item, buy, isNew: mode === 'new', newBlobs: new Map(), removed: [], catTouched: !!(src && src.cat), dateTouched: mode === 'buyedit', amounts: [] };
}
function renderBuy() {
  const d = state.draft, s = d.item, b = d.buy;
  $('#buy-title').textContent = { new: '단골템 기록', buy: '이번 구매 기록', buyedit: '구매 기록 수정', edit: '단골템 수정' }[d.mode];
  $('#view-buy').classList.toggle('saved-item', d.mode === 'edit' || d.mode === 'buyedit');
  $('#buy-product').hidden = !(d.mode === 'new' || d.mode === 'edit');
  $('#buy-purchase').hidden = d.mode === 'edit';
  $('#buy-head').textContent = d.mode === 'buyedit' ? '구매 기록' : '이번 구매';
  $('#b-title').value = s.title || '';
  $('#b-unit').innerHTML = UNITS.map(x => `<button type="button" class="chip ${s.unit === x ? 'is-on' : ''}" data-v="${x}">${x}</button>`).join('');
  $('#b-cat').innerHTML = staChips(s.cat);
  $('#b-unit-lbl').textContent = s.unit || '개';
  $('#b-price').value = b.price ? b.price.toLocaleString('ko-KR') : '';
  $('#b-qty').value = b.qty || '';
  $('#b-date').value = b.date || today();
  $('#b-shop').value = b.shop || '';
  $('#b-memo').value = b.memo || '';
  $('#b-group').value = s.group || '';
  $('#b-group-list').innerHTML = groupsOf().map(g => `<option value="${esc(g)}"></option>`).join('');
  $('#b-vol').value = b.vol > 0 ? b.vol : '';
  $('#b-vol-u').innerHTML = VOLU.map(x => `<button type="button" class="${(b.volU || 'ml') === x ? 'is-on' : ''}" data-v="${x}">${x}</button>`).join('');
  $('#b-vol-unit').textContent = `1${s.unit || '개'}당`;
  $('#b-opt').value = b.opt || '';
  $('#b-opt-list').innerHTML = [...new Set((s.buys || []).map(x => x.opt).filter(Boolean))].map(o => `<option value="${esc(o)}"></option>`).join('');
  $('#b-ocr-status').textContent = '';
  $('#b-ocr-box').hidden = true;
  renderBuyPhotos(); renderUnitPrice();
  $('#b-del-zone').hidden = !(d.mode === 'buyedit' || d.mode === 'edit');
  $('#b-del-btn').textContent = d.mode === 'edit' ? '이 단골템 통째로 삭제' : '이 구매 기록 삭제';
  $('#b-del-msg').textContent = d.mode === 'edit' ? '구매 기록과 캡처까지 모두 지워져요. 되돌릴 수 없어요.' : '이 구매 기록을 지울까요? 되돌릴 수 없어요.';
  $('#b-del-confirm').hidden = true; $('#b-del-btn').hidden = false;
}
function renderBuyPhotos() {
  const d = state.draft;
  $('#b-photos').innerHTML = (d.buy.photoIds || []).map(id => `<div class="ph" data-ph="${esc(id)}">
    <img ${d.newBlobs.has(id) ? `src="${d.newBlobs.get(id).url}"` : `data-pid="${esc(id)}"`} alt="">
    <button type="button" class="ph-x" data-ph-del aria-label="사진 빼기">×</button></div>`).join('');
  hydrate($('#b-photos'));
}
function renderUnitPrice() {
  const d = state.draft, b = d.buy, u = d.item.unit || '개';
  const el = $('#b-unit-price');
  if (!b.price) { el.textContent = ''; el.className = 'unit-price'; return; }
  const others = (d.item.buys || []).filter(x => x.id !== b.id && x.price > 0);
  const m = metricOf({ ...d.item, buys: others }, b);
  const pu = m.f(b);
  let msg = m.mode === 'vol' ? `${u}당 ${won(perUnit(b))} · ${m.label(pu)}` : m.label(pu), cls = 'unit-price';
  if (others.length) {
    const best = others.reduce((a, x) => (m.f(x) < m.f(a) ? x : a), others[0]);
    const diff = pu / m.f(best) - 1;
    if (diff < -0.005) { msg += ` · 지금까지 중 최저가예요!`; cls += ' good'; }
    else if (diff <= 0.005) { msg += ` · 최저가와 같아요`; cls += ' good'; }
    else { msg += ` · 최저(${fmtDate(best.date)} ${m.label(m.f(best))})보다 ${Math.round(diff * 100)}% 비싸요`; cls += ' bad'; }
  }
  el.textContent = msg; el.className = cls;
}
$('#b-title').addEventListener('input', e => { const d = state.draft; if (!d) return; d.item.title = e.target.value; if (!d.catTouched) { d.item.cat = staCat(guessCat(e.target.value, false), e.target.value); $('#b-cat').innerHTML = staChips(d.item.cat); } });
$('#b-unit').addEventListener('click', e => { const c = e.target.closest('[data-v]'); const d = state.draft; if (!c || !d) return; d.item.unit = c.dataset.v; $$('#b-unit .chip').forEach(x => x.classList.toggle('is-on', x === c)); $('#b-unit-lbl').textContent = c.dataset.v; $('#b-vol-unit').textContent = `1${c.dataset.v}당`; renderUnitPrice(); });
$('#b-cat').addEventListener('click', e => { const c = e.target.closest('[data-v]'); const d = state.draft; if (!c || !d) return; d.item.cat = d.item.cat === c.dataset.v ? null : c.dataset.v; d.catTouched = true; $('#b-cat').innerHTML = staChips(d.item.cat); });
$('#b-price').addEventListener('input', e => { const d = state.draft; if (!d) return; d.buy.price = parsePrice(e.target.value); renderUnitPrice(); });
$('#b-qty').addEventListener('input', e => { const d = state.draft; if (!d) return; d.buy.qty = parseFloat(e.target.value.replace(/[^\d.]/g, '')) || 0; renderUnitPrice(); });
$('#b-date').addEventListener('input', e => { const d = state.draft; if (!d) return; d.buy.date = e.target.value; d.dateTouched = true; });
$('#b-shop').addEventListener('input', e => { if (state.draft) state.draft.buy.shop = e.target.value; });
$('#b-memo').addEventListener('input', e => { if (state.draft) state.draft.buy.memo = e.target.value; });
$('#b-opt').addEventListener('input', e => { if (state.draft) state.draft.buy.opt = e.target.value; });
$('#b-group').addEventListener('input', e => { if (state.draft) state.draft.item.group = e.target.value; });
$('#b-vol').addEventListener('input', e => { const d = state.draft; if (!d) return; d.buy.vol = parseFloat(e.target.value.replace(/[^\d.]/g, '')) || 0; renderUnitPrice(); });
$('#b-vol-u').addEventListener('click', e => { const c = e.target.closest('[data-v]'); const d = state.draft; if (!c || !d) return; d.buy.volU = c.dataset.v; setSeg('#b-vol-u', c.dataset.v); renderUnitPrice(); });
$('#b-photos').addEventListener('click', e => {
  const ph = e.target.closest('[data-ph]'); const d = state.draft; if (!ph || !d || !e.target.closest('[data-ph-del]')) return;
  removePhoto(d, ph.dataset.ph);
  d.buy.photoIds = d.buy.photoIds.filter(x => x !== ph.dataset.ph);
  renderBuyPhotos();
});

/* 주문 캡처에서 금액·수량·날짜·쇼핑몰 찾기 */
function parseOrder(text) {
  const out = { amounts: [], pick: 0, qty: 0, date: '', shop: '' };
  const lines = text.split(/\n+/);
  const seen = new Set();
  lines.forEach(l => {
    for (const m of l.matchAll(/(\d{1,3}(?:,\d{3})+|\d{4,7})\s*원/g)) {
      const n = +m[1].replace(/,/g, '');
      if (n >= 100 && !seen.has(n)) { seen.add(n); out.amounts.push({ n, key: /(결제|총|최종|합계|주문금액)/.test(l) }); }
    }
  });
  const keyed = out.amounts.find(a => a.key);
  out.pick = keyed ? keyed.n : (out.amounts[0] ? out.amounts[0].n : 0);
  const q = [...text.matchAll(/(?:[x×*]\s*(\d{1,3})(?!\d)|(\d{1,3})\s*(?:개|병|입|팩|캔|롤|포|매)(?![가-힣]))/gi)].map(m => +(m[1] || m[2])).filter(n => n > 0 && n < 500);
  if (q.length) out.qty = Math.max(...q);
  const dm = /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/.exec(text);
  if (dm) out.date = `${dm[1]}-${dm[2].padStart(2, '0')}-${dm[3].padStart(2, '0')}`;
  const shops = [[/쿠팡|coupang|로켓/i, '쿠팡'], [/네이버|NAVER|스마트스토어|N페이/i, '네이버'], [/컬리|kurly/i, '컬리'], [/SSG|쓱/i, 'SSG'], [/11번가/, '11번가'], [/G마켓|지마켓/i, 'G마켓'], [/올리브영/, '올리브영'], [/다이소/, '다이소'], [/이마트/, '이마트']];
  const hit = shops.find(([re]) => re.test(text));
  if (hit) out.shop = hit[1];
  return out;
}
function buyOcrStatus(msg, busy) { const el = $('#b-ocr-status'); el.textContent = msg; el.classList.toggle('busy', !!busy); }
$('#b-shot').addEventListener('change', async e => {
  const files = await takeFiles(e.target);
  const d = state.draft; if (!files.length || !d) return;
  const before = d.item.photos.length;
  await addPhotos(files, d);
  d.buy.photoIds = [...(d.buy.photoIds || []), ...d.item.photos.slice(before).map(p => p.id)];
  renderBuyPhotos();
  ocrReport = buyOcrStatus;
  buyOcrStatus('글자 인식 준비 중…', true);
  try {
    const worker = await getOcrWorker();
    let text = '';
    for (const f of files) { const { data } = await worker.recognize(f); text += '\n' + ((data && data.text) || ''); }
    if (state.draft !== d) return;
    const o = parseOrder(text);
    const b = d.buy, found = [];
    if (o.pick && !b.price) { b.price = o.pick; $('#b-price').value = o.pick.toLocaleString('ko-KR'); found.push(`가격 ${won(o.pick)}`); }
    if (o.qty && !b.qty) { b.qty = o.qty; $('#b-qty').value = o.qty; found.push(`수량 ${o.qty}`); }
    if (o.date && !d.dateTouched) { b.date = o.date; $('#b-date').value = o.date; found.push(`날짜 ${fmtDate(o.date)}`); }
    if (o.shop && !b.shop) { b.shop = o.shop; $('#b-shop').value = o.shop; found.push(o.shop); }
    d.amounts = o.amounts.map(a => a.n);
    $('#b-ocr-box').hidden = d.amounts.length < 2;
    $('#b-ocr-chips').innerHTML = d.amounts.map(n => `<button type="button" class="chip ocr-chip" data-amt="${n}">${won(n)}</button>`).join('');
    renderUnitPrice();
    buyOcrStatus(found.length ? `찾았어요: ${found.join(' · ')}` : '금액을 찾지 못했어요. 직접 적어 주세요.');
  } catch (err) {
    buyOcrStatus(ocrFailMsg(err));
  }
});
$('#b-ocr-chips').addEventListener('click', e => {
  const c = e.target.closest('[data-amt]'); const d = state.draft; if (!c || !d) return;
  d.buy.price = +c.dataset.amt; $('#b-price').value = d.buy.price.toLocaleString('ko-KR');
  $$('#b-ocr-chips .chip').forEach(x => x.classList.toggle('is-on', x === c));
  renderUnitPrice();
});
$('#btn-buy-save').addEventListener('click', async () => {
  const d = state.draft; if (!d) return;
  const s = d.item, b = d.buy;
  s.title = (s.title || '').trim();
  if ((d.mode === 'new' || d.mode === 'edit') && !s.title) { toast('무엇인지 적어주세요'); $('#b-title').focus(); return; }
  if (d.mode !== 'edit') {
    if (!b.price) { toast('가격을 적어주세요'); $('#b-price').focus(); return; }
    b.shop = (b.shop || '').trim(); b.memo = (b.memo || '').trim(); b.opt = (b.opt || '').trim();
    if (!(b.vol > 0)) { b.vol = 0; delete b.volU; } else b.volU = b.volU || 'ml';
    const i = s.buys.findIndex(x => x.id === b.id);
    // 처음으로 용량을 적으면, 용량이 비어 있던 예전 기록에도 같은 용량을 넣는다 (같은 물건이라 보고)
    if (b.vol > 0 && !s.buys.some(x => x.id !== b.id && x.vol > 0)) s.buys.forEach(x => { if (x.id !== b.id) { x.vol = b.vol; x.volU = b.volU; } });
    if (i >= 0) s.buys[i] = b; else s.buys.push(b);
  }
  s.group = (s.group || '').trim();
  if (!SCATS[s.cat]) s.cat = 'etc'; s.cv = 2;
  s.photos = s.photos.filter(p => s.buys.some(x => (x.photoIds || []).includes(p.id)));
  try { await saveDraft(); } catch { toast('저장하지 못했어요. 저장 공간을 확인해 주세요.'); return; }
  state.draft = null;
  state.tab = 'staple';
  toast(d.mode === 'edit' ? '수정했어요' : '구매 기록을 남겼어요');
  if (d.mode === 'new') { history.replaceState({ view: 'staple', id: s.id }, ''); route({ view: 'staple', id: s.id }); }
  else history.back();
});
$('#b-del-btn').addEventListener('click', () => { $('#b-del-confirm').hidden = false; $('#b-del-btn').hidden = true; });
$('#b-del-no').addEventListener('click', () => { $('#b-del-confirm').hidden = true; $('#b-del-btn').hidden = false; });
$('#b-del-yes').addEventListener('click', async () => {
  const d = state.draft; if (!d) return;
  const s = d.item;
  if (d.mode === 'edit') {
    const src = state.items.find(i => i.id === s.id);
    if (src) { await store.remove(src); (src.photos || []).forEach(p => dropURL(p.id)); }
    await load(); state.draft = null; toast('삭제했어요');
    history.go(-2);
    return;
  }
  const gone = d.buy.photoIds || [];
  s.buys = s.buys.filter(x => x.id !== d.buy.id);
  s.photos = s.photos.filter(p => !gone.includes(p.id));
  await store.save(s, [], gone.filter(id => !d.newBlobs.has(id)));
  gone.forEach(dropURL);
  await load(); state.draft = null; toast('구매 기록을 지웠어요');
  history.back();
});

/* =========================================================
   설정·백업
   ========================================================= */
async function renderSettings() {
  const photos = state.items.reduce((n, i) => n + (i.photos || []).length, 0);
  let usage = '';
  try { if (navigator.storage?.estimate) { const { usage: u } = await navigator.storage.estimate(); if (u) usage = ` · 약 ${(u / 1048576).toFixed(1)}MB`; } } catch { /* 무시 */ }
  $('#stat-line').textContent = `위시 ${wishes().length}개 · 추천 ${recs().length}개 · 단골템 ${staples().length}개 · 사진 ${photos}장${usage}`;
  const last = lsGet(BACKUP_KEY);
  $('#last-backup-line').textContent = last ? `마지막 백업: ${last}` : '아직 백업한 적이 없어요.';
  $('#io-status').textContent = '';
}
const blobToDataURL = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
$('#btn-export').addEventListener('click', async () => {
  const st = $('#io-status');
  st.textContent = '백업 파일 만드는 중…';
  try {
    const items = await store.all();
    const photos = [];
    for (const p of await store.allPhotos()) photos.push({ id: p.id, itemId: p.itemId, data: await blobToDataURL(p.blob) });
    const blob = new Blob([JSON.stringify({ app: 'damdam', version: 1, exportedAt: new Date().toISOString(), items, photos })], { type: 'application/json' });
    const name = `담담-백업-${today()}.json`;
    const file = new File([blob], name, { type: 'application/json' });
    let done = false;
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); done = true; }
      catch (err) { if (err && err.name === 'AbortError') { st.textContent = '백업을 취소했어요.'; return; } }
    }
    if (!done) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }
    lsSet(BACKUP_KEY, today());
    st.textContent = `${name} (${(blob.size / 1048576).toFixed(1)}MB)을 만들었어요. 클라우드에 꼭 올려두세요.`;
    $('#last-backup-line').textContent = `마지막 백업: ${today()}`;
  } catch { st.textContent = '백업 파일을 만들지 못했어요. 다시 시도해 주세요.'; }
});
$('#import-input').addEventListener('change', async e => {
  const f = e.target.files?.[0]; e.target.value = '';
  if (!f) return;
  const st = $('#io-status');
  st.textContent = '불러오는 중…';
  try {
    const data = JSON.parse(await f.text());
    if (data.app !== 'damdam' || !Array.isArray(data.items)) throw new Error('형식');
    const photos = [];
    for (const p of data.photos || []) photos.push({ id: p.id, itemId: p.itemId, blob: await (await fetch(p.data)).blob() });
    await store.putMany(data.items, photos);
    photos.forEach(p => dropURL(p.id));
    await load();
    await renderSettings();
    st.textContent = `${data.items.length}개를 불러왔어요.`;
  } catch { st.textContent = '담담 백업 파일이 아니거나 손상된 파일이에요.'; }
});

/* =========================================================
   미리보기용 예시
   ========================================================= */
function canvasBlob(w, h, paint) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  return new Promise(res => c.toBlob(b => res(b), 'image/jpeg', 0.86));
}
function paintPost(bg, title, lines, art) {
  return (ctx, w, h) => {
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#111'; ctx.font = `700 ${w * 0.04}px sans-serif`; ctx.fillText('@someone', w * 0.18, h * 0.06);
    ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.arc(w * 0.09, h * 0.05, w * 0.05, 0, 7); ctx.fill();
    ctx.fillStyle = bg; ctx.fillRect(0, h * 0.1, w, h * 0.55);
    art(ctx, w, h);
    ctx.fillStyle = '#111'; ctx.font = `700 ${w * 0.05}px sans-serif`; ctx.fillText(title, w * 0.05, h * 0.72);
    ctx.font = `400 ${w * 0.04}px sans-serif`; ctx.fillStyle = '#333';
    lines.forEach((l, i) => ctx.fillText(l, w * 0.05, h * (0.78 + i * 0.05)));
  };
}
async function seedPreview() {
  const lines = [
    '엄마 기비 블라우스 GY26M1FRB1231/ 54사이즈',
    '온러닝 신발',
    'thruour 볼드반지 목걸이',
    '아빠 닥스 패딩 DMJU5D004g2  100사이즈',
    '네파 프리미아 7L82072 라이트그레이(b25) 100 /34만',
    'K2 트리니티 미들 kww25532 검정 100 / 79만',
    '린자켓 66사이즈 LWJKPI4300 바지는77',
    '엄마 모에 웨이스트 스트랩 나일론 점퍼 OWJPNE0200',
    '에드하디 선글라스 eds5980 black 56',
    '요시카와 스틸편수냄비 20cm',
    '메모 향수 이타크',
    '텐트 백팩',
    '무어만 책장',
    '업하이 릴렉스사이클',
    'shop-us.kurzgesagt.org 포스터',
    '포지티브 컵 http://www.positiv.kr/?fbclid=PAY2xjawHYTHlleHRuA2FlbQIxMQAB',
    '잉코 스웨이드 휴대용 전기매트',
    'jrl 드라이기',
    '레스트 인 네이처 향기관련 제품',
    '시리즈/킨토/필리빗 식기',
    '킨토 언다이드 머그 350ml / 18,000원',
    '오늘의집 원목 사이드테이블 / 89,000원',
  ];
  const now = Date.now();
  const items = lines.map((l, i) => {
    const p = parseLine(l);
    return { id: uid(), kind: 'wish', sample: true, title: p.title, brand: '', code: p.code, size: p.size, link: p.link, shop: shopFromLink(p.link), who: p.who || '나', cat: p.cat, prices: p.price ? [{ amount: p.price, where: '메모', date: today() }] : [], target: 0, status: 'want', memo: '', raw: l, photos: [], createdAt: now - i * 1000 };
  });
  // 네이버 장바구니에서 가져온 예시
  items.slice(-2).forEach(w => { w.shop = '네이버'; w.prices.forEach(p => { p.where = '네이버'; }); });
  // 가격 기록과 세일 대기 예시
  const nepa = items[4];
  nepa.prices.push({ amount: 289000, where: '공식몰 세일', date: today() });
  items[5].status = 'sale';
  items.push({ id: uid(), kind: 'wish', sample: true, title: '린 자켓', code: 'LWJKPD0300', size: '66', who: '나', cat: 'fashion', prices: [], status: 'bought', boughtAt: today(), memo: '', photos: [], createdAt: now - 20000 });
  items.push({ id: uid(), kind: 'wish', sample: true, title: '크림팩', code: '', size: '', who: '나', cat: 'beauty', prices: [], status: 'bought', boughtAt: today(), memo: '', photos: [], createdAt: now - 21000 });

  const photos = [];
  const recSpecs = [];
  for (const [file, spec] of [
    ['samples/rec-soda.jpg', { title: '클룹 제로소다 레몬', cat: 'drink', source: 'X', memo: '인공감미료 맛 안 나고 상큼한 레몬에이드 맛. 탄산은 약한 편.' }],
    ['samples/rec-poire.jpg', { title: '에릭 보르들레 뿌아레 오떵띡', cat: 'drink', source: '웹', memo: '배로 만든 스파클링. 선물용으로 좋을 듯' }],
  ]) {
    try {
      const res = await fetch(file);
      if (res.ok) { const blob = await shrink(await res.blob()); const id = uid(); photos.push({ id, blob }); recSpecs.push({ ...spec, pid: id }); }
    } catch { /* 예시 사진 없음 */ }
  }
  const drawn = [
    [{ title: '머쉬룸 테이블 조명', cat: 'home', source: '인스타', memo: '침실 협탁에 두면 예쁠 것 같음' }, paintPost('#e9e2d6', '머쉬룸 테이블 조명', ['#인테리어 #조명 #침실'], (c, w, h) => {
      c.fillStyle = '#f3c77b'; c.beginPath(); c.ellipse(w * 0.5, h * 0.3, w * 0.24, h * 0.09, 0, Math.PI, 0); c.fill();
      c.fillStyle = '#fff6dc'; c.fillRect(w * 0.26, h * 0.3, w * 0.48, h * 0.012);
      c.fillStyle = '#c99a50'; c.fillRect(w * 0.47, h * 0.31, w * 0.06, h * 0.22);
      c.beginPath(); c.ellipse(w * 0.5, h * 0.53, w * 0.16, h * 0.025, 0, 0, 7); c.fill();
    })],
    [{ title: '수제 버터쿠키 틴', cat: 'food', source: '스레드', memo: '선물용으로 좋다는 후기 많음' }, paintPost('#f4e7d2', '수제 버터쿠키 틴', ['선물하기 좋은 쿠키 맛집'], (c, w, h) => {
      c.fillStyle = '#2f5d8a'; c.beginPath(); c.arc(w * 0.5, h * 0.38, w * 0.3, 0, 7); c.fill();
      for (let i = 0; i < 9; i++) { c.fillStyle = i % 2 ? '#e2b06a' : '#c98d45'; c.beginPath(); c.arc(w * (0.36 + (i % 3) * 0.14), h * (0.3 + Math.floor(i / 3) * 0.08), w * 0.055, 0, 7); c.fill(); }
    })],
    [{ title: '진정 수분크림', cat: 'beauty', source: '블로그', memo: '환절기에 좋다는 추천' }, paintPost('#e7eef0', '진정 수분크림', ['#스킨케어 #수분크림'], (c, w, h) => {
      c.fillStyle = '#ffffff'; c.fillRect(w * 0.34, h * 0.26, w * 0.32, h * 0.22);
      c.fillStyle = '#8fc1b5'; c.fillRect(w * 0.32, h * 0.21, w * 0.36, h * 0.06);
      c.fillStyle = '#5a8f84'; c.font = `700 ${w * 0.04}px sans-serif`; c.fillText('CALM', w * 0.43, h * 0.38);
    })],
  ];
  for (const [spec, paint] of drawn) {
    const blob = await canvasBlob(720, 1100, paint);
    const id = uid(); photos.push({ id, blob }); recSpecs.push({ ...spec, pid: id });
  }
  recSpecs.forEach((s, i) => {
    const r = { id: uid(), kind: 'rec', sample: true, title: s.title, cat: s.cat, source: s.source, link: '', memo: s.memo, tried: i === 0, tryNote: i === 0 ? '진짜 상큼함. 박스로 재구매 고민 중' : '', photos: [{ id: s.pid }], createdAt: now - 5000 - i * 1000 };
    items.push(r);
    const p = photos.find(x => x.id === s.pid); if (p) p.itemId = r.id;
  });
  const staple = (title, unit, cat, buys, extra = {}) => ({ id: uid(), kind: 'staple', sample: true, cv: 2, title, unit, cat, photos: [], createdAt: now, ...extra,
    buys: buys.map(([ago, price, qty, shop, memo, more]) => ({ id: uid(), date: dAgo(ago), price, qty, shop, memo: memo || '', photoIds: [], ...(more || {}) })) });
  const w2 = { vol: 2000, volU: 'ml' }, w5 = { vol: 500, volU: 'ml' };
  items.push(
    staple('삼다수', '병', 'food', [[84, 11880, 12, '쿠팡', '', w2], [54, 10900, 12, '네이버', '쿠폰 1,000원', w2], [21, 12480, 12, '쿠팡', '', w2], [6, 9600, 20, '쿠팡', '500ml 묶음', w5]]),
    staple('마이프로틴 임팩트 웨이 1kg', '개', 'food', [[108, 39900, 1, '공식몰', '블랙프라이데이', { opt: '초코' }], [28, 45000, 1, '쿠팡', '', { opt: '바닐라' }]]),
    staple('물먹는하마 제습제', '개', 'living', [[128, 15900, 24, '쿠팡'], [25, 6000, 6, '다이소']]),
    staple('르네휘테르 포티샤 샴푸 200ml', '병', 'body', [[41, 24000, 1, '올리브영']], { group: '르네휘테르' }),
    staple('르네휘테르 트리트먼트 200ml', '병', 'body', [[40, 29000, 1, '올리브영', '1+1 행사'], [12, 31000, 1, '네이버']], { group: '르네휘테르' }),
  );
  await store.putMany(items, photos);
}

/* ---------- 다른 앱에서 공유받기 ---------- */
function openShared(title, text, url) {
  const urlInText = /https?:\/\/\S+/.exec(text || '');
  const link = cleanLink(url || (urlInText ? urlInText[0] : ''));
  let name = (title || (text || '').replace(urlInText ? urlInText[0] : '', '')).replace(/\s*[:|-]\s*(네이버\s*쇼핑|NAVER|쿠팡!?|무신사|스마트스토어).*$/i, '').replace(/^\[[^\]]+\]\s*/, '').trim();
  state.tab = 'wish';
  state.draft = null;
  go('wish');
  const d = state.draft, w = d.item;
  const p = parseLine(name);
  w.title = p.title || name; w.size = p.size; w.code = p.code;
  if (p.price) w.prices.push({ amount: p.price, where: shopFromLink(link) || '메모', date: today() });
  w.link = link; w.shop = shopFromLink(link);
  w.cat = toCat(p.cat || guessCat(name, false), name, WCATS);
  renderWish();
  toast('공유받은 상품을 채워뒀어요');
}

/* ---------- 시작 ---------- */
(async function init() {
  try { await load(); }
  catch {
    $('#home-body').innerHTML = '<div class="empty-state"><h2>저장소를 열지 못했어요</h2><p>시크릿 모드에서는 저장할 수 없어요. 일반 창에서 열어 주세요.</p></div>';
    return;
  }
  if (window.DAMDAM_PREVIEW && !state.items.length) { await seedPreview(); await load(); }
  const sp = new URLSearchParams(location.search);
  const shared = ['title', 'text', 'url'].some(k => sp.get(k));
  history.replaceState({ view: 'home' }, '', shared ? location.pathname : undefined);
  route({ view: 'home' });
  if (shared) openShared(sp.get('title') || '', sp.get('text') || '', sp.get('url') || '');
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !window.DAMDAM_PREVIEW) navigator.serviceWorker.register('sw.js').catch(() => {});
})();

/* =========================================================
   퀵 가격 계산기 — 사기 전에 이 가격이 괜찮은지 바로 확인
   ========================================================= */
function startCalc(id) {
  const list = staples().filter(x => stapleStats(x).buys.length);
  const pick = (id && list.find(x => x.id === id)) || null;
  state.calc = { id: pick ? pick.id : null, from: pick ? pick.id : null, price: 0, qty: 0, vol: 0, saving: false, shop: '' };
  if (pick) fillCalcFromLast(pick);
}
function fillCalcFromLast(sItem) {
  const c = state.calc, last = stapleStats(sItem).last;
  c.qty = last && last.qty ? last.qty : 0;
  c.vol = last && last.vol > 0 ? last.vol : 0;
  c.volU = (last && last.volU) || 'ml';
  c.shop = (last && last.shop) || '';
}
function renderCalc() {
  const c = state.calc;
  const list = staples().filter(x => stapleStats(x).buys.length)
    .sort((x, y) => ((stapleStats(y).last || {}).date || '').localeCompare((stapleStats(x).last || {}).date || ''));
  $('#c-empty').hidden = !!list.length;
  $('#c-item').disabled = !list.length;
  $('#c-item').innerHTML = `<option value="">고르세요</option>` + list.map(x => `<option value="${esc(x.id)}" ${c.id === x.id ? 'selected' : ''}>${esc(x.group && !x.title.includes(x.group) ? `${x.group} · ${x.title}` : x.title)}</option>`).join('');
  const sItem = list.find(x => x.id === c.id);
  const u = sItem ? sItem.unit || '개' : '개';
  $('#c-unit').textContent = u;
  $('#c-price').value = c.price ? c.price.toLocaleString('ko-KR') : '';
  $('#c-qty').value = c.qty || '';
  $('#c-vol').value = c.vol || '';
  $('#c-vol-u').innerHTML = VOLU.map(x => `<button type="button" class="${(c.volU || 'ml') === x ? 'is-on' : ''}" data-v="${x}">${x}</button>`).join('');
  $('#c-vol-lbl').textContent = `1${u}당`;
  renderCalcResult();
}
function judge(sItem, cand) {
  const st = stapleStats(sItem);
  const m = metricOf(sItem, cand);
  const v = m.f(cand);
  const best = st.buys.reduce((a, b) => (m.f(b) < m.f(a) ? b : a), st.buys[0]);
  const avg = st.buys.reduce((n, b) => n + m.f(b), 0) / st.buys.length;
  const dBest = v / m.f(best) - 1, dAvg = v / avg - 1;
  let verdict, cls;
  if (dBest < -0.005) { verdict = '최저가 갱신! 지금까지 중 가장 싸요'; cls = 'best'; }
  else if (dBest <= 0.1) { verdict = '괜찮은 가격이에요'; cls = 'good'; }
  else if (dAvg <= 0.005) { verdict = '평균 수준이에요'; cls = 'mid'; }
  else { verdict = '비싼 편이에요'; cls = 'bad'; }
  const pct = d => (Math.abs(d) < 0.005 ? '같아요' : `${Math.round(Math.abs(d) * 100)}% ${d < 0 ? '싸요' : '비싸요'}`);
  const rows = [
    ['최저', `${m.label(m.f(best))} · ${fmtDate(best.date)}${best.shop ? ' ' + esc(best.shop) : ''}`, pct(dBest)],
    ['평균', `${m.label(avg)} · ${st.buys.length}번`, pct(dAvg)],
    ['지난번', `${m.label(m.f(st.last))} · ${fmtDate(st.last.date)}`, pct(v / m.f(st.last) - 1)],
  ];
  let extra = '';
  if (m.mode === 'vol') extra = `${sItem.unit || '개'}당 ${won(perUnit(cand))}`;
  else if (cand.vol > 0) {
    // 예전 기록에 용량이 없으면 비교는 개당으로 하고, 지금 가격의 용량당 값만 보여준다
    const pv = cand.price / ((cand.qty > 0 ? cand.qty : 1) * cand.vol), vu = cand.volU || 'ml';
    const base = pv * 10 >= 10 ? 10 : pv * 100 >= 10 ? 100 : 1000;
    extra = `${base === 1000 ? (vu === 'ml' ? '1L' : '1kg') : base + vu}당 ${won(pv * base)}`;
  }
  const note = m.mode !== 'vol' && cand.vol > 0 && !(sItem.buys || []).some(x => x.vol > 0) ? 'fill' : '';
  return { verdict, cls, now: m.label(v), unitNow: extra, note, rows };
}
function renderCalcResult() {
  const c = state.calc, box = $('#c-result');
  const sItem = staples().find(x => x.id === c.id);
  if (!sItem || !c.price) { box.hidden = true; return; }
  const cand = { price: c.price, qty: c.qty, vol: c.vol, volU: c.volU };
  const j = judge(sItem, cand);
  const shops = [...new Set([c.shop, ...stapleStats(sItem).buys.map(b => b.shop), '쿠팡', '네이버', '컬리', '올리브영', '다이소'].filter(Boolean))].slice(0, 6);
  box.hidden = false;
  box.innerHTML = `
    <div class="cr-verdict ${j.cls}">${j.cls === 'best' || j.cls === 'good' ? bestMark() : ''}<b>${j.verdict}</b></div>
    <p class="cr-now">지금 <b>${j.now}</b>${j.unitNow ? ` <span>${j.unitNow}</span>` : ''}</p>
    <div class="cr-rows">${j.rows.map(r => `<div class="cr-row"><span class="cr-k">${r[0]}</span><span class="cr-v">${r[1]}</span><span class="cr-d">${r[2]}</span></div>`).join('')}</div>
    ${j.note ? `<button type="button" class="mini-btn" data-calc="fillvol">예전 기록도 같은 용량으로 보고 용량당 비교하기</button>` : ''}
    ${c.saving ? `<div class="field cr-save">
        <span class="lbl">어디서 샀어요?</span>
        <div class="chips" id="c-shops">${shops.map(x => `<button type="button" class="chip ${c.shop === x ? 'is-on' : ''}" data-shop="${esc(x)}">${esc(x)}</button>`).join('')}</div>
        <button type="button" class="primary-btn" data-calc="save">오늘 구매로 기록하기</button>
      </div>`
      : `<button type="button" class="primary-btn" data-calc="bought">이 가격에 샀어요</button>`}`;
}
$('#c-item').addEventListener('change', e => {
  const c = state.calc; c.id = e.target.value || null; c.saving = false;
  const sItem = staples().find(x => x.id === c.id); if (sItem) fillCalcFromLast(sItem);
  renderCalc();
  if (c.id) setTimeout(() => $('#c-price').focus(), 30);
});
$('#c-vol-u').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; state.calc.volU = b.dataset.v; setSeg('#c-vol-u', b.dataset.v); renderCalcResult(); });
$('#c-price').addEventListener('input', e => { state.calc.price = parsePrice(e.target.value); renderCalcResult(); });
$('#c-qty').addEventListener('input', e => { state.calc.qty = parseFloat(e.target.value.replace(/[^\d.]/g, '')) || 0; renderCalcResult(); });
$('#c-vol').addEventListener('input', e => { state.calc.vol = parseFloat(e.target.value.replace(/[^\d.]/g, '')) || 0; renderCalcResult(); });
$('#c-result').addEventListener('click', async e => {
  const c = state.calc;
  const sh = e.target.closest('[data-shop]');
  if (sh) { c.shop = c.shop === sh.dataset.shop ? '' : sh.dataset.shop; return renderCalcResult(); }
  const a = e.target.closest('[data-calc]')?.dataset.calc;
  if (a === 'bought') { c.saving = true; return renderCalcResult(); }
  if (a === 'fillvol') {
    const it = state.items.find(x => x.id === c.id); if (!it) return;
    (it.buys || []).forEach(x => { if (!(x.vol > 0)) { x.vol = c.vol; x.volU = c.volU || 'ml'; } });
    await store.save(it);
    toast('예전 기록에 용량을 넣었어요');
    return renderCalcResult();
  }
  if (a !== 'save') return;
  const sItem = state.items.find(x => x.id === c.id); if (!sItem) return;
  const last = stapleStats(sItem).last;
  const b = { id: uid(), date: today(), price: c.price, qty: c.qty, shop: c.shop, memo: '', photoIds: [], opt: (last && last.opt) || '' };
  if (c.vol > 0) {
    b.vol = c.vol; b.volU = c.volU || 'ml';
    if (!(sItem.buys || []).some(x => x.vol > 0)) (sItem.buys || []).forEach(x => { x.vol = b.vol; x.volU = b.volU; });
  }
  sItem.buys = [...(sItem.buys || []), b];
  try { await store.save(sItem); } catch (err) { toast('저장하지 못했어요. 저장 공간을 확인해 주세요.'); return; }
  await load();
  state.tab = 'staple';
  toast('구매 기록을 남겼어요');
  // 상세에서 열었으면 그 상세로 돌아가고, 홈에서 열었으면 상세로 바꿔 보여준다
  if (c.from === sItem.id) history.back();
  else { history.replaceState({ view: 'staple', id: sItem.id }, ''); route({ view: 'staple', id: sItem.id }); }
});
$('#btn-calc').addEventListener('click', () => go('calc'));

/* 앱 버전 표시 (설정 맨 아래). 업데이트가 들어왔는지 확인용 */
const APP_VER = 'damdam-v18';
(() => { const el = document.getElementById('app-ver'); if (el) el.textContent = `담담 버전 ${APP_VER.split('-').pop()}`; })();
