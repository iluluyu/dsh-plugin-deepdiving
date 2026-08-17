#!/usr/bin/env python3
"""Regenerate docs/img/demo.gif — transparent-background close-up loop.

Pipeline (deterministic, no screencast throttling):
  1. serve docs/ and screenshot the phase-frozen strip twice:
       demo.html?strip=36&bg=white   -> matte_white.png (full page)
       demo.html?strip=36&bg=black   -> matte_black.png (full page)
  2. run this script (Pillow only, stdlib):
       python3 docs/make-gif.py matte_white.png matte_black.png docs/img/demo.gif

Two-background alpha matting: each phase is photographed over a white and a
black backdrop, solving per pixel C = a*F + (1-a)*B:

    a = 1 - (Cw - Cb) / 255        (white: B=255, black: B=0)
    F = Cb / a   (where a > 0)

Anti-aliasing for the binary GIF alpha:
  - The strip is rendered at 2x font size, so each output pixel samples a
    2x2 block; alpha (and color) are the block means — sub-pixel coverage
    becomes smooth gray alpha before quantization.
  - Floyd-Steinberg error diffusion then thresholds that alpha: soft glyph
    edges get statistically correct dot coverage without Bayer cross-hatch,
    and the 25%-opacity glow stays below threshold (1-bit alpha cannot
    carry it — dropping it is intended).
  - Palette: one global adaptive 255-color table from the matted foreground
    of all frames; index 0 is reserved for transparency.
"""
from PIL import Image
import sys

WHITE_PATH = sys.argv[1] if len(sys.argv) > 1 else '/tmp/matte_white.png'
BLACK_PATH = sys.argv[2] if len(sys.argv) > 2 else '/tmp/matte_black.png'
OUT_PATH = sys.argv[3] if len(sys.argv) > 3 else 'docs/img/demo.gif'
WHITE = Image.open(WHITE_PATH).convert('RGB')
BLACK = Image.open(BLACK_PATH).convert('RGB')

N = 36          # phases (frames)
PITCH = 112     # strip row pitch, px in the screenshots
SS = 2          # supersample factor: 2x2 source block -> 1 output pixel
# ink ground truth in screenshots: x 222..400, y offset 15..43 per row; crop
# padded and aligned so 2x2 blocks fall on device pixels
X0, W = 214, 196
DY0, H = 8, 40


def downsample(px, x0, y0, w, h):
    """Mean of each SSxSS block in [x0, x0+w), [y0, y0+h) — w,h in source px."""
    out = []
    for yy in range(0, h, SS):
        row = []
        for xx in range(0, w, SS):
            sr = sg = sb = 0
            for dy in range(SS):
                for dx in range(SS):
                    r, g, b = px[x0 + xx + dx, y0 + yy + dy]
                    sr += r
                    sg += g
                    sb += b
            k = SS * SS
            row.append((sr / k, sg / k, sb / k))
        out.append(row)
    return out


frames = []         # (alpha float 0..1, fg RGB float) grids at output res
sample_pixels = []  # solid foreground pixels for the global palette

ow, oh = W // SS, H // SS
for i in range(N):
    y0 = i * PITCH + DY0
    cw = downsample(WHITE.load(), X0, y0, W, H)
    cb = downsample(BLACK.load(), X0, y0, W, H)
    alpha = []
    fg = []
    for yy in range(oh):
        ar, fr = [], []
        for xx in range(ow):
            rw, gw, bw = cw[yy][xx]
            rb, gb, bb = cb[yy][xx]
            a = 1 - ((rw - rb) + (gw - gb) + (bw - bb)) / (3 * 255)
            a = max(0.0, min(1.0, a))
            ar.append(a)
            if a > 0.02:
                fr.append((min(255, rb / a), min(255, gb / a), min(255, bb / a)))
            else:
                fr.append((0.0, 0.0, 0.0))
        alpha.append(ar)
        fg.append(fr)
    frames.append((alpha, fg))
    for yy in range(oh):
        for xx in range(ow):
            if alpha[yy][xx] >= 0.6:
                sample_pixels.append(tuple(int(v) for v in fg[yy][xx]))

sample = Image.new('RGB', (max(1, len(sample_pixels)), 1))
sample.putdata(sample_pixels or [(0, 0, 0)])
pal_img = sample.quantize(colors=255, method=Image.MEDIANCUT)
palette = pal_img.getpalette()[:255 * 3]
pal_rgb = [tuple(palette[k * 3:k * 3 + 3]) for k in range(255)]


def nearest_palette_index(rgb):
    """Nearest color in the global palette (palette size keeps this cheap)."""
    r, g, b = rgb
    best, bd = 0, 1 << 30
    for k, (pr, pg, pb) in enumerate(pal_rgb):
        d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2
        if d < bd:
            best, bd = k, d
    return best


out_frames = []
for alpha, fg in frames:
    p_frame = Image.new('P', (ow, oh), 0)
    pp = p_frame.load()
    # Full 2D Floyd-Steinberg: carry quantization error right (7/16),
    # down-left (3/16), down (5/16), down-right (1/16). Alpha below 0.02 has
    # no foreground to carry, so error flows around the glyph holes cleanly.
    err = [[0.0] * ow for _ in range(oh)]
    for yy in range(oh):
        for xx in range(ow):
            a = alpha[yy][xx] + err[yy][xx]
            a = max(0.0, min(1.0, a))
            solid = a > 0.5
            carry = a - (1.0 if solid else 0.0)
            if xx + 1 < ow:
                err[yy][xx + 1] += carry * 7 / 16
            if yy + 1 < oh:
                if xx > 0:
                    err[yy + 1][xx - 1] += carry * 3 / 16
                err[yy + 1][xx] += carry * 5 / 16
                if xx + 1 < ow:
                    err[yy + 1][xx + 1] += carry * 1 / 16
            pp[xx, yy] = (nearest_palette_index(tuple(int(v) for v in fg[yy][xx])) + 1) if solid else 0
    out_frames.append(p_frame)

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
