# dsh-plugin-deepdiving

Continuous water-flow light for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh) web "Deep diving…" turn status.

为 dsh web 端的 "Deep diving…" 运行状态条提供连续流动的水流光影。

---

## Why

The stock effect is a single pale band sweeping a flat-blue text every 1.8s — between sweeps the label is static, so the water stops. This plugin keeps the glyphs under a permanent current: three parallax gradient layers flow left→right like a river — a broad slow color undulation as the bed, medium highlight waves over it, and fast narrow sparkle streaks on the surface.

原版效果是一条淡色光带每 1.8s 扫过一次静态蓝字——两次扫过之间文字是静止的，"水"会停下来。本插件让文字永远处于水流之中：三层视差渐变从左向右流动——底层是宽幅缓慢的色浪河床，中层是斜切高光波浪，表层是快速掠过的窄亮流光。

| Stock 原版 | Deepdiving 本插件 |
|:---:|:---:|
| single band, mostly flat | three parallax currents, never stops |

Close-up — the water-flow on "Deep diving…", one complete 6s cycle compressed to 2.4s. APNG with full 8-bit alpha: transparent background (reads correctly on light and dark GitHub themes), smooth glyph edges, and the 25%-opacity glow intact. A 1-bit-alpha `demo.gif` sits alongside for GIF-only consumers. Full stock-vs-flow comparison with a live theme toggle in the [standalone demo](docs/demo.html):

![water-flow close-up](docs/img/demo.png)

Verified live on dsh `0.1.0-rc.6` (stock hashed class `Md3f7G_turnStatus`, GLM turn running): the plugin's animation, layers, and dark-theme brightening all resolve on the real element. 已在 dsh `0.1.0-rc.6` 真实会话中验证（原版哈希类名、GLM 思考中）：动画、分层、暗色提亮均在真实元素上生效。

## Install

```sh
dsh plugin --profile web add dsh-plugin-deepdiving
# or: dsh plugin --profile web add github:iluluyu/dsh-plugin-deepdiving
```

Restart `dsh web` and reload. Uninstall: `dsh plugin --profile web remove dsh-plugin-deepdiving`.

重启 `dsh web` 并刷新浏览器即可。卸载：`dsh plugin --profile web remove dsh-plugin-deepdiving`。

## Design

- **Pure CSS**, no JS animation loop; layered on the `background-clip: text` the stock rule already sets.
- Every gradient is periodic and every layer travels an exact integer number of tiles per cycle → **seamless loop** (6s default).
- Selector `[role="status"][class$="_turnStatus"]` beats the CSS-module hashed class (e.g. `Md3f7G_turnStatus`) in specificity and tolerates hash changes between builds.
- Colors resolve from the host's `--dsw-static-deepseek-*` tokens with official fallbacks; `body[data-ds-dark-theme]` (the ThemePresenter signal) brightens the river bed for dark surfaces.
- `prefers-reduced-motion` → static, still-colorful gradient.

纯 CSS 实现，直接叠在官方已设置的 `background-clip: text` 上；每层渐变均为周期函数且每循环位移整数个 tile，无缝循环；选择器特异性高于 CSS module 哈希类且容忍构建哈希变化；颜色实时读取宿主官方 token；暗色主题与减少动态效果均已适配。

### Reduced motion

`prefers-reduced-motion: reduce` (Windows: Settings → Accessibility → Visual effects → Animation effects off; macOS: Reduce motion) holds the currents still by default — the same guard the stock dsh shimmer has. To keep the flow flowing regardless, opt in once per profile and reload:

```js
localStorage['dsh-deepdiving:flow'] = '1'   // F12 console on the dsh page
```

`0` or removing the key restores the accessible default.

### Tunables

| Variable | Default | Meaning |
|:---|:---|:---|
| `--dv-dur` | `6s` | loop length |
| `--dv-glow` | `0 0 16px rgb(103 158 254 / 0.25)` | aura behind glyphs; `none` to disable |

```css
:root { --dv-dur: 4s; --dv-glow: none; }  /* faster, no aura */
```

## Demo

Open [`docs/demo.html`](docs/demo.html) directly in a browser — a standalone comparison page (light/dark, stock vs flow), no dsh required. `?strip=36&bg=white|black` renders phase-frozen filmstrips; [`docs/make-gif.py`](docs/make-gif.py) mates the two backdrops into the transparent GIF (two-background alpha recovery, since GIF alpha is 1-bit).

浏览器直接打开 [`docs/demo.html`](docs/demo.html) 即可查看对比演示（明暗主题 × 原版/流动），无需运行 dsh。

## Development

Zero-build: `lib/client.js` is hand-maintained source AND the shipped artifact, in the `window.__ModuleLoader__` handoff format (see the [outline plugin](https://github.com/iluluyu/dsh-plugin-outline) for the same skeleton). `npm run check` syntax-checks; `npm publish` ships.

```sh
git clone https://github.com/iluluyu/dsh-plugin-deepdiving
npm run check
```

MIT © iluluyu
