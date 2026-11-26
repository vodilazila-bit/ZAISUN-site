// Генерує статичні сторінки, які індексує Google (SPA лишається для покупок):
//   /t/<id>-<slug>/index.html — сторінка товару: назва, ціна, розміри, опис + JSON-LD Product
//   /c/<ключ>/index.html      — сторінка розділу: текст, список товарів зі ссилками на /t/… + JSON-LD
//   sitemap.xml               — головна, інфосторінки, розділи, товари (з фото)
// Запуск: node tools/gen_pages.js
const fs = require('fs');
const path = require('path');

const SITE = 'https://zaisun.com.ua';
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 't');
const OUT_C = path.join(ROOT, 'c');

const raw = fs.readFileSync(path.join(ROOT, 'data.js'), 'utf-8');
const DATA = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
// Категорії-чернетки (draft:true) не потрапляють ні на сторінки, ні у фід.
(() => {
  const dr = new Set();
  DATA.tree.forEach(t => { if (t.draft) { dr.add(t.id); (t.children || []).forEach(c => dr.add(c.id)); } });
  if (!dr.size) return;
  DATA.tree = DATA.tree.filter(t => !t.draft);
  for (const p of DATA.products) {
    const cats = p.cats || [], catn = p.catn || [];
    if (!cats.some(c => dr.has(c))) continue;
    const keep = cats.map((c, i) => dr.has(c) ? -1 : i).filter(i => i >= 0);
    if (!keep.length) { p.hidden = true; continue; }
    p.cats = keep.map(i => cats[i]); p.catn = keep.map(i => catn[i]);
  }
})();

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
const thumbOf = photo => '/images/thumb/' + encodeURIComponent(String(photo).replace(/\.[^.]+$/, '')) + '.webp';

// ── розділи: ті самі пункти, що MENU_DEF в index.html (поле c — назви категорій з дерева) ──
// Синхронізувати з MENU_DEF і STATIC_CATS в index.html. Порядок = пріоритет «основного» розділу товару
// для хлібних крихт: спершу тип речі, сезонні колекції — в кінці.
const CATS = [
  { k: 'bodi', c: ['Боді', 'Боді-гольф', 'Комплекти з боді'], h1: 'Дитячі боді',
    text: 'Боді для новонароджених і малюків: з довгим і коротким рукавом, з рюшами й крильцями, боді-гольфи та комплекти з боді. Шиємо самі в Луцьку з мʼяких натуральних тканин — бавовни, рубчика, ангори.' },
  { k: 'kostiumy', c: ['Костюм', 'Костюм утеплений'], h1: 'Дитячі костюми',
    text: 'Костюми для малюків і дітей: з двонитки, бомбери, світшоти, термокостюми й утеплені комплекти на осінь та зиму. Власне виробництво ZaiSun у Луцьку.' },
  { k: 'sukni', c: ['Сукні', 'сарафан'], h1: 'Дитячі сукні та сарафани',
    text: 'Сукні й сарафани для дівчаток — від святкових з фатином і сердечками до щоденних з мусліну, вельвету й трикотажу. Є моделі для новонароджених.' },
  { k: 'rompery', c: ['Ромпер'], h1: 'Дитячі ромпери',
    text: 'Ромпери з мусліну — 100% бавовна, легкі й дихаючі, з квітами, полуничками й сердечками. Зручні для літа, прогулянок і фотосесій.' },
  { k: 'dzhynsy', c: ['Джинси, штани, кофтини'], h1: 'Дитячі штани, лосини та кофтини',
    text: 'Базовий гардероб на кожен день: лосини з бавовни й рубчика, кльош, штани, джинси та кофтини для дівчаток і хлопчиків.' },
  { k: 'futbolky', c: ['Шорти, футболки', 'Лосіни, футболки'], h1: 'Дитячі футболки, шорти та літні комплекти',
    text: 'Футболки, шорти, велосипедки й легкі комплекти на тепле літо: бавовна, муслін, джинс із рюшами.' },
  { k: 'shapky', c: ['Шапки', 'Рукавички'], h1: 'Дитячі шапки та рукавички',
    text: 'Шапки для дітей на будь-яку пору: тонкі бавовняні бінні й чалми для новонароджених, демісезонні шапочки з вушками, зимові вʼязані шапки з помпоном і ангорою, а також теплі рукавички. Розмір підбирають за обхватом голови.' },
  { k: 'poviazky', c: ["Пов'язки"], h1: 'Дитячі повʼязки на голову',
    text: 'Трикотажні, велюрові й рубчикові повʼязки для дівчаток — від новонароджених до школярок, у десятках кольорів. Розмір — за обхватом голови.' },
  { k: 'panamy', c: ['Панама', 'Косинки, панами'], h1: 'Дитячі панами, косинки та бейсболки',
    text: 'Літні панами з мусліну й бавовни, косинки на резинці та панамки з вушками — захист від сонця для малюків.' },
  { k: 'kolhoty', c: ['Колготи, шкарпетки, гольфи'], h1: 'Дитячі колготи, шкарпетки та гольфи',
    text: 'Демісезонні й зимові колготи, махрові колготи з принтами, шкарпетки з гальмами (тормозками) й гольфи для дітей від народження до 8 років.' },
  { k: 'vzuttia', c: ['Пінетки'], h1: 'Пінетки та дитяче взуття',
    text: 'Пінетки для новонароджених і малюків: мʼякі кросівки-пінетки з протиковзкою підошвою, святкові туфельки й теплі пінетки. Розмір — за віком і довжиною устілки.' },
  { k: 'aksesuary', c: ['Аксесуари'], h1: 'Аксесуари для малюків',
    text: 'Корисні дрібниці від ZaiSun: непромокальні слинявчики-нагрудники, теплі рукавички та інші аксесуари для дітей.' },
  { k: 'khreshchennia', c: ['Одяг для Хрещення'], h1: 'Одяг на хрещення',
    text: 'Святкові сукні-боді з крильцями й фатином, сарафани та комплекти для хрещення — білі, молочні й ніжно-рожеві.' },
  { k: 'zyma', c: ['Зима'], h1: 'Дитячий зимовий одяг',
    text: 'Тепла колекція на зиму: вʼязані шапки з помпоном, шапки з ангори на трикотажному підкладі, шарфи, снуди, махрові колготи, рукавички й утеплені костюми.' },
  { k: 'osin', c: ['Осінь'], h1: 'Дитячий одяг на осінь',
    text: 'Демісезонний гардероб на осінь і весну: бомбери з двонитки, боді-гольфи, демісезонні колготи, шапочки й костюми для малюків.' },
  { k: 'lito', c: ['Літо'], h1: 'Дитячий літній одяг',
    text: 'Легкі речі на літо: сукні й ромпери з мусліну, панами, косинки, футболки й шорти — з натуральних тканин, щоб дитині не було спекотно.' },
  { k: 'novyirik', c: ['Новий Рік'], h1: 'Новорічний одяг для дітей',
    text: 'Святкові образи до Нового року та фотосесій: боді з крильцями, сукні, повʼязки, пінетки-туфельки й колготи в червоних, бордових і зелених кольорах.' },
];
const SERVICE_TEXT = 'Доставка Новою Поштою по Україні, безкоштовно — для замовлень від 3000 грн. Повернення протягом 14 днів.';

