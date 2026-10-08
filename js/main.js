const DATA_URL = "./data/products.json";
const CAT_IMG_DIR = "./images/categories/";

// 商品分類：大類 → 小類
// img 是 images/categories/ 裡的示意圖檔名；小類沒有自己的圖時，會用大類的圖
// 商品的 "cat" 填 "大類/小類"，一件商品可以填多個，例如 ["包袋/旅行包", "戶外露營/露營用品"]
const CATEGORIES = [
  {name:"戶外露營", img:"Ccamp.jpg", subs:["露營用品", "野炊餐具", "桌椅"]},
  {name:"隨身杯瓶", img:"Cbottle.jpg", subs:["保溫瓶壺", "隨行杯", "杯組禮盒", "燜燒杯"]},
  {name:"密封餐盒", img:"Clunchbox.jpg", subs:["便當餐盒", "保鮮盒"]},
  {name:"廚房用品", img:"Cpan.jpg", subs:[
    {name:"鍋具", img:"Cpan.jpg"}, {name:"刀具", img:"Cknife.jpg"}, {name:"廚房小物", img:"Ctableware.jpg"},
  ]},
  {name:"居家電器", img:"Cthing.jpg", subs:[]},
  {name:"數位3C", img:"CElectrical.jpg", subs:["行動電源", "轉接頭", "風扇"]},
  {name:"水晶獎座", img:"CAward.jpg", subs:[]},
  {name:"包袋", img:"Cbag.jpg", subs:["後背包", "旅行包", "公事包", "手提袋", "保溫袋"]},
  {name:"其他禮品", img:"COtheritem.jpg", subs:[]},
].map(c => ({...c, subs: c.subs.map(s => typeof s === "string" ? {name:s} : s)}));

const ALL = "全部";

const priceBands = [
  {label:"全部", min:0, max:Infinity},
  {label:"0–50元", min:0, max:50},
  {label:"51–100元", min:51, max:100},
  {label:"101–150元", min:101, max:150},
  {label:"151–200元", min:151, max:200},
  {label:"201–250元", min:201, max:250},
  {label:"251–300元", min:251, max:300},
  {label:"301–500元", min:301, max:500},
  {label:"501–800元", min:501, max:800},
  {label:"801–1200元", min:801, max:1200},
  {label:"1201元以上", min:1201, max:Infinity},
];

let products = null;
let isLoading = false;
let activeBand = 0, activeBig = ALL, activeSub = null, activeQuery = '';

const $ = id => document.getElementById(id);
const findCat = name => CATEGORIES.find(c => c.name === name);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// 商品的價格區間：products.json 的 "band"，例如 "301–500元"（要和 priceBands 的 label 一樣）
const bandOf = p => p.band || "";

function catsOf(p){
  return (Array.isArray(p.cat) ? p.cat : [p.cat]).map(c => {
    const [big, sub = null] = String(c).split("/");
    return {big, sub};
  });
}

function inCategory(p, big, sub){
  return big === ALL || catsOf(p).some(c => c.big === big && (!sub || c.sub === sub));
}

// 搜尋：比對品名、型號、分類；不分大小寫，忽略空白和 -（輸入 j1750 也找得到 J-1750）
const normalize = s => String(s).toLowerCase().replace(/[\s\-_./]/g, '');
function matchesQuery(p, query){
  const haystack = normalize([p.n, p.sku, ...catsOf(p).flatMap(c => [c.big, c.sub || ''])].join(' '));
  return query.trim().split(/\s+/).filter(Boolean).every(word => haystack.includes(normalize(word)));
}

function matches(p, bandIdx, big = activeBig, sub = activeSub){
  return inCategory(p, big, sub)
    && (bandIdx === 0 || bandOf(p) === priceBands[bandIdx].label)
    && (!activeQuery || matchesQuery(p, activeQuery));
}

function countIn(big, sub = null){
  return products ? products.filter(p => inCategory(p, big, sub)).length : null;
}

function updateStructuredData(){
  if (!products) return;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "企業禮贈品採購型錄",
    "description": "企業禮贈品與大宗採購商品型錄。",
    "inLanguage": "zh-Hant",
    "mainEntity": {
      "@type": "ItemList",
      "numberOfItems": products.length,
      "itemListElement": products.map((p, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "item": {
          "@type": "Product",
          "name": p.n,
          "category": catsOf(p).map(c => c.sub ? `${c.big} > ${c.sub}` : c.big).join(", "),
          "sku": p.sku,
          ...(p.image ? {"image": p.image} : {})
        }
      }))
    }
  };

  $('structuredData').textContent = JSON.stringify(structuredData);
}

