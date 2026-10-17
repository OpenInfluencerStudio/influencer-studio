"""Turn generated PNGs into the shipped thumbnail set: resize, webp (q78, method 6, <=25 KB), manifest.json, contact sheets.
Usage: python3 scripts/thumbs/finish.py PLAN_JSON WORK_DIR REPO_ASSETS_DIR [SHEET_DIR]
Only items whose PNG exists are written; everything else stays missing and the UI falls back to SVG art."""
import sys, json, hashlib, os, io
from PIL import Image, ImageDraw
plan = json.load(open(sys.argv[1])); work, out = sys.argv[2], sys.argv[3]
sheets = sys.argv[4] if len(sys.argv) > 4 else None
items, made = [], []
for it in plan:
    src = os.path.join(work, it['file'].replace('.webp', '.png'))
    if not os.path.exists(src): continue
    im = Image.open(src).convert('RGB').resize(tuple(it['out']), Image.LANCZOS)
    q = 78
    while True:
        b = io.BytesIO(); im.save(b, 'WEBP', quality=q, method=6)
        if b.tell() <= 25 * 1024 or q <= 40: break
        q -= 6
    dst = os.path.join(out, it['file']); os.makedirs(os.path.dirname(dst), exist_ok=True); open(dst, 'wb').write(b.getvalue())
    items.append({k: it[k] for k in ('control', 'option', 'look', 'shared', 'file', 'framing', 'mode', 'seed')} | {'w': it['out'][0], 'h': it['out'][1], 'bytes': b.tell(), 'sha256': hashlib.sha256(b.getvalue()).hexdigest(), 'fragment_hash': it['fragmentHash'], 'status': 'generated'})
    made.append((it, im))
man = {'manifest_version': 1, 'generator': {'model': 'FLUX.2 klein 4B (Apache-2.0)', 'note': 'synthetic adults, fully clothed; AI-generated; no real person'}, 'items': items}
json.dump(man, open(os.path.join(out, 'manifest.json'), 'w'), indent=1)
print(len(items), 'thumbnails,', sum(i['bytes'] for i in items) // 1024, 'KB total, max', max([i['bytes'] for i in items] or [0]), 'bytes')
if sheets:
    os.makedirs(sheets, exist_ok=True)
    by = {}
    for it, im in made: by.setdefault(it['group'], []).append((it, im))
    for g, lst in by.items():
        for p in range(0, len(lst), 40):
            chunk = lst[p:p + 40]; cols = 8; cw, ch = 200, 220; rows = (len(chunk) + cols - 1) // cols
            sh = Image.new('RGB', (cols * cw, rows * ch), 'white'); d = ImageDraw.Draw(sh)
            for k, (it, im) in enumerate(chunk):
                x, y = (k % cols) * cw, (k // cols) * ch; t = im.copy(); t.thumbnail((cw, ch - 16)); sh.paste(t, (x, y + 16))
                d.text((x + 2, y + 2), f"{it['option']}/{it['look']}"[:30], fill='black')
            sh.save(os.path.join(sheets, f'{g}_{p // 40 + 1}.jpg'), quality=80)