// той самий підбір, що findIdsByNames() в index.html: категорія за назвою разом із підкатегоріями
function idsByNames(names) {
  const ids = new Set();
  for (const t of DATA.tree) {
    if (names.includes(t.raw) || names.includes(t.name)) {
      ids.add(t.id);
      (t.children || []).forEach(c => ids.add(c.id));
    }
    for (const c of (t.children || [])) if (names.includes(c.raw) || names.includes(c.name)) ids.add(c.id);
  }
  return ids;
}
for (const c of CATS) {
  c.ids = idsByNames(c.c);
  c.url = `/c/${c.k}/`;
  c.all = visible.filter(p => (p.cats || []).some(id => c.ids.has(id)));
  // як у SPA: зниклі з наявності товари в списку розділу не показуємо (сторінка товару лишається)
  // спершу новіші, дрібниці до 200 грн — нижче
  c.list = c.all.filter(p => p.stock !== false)
    .sort((a, b) => ((a.price || 0) <= 200) - ((b.price || 0) <= 200) || b.id - a.id);
}
const LIVE_CATS = CATS.filter(c => c.list.length > 0);
// основний розділ товару: перший з CATS, до якого він належить
const primaryCat = p => LIVE_CATS.find(c => (p.cats || []).some(id => c.ids.has(id))) || null;

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
:root{--bg:#FAF4EC;--ink:#2E2A28;--mut:#665F59;--line:#E6DACB;--acc:#2E2A28}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:1000px;margin:0 auto;padding:16px}
header{border-bottom:1px solid var(--line);margin-bottom:24px}
header .wrap{display:flex;align-items:center;gap:12px;padding:12px 16px}
header img{height:44px;width:auto}
nav.bc{font-size:14px;color:var(--mut);margin-bottom:16px}
nav.bc a{color:var(--mut)}
.grid{display:grid;grid-template-columns:1fr;gap:28px}
@media(min-width:760px){.grid{grid-template-columns:minmax(0,420px) 1fr}}
.ph{width:100%;height:auto;aspect-ratio:3/4;object-fit:cover;border-radius:14px;background:#EFE6DA}
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
.rl img{width:100%;height:auto;aspect-ratio:3/4;object-fit:cover;border-radius:10px;margin-bottom:6px;background:#EFE6DA}
.rl b{display:block;font-weight:600;margin-top:3px}
.more{margin:18px 0 0;font-size:15px}
.more a{color:var(--ink)}
.lead{max-width:720px;margin:0 0 6px;color:#4A433E}
.svc{max-width:720px;margin:0 0 4px;color:var(--mut);font-size:15px}
.cnt{color:var(--mut);font-size:15px;margin:18px 0 14px}
.cats{margin:44px 0 0;border-top:1px solid var(--line);padding-top:22px;font-size:15px;line-height:2}
.cats h2{font-size:19px;margin:0 0 8px}
.cats a{color:var(--ink);margin-right:14px;white-space:nowrap}
footer{border-top:1px solid var(--line);margin-top:48px;padding:22px 0;color:var(--mut);font-size:14px}
footer a{color:var(--mut)}
`;

const HEAD_ICONS = `<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png">
<link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">`;
const HEADER = `<header><div class="wrap"><a href="/"><img src="/logo.webp" alt="ZaiSun" width="260" height="204"></a></div></header>`;
const FOOTER = `<footer><div class="wrap">
ZaiSun — дитячий одяг власного виробництва, Луцьк ·
<a href="/">Каталог</a> · <a href="/dostavka.html">Доставка</a> ·
<a href="/kontakty.html">Контакти</a> · <a href="/oferta.html">Оферта</a>
</div></footer>`;

function page(p) {
  const pi = priceInfo(p);
  const img = `${SITE}/images/${encodeURIComponent(p.photo)}`;
  const url = SITE + urlOf(p);
  const cats = (p.catn || []).filter(c => c && c.toLowerCase() !== 'sale');
  const cat = cats[cats.length - 1] || 'Дитячий одяг';
  const pc = primaryCat(p);

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
    return `<a href="${urlOf(r)}"><img src="${thumbOf(r.photo)}" alt="${esc(r.name)}" loading="lazy" width="300" height="400" onerror="this.onerror=null;this.src='/images/${encodeURIComponent(r.photo)}'"><span>${esc(r.name).slice(0, 64)}</span><b>${rp.many ? 'від ' : ''}${rp.min} грн</b></a>`;
  }).join('\n');

  // Окрема пропозиція на кожен розмір у наявності — з його ціною (Google показує ціну й наявність точно).
  const avail = ok => ok ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';
  const offers = sizes.length
    ? sizes.map(s => {
        const v = (p.var || {})[s] || {};
        return { '@type': 'Offer', name: `Розмір ${s}`, sku: `${p.id}-${s}`, price: v.p || pi.min, priceCurrency: 'UAH',
                 availability: avail(p.stock !== false && v.s !== false), itemCondition: 'https://schema.org/NewCondition', url };
      })
    : [{ '@type': 'Offer', price: pi.min, priceCurrency: 'UAH', availability: avail(p.stock !== false),
         itemCondition: 'https://schema.org/NewCondition', url }];

  const images = [img, ...((p.photos || []).filter(f => f && f !== p.photo).slice(0, 4).map(f => `${SITE}/images/${encodeURIComponent(f)}`))];
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    image: images,
    description: descText,
    sku: String(p.id),
    brand: { '@type': 'Brand', name: 'ZaiSun' },
    category: pc ? pc.h1 : cat,
    offers
  };
  if (p.color) ld.color = p.color;

  const crumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Головна', item: SITE + '/' },
      pc ? { '@type': 'ListItem', position: 2, name: pc.h1, item: SITE + pc.url }
         : { '@type': 'ListItem', position: 2, name: cat, item: SITE + '/' },
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
${HEAD_ICONS}
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
${HEADER}
<div class="wrap">
<nav class="bc"><a href="/">Головна</a> › ${pc ? `<a href="${pc.url}">${esc(pc.h1)}</a>` : esc(cat)}</nav>
<div class="grid">
  <div><img class="ph" src="/images/${encodeURIComponent(p.photo)}" alt="${esc(p.name)}" width="600" height="800" fetchpriority="high"></div>
  <div>
    <h1>${esc(p.name)}</h1>
    <div class="price">${pi.many ? 'від ' : ''}${pi.min} грн${
      (() => { const os = Object.values(p.var || {}).map(v => v && v.o).filter(x => x > 0);
               const old = os.length ? Math.min(...os) : p.old;
               return old && old > pi.min ? `<span class="old">${old} грн</span>` : ''; })()
    }</div>
    ${p.color ? `<p class="meta">Колір: ${esc(p.color)}</p>` : ''}
    <p class="meta">${p.stock ? 'В наявності' : 'Немає в наявності'}</p>
    ${rows ? `<table><tr><th>Розмір</th><th>Ціна</th></tr>${rows}</table>` : ''}
    <a class="buy" href="/?p=${p.id}">Купити на сайті</a>
    <div class="desc">${esc(descText)}</div>
  </div>
</div>
${rel ? `<section class="rel"><h2>Схожі товари</h2><div class="rl">${rel}</div>${pc ? `<p class="more"><a href="${pc.url}">Усі товари розділу «${esc(pc.h1)}» →</a></p>` : ''}</section>` : ''}
</div>
${FOOTER}
</body>
</html>`;
}

// ── сторінка розділу ──
function catPage(c) {
  const url = SITE + c.url;
  const n = c.list.length;
  const min = Math.min(...c.list.map(p => priceInfo(p).min).filter(x => x > 0));
  const title = `${c.h1} — купити в інтернет-магазині ZaiSun`;
  const desc = `${c.h1} від виробника ZaiSun: ${n} ${n % 10 === 1 && n % 100 !== 11 ? 'модель' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'моделі' : 'моделей')}, ціни від ${min} грн. Власне виробництво в Луцьку, доставка Новою Поштою по Україні.`;
  const cards = c.list.map((p, i) => {
    const pi = priceInfo(p);
    const lazy = i < 4 ? (i === 0 ? ' fetchpriority="high"' : '') : ' loading="lazy"';
    return `<a href="${urlOf(p)}"><img src="${thumbOf(p.photo)}" alt="${esc(p.name)}" width="300" height="400"${lazy} decoding="async" onerror="this.onerror=null;this.src='/images/${encodeURIComponent(p.photo)}'"><span>${esc(p.name).slice(0, 70)}</span><b>${pi.many ? 'від ' : ''}${pi.min} грн</b></a>`;
  }).join('\n');
  const others = LIVE_CATS.filter(x => x !== c).map(x => `<a href="${x.url}">${esc(x.h1)}</a>`).join(' ');

  const ld = [
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Головна', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: c.h1, item: url } ] },
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: c.h1, url, description: desc,
      isPartOf: { '@type': 'WebSite', name: 'ZaiSun', url: SITE + '/' },
      mainEntity: { '@type': 'ItemList', numberOfItems: n,
        itemListElement: c.list.slice(0, 40).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + urlOf(p), name: p.name })) } }
  ];

  return `<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
${HEAD_ICONS}
<meta property="og:type" content="website">
<meta property="og:site_name" content="ZaiSun">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${SITE}/images/${encodeURIComponent(c.list[0].photo)}">
<meta property="og:url" content="${url}">
${ld.map(x => `<script type="application/ld+json">${JSON.stringify(x)}</script>`).join('\n')}
<style>${CSS}</style>
</head>
<body>
${HEADER}
<div class="wrap">
<nav class="bc"><a href="/">Головна</a> › ${esc(c.h1)}</nav>
<h1>${esc(c.h1)}</h1>
<p class="lead">${esc(c.text)}</p>
<p class="svc">${esc(SERVICE_TEXT)}</p>
<a class="buy" href="/?cat=k${c.k}">Відкрити в каталозі з фільтрами</a>
<p class="cnt">${n} товарів у наявності</p>
<div class="rl">
${cards}
</div>
<section class="cats"><h2>Інші розділи</h2>${others}</section>
</div>
${FOOTER}
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

if (fs.existsSync(OUT_C)) fs.rmSync(OUT_C, { recursive: true });
for (const c of LIVE_CATS) {
  const dir = path.join(OUT_C, c.k);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), catPage(c));
}

// ── sitemap ── (у товарів — головне фото: так їх знаходить пошук Google за картинками)
const imgTag = f => `<image:image><image:loc>${SITE}/images/${encodeURIComponent(f)}</image:loc></image:image>`;
const urls = [
  `  <url><loc>${SITE}/</loc></url>`,
  ...['/dostavka.html', '/kontakty.html', '/oferta.html'].map(u => `  <url><loc>${SITE}${u}</loc></url>`),
  ...LIVE_CATS.map(c => `  <url><loc>${SITE}${c.url}</loc></url>`),
  ...visible.map(p => `  <url><loc>${SITE}${urlOf(p)}</loc>${imgTag(p.photo)}</url>`)
];
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
  urls.join('\n') + `\n</urlset>\n`);

console.log(`сторінок товарів: ${n} | розділів: ${LIVE_CATS.length} | у sitemap: ${urls.length}`);