function setEmptyMessage(msg){
  const empty = $('empty');
  empty.textContent = msg;
  empty.style.display = 'block';
}

/* ---------- 商品列表 ---------- */
function render(){
  const grid = $('grid');
  const empty = $('empty');

  if (isLoading){
    grid.innerHTML = '';
    setEmptyMessage('正在下載商品資料…');
    return;
  }
  if (!products){
    grid.innerHTML = '';
    return;
  }

  const list = products.filter(p => matches(p, activeBand));
  grid.innerHTML = list.map(p => {
    const c = catsOf(p).find(c => activeBig === ALL || c.big === activeBig) || catsOf(p)[0];
    const band = bandOf(p);
    return `
    <div class="card">
      <div class="swatch">
        ${p.image ? `<img src="./images/${p.image}" alt="${p.n}" loading="lazy">` : p.sku}
      </div>
      <div class="card-body">
        <div class="card-cat">${c.sub || c.big}</div>
        <div class="card-name">${p.n}</div>
        <div class="card-sku">型號 ${p.sku}</div>
        <div class="card-foot">
          ${band ? `<div class="card-band"><small>價格區間</small>${band}</div>` : '<span></span>'}
          ${inquiryButton(p.sku)}
        </div>
      </div>
    </div>`;
  }).join('');
  empty.style.display = 'none';
  $('resultCount').textContent = `共 ${list.length} 件`;

  if (!list.length && activeQuery){
    setEmptyMessage(`找不到「${activeQuery}」相關的商品。換個關鍵字試試，或加 LINE 告訴我們需求，我們幫您找。`);
  } else if (!list.length){
    const label = activeSub || activeBig;
    setEmptyMessage(countIn(activeBig, activeSub)
      ? '這個價格區間目前沒有商品，換個篩選條件試試看。'
      : `「${label}」商品陸續上架中，歡迎加 LINE 或來電詢問。`);
  }
}

/* ---------- 商品區上方：目前分類、小類、價格區間 ---------- */
function buildFilters(){
  // 麵包屑：全部商品 / 大類 / 小類，最後一層是目前位置
  const levels = [{label:"全部商品", big:ALL}];
  if (activeBig !== ALL) levels.push({label:activeBig, big:activeBig});
  if (activeSub) levels.push({label:activeSub, big:activeBig, sub:activeSub});
  if (activeQuery) levels.push({label:`搜尋「${esc(activeQuery)}」`});
  $('crumbs').innerHTML = levels.map((l, i) => i === levels.length - 1
    ? `<span class="current" aria-current="page">${l.label}</span>`
    : `<a href="#catalog" data-big="${l.big}">${l.label}</a><span class="sep">/</span>`).join('')
    + (activeQuery ? '<button class="crumb-clear" type="button" data-clear-search>清除搜尋 ×</button>' : '');

  const cat = findCat(activeBig);
  const subRow = $('subRow');
  if (cat && cat.subs.length){
    const chip = (sub, label) => {
      const n = countIn(activeBig, sub);
      const countTag = n === null ? '' : `<span class="count">${n}</span>`;
      return `<button class="chip ${activeSub === sub ? 'active' : ''} ${n === 0 ? 'is-empty' : ''}" type="button" data-sub-chip="${sub || ''}">${label}${countTag}</button>`;
    };
    subRow.innerHTML = chip(null, `全部${activeBig}`) + cat.subs.map(s => chip(s.name, s.name)).join('');
    subRow.hidden = false;
  } else {
    subRow.innerHTML = '';
    subRow.hidden = true;
  }

  // 價格區間：全部顯示，目前分類下沒有商品的區間變淡
  $('priceRow').innerHTML = priceBands.map((b, i) => {
    const n = products ? products.filter(p => matches(p, i)).length : null;
    const countTag = n === null ? '' : `<span class="count">${n}</span>`;
    return `<button class="chip ${i === activeBand ? 'active' : ''} ${n === 0 ? 'is-empty' : ''}" type="button" data-band="${i}">${b.label}${countTag}</button>`;
  }).join('');

  // 選單上標示目前所在的分類
  document.querySelectorAll('.nav-link, .drw-link').forEach(el => el.classList.toggle('active', el.dataset.big === activeBig));
  document.querySelectorAll('.drw-subs a').forEach(el =>
    el.classList.toggle('active', el.dataset.big === activeBig && el.dataset.sub === activeSub));
}

