"""Banda sonora sintetizada del anuncio (30 s, 44,1 kHz estéreo) con numpy.
Marca los mismos instantes que la línea de tiempo de promo.html."""
import numpy as np, wave, sys
SR = 44100; DUR = 30.0; N = int(SR * DUR)
rng = np.random.default_rng(7)
t_all = np.arange(N) / SR
L = np.zeros(N); R = np.zeros(N)
fx_L = np.zeros(N); fx_R = np.zeros(N)   # envío a reverb

def add(sig, t0, pan=0.0, send=0.25, gain=1.0):
    i0 = int(t0 * SR)
    if i0 >= N: return
    seg = sig[: N - i0] * gain
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    L[i0:i0 + len(seg)] += seg * l; R[i0:i0 + len(seg)] += seg * r
    fx_L[i0:i0 + len(seg)] += seg * l * send; fx_R[i0:i0 + len(seg)] += seg * r * send

def env(n, a, d, s=0.0, r=0.0, sus_level=0.0):
    e = np.zeros(n); a_n, d_n = int(a * SR), int(d * SR)
    if a_n: e[:a_n] = np.linspace(0, 1, a_n)
    e[a_n:a_n + d_n] = np.linspace(1, sus_level, d_n) if d_n else 0
    return e

def midi(m): return 440.0 * 2 ** ((m - 69) / 12)

def tone(f, dur, kind='sine', a=.005, rel=.2, lp=None):
    n = int((dur + rel) * SR); t = np.arange(n) / SR
    if kind == 'sine': w = np.sin(2 * np.pi * f * t)
    elif kind == 'saw': w = 2 * ((f * t) % 1) - 1
    elif kind == 'pluck': w = np.sin(2 * np.pi * f * t) + .4 * np.sin(4 * np.pi * f * t) * np.exp(-t * 14) + .2 * np.sin(6 * np.pi * f * t) * np.exp(-t * 22)
    else: w = np.sign(np.sin(2 * np.pi * f * t))
    e = np.ones(n); an = max(1, int(a * SR)); e[:an] = np.linspace(0, 1, an)
    rn = int(rel * SR); e[-rn:] *= np.linspace(1, 0, rn)
    if kind == 'pluck': e *= np.exp(-t * 6)
    return w * e

def lowpass(x, fc):
    a = np.exp(-2 * np.pi * fc / SR); y = np.zeros_like(x); s = 0.0
    for i in range(len(x)): s = (1 - a) * x[i] + a * s; y[i] = s
    return y

def noise_sweep(dur, f0, f1, up=True):
    n = int(dur * SR); w = rng.standard_normal(n)
    # barrido: banda estrecha simulada con modulación de un filtro de un polo por bloques
    out = np.zeros(n); blocks = 80; bs = n // blocks; s = 0.0
    for b in range(blocks):
        x = b / blocks; fc = f0 * (f1 / f0) ** (x if up else 1 - x); a = np.exp(-2 * np.pi * fc / SR)
        seg = w[b * bs:(b + 1) * bs]; o = np.zeros_like(seg)
        for i in range(len(seg)): s = (1 - a) * seg[i] + a * s; o[i] = seg[i] - s if up else s
        out[b * bs:(b + 1) * bs] = o
    e = (np.linspace(0, 1, n) ** 2) if up else np.linspace(1, 0, n) ** 1.5
    return out * e

def kick(f0=120, f1=42, dur=.32):
    n = int(dur * SR); t = np.arange(n) / SR; ph = 2 * np.pi * (f1 * t + (f0 - f1) * (1 - np.exp(-t * 28)) / 28)
    return np.sin(ph) * np.exp(-t * 11) * 1.0

def hat(dur=.07):
    n = int(dur * SR); w = rng.standard_normal(n); w = np.diff(w, prepend=0); return w * np.exp(-np.arange(n) / SR * 70) * .5

def clap():
    n = int(.22 * SR); w = rng.standard_normal(n); t = np.arange(n) / SR
    w = w - lowpass(w, 700); return w * (np.exp(-t * 26) + .5 * np.exp(-((t - .02) ** 2) * 9000)) * .7

# ---- escenas (mismos tiempos que promo.html) ----
SCN = [0, 2.8, 5.6, 10.2, 13.6, 18.0, 21.0, 23.8, 27.0, 30.0]
BEAT = .5
# acordes: Am - F - C - G  (cada 2 s); final sobre Am9 / Fmaj
CH = [[57, 60, 64, 71], [53, 57, 60, 67], [48, 55, 60, 64], [55, 59, 62, 66]]
def pad(chord, t0, dur, gain=.11):
    for k, m in enumerate(chord):
        for det in (-.15, .15):
            s = tone(midi(m) * (1 + det * .003), dur, 'saw', a=.9, rel=1.2)
            s = lowpass(s, 900 + 500 * (k % 2)); add(s, t0, pan=(k - 1.5) * .5, send=.45, gain=gain / 2)
t = 0.0; ci = 0
while t < 28.0:
    pad(CH[ci % 4], t, 2.2, gain=.10 if t > 2 else .07); ci += 1; t += 2.0
# bajo (desde la escena 2)
t = 2.8; ci = 0
while t < 27.0:
    root = CH[ci % 4][0] - 24
    for q in range(4):
        add(lowpass(tone(midi(root), BEAT * .9, 'sine', a=.01, rel=.15), 400), t + q * BEAT, send=.05, gain=.28 if t > 5.6 else .16)
    t += 2.0; ci += 1
