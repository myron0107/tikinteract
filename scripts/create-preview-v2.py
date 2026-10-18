"""Render a 16-second 1080p promo using actual game screenshots and original audio.

Uses the checkout-local Pillow/FFmpeg tools. --stills-only renders QA frames first.
"""
import array
import math
import random
import subprocess
import sys
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.tools/video'))
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps
import imageio_ffmpeg

W, H, FPS, DURATION = 1920, 1080, 30, 16
ASSETS = ROOT / 'assets'
WORK = ROOT / '.tools/video/render'
WORK.mkdir(parents=True, exist_ok=True)
FONT_DIR = ROOT / '.tools/video/fonts'
DISPLAY = FONT_DIR / 'oxanium-bold.ttf'
BODY = FONT_DIR / 'inter-bold.ttf'
if not DISPLAY.exists(): DISPLAY = Path('C:/Windows/Fonts/bahnschrift.ttf')
if not BODY.exists(): BODY = Path('C:/Windows/Fonts/segoeuib.ttf')
RED, WHITE, MUTED = '#ff3344', '#f6f6f8', '#b8b8c2'

def font(size, body=False):
    return ImageFont.truetype(str(BODY if body else DISPLAY), size)

GAMES = [
    ('neon-race-preview.png', 'NEON RACE', 'CURSE AUTO', 'Fiecare like contează.\nFiecare cadou schimbă cursa.'),
    ('neon-riders-preview.png', 'NEON RIDERS', 'CURSE MOTO', 'Două echipe.\nO singură linie de sosire.'),
    ('country-derby-preview.png', 'COUNTRY DERBY', 'CURSE DE CAI', 'Alege-ți echipa.\nLasă comunitatea să joace.'),
]
ART = [Image.open(ASSETS / game[0]).convert('RGB') for game in GAMES]
LOGO = Image.open(ASSETS / 'tikinteract-icon-v2.png').convert('RGBA')
LOGO.thumbnail((62, 62), Image.Resampling.LANCZOS)

def background():
    im = Image.new('RGBA', (W, H), '#080809')
    glow = Image.new('RGBA', (W, H))
    d = ImageDraw.Draw(glow)
    d.ellipse((960, -160, 2080, 1140), fill=(175, 16, 39, 58))
    glow = glow.filter(ImageFilter.GaussianBlur(150))
    im = Image.alpha_composite(im, glow)
    d = ImageDraw.Draw(im)
    for x in range(960, W, 64): d.line((x, 105, x, 995), fill='#1c171a')
    for y in range(140, 1000, 64): d.line((960, y, W, y), fill='#1c171a')
    d.line((96, 106, 1824, 106), fill='#28282e', width=1)
    d.line((96, 994, 1824, 994), fill='#28282e', width=1)
    im.alpha_composite(LOGO, (94, 25))
    d.text((176, 35), 'TIKINTERACT', font=font(35), fill=WHITE)
    d.text((1470, 46), 'TIKTOK LIVE GAMING', font=font(19, True), fill=MUTED)
    return im

BASE = background()

def portrait(index, height):
    image = ImageOps.contain(ART[index], (600, height), Image.Resampling.LANCZOS)
    tile = Image.new('RGBA', (image.width + 4, image.height + 4))
    mask = Image.new('L', image.size)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, image.width-1, image.height-1), radius=12, fill=255)
    tile.paste(image, (2, 2), mask)
    ImageDraw.Draw(tile).rounded_rectangle((0, 0, tile.width-1, tile.height-1), radius=14, outline='#ffffff38', width=2)
    return tile

BIG_TILES = [portrait(i, 840) for i in range(3)]
SMALL_TILES = [portrait(i, 462 if i != 1 else 570) for i in range(3)]

def text_layer(lines, size, y, subtitle, tag, cta=False):
    layer = Image.new('RGBA', (W, H))
    d = ImageDraw.Draw(layer)
    tag_font = font(20, True)
    tag_width = int(d.textlength(tag, font=tag_font)) + 36
    d.rounded_rectangle((100, y-70, 100+tag_width, y-28), radius=6, fill='#ff334420', outline='#ff334455')
    d.text((118, y-61), tag, font=tag_font, fill='#ff9da6')
    d.multiline_text((96, y), lines, font=font(size), fill=WHITE, spacing=13)
    title_box = d.multiline_textbbox((96, y), lines, font=font(size), spacing=13)
    text_y = title_box[3] + 38
    d.multiline_text((100, text_y), subtitle, font=font(29, True), fill=MUTED, spacing=13)
    if cta:
        cy = text_y + 112
        d.rounded_rectangle((100, cy, 588, cy+64), radius=9, fill=RED)
        d.text((123, cy+18), 'DESCHIDE LIVE STUDIO  >', font=font(23, True), fill=WHITE)
    return layer

LAYERS = [text_layer('TU EȘTI LIVE.\nCHAT-UL INTRĂ\nÎN JOC.', 80, 300, 'Gaming interactiv pentru\ncomunitatea ta de pe TikTok.', 'TIKINTERACT / LIVE STREAM')]
for i, game in enumerate(GAMES):
    size = 104
    while ImageDraw.Draw(BASE).textlength(game[1], font=font(size)) > 950: size -= 2
    LAYERS.append(text_layer(game[1], size, 385, game[3], f'0{i+1} / 03   ·   {game[2]}'))
LAYERS.append(text_layer('TOTUL PENTRU\nLIVE-UL TĂU.', 82, 310, 'Jocuri. Sunete. Comunitate.', 'TU TRANSMIȚI. CHAT-UL DECIDE.', True))