function selectCategory(big, sub = null){
  activeQuery = '';
  activeBig = big;
  activeSub = sub;
  activeBand = 0;
  buildFilters();
  render();
}

$('subRow').addEventListener('click', e => {
  const el = e.target.closest('[data-sub-chip]');
  if (!el) return;
  selectCategory(activeBig, el.dataset.subChip || null);
});
$('priceRow').addEventListener('click', e => {
  const el = e.target.closest('[data-band]');
  if (!el) return;
  activeBand = +el.dataset.band;
  buildFilters();
  render();
});

// 選單、下拉面板、側邊選單、麵包屑：點了都會篩選並捲到商品區（連結本身是 #catalog）
document.addEventListener('click', e => {
  const el = e.target.closest('[data-big]');
  if (!el) return;
  selectCategory(el.dataset.big, el.dataset.sub || null);
  closeMega();
  closeDrawer();
  closeSearch();
});

document.querySelectorAll('.slide[data-cat]').forEach(el => el.addEventListener('click', () => {
  selectCategory(el.dataset.cat);
}));

/* ---------- 頂部選單列（電腦版） ---------- */
const header = $('siteHeader');
const mega = $('megaPanel');
let megaCat = null, megaTimer = null;

function buildNav(){
  $('navList').innerHTML = CATEGORIES.map(c =>
    `<li><a class="nav-link" href="#catalog" data-big="${c.name}" data-mega="${c.name}">${c.name}</a></li>`).join('');
}

function openMega(name){
  clearTimeout(megaTimer);
  if (megaCat === name && !mega.hidden) return;
  const cat = findCat(name);
  if (!cat) return;
  closeSearch();
  megaCat = name;

  const total = countIn(cat.name);
  const subs = cat.subs.length
    ? `<ul class="mega-subs">${cat.subs.map(s => {
        const n = countIn(cat.name, s.name);
        return `<li><a href="#catalog" class="${n === 0 ? 'is-empty' : ''}" data-big="${cat.name}" data-sub="${s.name}" data-img="${s.img || cat.img}">${s.name}${n === null ? '' : `<small>${n}</small>`}</a></li>`;
      }).join('')}</ul>`
    : `<p class="mega-note">${total ? `共 ${total} 件商品` : '商品陸續上架中，歡迎加 LINE 或來電詢問。'}</p>`;

  mega.innerHTML = `
    <div class="mega-inner">
      <div>
        <a class="mega-title" href="#catalog" data-big="${cat.name}">${cat.name}<span>看全部 →</span></a>
        ${subs}
      </div>
      <a class="mega-media" href="#catalog" data-big="${cat.name}" tabindex="-1" aria-hidden="true">
        <img src="${CAT_IMG_DIR}${cat.img}" alt="">
      </a>
    </div>`;
  mega.hidden = false;
  document.querySelectorAll('.nav-link').forEach(a => a.classList.toggle('is-open', a.dataset.mega === name));

  // 移到小類時，右邊的示意圖換成該小類的圖
  const img = mega.querySelector('.mega-media img');
  mega.querySelectorAll('[data-img]').forEach(a => {
    const show = () => { img.src = CAT_IMG_DIR + a.dataset.img; };
    a.addEventListener('pointerenter', show);
    a.addEventListener('focus', show);
  });
}

function closeMega(){
  clearTimeout(megaTimer);
  mega.hidden = true;
  megaCat = null;
  document.querySelectorAll('.nav-link.is-open').forEach(a => a.classList.remove('is-open'));
}

$('navList').addEventListener('pointerover', e => {
  // 搜尋面板開著時，滑鼠只是經過分類去點搜尋框，不要跳出下拉面板
  if (!$('searchPanel').hidden) return;
  const link = e.target.closest('[data-mega]');
  if (link && e.pointerType === 'mouse') openMega(link.dataset.mega);
});
$('navList').addEventListener('focusin', e => {
  const link = e.target.closest('[data-mega]');
  if (link) openMega(link.dataset.mega);
});
header.addEventListener('pointerleave', () => { megaTimer = setTimeout(closeMega, 180); });
header.addEventListener('pointerenter', () => clearTimeout(megaTimer));
header.addEventListener('focusout', e => { if (!header.contains(e.relatedTarget)) closeMega(); });

