"""Convert preset hero / example PNGs to small webp and register them in assets/previews/manifest.json.
usage: python scripts/presets/finish.py <png_dir> [--only-new]   (needs Pillow)"""
import json, os, re, sys
from PIL import Image
src = sys.argv[1]; root = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'previews')
meta = json.load(open(os.path.join(os.path.dirname(__file__), 'presetmeta.json')))
mp = os.path.join(root, 'manifest.json'); man = json.load(open(mp))
items = [i for i in man['items'] if i['control'] not in ('preset', 'example')]
os.makedirs(os.path.join(root, 'presets'), exist_ok=True); total = 0
for f in sorted(os.listdir(src)):
    if not f.endswith('.png'): continue
    n = f[:-4]; m = re.match(r'example_(.+)_(ultra_fat|fat|medium|thin|skinny|stick_thin)$', n)
    if m: control, option, look, shared = 'example', m.group(2), m.group(1), False
    elif '__' in n: option, look = n.split('__'); control, shared = 'preset', False
    else: control, option, look, shared = 'preset', n, meta[n], True
    im = Image.open(os.path.join(src, f)).convert('RGB'); im = im.resize((384, 512), Image.LANCZOS)
    out = os.path.join(root, 'presets', n + '.webp'); q = 80
    while True:
        im.save(out, 'WEBP', quality=q, method=6)
        if os.path.getsize(out) <= 48000 or q <= 40: break
        q -= 6
    total += os.path.getsize(out)
    items.append({'control': control, 'option': option, 'look': look, 'shared': shared, 'file': 'presets/' + n + '.webp', 'framing': 'full', 'w': 384, 'h': 512})
man['items'] = items; json.dump(man, open(mp, 'w'), separators=(',', ':'))
print('items', len(items), 'preset+example bytes', total)
