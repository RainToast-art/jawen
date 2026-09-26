const DATA_URL = "./data/products.json";

const priceBands = [
  {label:"全部", min:0, max:Infinity},
  {label:"300元以下", min:0, max:300},
  {label:"300–500元", min:301, max:500},
  {label:"500–800元", min:501, max:800},
  {label:"800–1200元", min:801, max:1200},
  {label:"1200元以上", min:1201, max:Infinity},
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

function getCats(){
  return products ? ["全部", ...new Set(products.map(p => p.cat))] : ["全部"];
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
        <a class="card-ask" href="https://line.me/R/ti/p/@YOUR_LINE_ID">詢問這項商品</a>
      </div>
    </div>
  `).join('');
  empty.style.display = 'none';
  if (!list.length) setEmptyMessage('這個區間目前沒有商品，換個篩選條件試試看。');
}

function buildChips(){
  const priceRow = document.getElementById('priceRow');
  priceRow.innerHTML = priceBands.map((b,i) =>
    `<button class="chip ${i===activeBand?'active':''}" data-i="${i}">${b.label}</button>`
  ).join('');
  priceRow.querySelectorAll('.chip').forEach(el => el.onclick = () => {
    activeBand = +el.dataset.i;
    render();
    buildChips();
  });

  const catRow = document.getElementById('catRow');
  catRow.innerHTML = getCats().map(c =>
    `<button class="chip ${c===activeCat?'active':''}" data-c="${c}">${c}</button>`
  ).join('');
  catRow.querySelectorAll('.chip').forEach(el => el.onclick = () => onCategoryClick(el.dataset.c));
}

function onCategoryClick(cat){
  activeCat = cat;
  buildChips();
  render();
}

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