/* ---------- 側邊選單（手機、平板） ---------- */
const drawer = $('navDrawer');
const backdrop = $('drawerBackdrop');
const navToggle = $('navToggle');
const chevron = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></svg>';

function buildDrawer(){
  const allItem = `<li><div class="drw-row"><a class="drw-link" href="#catalog" data-big="${ALL}"><span class="drw-thumb"></span>全部商品</a></div></li>`;
  $('drawerList').innerHTML = allItem + CATEGORIES.map((c, i) => `
    <li>
      <div class="drw-row">
        <a class="drw-link" href="#catalog" data-big="${c.name}"><img src="${CAT_IMG_DIR}${c.img}" alt="" loading="lazy">${c.name}</a>
        ${c.subs.length ? `<button class="icon-btn drw-expand" type="button" aria-expanded="false" aria-controls="drwSubs${i}" aria-label="展開${c.name}的小類">${chevron}</button>` : ''}
      </div>
      ${c.subs.length ? `<ul class="drw-subs" id="drwSubs${i}" hidden>${c.subs.map(s =>
        `<li><a href="#catalog" data-big="${c.name}" data-sub="${s.name}">${s.name}</a></li>`).join('')}</ul>` : ''}
    </li>`).join('');
}

function openDrawer(){
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  backdrop.hidden = false;
  navToggle.setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
  $('drawerClose').focus();
}

function closeDrawer(){
  if (!drawer.classList.contains('open')) return;
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  backdrop.hidden = true;
  navToggle.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
}

navToggle.addEventListener('click', openDrawer);
$('drawerClose').addEventListener('click', () => { closeDrawer(); navToggle.focus(); });
backdrop.addEventListener('click', closeDrawer);
$('drawerList').addEventListener('click', e => {
  const btn = e.target.closest('.drw-expand');
  if (!btn) return;
  const open = btn.getAttribute('aria-expanded') !== 'true';
  btn.setAttribute('aria-expanded', String(open));
  $(btn.getAttribute('aria-controls')).hidden = !open;
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  closeMega();
  if (drawer.classList.contains('open')){ closeDrawer(); navToggle.focus(); }
});

/* ---------- 搜尋 ---------- */
const searchPanel = $('searchPanel');
const searchInput = $('searchInput');
const SEARCH_PREVIEW = 6;   // 輸入時最多先列出幾筆

function openSearch(){
  closeMega();
  searchPanel.hidden = false;
  $('searchBtn').setAttribute('aria-expanded', 'true');
  searchInput.value = activeQuery;
  renderSuggestions();
  searchInput.focus();
}

function closeSearch(){
  if (searchPanel.hidden) return;
  searchPanel.hidden = true;
  $('searchBtn').setAttribute('aria-expanded', 'false');
}

