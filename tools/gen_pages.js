// Генерує статичну сторінку на кожен товар: /t/<id>-<slug>/index.html
// У вихідному HTML — реальний текст (назва, ціна, опис, розміри) + JSON-LD.
// Саме це Google індексує; SPA лишається для покупок.
// Запуск: node tools/gen_pages.js
const fs = require('fs');
const path = require('path');

const SITE = 'https://zaisun.com.ua';
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 't');

const raw = fs.readFileSync(path.join(ROOT, 'data.js'), 'utf-8');
const DATA = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));

const esc = s => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const TR = {
  а:'a',б:'b',в:'v',г:'h',ґ:'g',д:'d',е:'e',є:'ie',ж:'zh',з:'z',и:'y',і:'i',
  ї:'i',й:'i',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',
  ф:'f',х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ь:'',ю:'iu',я:'ia',ы:'y',э:'e',ё:'e',ъ:''
};
function slug(s) {
  return String(s).toLowerCase()
    .split('').map(c => (c in TR ? TR[c] : c)).join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60).replace(/-+$/, '');
}

// обрізає по межі слова, без висячих тире й ком
function clip(s, n) {
  s = String(s).trim();
  if (s.length <= n) return s;
  let t = s.slice(0, n);
  const sp = t.lastIndexOf(' ');
  if (sp > n * 0.6) t = t.slice(0, sp);
  return t.replace(/[\s,;:–—-]+$/, '');
}

// ── ціни ──
function priceInfo(p) {
  const vals = Object.values(p.var || {}).filter(v => v && v.s !== false && v.p > 0);
  const prices = vals.map(v => v.p);
  const all = prices.length ? prices : [p.price].filter(x => x > 0);
  return { min: Math.min(...all), max: Math.max(...all), many: new Set(all).size > 1 };
}

const visible = DATA.products.filter(p => !p.hidden && p.photo);
const urlOf = p => `/t/${p.id}-${slug(p.name)}/`;

// Заголовки. Після обрізання довгі назви можуть збігтись (часто відрізняються
// лише кольором у кінці). Розводимо: спершу кольором, потім артикулом.
const TITLES = (() => {
  const t = new Map();
  for (const p of visible) t.set(p.id, clip(p.name, 62));

  const tally = () => {
    const m = new Map();
    for (const v of t.values()) m.set(v, (m.get(v) || 0) + 1);
    return m;
  };

  let c = tally();
  for (const p of visible) {
    if (c.get(t.get(p.id)) > 1 && p.color) t.set(p.id, clip(p.name, 44) + ' — ' + p.color);
  }
  c = tally();
  for (const p of visible) {
    if (c.get(t.get(p.id)) > 1) t.set(p.id, t.get(p.id) + ' #' + p.id);
  }
  return t;
})();

// ── схожі товари: та сама категорія ──
function related(p, n) {
  const cats = new Set(p.cats || []);
  return visible
    .filter(x => x.id !== p.id && (x.cats || []).some(c => cats.has(c)))
    .slice(0, n);
}

const CSS = `
:root{--bg:#FAF4EC;--ink:#2E2A28;--mut:#7A736D;--line:#E6DACB;--acc:#2E2A28}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:1000px;margin:0 auto;padding:16px}
header{border-bottom:1px solid var(--line);margin-bottom:24px}
header .wrap{display:flex;align-items:center;gap:12px;padding:12px 16px}
header img{height:44px}
nav.bc{font-size:14px;color:var(--mut);margin-bottom:16px}
nav.bc a{color:var(--mut)}
.grid{display:grid;grid-template-columns:1fr;gap:28px}
@media(min-width:760px){.grid{grid-template-columns:minmax(0,420px) 1fr}}
.ph{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:14px;background:#EFE6DA}
h1{font-size:24px;line-height:1.25;margin:0 0 12px}
.price{font-size:26px;font-weight:700;margin:8px 0 4px}
.old{color:var(--mut);text-decoration:line-through;font-size:18px;font-weight:400;margin-left:8px}
.meta{color:var(--mut);font-size:15px;margin:2px 0}
table{border-collapse:collapse;margin:16px 0;font-size:15px;width:100%;max-width:340px}
th,td{border:1px solid var(--line);padding:7px 11px;text-align:left}
th{background:#F2E9DD;font-weight:600}
.buy{display:inline-block;background:var(--acc);color:#fff;text-decoration:none;
padding:14px 30px;border-radius:11px;font-weight:600;margin:18px 0 8px}
.desc{margin:22px 0;white-space:pre-line}
.rel{margin:44px 0 0;border-top:1px solid var(--line);padding-top:24px}
.rel h2{font-size:19px;margin:0 0 16px}
.rl{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
@media(min-width:640px){.rl{grid-template-columns:repeat(4,1fr)}}
.rl a{text-decoration:none;color:var(--ink);font-size:14px;line-height:1.35}
.rl img{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:10px;margin-bottom:6px;background:#EFE6DA}
.rl b{display:block;font-weight:600;margin-top:3px}
footer{border-top:1px solid var(--line);margin-top:48px;padding:22px 0;color:var(--mut);font-size:14px}
footer a{color:var(--mut)}
`;

