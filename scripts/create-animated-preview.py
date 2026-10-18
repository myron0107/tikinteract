"""Replace the static game artwork with recorded game animation in the promo."""
import bisect
import importlib.util
import json
import subprocess
import sys
from functools import lru_cache
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('promo',ROOT/'scripts/create-preview-v2.py')
promo=importlib.util.module_from_spec(spec)
spec.loader.exec_module(promo)
from PIL import Image,ImageDraw,ImageChops,ImageStat

WORK=ROOT/'.tools/video/animation-render'
WORK.mkdir(parents=True,exist_ok=True)
GAME_IDS=['neon-race','neon-riders','country-derby']
RECORDINGS=[]
for game in GAME_IDS:
    directory=ROOT/'.tools/video/animation'/game
    recording=json.loads((directory/'frames.json').read_text())
    assert recording['duration']>3.5 and len(recording['frames'])>60
    recording['directory']=directory
    recording['times']=[frame['time'] for frame in recording['frames']]
    RECORDINGS.append(recording)

@lru_cache(maxsize=12)
def recorded_frame(game,index):
    recording=RECORDINGS[game]
    with Image.open(recording['directory']/recording['frames'][index]['file']) as frame:
        assert frame.size==(540,960),frame.size
        return frame.convert('RGB')

def artwork(game,time):
    recording=RECORDINGS[game]
    index=max(0,min(len(recording['frames'])-1,bisect.bisect_right(recording['times'],time)-1))
    return recorded_frame(game,index)

def frame(time):
    scene,local,_=promo.scene_at(time)
    if scene in (0,4):
        for game in range(3):
            promo.ART[game]=artwork(game,local)
            promo.SMALL_TILES[game]=promo.portrait(game,570 if game==1 else 462)
    else:
        game=scene-1
        promo.ART[game]=artwork(game,local)
        promo.BIG_TILES[game]=promo.portrait(game,840)
    image=promo.frame(time)
    draw=ImageDraw.Draw(image)
    draw.rectangle((1250,26,1830,86),fill='#0b0b0e')
    draw.ellipse((1306,48,1314,56),fill=promo.RED)
    draw.text((1330,41),'DEMO · ANIMAȚIE DIN JOC',font=promo.font(20,True),fill='#c6c6d0')
    return image

def main():
    for i,recording in enumerate(RECORDINGS):
        first=artwork(i,.4);last=artwork(i,3.2)
        difference=sum(ImageStat.Stat(ImageChops.difference(first,last)).mean)/3
        assert difference>1.5,f'No significant animation: {GAME_IDS[i]}'
        print(f'{GAME_IDS[i]} motion verified: mean frame difference {difference:.2f}',flush=True)
    sheet=Image.new('RGB',(960,810),'#080809')
    for i,time in enumerate([1.5,3.8,7.5,11,14.5]):
        still=frame(time)
        still.save(WORK/f'scene-{i+1}.jpg',quality=93)
        sheet.paste(still.resize((480,270),Image.Resampling.LANCZOS),((i%2)*480,(i//2)*270))
    sheet.save(WORK/'contact-sheet.jpg',quality=93)
    frame(1.5).save(ROOT/'assets/tikinteract-animation-poster.jpg',quality=93)
    if '--stills-only' in sys.argv:return
    silent=WORK/'animated-silent.mp4'
    writer=promo.imageio_ffmpeg.write_frames(str(silent),(promo.W,promo.H),fps=promo.FPS,codec='libx264',pix_fmt_out='yuv420p',macro_block_size=1,output_params=['-crf','20','-preset','fast','-movflags','+faststart'],ffmpeg_log_level='error')
    writer.send(None)
    try:
        for n in range(promo.FPS*promo.DURATION):
            writer.send(frame(n/promo.FPS).tobytes())
            if n%(promo.FPS*4)==0:print(f'Animated {n//promo.FPS}/{promo.DURATION}s',flush=True)
    finally:writer.close()
    audio=WORK/'soundtrack.wav'
    promo.soundtrack(audio)
    destination=ROOT/'assets/tikinteract-animation.mp4'
    subprocess.run([promo.imageio_ffmpeg.get_ffmpeg_exe(),'-y','-i',str(silent),'-i',str(audio),'-c:v','copy','-c:a','aac','-b:a','128k','-movflags','+faststart','-shortest',str(destination)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    print(f'Created animated 1080p promo: {destination.stat().st_size} bytes',flush=True)

if __name__=='__main__':main()
