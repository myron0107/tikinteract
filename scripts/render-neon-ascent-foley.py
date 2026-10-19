"""Physical arcade sound design for NOVA & VEX, original synthesis only."""
import importlib.util
import json
import math
import sys
from pathlib import Path

sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('synthesis',Path(__file__).with_name('render-neon-ascent-audio.py'))
synth=importlib.util.module_from_spec(spec)
spec.loader.exec_module(synth)
Clip,RATE,TAU=synth.Clip,synth.RATE,math.tau


def swish(name,description,seconds=.45):
    c=Clip(seconds)
    c.noise(0,seconds*.9,.6,cutoff=.12,decay=1.5)
    for i in range(len(c.samples)):
        c.samples[i]*=math.sin(math.pi*i/len(c.samples))
    c.save(name,description)


def hit(name,description,hz=110,metal=False):
    c=Clip(.48)
    c.tone(0,.19,hz,end=hz*.43,gain=.5,attack=.002,release=.12)
    c.noise(0,.13,.65,cutoff=.32,decay=6)
    if metal:
        for partial in [2.31,3.82,5.17]:
            c.tone(0,.28,hz*partial,gain=.065,kind='bell',release=.2)
    c.save(name,description)


def music():
    beat=60/132;seconds=64*beat;c=Clip(seconds+2,36)
    # Driving arcade track: syncopated bass, short stabs and a repeating hook
    # with a B section. No sustained ambient pad or slow atmospheric intro.
    progression=[(48,60,63,67),(44,60,63,68),(51,58,63,67),(46,58,62,65)]
    hooks=[[79,79,75,77,79,82,79,75],[80,79,75,72,75,79,80,79],
           [79,82,87,82,79,75,77,79],[77,74,70,74,77,79,77,74]]
    for bar in range(16):
        chord=progression[bar%4]
        melody=hooks[bar%4]
        for b in range(4):
            t=(bar*4+b)*beat
            c.tone(t,.17,135,end=44,gain=.42,attack=.002,release=.095)
            if b in [1,3]:
                for offset in [0,.012,.025]:c.noise(t+offset,.10,.25,cutoff=.45,decay=5)
                c.tone(t,.11,170,end=110,gain=.08)
            for off in [0,.5]:c.noise(t+off*beat,.045,.11 if off==.5 else .055,cutoff=.65,decay=5)
            for off in [.0,.5,.75] if b in [1,3] else [.0,.5]:
                bass=chord[0]-12+(12 if off==.75 else 0)
                c.tone(t+off*beat,.14,440*2**((bass-69)/12),gain=.22,kind='soft',attack=.004,release=.065)
        for off in [.75,1.5,2.75,3.5]:
            for note in chord[1:]:c.tone((bar*4+off)*beat,.14,440*2**((note-69)/12),gain=.049,kind='soft',attack=.004,release=.07)
        for step,note in enumerate(melody):
            if bar in [3,7,11,15] and step>4:continue
            # B section adds an answering octave phrase and a small stereo-safe echo.
            note+=12 if bar>=8 and step in [2,6] else 0
            t=(bar*4+step*.5)*beat
            hz=440*2**((note-69)/12)
            c.tone(t,.17,hz,gain=.115 if bar>=4 else .08,kind='soft',attack=.006,release=.09)
            c.tone(t+beat*.75,.14,hz,gain=.023,kind='soft',release=.1)
        if bar%4==3:
            for step in range(4):c.noise((bar*4+3+step*.25)*beat,.05,.15,cutoff=.4,decay=5)
    n=round(seconds*RATE)
    for i in range(n,len(c.samples)):c.samples[i-n]+=c.samples[i]
    c.samples=c.samples[:n]
    c.save('neon-arcade-run','Original rhythmic arcade score: 132 BPM, four-on-the-floor drums, syncopated bass, short chord stabs, melodic hook and B section.',loop=True,music=True)


