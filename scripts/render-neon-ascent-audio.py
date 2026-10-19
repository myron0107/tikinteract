"""Original deterministic NEON ASCENT score and SFX; no external recordings.

Run with Python 3 and FFmpeg (FFMPEG env var or the workspace video tool).
PCM masters stay in .tools; MP3 runtime assets and an audit ship with the game.
"""
import array
import hashlib
import json
import math
import os
from pathlib import Path
import random
import subprocess
import wave

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'GAME/NOVA-VEX/audio'
MASTERS = ROOT / '.tools/neon-ascent/audio-masters'
FFMPEG = os.environ.get('FFMPEG', str(ROOT / '.tools/video/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'))
RATE = 32000
TAU = math.tau
AUDIT = []


class Clip:
    def __init__(self, seconds, seed=7):
        self.samples = array.array('f', [0]) * round(seconds * RATE)
        self.random = random.Random(seed)

    def tone(self, start, duration, hz, end=None, gain=.3, kind='sine', attack=.008, release=.07):
        phase = 0
        count = round(duration * RATE)
        at = round(start * RATE)
        for i in range(count):
            t = i / RATE
            p = i / max(1, count - 1)
            frequency = hz * ((end / hz) ** p) if end else hz
            phase += TAU * frequency / RATE
            value = math.sin(phase)
            if kind == 'soft':
                value = (value + .22 * math.sin(phase * 2) + .09 * math.sin(phase * 3)) / 1.31
            elif kind == 'bell':
                value = (value + .24 * math.sin(phase * 2.003) * math.exp(-t * 7)) / 1.24
            elif kind == 'fm':
                value = math.sin(phase + 1.8 * math.sin(phase * 2) * (1 - p))
            envelope = min(1, t / max(attack, .0001), (duration - t) / max(release, .0001))
            if kind == 'bell':
                envelope *= math.exp(-t * 3)
            index = at + i
            if index >= len(self.samples):
                break
            self.samples[index] += value * gain * max(0, envelope)
        return self

    def noise(self, start, duration, gain=.15, cutoff=.1, decay=3):
        low = previous = 0
        at = round(start * RATE)
        for i in range(round(duration * RATE)):
            white = self.random.uniform(-1, 1)
            low += cutoff * (white - low)
            # Smoothed noise avoids brittle white-noise transients.
            previous += .5 * (low - previous)
            envelope = min(1, i / (RATE * .004)) * math.exp(-decay * i / (RATE * duration))
            envelope *= min(1, (duration - i / RATE) / .025)
            if at + i >= len(self.samples):
                break
            self.samples[at + i] += previous * gain * envelope
        return self

    def notes(self, notes, step=.095, start=0, gain=.3, duration=.26, kind='bell'):
        for index, midi in enumerate(notes):
            self.tone(start + index * step, duration, 440 * 2 ** ((midi - 69) / 12), gain=gain, kind=kind)
        return self

    def save(self, name, description, loop=False, music=False):
        data = self.samples
        peak = max(abs(v) for v in data) or 1
        scale = .78 / peak
        # Smooth the loop boundary by wrapping note tails. FX have short fades.
        pcm = array.array('h')
        square = 0
        edge = round(RATE * .012)
        for i, value in enumerate(data):
            value *= scale
            if not loop:
                value *= min(1, i / edge, (len(data) - 1 - i) / edge)
            square += value * value
            pcm.append(round(max(-1, min(1, value)) * 32767))
        wav = MASTERS / (name + '.wav')
        with wave.open(str(wav), 'wb') as output:
            output.setparams((1, 2, RATE, len(pcm), 'NONE', 'not compressed'))
            output.writeframes(pcm.tobytes())
        target = OUT / (name + '.mp3')
        subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(wav),
                        '-c:a', 'libmp3lame', '-b:a', '128k' if music else '96k',
                        '-write_xing', '1', '-metadata', 'artist=TIKINTERACT',
                        '-metadata', 'title=' + name, str(target)], check=True)
        AUDIT.append(dict(file=target.name, description=description, loop=loop,
                          seconds=round(len(data) / RATE, 4), peak=.78,
                          rms=round(math.sqrt(square / len(data)), 4),
                          sha256=hashlib.sha256(target.read_bytes()).hexdigest()))