// 把關鍵字在品名裡標出來
function highlight(text, query){
  let html = esc(text);
  query.trim().split(/\s+/).filter(Boolean).forEach(word => {
    const re = new RegExp(esc(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    html = html.replace(re, m => `<mark>${m}</mark>`);
  });
  return html;
}

function renderSuggestions(){
  const box = $('searchResults');
  const query = searchInput.value.trim();
  if (!query){ box.innerHTML = ''; return; }
  if (!products){ box.innerHTML = '<div class="sr-note">商品資料載入中…</div>'; return; }

  const found = products.filter(p => matchesQuery(p, query));
  if (!found.length){
    box.innerHTML = `<div class="sr-note">找不到「${esc(query)}」相關的商品，換個關鍵字試試看。</div>`;
    return;
  }
  box.innerHTML = found.slice(0, SEARCH_PREVIEW).map(p => {
    const c = catsOf(p)[0];
    const thumb = p.image ? `<img src="./images/${p.image}" alt="" loading="lazy">` : esc(p.sku);
    return `<a class="sr-item" href="#catalog" data-search="${esc(p.sku)}">
      <span class="sr-thumb">${thumb}</span>
      <span><span class="sr-name">${highlight(p.n, query)}</span>
      <span class="sr-meta">型號 ${esc(p.sku)} ・ ${esc(c.sub || c.big)}</span></span>
    </a>`;
  }).join('') + `<a class="sr-all" href="#catalog" data-search="${esc(query)}">查看全部 ${found.length} 筆結果 →</a>`;
}

function applySearch(query){
  activeQuery = query.trim();
  activeBig = ALL;
  activeSub = null;
  activeBand = 0;
  buildFilters();
  render();
  closeSearch();
}

$('searchBtn').addEventListener('click', () => searchPanel.hidden ? openSearch() : closeSearch());
$('searchClose').addEventListener('click', closeSearch);
searchInput.addEventListener('input', renderSuggestions);
$('searchForm').addEventListener('submit', e => {
  e.preventDefault();
  if (!searchInput.value.trim()) return;
  applySearch(searchInput.value);
  $('catalog').scrollIntoView({behavior: 'smooth'});
});
// 點建議清單：直接篩選（連結本身會捲到商品區）
$('searchResults').addEventListener('click', e => {
  const el = e.target.closest('[data-search]');
  if (el) applySearch(el.dataset.search);
});
$('crumbs').addEventListener('click', e => {
  if (!e.target.closest('[data-clear-search]')) return;
  activeQuery = '';
  buildFilters();
  render();
});
// 點搜尋面板外面就收起來
document.addEventListener('pointerdown', e => {
  if (!searchPanel.hidden && !searchPanel.contains(e.target) && !e.target.closest('#searchBtn')) closeSearch();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSearch(); });

/* ---------- 詢價車 ---------- */
// 送出的詢價會進到這份 Google 表單（回覆會自動存到連結的試算表）
// 表單題目若有增減，要重新取得「預先填入的連結」並更新這裡的 entry 代碼
const INQUIRY_FORM = {
  action: "https://docs.google.com/forms/d/e/1FAIpQLSe2Njx27LXzeIv3DkvxX-Y-yfENSfU6JoAbehyFsW_h7-xNDg/formResponse",
  fields: {
    name:    "entry.2099267464", // 您的稱呼
    phone:   "entry.327190387",  // 電話
    line:    "entry.1314464919", // LINE ID
    email:   "entry.1715246035", // Email
    company: "entry.298215200",  // 公司名稱
    items:   "entry.936628327",  // 詢價商品
    note:    "entry.1777856729", // 備註
  },
};

// 加入詢價的商品存在瀏覽器裡（localStorage），重新整理頁面也不會消失
// 格式：[{sku:"J-1750", qty:"100"}, …]，qty 留空代表客人還沒填數量
const INQUIRY_KEY = 'jawen-inquiry';
let inquiry = [];
try {
  inquiry = (JSON.parse(localStorage.getItem(INQUIRY_KEY)) || [])
    .map(x => typeof x === 'string' ? {sku:x, qty:''} : x)
    .filter(x => x && x.sku);
} catch (e) { inquiry = []; }

const inInquiry = sku => inquiry.some(x => x.sku === sku);
const productBySku = sku => (products || []).find(p => p.sku === sku);

function saveInquiry(){
  try { localStorage.setItem(INQUIRY_KEY, JSON.stringify(inquiry)); } catch (e) {}
  const count = $('cartCount');
  count.textContent = inquiry.length;
  count.hidden = inquiry.length === 0;
  $('cartBtn').setAttribute('aria-label', `詢價車，已加入 ${inquiry.length} 件`);
  $('cartHeadCount').textContent = inquiry.length ? `（${inquiry.length} 件）` : '';
}

function inquiryButton(sku){
  const added = inInquiry(sku);
  return `<button class="inq-btn ${added ? 'added' : ''}" type="button" data-inquiry="${sku}" aria-pressed="${added}">${added ? '✓ 已加入' : '＋ 加入詢價'}</button>`;
}

function showToast(msg){
  let toast = $('toast');
  if (!toast){
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toast.hidden = true; }, 2600);
}

function toggleInquiry(sku){
  const name = productBySku(sku)?.n || sku;
  if (inInquiry(sku)){
    inquiry = inquiry.filter(x => x.sku !== sku);
    showToast(`已從詢價車移除：${name}`);
  } else {
    inquiry.push({sku, qty:''});
    showToast(`已加入詢價：${name}`);
  }
  saveInquiry();
}

$('grid').addEventListener('click', e => {
  const btn = e.target.closest('[data-inquiry]');
  if (!btn) return;
  toggleInquiry(btn.dataset.inquiry);
  btn.outerHTML = inquiryButton(btn.dataset.inquiry);
});

/* 詢價車面板 */
const cartPanel = $('cartPanel');
const cartBackdrop = $('cartBackdrop');
const removeIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg>';

function renderCart(){
  $('cartEmpty').hidden = inquiry.length > 0;
  $('cartList').innerHTML = inquiry.map(x => {
    const p = productBySku(x.sku);
    const thumb = p && p.image
      ? `<img src="./images/${p.image}" alt="" loading="lazy">`
      : `<span>${x.sku}</span>`;
    return `
    <li class="cart-item">
      <div class="cart-thumb">${thumb}</div>
      <div class="cart-info">
        <div class="cart-name">${p ? p.n : x.sku}</div>
        <div class="cart-meta">型號 ${x.sku}${p && p.band ? ` ・ ${p.band}` : ''}</div>
        <label class="cart-qty">
          <span>數量</span>
          <input type="text" inputmode="numeric" data-qty="${x.sku}" value="${x.qty || ''}" placeholder="量多價格越便宜唷！" aria-label="${p ? p.n : x.sku} 的數量">
        </label>
      </div>
      <button class="icon-btn cart-remove" type="button" data-remove="${x.sku}" aria-label="移除 ${p ? p.n : x.sku}">${removeIcon}</button>
    </li>`;
  }).join('');
}

function openCart(){
  $('cartView').hidden = false;
  $('cartDone').hidden = true;
  $('formError').hidden = true;
  renderCart();
  cartPanel.classList.add('open');
  cartPanel.setAttribute('aria-hidden', 'false');
  cartBackdrop.hidden = false;
  document.body.style.overflow = 'hidden';
  $('cartClose').focus();
}

function closeCart(){
  if (!cartPanel.classList.contains('open')) return;
  cartPanel.classList.remove('open');
  cartPanel.setAttribute('aria-hidden', 'true');
  cartBackdrop.hidden = true;
  document.body.style.overflow = '';
  $('cartBtn').focus();
}

$('cartBtn').addEventListener('click', openCart);
$('cartClose').addEventListener('click', closeCart);
$('doneClose').addEventListener('click', closeCart);
cartBackdrop.addEventListener('click', closeCart);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCart(); });