def foley():
    Clip(.3).tone(0,.23,210,end=490,gain=.4,kind='soft',release=.14).noise(0,.07,.1).save('runner-hop','Light rubber-sole hop.')
    hit('sneaker-step','Soft compact sneaker contact.',85)
    c=Clip(.5)
    for i in range(4):c.tone(i*.075,.14,220+i*65,end=170+i*45,gain=.3,kind='soft')
    c.save('spring-compress','Spring winding under the runner, short rubber squeak.')
    c=Clip(.65)
    for i in range(5):c.tone(i*.055,.24,460-i*50,end=160+i*20,gain=.3/(i+1)**.5,kind='soft')
    c.save('spring-boing','Bouncy elastic boing released at takeoff.')
    c=Clip(.55);c.noise(0,.45,.35,cutoff=.18,decay=1)
    c.tone(0,.33,640,end=240,gain=.24,kind='soft',attack=.03,release=.16)
    c.save('banana-skid','Short rubber squeak and sliding shoe.')
    hit('slip-tumble','Comic soft tumble after the slip.',125)
    swish('hook-cast','Grappling hook cast with a tight cable swish.')
    hit('hook-latch','Steel hook latches onto the anchor.',280,True)
    hit('jetpack-buckle','Jetpack clips into the harness.',215,True)
    c=Clip(.65);c.noise(0,.6,.6,cutoff=.045,decay=.7);c.tone(0,.45,70,end=110,gain=.13)
    c.save('jetpack-ignite','Short warm gas ignition; no laser chirp.')
    c=Clip(.85);c.noise(0,.75,.4,cutoff=.025,decay=.6)
    c.tone(0,.72,180,end=270,gain=.12,kind='soft',attack=.18,release=.3)
    c.save('portal-unfold','Air folds open with a restrained resonant shimmer.')
    swish('portal-cross','Quick close air sweep when passing through the portal.',.55)
    swish('glove-swing','Padded glove swinging through air.',.4)
    hit('boxing-thump','Rounded padded boxing impact.',95)
    c=Clip(.7)
    for i in range(6):
        c.noise(i*.065,.07,.3,cutoff=.32,decay=5)
        c.tone(i*.065,.15,350+i*80,gain=.14,kind='bell')
    c.save('chain-lock','Several heavy chain links attaching to the runner.')
    hit('chain-tighten','Chain pulled taut with a small metal clank.',170,True)
    c=Clip(.7);c.noise(0,.62,.6,cutoff=.035,decay=.8);c.tone(0,.55,75,end=90,gain=.15)
    c.save('press-motor','Hydraulic pump starts, low mechanical strain.')
    swish('press-valve','Pneumatic pressure release.',.42)
    hit('press-contact','Heavy rubber-buffered hydraulic press contact.',62,True)
    swish('gear-detach','Short harness or cable release.',.35)
    Clip(.75).notes([60,67,72],step=.14,gain=.27,duration=.35,kind='soft').save('checkpoint-return','Gentle checkpoint restore cue.')
    Clip(.85).notes([79,84,88],step=.09,gain=.24,duration=.45).save('crown-shine','Short glass-like crown reward sparkle.')
    swish('crown-swipe','Crown whisked away by Vex.',.45)
    c=Clip(.95);c.noise(0,.85,.4,cutoff=.055,decay=1);c.tone(0,.65,100,end=165,gain=.13)
    c.save('vex-skate-in','Vex arrives with rolling wheels and a gentle brake.')
    Clip(.32).noise(0,.25,.55,cutoff=.3,decay=2).tone(0,.18,520,end=310,gain=.13).save('vex-brake','Quick rubber skate brake.')
    hit('vex-bump','Small padded shoulder bump.',135)
    c=Clip(.9)
    c.tone(0,.22,850,end=1050,gain=.15,attack=.045,release=.07)
    c.tone(.28,.32,1050,end=750,gain=.13,attack=.04,release=.15)
    c.noise(0,.6,.035,cutoff=.2,decay=1)
    c.save('vex-whistle','Brief cheeky two-part whistle instead of alien laughter.')
    swish('vex-skate-out','Vex skating away with a soft wheel swish.',.75)
    Clip(1.2).notes([88,84,79],step=.25,gain=.19,duration=.6).save('crown-float','Delicate crown descent, three quiet glass notes.')
    Clip(.5).tone(0,.4,1046.5,gain=.3,kind='bell',release=.3).save('crown-ding','Single clear crown catch ding.')
    c=Clip(1.65)
    c.notes([72,76,79,84],step=.1,gain=.25,duration=.4)
    for note in [60,64,67]:c.tone(.45,.95,440*2**((note-69)/12),gain=.08,kind='soft',release=.45)
    c.save('champion-sting','Short warm arcade victory sting, no long fanfare.')
    swish('crown-swish','Light crown flight swish.',.35)
    Clip(.7).notes([72,79],step=.14,gain=.23,duration=.4).save('finish-bell','Simple two-note finish bell.')
    Clip(.15).tone(0,.1,440,end=360,gain=.3,kind='soft',release=.07).save('countdown-tock','Rounded wooden-style countdown tock, no piercing beep.')


