#!/usr/bin/env python3
"""Regenerate docs/img/demo.gif — transparent-background close-up loop.

Pipeline (deterministic, no screencast throttling):
  1. serve docs/ and screenshot the phase-frozen strip twice:
       demo.html?strip=36&bg=white   -> matte_white.png (full page)
       demo.html?strip=36&bg=black   -> matte_black.png (full page)
  2. run this script (Pillow only, stdlib):
       python3 docs/make-gif.py matte_white.png matte_black.png docs/img/demo.gif

Two-background alpha matting -> transparent GIF for dsh-plugin-deepdiving.

Photographs of the phase strip over white and black backdrops solve, per
pixel, C = a*F + (1-a)*B:

    a = 1 - (Cw - Cb) / 255        (white: B=255, black: B=0)
    F = Cb / a   (where a > 0)

GIF alpha is binary, so the recovered a is thresholded with a 4x4 Bayer
dither in the 0.30..0.70 band (soft glyph edges) and hard below/above (the
0.25-alpha glow falls under 0.30 and disappears - intended: 1-bit alpha
cannot carry it). Palette: one global adaptive 255-color table built from
the matted foreground of all frames; index 0 is the transparent entry.
"""
from PIL import Image
import sys

import os
WHITE_PATH = sys.argv[1] if len(sys.argv) > 1 else '/tmp/matte_white.png'
BLACK_PATH = sys.argv[2] if len(sys.argv) > 2 else '/tmp/matte_black.png'
OUT_PATH = sys.argv[3] if len(sys.argv) > 3 else 'docs/img/demo.gif'
WHITE = Image.open(WHITE_PATH).convert('RGB')
BLACK = Image.open(BLACK_PATH).convert('RGB')

N = 36
PITCH = 112
# ink ground truth: x 222..400, y offset 15..43 within each row; crop padded
X0, W = 210, 204
DY0, H = 6, 46

BAYER = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
]

frames = []       # (alpha, rgb) per frame as PIL images
sample_pixels = []  # foreground pixels for the global palette

for i in range(N):
    y0 = i * PITCH + DY0
    cw = WHITE.crop((X0, y0, X0 + W, y0 + H))
    cb = BLACK.crop((X0, y0, X0 + W, y0 + H))
    pw, pb = cw.load(), cb.load()
    alpha = Image.new('L', (W, H))
    fg = Image.new('RGB', (W, H))
    pa, pf = alpha.load(), fg.load()
    for y in range(H):
        for x in range(W):
            rw, gw, bw = pw[x, y]
            rb, gb_, bb = pb[x, y]
            a = 1 - ((rw - rb) + (gw - gb_) + (bw - bb)) / (3 * 255)
            a = max(0.0, min(1.0, a))
            pa[x, y] = round(a * 255)
            if a > 0.02:
                pf[x, y] = (min(255, round(rb / a)),
                            min(255, round(gb_ / a)),
                            min(255, round(bb / a)))
            else:
                pf[x, y] = (0, 0, 0)
    frames.append((alpha, fg))

# global palette from all frames' foreground (alpha >= 0.6: solid core)
for alpha, fg in frames:
    pa, pf = alpha.load(), fg.load()
    for y in range(H):
        for x in range(W):
            if pa[x, y] >= 153:
                sample_pixels.append(pf[x, y])
sample = Image.new('RGB', (len(sample_pixels), 1))
sample.putdata(sample_pixels)
pal_img = sample.quantize(colors=255, method=Image.MEDIANCUT)
palette = pal_img.getpalette()[:255 * 3]

# map each frame: quantize fg -> indices, shift +1, apply dithered alpha -> 0
out_frames = []
for alpha, fg in frames:
    q = fg.quantize(palette=pal_img, dither=Image.Dither.NONE)
    idx = q.load()
    pa = alpha.load()
    p_frame = Image.new('P', (W, H), 0)
    pp = p_frame.load()
    for y in range(H):
        for x in range(W):
            t = pa[x, y] / 255
            if t >= 0.70:
                solid = True
            elif t <= 0.30:
                solid = False
            else:
                # bayer dither in the soft band
                solid = t * 16 > BAYER[y & 3][x & 3]
            pp[x, y] = idx[x, y] + 1 if solid else 0
    out_frames.append(p_frame)

# attach palette with reserved transparent index 0
for f in out_frames:
    f.putpalette([0, 0, 0] + palette)

out_frames[0].save(
    OUT_PATH,
    save_all=True,
    append_images=out_frames[1:],
    transparency=0,
    disposal=2,
    duration=66,   # 36 * 66ms = 2.4s
    loop=0,
    optimize=False,
)
print('frames:', len(out_frames), 'size:', out_frames[0].size)