function page(p) {
  const pi = priceInfo(p);
  const img = `${SITE}/images/${encodeURIComponent(p.photo)}`;
  const url = SITE + urlOf(p);
  const cats = (p.catn || []).filter(c => c && c.toLowerCase() !== 'sale');
  const cat = cats[cats.length - 1] || 'Дитячий одяг';

  const sizes = (p.sizes || []).filter(s => {
    const v = (p.var || {})[s];
    return !v || v.s !== false;
  });

  const descText = (p.desc && p.desc.trim()) ? p.desc.trim() : p.name;
  const metaDesc = `${p.name}. ${pi.many ? 'Від ' : ''}${pi.min} грн. ${
    sizes.length ? 'Розміри: ' + sizes.join(', ') + '. ' : ''
  }ZaiSun — власне виробництво, доставка Новою Поштою.`.replace(/\s+/g, ' ').slice(0, 300);

  const rows = sizes.map(s => {
    const v = (p.var || {})[s] || {};
    return `<tr><td>${esc(s)}</td><td>${v.p || pi.min} грн</td></tr>`;
  }).join('\n');

  const rel = related(p, 4).map(r => {
    const rp = priceInfo(r);
    return `<a href="${urlOf(r)}"><img src="/images/${encodeURIComponent(r.photo)}" alt="${esc(r.name)}" loading="lazy" width="300" height="400"><span>${esc(r.name).slice(0, 64)}</span><b>${rp.many ? 'від ' : ''}${rp.min} грн</b></a>`;
  }).join('\n');

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    image: [img],
    description: descText,
    sku: String(p.id),
    brand: { '@type': 'Brand', name: 'ZaiSun' },
    category: cat,
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'UAH',
      lowPrice: pi.min,
      highPrice: pi.max,
      offerCount: Math.max(1, sizes.length),
      availability: p.stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url,
      seller: { '@type': 'Organization', name: 'ZaiSun' }
    }
  };
  if (p.color) ld.color = p.color;

  const crumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Головна', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: cat, item: SITE + '/' },
      { '@type': 'ListItem', position: 3, name: p.name, item: url }
    ]
  };

  return `<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(TITLES.get(p.id))} — ZaiSun</title>
<meta name="description" content="${esc(metaDesc)}">
<link rel="canonical" href="${url}">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png">
<link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="product">
<meta property="og:site_name" content="ZaiSun">
<meta property="og:title" content="${esc(p.name)}">
<meta property="og:description" content="${esc(metaDesc)}">
<meta property="og:image" content="${img}">
<meta property="og:url" content="${url}">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<script type="application/ld+json">${JSON.stringify(crumbs)}</script>
<style>${CSS}</style>
</head>
<body>
<header><div class="wrap"><a href="/"><img src="/logo.png" alt="ZaiSun"></a></div></header>
<div class="wrap">
<nav class="bc"><a href="/">Головна</a> › ${esc(cat)}</nav>
<div class="grid">
  <div><img class="ph" src="/images/${encodeURIComponent(p.photo)}" alt="${esc(p.name)}" width="600" height="800"></div>
  <div>
    <h1>${esc(p.name)}</h1>
    <div class="price">${pi.many ? 'від ' : ''}${pi.min} грн${
      p.old && p.old > pi.min ? `<span class="old">${p.old} грн</span>` : ''
    }</div>
    ${p.color ? `<p class="meta">Колір: ${esc(p.color)}</p>` : ''}
    <p class="meta">${p.stock ? 'В наявності' : 'Немає в наявності'}</p>
    ${rows ? `<table><tr><th>Розмір</th><th>Ціна</th></tr>${rows}</table>` : ''}
    <a class="buy" href="/?p=${p.id}">Купити на сайті</a>
    <div class="desc">${esc(descText)}</div>
  </div>
</div>
${rel ? `<section class="rel"><h2>Схожі товари</h2><div class="rl">${rel}</div></section>` : ''}
</div>
<footer><div class="wrap">
ZaiSun — дитячий одяг власного виробництва, Луцьк ·
<a href="/">Каталог</a> · <a href="/dostavka.html">Доставка</a> ·
<a href="/kontakty.html">Контакти</a> · <a href="/oferta.html">Оферта</a>
</div></footer>
</body>
</html>`;
}

// ── генерація ──
if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const seen = new Set();
let n = 0;
for (const p of visible) {
  const dir = path.join(OUT, `${p.id}-${slug(p.name)}`);
  if (seen.has(dir)) { console.error('дубль шляху:', dir); process.exit(1); }
  seen.add(dir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page(p));
  n++;
}

// ── sitemap ──
const urls = [
  `${SITE}/`, `${SITE}/dostavka.html`, `${SITE}/kontakty.html`, `${SITE}/oferta.html`,
  ...visible.map(p => SITE + urlOf(p))
];
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n') +
  `\n</urlset>\n`);

console.log(`сторінок: ${n} | у sitemap: ${urls.length}`);