def loops():
    for name,base,mod,noise,description in [
        ('cable-reel',108,14,.15,'Quiet reel motor pulling the grappling cable.'),
        ('jetpack-air',68,18,.6,'Soft filtered air thrust, not two loud engines.'),
        ('portal-breeze',135,2,.16,'Low airy portal resonance.'),
        ('glove-piston',58,4,.16,'Very quiet pneumatic pressure sustain.'),
        ('chain-drag',90,8,.12,'Soft chain tension and periodic link rattle.')]:
        c=Clip(2,27);c.noise(0,2,noise,cutoff=.025,decay=0)
        for i in range(len(c.samples)):
            t=i/RATE;envelope=.65+.35*math.sin(TAU*mod*t)
            c.samples[i]+=.08*math.sin(TAU*base*t)*envelope
            c.samples[i]*=min(1,t/.018,(2-t)/.018)
        c.save(name,description,loop=True)


def vex_hair():
    Clip(.3).noise(0,.25,.6,cutoff=.09,decay=2).save('vex-hair-grab','Soft glove and clothing rustle as the hand closes; no punch.')
    c=Clip(.42);c.noise(0,.35,.5,cutoff=.065,decay=1.5)
    c.tone(.02,.19,390,end=245,gain=.085,kind='soft',attack=.04,release=.1)
    c.save('vex-hair-tug','Short cartoon tug swish and gentle elastic squeak; no impact or tearing.')
    swish('vex-let-go','Small airy release when the hand opens.',.25)


RETIRED_BOARD_SCENES={'vex-chain-throw.mp3','chain-tighten.mp3','chain-drag.mp3','vex-dive-charge.mp3','vex-dive-impact.mp3'}
RETIRED_NEGATIVES={'press-motor.mp3','press-valve.mp3','press-contact.mp3','glove-swing.mp3','chain-lock.mp3','glove-piston.mp3'}|RETIRED_BOARD_SCENES


def vex_negative():
    swish('vex-banana-toss','Vex throws the peel: a short cloth-and-air swish.',.38)
    c=Clip(.58)
    for i in range(4):c.tone(i*.065,.15,180+i*45,end=130+i*30,gain=.2,kind='soft')
    c.noise(.25,.25,.35,cutoff=.12,decay=3)
    c.save('vex-glove-spring','Vex cocks and releases a compact spring boxing glove.')
    vex_board_scenes()


def vex_board_scenes():
    c=Clip(.45,53);c.noise(0,.37,.45,cutoff=.08,decay=1.4)
    c.tone(.03,.22,240,end=165,gain=.11,kind='soft',release=.12)
    c.save('vex-board-catch','Clothing rustle and a soft step as Vex pulls Nova onto the shared board; no chain or metal.')
    c=Clip(.7,54);c.noise(0,.64,.48,cutoff=.028,decay=.7)
    c.tone(0,.6,105,end=65,gain=.13,kind='soft',attack=.07,release=.2)
    c.save('vex-board-descent','Board thrusters bank downward once both riders are aboard.')
    swish('vex-board-throw','Vex releases Nova from the board with a quick clothing-and-air toss.',.5)
    c=Clip(.4,55);c.noise(0,.32,.45,cutoff=.07,decay=1.4)
    c.tone(.02,.2,165,end=125,gain=.07,kind='soft')
    c.save('vex-push-reach','Short sleeve rustle as Vex reaches toward Nova before the push.')
    c=Clip(.55,56);c.noise(0,.47,.45,cutoff=.045,decay=1.2)
    c.noise(.13,.22,.14,cutoff=.12,decay=2)
    c.save('vex-push-contact','Soft fabric friction and airy hand release after a sustained open-palmed push; no hit, thump or punch.')
    c=Clip(2,45);c.noise(0,2,.4,cutoff=.026,decay=0)
    for i in range(len(c.samples)):
        t=i/RATE;c.samples[i]+=.08*math.sin(TAU*74*t)*(.7+.3*math.sin(TAU*12*t))
        c.samples[i]*=min(1,t/.018,(2-t)/.018)
    c.save('vex-board-rush','Quiet shared hoverboard air rush while Vex carries Nova downward.',loop=True)
    c=Clip(2,57);c.noise(0,2,.5,cutoff=.05,decay=0)
    for i in range(len(c.samples)):
        t=i/RATE;c.samples[i]*=(.78+.22*math.sin(TAU*3*t))*min(1,t/.025,(2-t)/.025)
    c.save('vex-freefall','Soft looping falling-air rush after Nova is pushed off the ledge; no motor.',loop=True)