# pulso: bombo desde la escena 3 hasta el clímax
for b in range(int((5.6 - 0) / BEAT), int(27.0 / BEAT)):
    tb = b * BEAT
    if tb < 5.6: continue
    add(kick(), tb, send=.03, gain=.55)
    if tb >= 10.2 and (b % 2 == 1): add(clap(), tb, send=.35, gain=.28)
    if tb >= 10.2: add(hat(), tb + BEAT / 2, pan=.3, send=.1, gain=.35)
    if tb >= 13.6: add(hat(.05), tb + BEAT / 4, pan=-.3, send=.05, gain=.2); add(hat(.05), tb + BEAT * .75, pan=.3, send=.05, gain=.2)
# arpegio (desde la escena 3)
SCALE = [57, 60, 64, 67, 69, 72, 76, 79, 81]
pat = [0, 2, 4, 2, 5, 4, 2, 1]
t = 5.6; i = 0
while t < 27.0:
    ch = CH[int((t - 0) // 2.0) % 4]; arp = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[1] + 24, ch[2] + 24]
    n = arp[pat[i % 8] % len(arp)]; add(tone(midi(n), .22, 'pluck', a=.003, rel=.1), t, pan=((i * .37) % 1.6) - .8, send=.45, gain=.17 if t < 13.6 else .22)
    t += BEAT / 2; i += 1
# destellos de los iconos (escena 2): 13 notas ascendentes
for k in range(13):
    add(tone(midi(SCALE[k % len(SCALE)] + 12 * (k // 9)), .3, 'sine', a=.002, rel=.25), 3.15 + k * .07, pan=-.8 + k * .13, send=.5, gain=.16)
# modos (escena 3): cuatro notas al cambiar de modo
for k, tt in enumerate([6.2, 6.83 + 5.6 - 5.6 + 0.0, 8.17 + 0.0, 9.5]):
    pass
for tt, n in [(6.2, 72), (5.6 + (40 - 3) / 30, 76), (5.6 + (80 - 3) / 30, 79), (5.6 + (120 - 3) / 30, 84)]:
    add(tone(midi(n), .45, 'pluck', a=.002, rel=.3), tt, send=.6, gain=.3)
# temas (escena 4): un "tin" por cambio
for k in range(6): add(tone(midi(84 + [0, 4, 7, 12, 4, 0][k]), .35, 'sine', a=.002, rel=.3), 10.4 + k * .5, pan=.4, send=.6, gain=.18)
# toast y confeti (escena 7)
add(tone(midi(88), .5, 'pluck', a=.002, rel=.4), 22.1, send=.6, gain=.3); add(tone(midi(91), .5, 'pluck'), 22.18, send=.6, gain=.25); add(tone(midi(95), .8, 'pluck', rel=.6), 22.26, send=.7, gain=.22)
add(hat(.4) * 2.2, 22.1, send=.5, gain=.35)
# clic de actualizar (escena 8) y reinicio
add(tone(1400, .03, 'sine', rel=.03), 23.8 + 57 / (30 * 1.62), send=.2, gain=.35)
add(tone(900, .04, 'sine', rel=.05), 23.8 + 58 / (30 * 1.62), send=.2, gain=.2)
add(noise_sweep(.5, 400, 7000, True), 23.8 + 120 / (30 * 1.62), send=.4, gain=.18)
add(tone(midi(84), .6, 'pluck', rel=.5), 23.8 + 140 / (30 * 1.62), send=.7, gain=.28)
# barridos de transición
for a in SCN[1:9]:
    add(noise_sweep(.55, 300, 9000, True), a - .5, send=.55, gain=.20)
    add(noise_sweep(.9, 6000, 500, False), a, send=.5, gain=.10)
    add(kick(90, 30, .6), a, send=.1, gain=.35)
# clímax final (escena 9): acorde amplio + campana
for m in [45, 57, 64, 69, 72, 76, 81]:
    add(lowpass(tone(midi(m), 3.0, 'saw', a=.04, rel=2.0), 2400), 27.0, pan=(m % 5 - 2) * .3, send=.6, gain=.075)
add(kick(100, 38, .9), 27.0, gain=.7, send=.1)
for k, n in enumerate([81, 84, 88, 93]): add(tone(midi(n), 1.2, 'pluck', rel=1.2), 27.55 + k * .12, pan=(k - 1.5) * .4, send=.7, gain=.22)

# ---- reverb por convolución (FFT) ----
def reverb(x, secs=2.2):
    n = int(secs * SR); t = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-t * 2.4); ir = lowpass(ir, 6000) * .6
    m = 1 << int(np.ceil(np.log2(len(x) + n)))
    y = np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)[:len(x)]
    return y / (np.max(np.abs(y)) + 1e-9)
rl = reverb(fx_L); rr = reverb(fx_R)
wet = .5
outL = L + rl * wet * np.max(np.abs(fx_L)) * 0.9; outR = R + rr * wet * np.max(np.abs(fx_R)) * 0.9
# ---- masterización: fundido, normalizar, saturación suave ----
fade = np.ones(N); fi = int(.8 * SR); fade[:fi] = np.linspace(0, 1, fi) ** 2; fo = int(1.0 * SR); fade[-fo:] = np.linspace(1, 0, fo) ** 1.5
outL *= fade; outR *= fade
peak = max(np.max(np.abs(outL)), np.max(np.abs(outR))); g = .85 / peak
outL = np.tanh(outL * g * 1.25) * .9; outR = np.tanh(outR * g * 1.25) * .9
pcm = np.empty(N * 2, dtype='<i2'); pcm[0::2] = (outL * 32767).astype('<i2'); pcm[1::2] = (outR * 32767).astype('<i2')
path = sys.argv[1] if len(sys.argv) > 1 else 'audio.wav'
with wave.open(path, 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('audio', path, round(N / SR, 1), 's')