def ease(t):
    return 1 - (1 - max(0, min(1, t))) ** 3

def scene_at(t):
    if t < 2.5: return 0, t, 2.5
    if t < 13:
        idx = min(2, int((t - 2.5) / 3.5))
        return idx + 1, t - 2.5 - idx*3.5, 3.5
    return 4, t - 13, 3

def frame(t):
    scene, local, length = scene_at(t)
    im = BASE.copy()
    enter = ease(local/.6)
    if scene in (0, 4):
        for i, tile in enumerate(SMALL_TILES):
            x = [1020, 1284, 1604][i]
            y = [320, 242, 320][i]
            if scene == 4: y += 10
            y += int((1 - ease((local-i*.09)/.7))*44 + math.sin(local*1.2+i)*4)
            im.alpha_composite(tile, (x, y))
        d = ImageDraw.Draw(im)
        for i, name in enumerate(['NEON RACE', 'NEON RIDERS', 'COUNTRY DERBY']):
            d.text(([1020, 1284, 1604][i], 855), name, font=font(17, True), fill=MUTED)
    else:
        tile = BIG_TILES[scene-1]
        x = 1304 + int((1-enter)*40)
        y = 132 + int(math.sin(local*.8)*3)
        im.alpha_composite(tile, (x, y))
        d = ImageDraw.Draw(im)
        d.line((1190, 226, 1190, 860), fill='#61202b', width=2)
        d.text((104, 835), 'LIKE-URI  /  CADOURI  /  ECHIPE', font=font(20, True), fill='#ff7c89')
    layer = LAYERS[scene].copy()
    if enter < 1: layer.putalpha(layer.getchannel('A').point(lambda a: int(a*enter)))
    im.alpha_composite(layer, (int((1-enter)*-22), 0))
    d = ImageDraw.Draw(im)
    d.text((100, 1020), 'JOCURI INTERACTIVE PENTRU TIKTOK LIVE', font=font(17, True), fill='#a6a6b0')
    for i in range(3):
        left = 1556 + i*92
        d.rounded_rectangle((left, 1027, left+72, 1031), radius=2, fill='#39363d')
        progress = max(0, min(1, (t-2.5-i*3.5)/3.5))
        if progress > 0: d.rounded_rectangle((left, 1027, left+max(2,int(72*progress)), 1031), radius=2, fill=RED)
    # Short dip transitions, no flashes or abrupt movement.
    dip = min(1, local/.18, (length-local)/.18)
    opacity = .68 + .32*max(0,dip)
    return Image.blend(Image.new('RGB', (W,H), '#080809'), im.convert('RGB'), opacity)

def soundtrack(path):
    rate = 44100
    samples = array.array('h')
    rng = random.Random(42)
    beat = 60/104
    notes = [130.81, 155.56, 196, 233.08, 261.63, 233.08, 196, 155.56]
    for n in range(rate*DURATION):
        t = n/rate
        step = t % (beat/2)
        note = notes[int(t/(beat/2)) % len(notes)]
        synth = .042*math.exp(-step*11)*(math.sin(2*math.pi*note*t)+.22*math.sin(4*math.pi*note*t))
        kick_t = t % beat
        kick = .14*math.exp(-kick_t*24)*math.sin(2*math.pi*48*kick_t + 9*(1-math.exp(-kick_t*45)))
        hat = .012*(rng.random()*2-1)*math.exp(-step*90)
        fade = min(1, t/.6, (DURATION-t)/1.2)
        samples.append(int(32767*(synth+kick+hat)*max(0,fade)))
    with wave.open(str(path), 'wb') as out:
        out.setnchannels(1); out.setsampwidth(2); out.setframerate(rate)
        out.writeframes(samples.tobytes())

def main():
    times = [1.5, 3.8, 7.5, 11, 14.5]
    sheet = Image.new('RGB', (960, 270*3), '#080809')
    for i,t in enumerate(times):
        still = frame(t)
        still.save(WORK / f'scene-{i+1}.jpg', quality=93)
        sheet.paste(still.resize((480,270), Image.Resampling.LANCZOS), ((i%2)*480,(i//2)*270))
    sheet.save(WORK / 'contact-sheet.jpg', quality=93)
    frame(1.5).save(ASSETS / 'tikinteract-preview-v2-poster.jpg', quality=93)
    if '--stills-only' in sys.argv:
        print('QA frames:', WORK / 'contact-sheet.jpg', flush=True)
        return
    silent = WORK / 'preview-silent.mp4'
    writer = imageio_ffmpeg.write_frames(str(silent), (W,H), fps=FPS, codec='libx264', pix_fmt_out='yuv420p', macro_block_size=1, output_params=['-crf','20','-preset','fast','-movflags','+faststart'], ffmpeg_log_level='error')
    writer.send(None)
    try:
        for n in range(FPS*DURATION):
            writer.send(frame(n/FPS).tobytes())
            if n % (FPS*4) == 0: print(f'Rendered {n//FPS}/{DURATION}s', flush=True)
    finally: writer.close()
    audio = WORK / 'soundtrack.wav'
    soundtrack(audio)
    destination = ASSETS / 'tikinteract-preview-v2.mp4'
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-i', str(silent), '-i', str(audio), '-c:v','copy','-c:a','aac','-b:a','128k','-movflags','+faststart','-shortest',str(destination)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    print('Created:', destination, destination.stat().st_size, 'bytes', flush=True)

if __name__ == '__main__': main()