$('cartList').addEventListener('click', e => {
  const btn = e.target.closest('[data-remove]');
  if (!btn) return;
  toggleInquiry(btn.dataset.remove);
  renderCart();
  render();
});

// 數量只接受數字，邊打邊存
$('cartList').addEventListener('input', e => {
  const input = e.target.closest('[data-qty]');
  if (!input) return;
  input.value = input.value.replace(/[^\d]/g, '');
  const item = inquiry.find(x => x.sku === input.dataset.qty);
  if (item){ item.qty = input.value; saveInquiry(); }
});

/* 詢價清單文字：送到 Google 表單的「詢價商品」、也用在複製到 LINE */
function inquiryText(){
  return inquiry.map((x, i) => {
    const p = productBySku(x.sku);
    return `${i + 1}. ${x.sku}｜${p ? p.n : ''}｜數量：${x.qty || '未填'}`;
  }).join('\n');
}

function makeInquiryId(){
  const d = new Date();
  const mmdd = String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `JW-${mmdd}-${rand}`;
}

function formError(msg, field){
  const box = $('formError');
  box.textContent = msg;
  box.hidden = false;
  if (field) $('inqForm').elements[field].focus({preventScroll: true});
  box.scrollIntoView({block: 'center', behavior: 'smooth'});
}

