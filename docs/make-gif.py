#!/usr/bin/env python3
"""Regenerate docs/img/demo.{gif,png} — transparent demo media for the README.

Pipeline (deterministic, no screencast throttling):
  1. serve docs/ and screenshot the phase-frozen strip twice:
       demo.html?strip=36&bg=white   -> matte_white.png (full page)
       demo.html?strip=36&bg=black   -> matte_black.png (full page)
  2. run this script (Pillow only, stdlib):
       python3 docs/make-gif.py matte_white.png matte_black.png

Two-background alpha matting: each phase is photographed over a white and a
black backdrop, solving per pixel C = a*F + (1-a)*B in sRGB space (matching
CSS simple alpha compositing):

    a = 1 - (Cw - Cb) / 255        (white: B=255, black: B=0)
    F = Cb / a   (where a > 0)

Outputs, both looping one 6s cycle in 2.4s (36 frames x 66ms):

  demo.png  APNG, full 8-bit alpha: smooth glyph edges (no dithering) and
            the 25%-opacity blue glow survive intact. Primary README asset.
  demo.gif  GIF, binary alpha: 2x supersampling + full 2D Floyd-Steinberg
            error diffusion approximate the soft edges; the sub-threshold
            glow is dropped (1-bit alpha cannot carry it). Fallback for
            GIF-only contexts.
"""
from PIL import Image
import sys

WHITE_PATH = sys.argv[1] if len(sys.argv) > 1 else '/tmp/matte_white.png'
BLACK_PATH = sys.argv[2] if len(sys.argv) > 2 else '/tmp/matte_black.png'
OUT_DIR = 'docs/img'
WHITE = Image.open(WHITE_PATH).convert('RGB')
BLACK = Image.open(BLACK_PATH).convert('RGB')

N = 36          # phases (frames)
PITCH = 112     # strip row pitch, px in the screenshots

# ---- GIF geometry: tight glyph crop, 2x supersampled -----------------------
# ink ground truth in screenshots: x 222..400, y offset 15..43 per row
X0, W = 214, 196
DY0, H = 8, 40
SS = 2          # supersample factor: 2x2 source block -> 1 output pixel


def downsample(px, x0, y0, w, h):
        """Mean of each SSxSS block in [x0, x0+w), [y0, y0+h) - w,h in source px."""
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


# ---- shared matting for the GIF (downsampled grids) ------------------------
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


# ---- GIF assembly: FS-dithered binary alpha --------------------------------
out_frames = []
for alpha, fg in frames:
        p_frame = Image.new('P', (ow, oh), 0)
        pp = p_frame.load()
        # Full 2D Floyd-Steinberg: carry quantization error right (7/16),
        # down-left (3/16), down (5/16), down-right (1/16).
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
        f'{OUT_DIR}/demo.gif',
        save_all=True,
        append_images=out_frames[1:],
        transparency=0,
        disposal=2,
        duration=66,   # 36 * 66ms = 2.4s
        loop=0,
        optimize=False,
)
print('gif frames:', len(out_frames), 'size:', out_frames[0].size)

# ---- APNG assembly: full 8-bit alpha, glow preserved, 1:1 crop -------------
# Wider crop than the GIF: the text-shadow glow spreads ~32px (16px CSS blur
# at 2x render) beyond the ink, and 8-bit alpha can carry it. Vertical span
# stays inside the 112px row band, so neighbor rows never contaminate.
AX0, AW = 182, 260   # ink 222..400 + glow margins
ADY, AH = 0, 80      # within-band band; the glow's faint outer tail clips

apng_frames = []
for i in range(N):
        y0 = i * PITCH + ADY
        cw = WHITE.crop((AX0, y0, AX0 + AW, y0 + AH))
        cb = BLACK.crop((AX0, y0, AX0 + AW, y0 + AH))
        frame = Image.new('RGBA', (AW, AH))
        pf = frame.load()
        pw, pb = cw.load(), cb.load()
        for y in range(AH):
                for x in range(AW):
                        rw, gw, bw = pw[x, y]
                        rb, gb, bb = pb[x, y]
                        a = 1 - ((rw - rb) + (gw - gb) + (bw - bb)) / (3 * 255)
                        a = max(0.0, min(1.0, a))
                        if a < 0.015:
                                pf[x, y] = (0, 0, 0, 0)
                        else:
                                pf[x, y] = (min(255, round(rb / a)), min(255, round(gb / a)),
                                            min(255, round(bb / a)), round(a * 255))
        apng_frames.append(frame)

apng_frames[0].save(
        f'{OUT_DIR}/demo.png',
        save_all=True,
        append_images=apng_frames[1:],
        duration=66,   # 36 * 66ms = 2.4s
        loop=0,
        disposal=0,    # no inter-frame clearing — Pillow trims disposal=2
        blend=0,       # SOURCE: every frame fully replaces the canvas.
        # (disposal=2 + Pillow's dirty-rect trimming drops the phase-invariant
        # glow pixels outside each frame's changed region; ffmpeg and PIL both
        # decode the trimmed file per spec, so the glow genuinely disappears
        # on frames >= 1. SOURCE/no-disposal keeps every frame complete.)
        optimize=True,
)
print('apng frames:', len(apng_frames), 'size:', apng_frames[0].size)
