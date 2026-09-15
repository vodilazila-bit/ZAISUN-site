// Ділить каталог на дві частини:
//   data-lite.js — усе, крім описів. Це те, що потрібно для сітки товарів,
//                  і саме воно вантажиться на старті.
//   data-desc.js — тільки описи, id → текст. Довантажується у фоні,
//                  коли каталог уже намальований.
//
// data.js лишається джерелом правди: з ним працює адмінка, з нього
// генеруються сторінки товарів і фід. Ці два файли — похідні.

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const raw = fs.readFileSync(path.join(ROOT, 'data.js'), 'utf-8');
const DATA = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));

const desc = {};
const lite = JSON.parse(JSON.stringify(DATA));
for (const p of lite.products) {
  if (p.desc) desc[p.id] = p.desc;
  delete p.desc;
}

fs.writeFileSync(path.join(ROOT, 'data-lite.js'),
  'const DATA = ' + JSON.stringify(lite) + ';\n', 'utf-8');
fs.writeFileSync(path.join(ROOT, 'data-desc.js'),
  'window.ZS_DESC = ' + JSON.stringify(desc) + ';\nif(window.zsDescReady) window.zsDescReady();\n', 'utf-8');

const kb = f => Math.round(fs.statSync(path.join(ROOT, f)).size / 1024);
console.log('data.js', kb('data.js') + ' КБ →  data-lite.js', kb('data-lite.js') + ' КБ  +  data-desc.js', kb('data-desc.js') + ' КБ');
