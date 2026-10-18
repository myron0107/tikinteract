"""Generate the 12-second promotional montage from the existing game artwork."""
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.tools' / 'video'))
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageFilter
import imageio_ffmpeg

W, H, FPS = 1280, 720, 24
font_path = 'C:/Windows/Fonts/segoeuib.ttf'
title_font = ImageFont.truetype(font_path, 58)
small_font = ImageFont.truetype(font_path, 19)
body_font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 27)
games = [
    ('neon-race-preview.png', 'NEON RACE', 'Fiecare like schimbă cursa.'),
    ('neon-riders-preview.png', 'NEON RIDERS', 'Două echipe. O singură victorie.'),
    ('country-derby-preview.png', 'COUNTRY DERBY', 'Adună-ți echipa. Intră în cursă.'),
]
images = [Image.open(ROOT / 'assets' / g[0]).convert('RGB') for g in games]
overlay = Image.new('RGBA', (W, H))
d = ImageDraw.Draw(overlay)
for y in range(H):
    alpha = int(215 * max(0, (y / H - .3) / .7))
    d.line((0, y, W, y), fill=(3, 3, 5, alpha))
d.rectangle((0, 0, W, 90), fill=(3, 3, 5, 120))

def frame(n):
    idx = min(n // (4 * FPS), 2)
    local = (n % (4 * FPS)) / (4 * FPS - 1)
    scale = 1.03 + .06 * local
    art = ImageOps.fit(images[idx], (int(W * scale), int(H * scale)))
    x, y = (art.width-W)//2, (art.height-H)//2
    im = art.crop((x,y,x+W,y+H)).filter(ImageFilter.GaussianBlur(24)).convert('RGBA')
    im = Image.blend(im, Image.new('RGBA', (W,H), '#080709'), .8)
    im = Image.alpha_composite(im, overlay)
    # Preserve the complete portrait game screen inside the landscape video.
    portrait = ImageOps.contain(images[idx], (390, 614))
    px, py = 848 + (390-portrait.width)//2, 88 + (614-portrait.height)//2
    im.paste(portrait, (px,py))
    draw = ImageDraw.Draw(im)
    draw.ellipse((52, 34, 64, 46), fill='#ff263e')
    draw.text((78, 25), 'TIKINTERACT', font=small_font, fill='#fff5f2')
    draw.text((990, 25), 'JOCURI PENTRU LIVE', font=small_font, fill='#d0c3c5')
    draw.rounded_rectangle((52, 238, 278, 276), radius=19, fill='#e61932')
    draw.text((68, 243), f'0{idx+1} / 03   •   PREVIEW', font=small_font, fill='white')
    draw.text((48, 303), games[idx][1], font=title_font, fill='#fff5f2')
    draw.text((52, 395), games[idx][2], font=body_font, fill='#ebdfdd')
    draw.text((52, 630), 'LIVE-ul tău. Regulile publicului.', font=small_font, fill='#ff8b95')
    for j in range(3):
        left = 52 + j * 66
        draw.rounded_rectangle((left, 674, left+50, 678), radius=2, fill='#ffffff40')
        if j <= idx:
            width = 50 if j < idx else max(2, int(50 * local))
            draw.rounded_rectangle((left, 674, left+width, 678), radius=2, fill='#ff263e')
    # Brief fade between artwork scenes, without rapid flashing.
    fade = min(1, local * 12, (1-local)*12)
    return Image.blend(Image.new('RGB', (W,H), '#080709'), im.convert('RGB'), .45 + .55*fade)

frame(40).save(ROOT / 'assets/tikinteract-preview-poster.jpg', quality=90)
writer = imageio_ffmpeg.write_frames(str(ROOT / 'assets/tikinteract-preview.mp4'), (W,H), fps=FPS, codec='libx264', quality=7, output_params=['-movflags', '+faststart'])
writer.send(None)
for n in range(12 * FPS):
    writer.send(frame(n).tobytes())
writer.close()
print('Created 12-second, 1280x720 H.264 montage and poster.')
