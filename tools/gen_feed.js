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

// ── Вік для Google (age_group) за розмірами товару ──────────────────────
// Google: newborn 0–3 міс, infant 3–12 міс, toddler 1–5 років, kids 5–13 років.
// Розмір → орієнтовний вік у місяцях, далі медіана по всіх розмірах товару.
const AGE_H = [[50,0],[56,1],[62,2.5],[68,4.5],[74,7.5],[80,10.5],[86,15],[92,21],[98,30],
  [104,42],[110,54],[116,66],[122,78],[128,90],[134,102],[140,114],[146,126],[152,138],[158,150],[164,162]]; // зріст, см
const AGE_C = [[34,0],[36,0.5],[38,1.5],[40,3],[42,5],[44,8],[46,12],[48,24],[50,42],[52,72],[54,120],[56,170]]; // обхват голови, см
const AGE_HEAD = /шапк|чалм|пов.?язк|панам|косинк|бейс|тюрбан|солох|капор|кепк|берет/i;
const AGE_CLOTH = /боді|сукн|ромпер|комплект|костюм|сарафан|набір|чоловічок|комбінезон|кофт|штан|лосін/i;
function ageInterp(tbl, v) {
  if (v <= tbl[0][0]) return tbl[0][1];
  for (let i = 1; i < tbl.length; i++) if (v <= tbl[i][0]) {
    const [a, am] = tbl[i - 1], [b, bm] = tbl[i];
    return am + (bm - am) * (v - a) / (b - a);
  }
  return 170;
}
function ageSizeMonths(sz, headMode) {
  const t = String(sz).toLowerCase().replace(/,/g, '.');
  let m;
  if ((m = t.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*(?:рік|роки|років|р(?![а-яіїєґ]))/))) return (parseFloat(m[1]) + parseFloat(m[2])) / 2 * 12;
  if ((m = t.match(/(\d+(?:\.\d+)?)\s*(?:рік|роки|років)/))) return parseFloat(m[1]) * 12;
  if ((m = t.match(/(\d+)\s*[-–]\s*(\d+)\s*міс/))) return (+m[1] + +m[2]) / 2;
  if ((m = t.match(/(\d+)\s*міс/))) return +m[1];
  const nums = (t.match(/\d+(?:\.\d+)?/g) || []).map(Number);
  if (!nums.length) return null;
  const v = nums.reduce((a, b) => a + b, 0) / nums.length;
  if (headMode) return (v >= 30 && v <= 58) ? ageInterp(AGE_C, v) : null;
  return (v >= 44 && v <= 170) ? ageInterp(AGE_H, v) : null;
}
function ageGroup(p) {
  const name = p.name || '';
  const head4 = name.split(/\s+/).slice(0, 4).join(' ');
  const allNums = (p.sizes || []).join(' ').match(/\d+/g) || [];
  const maxNum = allNums.length ? Math.max(...allNums.map(Number)) : 0;
  // обхват голови — лише для головних уборів, де всі числа ≤ 58 (інакше це зріст)
  const minNum = allNums.length ? Math.min(...allNums.map(Number)) : 0;
  const noAgeWords = !/міс|рік|роки|років|\dр(?![а-яіїєґ])/i.test((p.sizes || []).join(' '));
  const headMode = noAgeWords && maxNum <= 58 &&
    ((minNum > 0 && minNum < 44) || (AGE_HEAD.test(head4) && !AGE_CLOTH.test(head4)));
  const ms = (p.sizes || []).map(z => ageSizeMonths(z, headMode)).filter(x => x != null).sort((a, b) => a - b);
  if (!ms.length) return /новонародж|на виписку/i.test(name) ? 'newborn' : 'infant';
  const mid = ms.length % 2 ? ms[(ms.length - 1) / 2] : (ms[ms.length / 2 - 1] + ms[ms.length / 2]) / 2;
  return mid < 3 ? 'newborn' : mid <= 12 ? 'infant' : mid < 60 ? 'toddler' : 'kids';
}
// ────────────────────────────────────────────────────────────────────────

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
  // «(копія)» лишається в назві після дублювання товару в адмінці — у рекламу не пускаємо
  const title = p.name.replace(/\s*\(\s*копія\s*\)/gi, '').replace(/\s{2,}/g, ' ').trim();
  const desc = (p.desc && p.desc.trim()) ? p.desc.trim() : title;

  let x = `  <item>
    <g:id>${p.id}</g:id>
    <g:title>${esc(title).slice(0, 150)}</g:title>
    <g:description>${esc(desc).slice(0, 4900)}</g:description>
    <g:link>${link}</g:link>
    <g:image_link>${img}</g:image_link>
    <g:availability>${p.stock ? 'in stock' : 'out of stock'}</g:availability>
    <g:condition>new</g:condition>
    <g:brand>ZaiSun</g:brand>
    <g:identifier_exists>no</g:identifier_exists>
    <g:age_group>${ageGroup(p)}</g:age_group>
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