if __name__=='__main__':
    synth.OUT.mkdir(parents=True,exist_ok=True);synth.MASTERS.mkdir(parents=True,exist_ok=True)
    if '--board-scenes-only' in sys.argv:
        previous=json.loads((synth.OUT/'sound-design.json').read_text(encoding='utf-8'))
        vex_board_scenes();names={item['file'] for item in synth.AUDIT}|RETIRED_BOARD_SCENES
        previous['files']=[item for item in previous['files'] if item['file'] not in names]+synth.AUDIT
        (synth.OUT/'sound-design.json').write_text(json.dumps(previous,indent=2)+'\n',encoding='utf-8')
        for name in RETIRED_BOARD_SCENES:(synth.OUT/name).unlink(missing_ok=True)
        print('Rendered seven board-ride, throw, shove and freefall sounds; retired the chain/dive sounds.')
        sys.exit(0)
    if '--negative-only' in sys.argv:
        previous=json.loads((synth.OUT/'sound-design.json').read_text(encoding='utf-8'))
        vex_negative();names={item['file'] for item in synth.AUDIT}|RETIRED_NEGATIVES
        previous['files']=[item for item in previous['files'] if item['file'] not in names]+synth.AUDIT
        (synth.OUT/'sound-design.json').write_text(json.dumps(previous,indent=2)+'\n',encoding='utf-8')
        for name in RETIRED_NEGATIVES:(synth.OUT/name).unlink(missing_ok=True)
        print('Rendered Vex attack sounds; retired standalone trap and chain/dive sounds.')
        sys.exit(0)
    if '--vex-only' in sys.argv:
        previous=json.loads((synth.OUT/'sound-design.json').read_text(encoding='utf-8'))
        vex_hair();names={item['file'] for item in synth.AUDIT}
        previous['files']=[item for item in previous['files'] if item['file'] not in names]+synth.AUDIT
        (synth.OUT/'sound-design.json').write_text(json.dumps(previous,indent=2)+'\n',encoding='utf-8')
        print('Rendered three soft Vex grab/tug/release sounds.')
        sys.exit(0)
    if '--music-only' in sys.argv:
        previous=json.loads((synth.OUT/'sound-design.json').read_text(encoding='utf-8'))
        music()
        previous['files']=[item for item in previous['files'] if item['file'] not in ['courier-groove.mp3','neon-arcade-run.mp3']]+synth.AUDIT
        (synth.OUT/'sound-design.json').write_text(json.dumps(previous,indent=2)+'\n',encoding='utf-8')
        print('Rendered new 132 BPM arcade music; existing sound effects preserved.')
        sys.exit(0)
    music();foley();loops();vex_hair();vex_negative()
    synth.AUDIT=[item for item in synth.AUDIT if item['file'] not in RETIRED_NEGATIVES]
    for name in RETIRED_NEGATIVES:(synth.OUT/name).unlink(missing_ok=True)
    result=dict(game='NOVA & VEX',version='physical-arcade',author='TIKINTERACT',
                provenance='Original procedural foley and composition. No third-party samples or recordings.',
                generator='scripts/render-neon-ascent-foley.py',sampleRate=RATE,files=synth.AUDIT)
    (synth.OUT/'sound-design.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print('Rendered',len(synth.AUDIT),'original physical arcade sounds.')
