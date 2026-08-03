// Генерує feed.xml для Google Merchant Center з data.js
// Запуск: node tools/gen_feed.js
const fs = require('fs');
const path = require('path');

const SITE = 'https://zaisun.com.ua';
const raw = fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf-8');
const DATA = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));

const esc = s => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const items = [];
for (const p of DATA.products) {
  if (p.hidden) continue;  // приховані на сайті — не показуємо і в Merchant
  if (!p.photo) continue; // Merchant вимагає фото
  const prices = Object.values(p.var || {}).map(v => v.p).filter(x => x > 0);
  const price = prices.length ? Math.min(...prices) : p.price;
  if (!price || price <= 0) continue;

  const olds = Object.values(p.var || {}).map(v => v.o).filter(x => x > 0);
  const old = olds.length ? Math.min(...olds) : (p.old || null);
  const hasSale = old && old > price;

  const link = `${SITE}/?p=${p.id}`;
  const img = `${SITE}/images/${encodeURIComponent(p.photo)}`;
  const ptype = (p.catn || []).filter(c => c && c.toLowerCase() !== 'sale').map(esc).join(' &gt; ');
  const nm = p.name.toLowerCase();
  const gender = /дівчин|дівчат|сукн|сарафан|спідниц/.test(nm) ? 'female' : (/хлопчик|хлопц/.test(nm) ? 'male' : 'unisex');
  const desc = (p.desc && p.desc.trim()) ? p.desc.trim() : p.name;

  let x = `  <item>
    <g:id>${p.id}</g:id>
    <g:title>${esc(p.name).slice(0, 150)}</g:title>
    <g:description>${esc(desc).slice(0, 4900)}</g:description>
    <g:link>${link}</g:link>
    <g:image_link>${img}</g:image_link>
    <g:availability>${p.stock ? 'in stock' : 'out of stock'}</g:availability>
    <g:condition>new</g:condition>
    <g:brand>ZaiSun</g:brand>
    <g:identifier_exists>no</g:identifier_exists>
    <g:age_group>kids</g:age_group>
    <g:gender>${gender}</g:gender>\n`;
  if (hasSale) {
    x += `    <g:price>${old.toFixed(2)} UAH</g:price>
    <g:sale_price>${price.toFixed(2)} UAH</g:sale_price>\n`;
  } else {
    x += `    <g:price>${price.toFixed(2)} UAH</g:price>\n`;
  }
  if (p.color) x += `    <g:color>${esc(p.color)}</g:color>\n`;
  if (p.sizes && p.sizes.length) x += `    <g:size>${esc(p.sizes.join('/')).slice(0, 100)}</g:size>\n`;
  if (ptype) x += `    <g:product_type>${ptype}</g:product_type>\n`;
  x += `  </item>`;
  items.push(x);
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>ZaiSun — дитячий одяг</title>
  <link>${SITE}</link>
  <description>Каталог товарів ZaiSun</description>
${items.join('\n')}
</channel>
</rss>
`;

fs.writeFileSync(path.join(__dirname, '..', 'feed.xml'), xml, 'utf-8');
console.log(`feed.xml: ${items.length} товарів (пропущено без фото/ціни: ${DATA.products.length - items.length})`);
