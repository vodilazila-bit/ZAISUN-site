#!/usr/bin/env python3
# Зменшені копії фото для плиток каталогу.
#
# У плитці ширина ~190 px, а ми віддавали оригінал 800x1066 вагою 100–275 КБ.
# На пошуку це давало ~3,4 МБ одним залпом і фото доповзали 2–3 секунди.
# Копія 440 px у WebP важить 5–20 КБ, тобто приблизно вдесятеро менше.
#
# Запускається в GitHub Actions після збереження з адмінки й робить тільки те,
# чого ще немає. Якщо копії нема, сайт сам підставляє оригінал (onerror),
# тому нові фото працюють одразу, просто важчі до наступного запуску.

import os
from PIL import Image

SRC = 'images'
DST = 'images/thumb'
WIDTH = 440
QUALITY = 72

os.makedirs(DST, exist_ok=True)
made = skipped = failed = 0

for name in sorted(os.listdir(SRC)):
    path = os.path.join(SRC, name)
    if not os.path.isfile(path):
        continue
    if not name.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
        continue
    out = os.path.join(DST, os.path.splitext(name)[0] + '.webp')
    if os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(path):
        skipped += 1
        continue
    try:
        im = Image.open(path)
        if im.mode in ('RGBA', 'P', 'LA'):
            im = im.convert('RGB')
        im.thumbnail((WIDTH, WIDTH * 4), Image.LANCZOS)
        im.save(out, 'WEBP', quality=QUALITY, method=5)
        made += 1
    except Exception as e:
        print('не вдалось:', name, e)
        failed += 1

print(f'зменшених копій створено: {made}, вже були: {skipped}, помилок: {failed}')