$('inqForm').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  const v = name => form.elements[name].value.trim();
  $('formError').hidden = true;

  if (!inquiry.length) return formError('詢價車還沒有商品，請先加入想詢價的商品。');
  if (!v('name')) return formError('請填寫您的稱呼。', 'name');
  if (!v('phone') && !v('line') && !v('email')) return formError('請至少留下一種聯絡方式：電話、LINE ID 或 Email。', 'phone');
  if (v('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('email'))) return formError('Email 格式好像不太對，請再確認一次。', 'email');

  const id = makeInquiryId();
  const done = () => {
    inquiry = [];
    saveInquiry();
    render();
    form.reset();
    $('doneId').textContent = id;
    $('cartView').hidden = true;
    $('cartDone').hidden = false;
  };

  // 機器人會填隱藏欄位：假裝送出成功，但不真的送
  if (v('website')) return done();

  const f = INQUIRY_FORM.fields;
  const body = new URLSearchParams({
    [f.name]: v('name'),
    [f.phone]: v('phone'),
    [f.line]: v('line'),
    [f.email]: v('email'),
    [f.company]: v('company'),
    [f.items]: `詢價編號：${id}\n${inquiryText()}`,
    [f.note]: v('note'),
  });

  const btn = $('submitBtn');
  btn.disabled = true;
  btn.textContent = '送出中…';
  try {
    // Google 表單不允許網站讀取回應（no-cors），只要請求有送出就視為成功
    await fetch(INQUIRY_FORM.action, {method:'POST', mode:'no-cors', body});
    done();
  } catch (err) {
    console.error('詢價送出失敗：', err);
    formError('送出失敗，可能是網路不穩。請稍後再試，或按下方「複製詢價清單」改用 LINE 傳給我們。');
  } finally {
    btn.disabled = false;
    btn.textContent = '送出詢價';
  }
});

$('copyList').addEventListener('click', async () => {
  if (!inquiry.length) return showToast('詢價車還沒有商品');
  const text = `嘉玟禮品 詢價清單\n${inquiryText()}`;
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  showToast('已複製詢價清單，可以貼到 LINE 傳給我們');
});

saveInquiry();

// 熱門禮贈品輪播：每 4 秒自動翻頁，滑鼠移上去或手指觸碰時暫停
const CAROUSEL_INTERVAL = 4000;

function initCarousel(){
  const root = document.getElementById('featCarousel');
  if (!root) return;
  const track = root.querySelector('.car-track');
  const slides = [...track.querySelectorAll('.slide')];
  const dotsBox = root.querySelector('.car-dots');
  let index = 0, timer = null;

  dotsBox.innerHTML = slides.map((_, i) =>
    `<button class="car-dot" type="button" aria-label="第 ${i + 1} 張"></button>`).join('');
  const dots = [...dotsBox.children];

  function setActive(i){
    index = i;
    dots.forEach((d, j) => {
      d.classList.toggle('active', j === i);
      d.setAttribute('aria-current', j === i ? 'true' : 'false');
    });
  }
  function goTo(i){
    i = (i + slides.length) % slides.length;
    track.scrollTo({left: i * track.clientWidth});
    setActive(i);
  }
  function stop(){ clearInterval(timer); timer = null; }
  function start(){
    stop();
    timer = setInterval(() => goTo(index + 1), CAROUSEL_INTERVAL);
  }

  // 使用者手動滑動時，同步下方圓點
  track.addEventListener('scroll', () => {
    const i = Math.round(track.scrollLeft / track.clientWidth);
    if (i !== index && i >= 0 && i < slides.length) setActive(i);
  }, {passive: true});

  root.querySelector('.car-prev').addEventListener('click', () => { goTo(index - 1); start(); });
  root.querySelector('.car-next').addEventListener('click', () => { goTo(index + 1); start(); });
  dots.forEach((d, i) => d.addEventListener('click', () => { goTo(i); start(); }));

  root.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') stop(); });
  root.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') start(); });
  root.addEventListener('focusin', stop);
  root.addEventListener('focusout', start);
  track.addEventListener('touchstart', stop, {passive: true});
  track.addEventListener('touchend', start, {passive: true});
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
  window.addEventListener('resize', () => track.scrollTo({left: index * track.clientWidth, behavior: 'instant'}));

  setActive(0);
  start();
}


async function loadProducts(){
  isLoading = true;
  buildFilters();
  render();

  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('products.json 必須是陣列格式');
    products = data;
  } catch (err) {
    products = null;
    $('grid').innerHTML = '';
    setEmptyMessage('商品資料下載失敗，請確認 products.json 與此頁面放在同一資料夾，並透過本機伺服器開啟（非直接雙擊檔案）。');
    console.error('載入 products.json 失敗：', err);
  } finally {
    isLoading = false;
    updateStructuredData();
    buildFilters();
    render();
  }
}

buildNav();
buildDrawer();
initCarousel();
loadProducts();
