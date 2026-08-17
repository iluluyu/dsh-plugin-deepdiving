/**
 * dsh-plugin-deepdiving — browser half (zero-build: hand-maintained source AND
 * shipped artifact, in the window.__ModuleLoader__ handoff format).
 *
 * Replaces the stock single-band shimmer on the running-turn status text
 * ("Deep diving…") with a continuous water-flow of light: three parallax
 * gradient currents sweep the glyphs left-to-right like water — a broad slow
 * color undulation as the river bed, medium highlight waves over it, and
 * fast narrow sparkle streaks on the surface. Because the base layer is a
 * periodic gradient, the text is always in motion (the stock effect is a flat
 * color most of its 1.8s cycle with one pale band sweeping through).
 *
 * Mechanics, all pure CSS layered on background-clip: text (already set by
 * ui-conversation's own rules):
 *
 *   layer 1 (top)    sparkle   linear-gradient(90deg)   size 125%  5 tiles / 6s
 *   layer 2          current   linear-gradient(100deg)  size 200%  3 tiles / 6s
 *   layer 3 (base)   undulate  linear-gradient(90deg)   size 150%  2 tiles / 6s
 *
 * Every layer's gradient is periodic (first stop == last stop) and every
 * layer travels an exact integer number of tiles per cycle, so the loop is
 * seamless. Percentage background-position shifts one full tile at
 * p = 100·k·S/(S−1) for size S and k tiles; 125%→2500%, 200%→600% (k=5,3),
 * 150%→600% (k=2). Position percentages DECREASE so the water flows
 * left→right, matching the stock sweep's direction and the reading direction.
 *
 * The override targets [role="status"][class$="_turnStatus"], matching the
 * CSS-module hashed class ("Md3f7G_turnStatus" in 0.1.0-rc.6, hash-stable
 * prefix irrelevant) with specificity (0,2,0) over the module class (0,1,0),
 * so injection order never matters; a plain .turnStatus fallback covers any
 * future unhashed build. Colors resolve from the host's --dsw-static-deepseek
 * tokens with official values as fallbacks; body[data-ds-dark-theme] (the
 * ThemePresenter signal) brightens the two darkest stops for dark surfaces.
 * prefers-reduced-motion keeps a static, still-colorful gradient. Tunables:
 * --dv-dur (default 6s) and --dv-glow (default a soft blue aura, none to kill).
 */
window.__ModuleLoader__.load({
	id: "dsh-plugin-deepdiving",
	factory: () => {
		const CSS = `
		/* Palette: official DeepSeek static tokens, resolved live with fallbacks. */
		:root {
			--dv-d500: var(--dsw-static-deepseek-500, rgb(65 118 230));
			--dv-d450: var(--dsw-static-deepseek-450, rgb(86 134 254));
			--dv-d400: var(--dsw-static-deepseek-400, rgb(103 158 254));
			--dv-d300: var(--dsw-static-deepseek-300, rgb(183 200 254));
			--dv-d200: var(--dsw-static-deepseek-200, rgb(211 226 255));
		}
		/* Dark theme: lift the two darkest stops so the river bed stays visible. */
		body[data-ds-dark-theme], :root[data-ds-dark-theme] {
			--dv-d500: var(--dsw-static-deepseek-450, rgb(86 134 254));
			--dv-d450: var(--dsw-static-deepseek-400, rgb(103 158 254));
		}

		[role="status"][class$="_turnStatus"],
		[role="status"].turnStatus {
			background-image:
				/* surface sparkle: one narrow bright streak per 1.25w tile */
				linear-gradient(90deg,
					transparent 0%, transparent 28%,
					var(--dv-d200) 36%,
					transparent 44%, transparent 100%),
				/* mid current: two slanted highlight crests per 2w tile */
				linear-gradient(100deg,
					transparent 0%, transparent 14%,
					var(--dv-d300) 26%,
					transparent 40%,
					transparent 58%,
					var(--dv-d300) 74%,
					transparent 88%, transparent 100%),
				/* base river bed: broad periodic color undulation, never flat */
				linear-gradient(90deg,
					var(--dv-d500) 0%,
					var(--dv-d450) 12%,
					var(--dv-d500) 28%,
					var(--dv-d400) 45%,
					var(--dv-d500) 62%,
					var(--dv-d450) 78%,
					var(--dv-d500) 90%,
					var(--dv-d500) 100%);
			background-size: 125% 100%, 200% 100%, 150% 100%;
			background-position: 0 0, 0 0, 0 0;
			/* soft aura behind the glyphs; --dv-glow: none turns it off */
			text-shadow: var(--dv-glow, 0 0 16px rgb(103 158 254 / 0.25));
			/* all layers flow left->right at parallax speeds, seamlessly */
			animation: dv-deepdiving-flow var(--dv-dur, 6s) linear infinite;
		}
		/* the elapsed clock keeps its own caption fill; no inherited aura */
		[role="status"][class$="_turnStatus"] [class$="_turnStatusClock"] {
			text-shadow: none;
		}

		@keyframes dv-deepdiving-flow {
			from { background-position: 2500% 0, 600% 0, 600% 0; }
			to   { background-position: 0 0, 0 0, 0 0; }
		}

		@media (prefers-reduced-motion: reduce) {
			/* Accessibility default: honor the OS signal and hold the currents
			 * still (the gradient stays — only motion stops). Opt back in per
			 * profile with: localStorage['dsh-deepdiving:flow'] = '1' (see apply). */
			body:not([data-dv-flow]) [role="status"][class$="_turnStatus"],
			body:not([data-dv-flow]) [role="status"].turnStatus {
				animation: none;
				background-position: 0 0, 0 0, 0 0;
				text-shadow: none;
			}
		}
		`;

		/** Inject the stylesheet once. ctx.effect runs the body immediately and
		 * adopts its return as the unload disposer — the outline plugin's exact
		 * pattern (register now, return the cleanup). Also honors the explicit
		 * motion opt-in: reduced-motion users who still want the flow set
		 * localStorage['dsh-deepdiving:flow'] = '1' and reload.
		 * @param ctx - client root context. */
		function apply(ctx) {
			ctx.effect(() => {
				const st = document.createElement("style");
				st.textContent = CSS;
				document.head.appendChild(st);
				try {
					if (window.localStorage.getItem("dsh-deepdiving:flow") === "1") {
						document.body.setAttribute("data-dv-flow", "");
					}
				} catch { /* storage unavailable: a11y default stands */ }
				return () => st.remove();
			}, "deepdiving: style cleanup");
		}

		return { apply };
	},
});