def score():
    # Eight bars, 110 BPM, E minor / C major / G major / D major.
    beat = 60 / 110
    duration = beat * 32
    c = Clip(duration + 2)
    chords = [(40, 55, 59, 64), (36, 55, 60, 64), (43, 55, 59, 62), (38, 54, 57, 62)]
    melody = [76, 79, 83, 79, 74, 76, 79, 74, 76, 79, 84, 79, 76, 74, 72, 74,
              74, 79, 83, 86, 83, 79, 76, 74, 78, 81, 86, 81, 78, 76, 74, 71]
    for bar in range(8):
        chord = chords[bar // 2]
        for note in chord[1:]:
            c.tone(bar * 4 * beat, 4.6 * beat, 440 * 2 ** ((note - 69) / 12), gain=.042, kind='soft', attack=.18, release=.5)
        for step in range(8):
            t = (bar * 4 + step / 2) * beat
            bass = chord[0] + (12 if step in (3, 7) else 0)
            c.tone(t, .23, 440 * 2 ** ((bass - 69) / 12), gain=.21, kind='soft', release=.1)
            note = chord[1 + (step % 3)] + 12
            c.tone(t + beat / 4, .29, 440 * 2 ** ((note - 69) / 12), gain=.055, kind='bell')
            c.noise(t + beat / 4, .055, gain=.12 if step % 2 == 0 else .07, cutoff=.65, decay=5)
        for b in range(4):
            t = (bar * 4 + b) * beat
            c.tone(t, .19, 125, end=43, gain=.4, attack=.002, release=.09)
            if b % 2:
                c.noise(t, .13, gain=.32, cutoff=.5, decay=4)
                c.tone(t, .105, 190, end=115, gain=.08)
            c.tone(t + beat / 2, .42, 440 * 2 ** ((melody[bar * 4 + b] - 69) / 12), gain=.085, kind='bell', release=.15)
    # Wrap all reverb/release tails into the beginning for sample-accurate looping.
    length = round(duration * RATE)
    for i in range(length, len(c.samples)):
        c.samples[i - length] += c.samples[i]
    c.samples = c.samples[:length]
    c.save('neon-ascent-theme', 'Original eight-bar synthwave score, 110 BPM, E minor.', loop=True, music=True)


def effects():
    Clip(.28).tone(0, .22, 280, end=630, gain=.4, kind='soft').save('runner-jump', 'Soft upward sneaker/synth jump.')
    Clip(.2).tone(0, .14, 100, end=48, gain=.5).noise(0, .10, .2).save('runner-land', 'Compact sneaker landing, soft low thud.')
    Clip(.65).notes([76, 83, 88], step=.1).tone(0, .26, 180, end=420, gain=.13).save('energy-charge', 'Fresh electric energy-drink charge.')
    Clip(.36).notes([88, 95], step=.06, duration=.19, gain=.2).save('energy-release', 'Tiny bright energy release sparkle.')
    c = Clip(.65, 11)
    for i, hz in enumerate([630, 180, 490, 120, 310, 80]):
        c.tone(i * .055, .055, hz, end=hz*.8, gain=.27, kind='fm', release=.012)
    c.noise(0, .38, .25, cutoff=.4).save('glitch-trigger', 'Short fragmented digital malfunction, no metallic anvil.')
    Clip(.55).tone(0, .36, 240, end=65, gain=.45, kind='fm').noise(0, .18, .25).save('glitch-impact', 'Low digital glitch drop with filtered crackle.')
    Clip(1.05).tone(0, .7, 130, end=310, gain=.18, kind='fm').notes([71, 78, 83], start=.3, step=.16, gain=.23).save('drone-arrive', 'Rescue drone spin-up and friendly lock-on tones.')
    Clip(.8).tone(0, .6, 110, end=360, gain=.25, kind='soft').notes([64, 71, 76], step=.11, gain=.18).save('board-activate', 'Hoverboard ignition, low electric lift.')
    Clip(.75).tone(0, .55, 160, end=900, gain=.28, kind='fm').notes([76, 83, 88], start=.2, step=.13, gain=.2).save('laser-activate', 'Laser elevator power ramp with ascending harmonics.')
    Clip(.85).tone(0, .62, 440, end=48, gain=.36, kind='soft').noise(.1, .35, .18).save('blackout-trigger', 'Power-grid breaker and descending shutdown.')
    Clip(.85).tone(0, .66, 210, end=58, gain=.3, kind='fm').notes([64, 59, 52], step=.14, gain=.18).save('gravity-trigger', 'Heavy gravity lock with falling digital tones.')
    Clip(1.15).tone(0, .95, 90, end=1100, gain=.25, kind='fm').noise(.1, .85, .12, decay=.7).save('emp-charge', 'Electromagnetic capacitor charging, rising pulse.')
    Clip(.55).tone(0, .45, 950, end=145, gain=.22, kind='fm').noise(0, .3, .24).save('emp-release', 'Plasma discharge sweep before the impact.')
    Clip(1.1).tone(0, .65, 125, end=34, gain=.48).tone(.03, .35, 520, end=130, gain=.19, kind='fm').noise(0, .75, .55, cutoff=.18, decay=5).save('emp-impact', 'Rounded EMP shockwave, deep pulse and electric tail.')
    Clip(.7).tone(0, .48, 540, end=170, gain=.18).notes([83, 79, 76], step=.08, gain=.12).save('lift-release', 'Soft hover drive release and deceleration.')
    Clip(1.1).notes([64, 71, 76, 83], step=.15, gain=.27, duration=.4).save('reboot-sequence', 'Holographic reboot, four-note system restart.')
    Clip(.85).notes([76, 80, 83, 88], step=.11, gain=.32).save('crown-award', 'New crown sparkle with ascending E-major signature.')
    Clip(.85).notes([83, 79, 72, 67], step=.11, gain=.3, kind='fm').save('vex-heist', 'Vex crown heist: quick descending masked motif.')
    Clip(1.3).tone(0, .95, 110, end=320, gain=.24, kind='soft').notes([63, 66, 70], start=.3, step=.17, gain=.23).save('vex-arrival', 'Vex hoverboard arrival with a dark three-note motif.')
    Clip(.5).notes([70, 75], step=.13, gain=.23, kind='fm').save('vex-lock', 'Vex visor lock-on, no spacecraft hatch.')
    Clip(.4).tone(0, .2, 170, end=60, gain=.45).noise(0, .16, .42).save('vex-strike', 'Stylized quick glove strike.')
    Clip(1.35).notes([75, 70, 73, 66], step=.22, gain=.3, duration=.3, kind='fm').save('vex-taunt', 'Vex signature electronic tease, no alien laughter.')
    Clip(1.2).tone(0, .85, 390, end=85, gain=.25, kind='soft').noise(0, .6, .13).save('vex-departure', 'Hoverboard escape sweeping away.')
    Clip(1.65).notes([88, 83, 80, 76], step=.23, gain=.25, duration=.55).save('crown-descent', 'Holographic crown descending with bell harmonics.')
    Clip(.6).notes([76, 83, 88], step=.065, gain=.3).save('crown-catch', 'Crown catch: compact sparkling chord.')
    c = Clip(3.3)
    c.notes([64, 68, 71, 76, 80, 83], step=.16, duration=.55, gain=.27)
    for note in [64, 68, 71, 76]:
        c.tone(1.2, 1.8, 440*2**((note-69)/12), gain=.11, kind='soft', attack=.09, release=.65)
    c.save('champion-neon', 'Original E-major champion flourish and warm synth chord.')
    Clip(.65).tone(0, .48, 320, end=880, gain=.18).noise(0, .4, .1).save('crown-flight', 'Light crown-flight shimmer.')
    Clip(.8).notes([71, 76, 83], step=.15, gain=.24).save('finish-beacon', 'Finish beacon confirmation.')
    Clip(.2).tone(0, .13, 880, gain=.32, kind='bell', release=.065).save('countdown-tick', 'Clear short countdown pip, once per second.')


def beds():
    # Periodic integer frequencies/modulation: zero-jump seamless two-second loops.
    for name, base, pulse, description in [
        ('drone-hover', 156, 24, 'Soft rescue rotor flutter.'),
        ('board-hover', 98, 6, 'Smooth low hoverboard thruster.'),
        ('laser-hum', 220, 8, 'Clean rising-energy laser sustain.'),
        ('blackout-hum', 55, 3, 'Quiet interrupted power-grid hum.'),
        ('gravity-hum', 65, 2, 'Deep gravitational oscillation.')]:
        c = Clip(2)
        for i in range(len(c.samples)):
            t = i / RATE
            modulation = .68 + .32 * math.sin(TAU*pulse*t)
            c.samples[i] = modulation * (math.sin(TAU*base*t) + .18*math.sin(TAU*base*2*t) + .07*math.sin(TAU*base*3*t))
        c.save(name, description, loop=True)


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    MASTERS.mkdir(parents=True, exist_ok=True)
    score()
    effects()
    beds()
    audit = dict(game='NEON ASCENT', author='TIKINTERACT', provenance='Original procedural compositions and synthesis; no external samples or recordings.',
                 generator='scripts/render-neon-ascent-audio.py', sampleRate=RATE, files=AUDIT)
    (OUT / 'sound-design.json').write_text(json.dumps(audit, indent=2) + '\n', encoding='utf-8')
    print(f'Rendered {len(AUDIT)} original audio files ({sum((OUT/x["file"]).stat().st_size for x in AUDIT):,} bytes).')
