const DATA_URL = "./data/products.json";

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
const swatchColors = ["#7B2331","#B08D57","#4A5B4A","#5C1A24","#8A6A3F"];

let products = null;
let isLoading = false;
let activeBand = 0, activeCat = "全部";

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
          "category": p.cat,
          "sku": p.sku,
          ...(p.image ? {"image": p.image} : {}),
          "offers": {
            "@type": "Offer",
            "priceCurrency": "TWD",
            "price": p.price,
            "availability": "https://schema.org/InStock"
          }
        }
      }))
    }
  };

  document.getElementById('structuredData').textContent = JSON.stringify(structuredData);
}

// 熱門禮贈品專區用到、但商品資料裡還沒有的類別
const extraCats = ["餐具", "水晶獎座", "電子產品", "其他禮品"];

// 類別圖片：把檔案放進 images/categories/，再把檔名填進對應的類別，例如 "包類": "bag.jpg"
const catImages = {
  "全部": "",
  "包類": "",
  "戶外露營": "",
  "保溫杯瓶": "",
  "鍋具": "",
  "廚房小物": "",
  "刀具": "",
  "保鮮餐盒": "",
  "餐具": "",
  "水晶獎座": "",
  "電子產品": "",
  "其他禮品": "",
};

function getCats(){
  return products ? ["全部", ...new Set([...products.map(p => p.cat), ...extraCats])] : ["全部"];
}

function setEmptyMessage(msg){
  const empty = document.getElementById('empty');
  empty.textContent = msg;
  empty.style.display = 'block';
}

function render(){
  const grid = document.getElementById('grid');
  const empty = document.getElementById('empty');

  if (isLoading){
    grid.innerHTML = '';
    setEmptyMessage('正在下載商品資料…');
    return;
  }
  if (!products){
    grid.innerHTML = '';
    setEmptyMessage('請點選上方「依商品類型篩選」的按鈕，載入商品型錄。');
    return;
  }

  const band = priceBands[activeBand];
  const list = products.filter(p =>
    p.price >= band.min && p.price <= band.max &&
    (activeCat === "全部" || p.cat === activeCat)
  );
  grid.innerHTML = list.map((p,i) => `
    <div class="card">
      <div class="swatch">
        ${p.image ? `<img src="./images/${p.image}" alt="${p.n}" loading="lazy">` : p.sku}
      </div>
      <div class="card-body">
        <div class="card-cat">${p.cat}</div>
        <div class="card-name">${p.n}</div>
        <div class="card-sku">型號 ${p.sku}</div>
        <div class="card-price">NT$ ${p.price.toLocaleString()}</div>
      </div>
    </div>
  `).join('');
  empty.style.display = 'none';
  if (!list.length){
    const catHasItems = activeCat === "全部" || products.some(p => p.cat === activeCat);
    setEmptyMessage(catHasItems
      ? '這個區間目前沒有商品，換個篩選條件試試看。'
      : `「${activeCat}」商品即將上架，歡迎加 LINE 或來電詢問。`);
  }
}

function countInBand(band){
  if (!products) return null;
  return products.filter(p =>
    p.price >= band.min && p.price <= band.max &&
    (activeCat === "全部" || p.cat === activeCat)
  ).length;
}

function buildChips(){
  const priceRow = document.getElementById('priceRow');
  priceRow.innerHTML = priceBands.map((b,i) => {
    const n = countInBand(b);
    const countTag = n === null ? '' : `<span class="count">${n}</span>`;
    return `<button class="chip ${i===activeBand?'active':''} ${n===0?'is-empty':''}" data-i="${i}">${b.label}${countTag}</button>`;
  }).join('');
  priceRow.querySelectorAll('.chip').forEach(el => el.onclick = () => {
    activeBand = +el.dataset.i;
    render();
    buildChips();
  });

  const catRow = document.getElementById('catRow');
  catRow.innerHTML = getCats().map(c => {
    const empty = c !== "全部" && !products.some(p => p.cat === c);
    const img = catImages[c];
    const media = img
      ? `<img src="./images/categories/${img}" alt="${c}" loading="lazy">`
      : `<span class="cat-placeholder">圖片待提供</span>`;
    return `<button class="cat-tile ${c===activeCat?'active':''} ${empty?'is-empty':''}" data-c="${c}">
      <span class="cat-media">${media}</span>
      <span class="cat-name">${c}</span>
    </button>`;
  }).join('');
  catRow.querySelectorAll('.cat-tile').forEach(el => el.onclick = () => onCategoryClick(el.dataset.c));
}

function onCategoryClick(cat){
  activeCat = cat;
  buildChips();
  render();
}

document.querySelectorAll('.feat-tile[data-cat]').forEach(el => el.addEventListener('click', () => {
  activeBand = 0;
  onCategoryClick(el.dataset.cat);
}));

async function loadProducts(){
  isLoading = true;
  buildChips();
  render();

  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('products.json 必須是陣列格式');
    products = data;
  } catch (err) {
    products = null;
    document.getElementById('grid').innerHTML = '';
    setEmptyMessage('商品資料下載失敗，請確認 products.json 與此頁面放在同一資料夾，並透過本機伺服器開啟（非直接雙擊檔案）。');
    console.error('載入 products.json 失敗：', err);
  } finally {
    isLoading = false;
    updateStructuredData();
    buildChips();
    render();
  }
}

loadProducts();
