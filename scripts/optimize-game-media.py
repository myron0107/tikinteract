"""Lossless WebP encoding: every decoded pixel must match the source PNG."""
from pathlib import Path
import hashlib
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.tools' / 'video'))
from PIL import Image

games = [ROOT / name for name in ['GAME/NEON-RACE/Neon-Race.html','GAME/NEON-RIDERS/NEON-RIDERS.html','GAME/COUNTRY-DERBY/COUNTRY-DERBY.html']]
documents = {game: game.read_text(encoding='utf-8') for game in games}
before = after = count = 0
media_dir = ROOT / 'assets/game-media'
for source in sorted(media_dir.glob('*.png')):
    old_url = '../../assets/game-media/' + source.name
    if not any(old_url in text for text in documents.values()):
        continue
    image = Image.open(source).convert('RGBA')
    import io
    encoded = io.BytesIO()
    image.save(encoded, format='WEBP', lossless=True, quality=100, method=4, exact=True)
    data = encoded.getvalue()
    before += source.stat().st_size
    if len(data) >= source.stat().st_size:
        after += source.stat().st_size
        continue
    decoded = Image.open(io.BytesIO(data)).convert('RGBA')
    assert image.size == decoded.size and image.tobytes() == decoded.tobytes(), source.name
    name = hashlib.sha256(data).hexdigest() + '.webp'
    (media_dir / name).write_bytes(data)
    new_url = '../../assets/game-media/' + name
    documents = {game: text.replace(old_url, new_url) for game, text in documents.items()}
    after += len(data)
    count += 1
    print(f'{source.name[:12]} {source.stat().st_size} -> {len(data)}; pixels identical', flush=True)
for game, text in documents.items():
    game.write_text(text, encoding='utf-8')
print(f'Lossless media: {before} -> {after} bytes; {count} optimized images', flush=True)
