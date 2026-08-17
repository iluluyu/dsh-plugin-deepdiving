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
 *   layer 1 (top)    sparkle   linear-gradient(90deg)   size 125%  5 tiles / 4s
 *   layer 2          current   linear-gradient(100deg)  size 200%  3 tiles / 4s
 *   layer 3 (base)   undulate  linear-gradient(90deg)   size 150%  2 tiles / 4s
 *
 * Every layer's gradient is periodic (first stop == last stop) and every
 * layer travels an exact integer number of tiles per cycle, so the loop is
 * seamless at ANY duration (all layers share one --dv-dur). Percentage
 * background-position shifts one full tile at p = 100·k·S/(S−1) for size S
 * and k tiles; 125%→2500%, 200%→600% (k=5,3), 150%→600% (k=2). Position
 * percentages DECREASE so the water flows left→right, matching the stock
 * sweep's direction and the reading direction.
 *
 * The override targets [role="status"][class$="_turnStatus"], matching the
 * CSS-module hashed class ("Md3f7G_turnStatus" in 0.1.0-rc.6, hash-stable
 * prefix irrelevant) with specificity (0,2,0) over the module class (0,1,0),
 * so injection order never matters; a plain .turnStatus fallback covers any
 * future unhashed build. Colors resolve from the host's --dsw-static-deepseek
 * tokens with official values as fallbacks; body[data-ds-dark-theme] (the
 * ThemePresenter signal) brightens the two darkest stops for dark surfaces.
 *
 * Preferences card (Settings → Plugins → Plugin configuration): a visual
 * replica of the shipped PluginCard chrome — same tokens, same fold-out
 * layout, same select-pill and switch idioms — holding two fields:
 *
 *   speed mode   constant | follow — in follow mode a MutationObserver over
 *               the conversation flow's stable [data-conversation-scroll]
 *               attribute counts streamed characters (reasoning + assistant
 *               text both update it while a turn runs), an exponential
 *               moving average maps that presentation-level token pace onto
 *               --dv-dur from 12s (still water) down to 2.5s (rapids). This
 *               stays decoupled from internal store APIs, exactly the DOM
 *               discovery strategy the outline plugin uses.
 *   force flow   keep animating under prefers-reduced-motion (default ON).
 *
 * Both apply live and persist per browser via localStorage — the host's
 * api-proxy serves settings namespaces to the Web client from a hard-coded
 * allowlist (see lib/index.js), so a third-party section cannot cross that
 * boundary yet, and reduced-motion is itself a per-browser signal, making a
 * per-browser preference the consistent scope. Copy is bilingual (zh/en)
 * through the locale service's active snapshot.
 */
window.__ModuleLoader__.load({
	id: "dsh-plugin-deepdiving",
	factory: (require) => {
		const React = require("react");
		const h = React.createElement;
		const { Menu } = require("@deepseek-ai/dsh-client-ui-primitives");

		const LS_FLOW = "dsh-deepdiving:force-flow";
		const LS_SPEED = "dsh-deepdiving:speed-mode";

		function readForceFlow() {
			try { return window.localStorage.getItem(LS_FLOW) !== "0"; } catch { return true; }
		}
		function readSpeedMode() {
			try { const v = window.localStorage.getItem(LS_SPEED); return v === "follow" ? "follow" : "constant"; } catch { return "constant"; }
		}
		function write(key, value) {
			try { window.localStorage.setItem(key, value); } catch { /* storage blocked: in-memory only */ }
		}

		function projectForceFlow() {
			if (readForceFlow()) document.body.setAttribute("data-dv-flow", "");
			else document.body.removeAttribute("data-dv-flow");
		}

		/* Bilingual copy, selected off the locale service's active id. Kept
		 * terse — one line per role, the settings-section house style. */
		const COPY = {
			zh: {
				title: "Deep diving",
				description: "“Deep diving…” 状态条的流光动画。",
				expand: "展开", collapse: "收起",
				speedLabel: "流动速度",
				speedHint: "跟随模式下，输出越快流光越快。",
				speedConstant: "恒定（4 秒）",
				speedFollow: "跟随生成速度",
				forceLabel: "减弱动态时仍流动",
				forceHint: "忽略浏览器的减弱动态请求。",
			},
			en: {
				title: "Deep diving",
				description: "The flowing light on the “Deep diving…” status line.",
				expand: "Expand", collapse: "Collapse",
				speedLabel: "Flow speed",
				speedHint: "Follow mode: the light speeds up with output.",
				speedConstant: "Constant (4s)",
				speedFollow: "Follow generation speed",
				forceLabel: "Flow under reduced motion",
				forceHint: "Ignore the browser's reduced-motion request.",
			},
		};
		function copyFor(active) { return COPY[active === "en" ? "en" : "zh"]; }

		const CSS = `
		/* Palette: official DeepSeek static tokens, resolved live with fallbacks. */
		:root {
			--dv-d500: var(--dsw-static-deepseek-500, rgb(65 118 230));
			--dv-d450: var(--dsw-static-deepseek-450, rgb(86 134 254));
			--dv-d400: var(--dsw-static-deepseek-400, rgb(103 158 254));
			--dv-d300: var(--dsw-static-deepseek-300, rgb(183 200 254));
			--dv-d200: var(--dsw-static-deepseek-200, rgb(211 226 255));
		}
		/* Dark theme: lift the two darkest stops so the river bed stays
		 * visible on dark surfaces (same signal the host ThemePresenter writes;
		 * the card chrome below reads host tokens directly, so it re-themes
		 * itself without plugin-side rules). */
		body[data-ds-dark-theme], :root[data-ds-dark-theme] {
			--dv-d500: var(--dsw-static-deepseek-450, rgb(86 134 254));
			--dv-d450: var(--dsw-static-deepseek-400, rgb(103 158 254));
		}

		[role="status"][class$="_turnStatus"],
		[role="status"].turnStatus {
			/* Repaint containment: the animated gradients repaint this row only,
			 * never the wider layout. Size is fixed (26px inline-flex row). */
			contain: layout paint;
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
			text-shadow: var(--dv-glow, 0 0 12px rgb(103 158 254 / 0.25));
			/* all layers flow left->right at parallax speeds, seamlessly */
			animation: dv-deepdiving-flow var(--dv-dur, 4s) linear infinite;
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
			/* Accessibility hold: without the force-flow opt-in the currents
			 * stand still (the gradient stays). forceFlow defaults ON — flip
			 * it in Settings, Plugins, Plugin configuration. */
			body:not([data-dv-flow]) [role="status"][class$="_turnStatus"],
			body:not([data-dv-flow]) [role="status"].turnStatus {
				animation: none;
				background-position: 0 0, 0 0, 0 0;
				text-shadow: none;
			}
		}

		/* Settings card: a token-faithful replica of the shipped PluginCard
		 * chrome. Every color/spacing reads a --dsw-alias token, so light/dark
		 * re-theming is the host's job — no [data-ds-dark-theme] rules needed
		 * here. Only the two literals below (switch track + knob) have no
		 * matching public token; they get explicit dark companions. */
		.dv-card {
			list-style: none;
			border: 1px solid var(--dsw-alias-border-l2);
			border-radius: 12px;
			background: var(--dsw-alias-bg-layer-3);
			transition: border-color .16s, background .16s;
		}
		.dv-card:hover { border-color: var(--dsw-alias-label-dimmed); }
		.dv-card.dv-open {
			background: var(--dsw-alias-bg-layer-2);
			border-color: var(--dsw-alias-label-dimmed);
		}
		.dv-header {
			width: 100%; appearance: none; border: 0; background: none;
			font: inherit; color: inherit; text-align: left; cursor: pointer;
			display: flex; align-items: center; gap: 12px;
			padding: 14px 16px; border-radius: 12px;
		}
		.dv-header:focus-visible {
			outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px;
		}
		.dv-headText {
			flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px;
		}
		.dv-name {
			font-size: 15px; font-weight: 600; line-height: 1.4;
			color: var(--dsw-alias-label-primary);
		}
		.dv-description {
			font-size: 13px; line-height: 1.5; color: var(--dsw-alias-label-tertiary);
		}
		.dv-chevron {
			flex: none; color: var(--dsw-alias-label-tertiary); transition: transform .16s;
		}
		.dv-chevron.dv-chevronOpen { transform: rotate(180deg); }
		.dv-body {
			border-top: 1px solid var(--dsw-alias-border-l2);
			margin: 0 16px; padding-bottom: 8px;
		}
		.dv-field {
			display: flex; flex-direction: column; gap: 6px; padding: 12px 0;
		}
		.dv-field + .dv-field { border-top: 1px solid var(--dsw-alias-border-l2); }
		.dv-fieldHead { display: flex; align-items: center; gap: 8px; }
		.dv-label {
			flex: 1; min-width: 0; font-size: 13px; font-weight: 500; line-height: 1.5;
			color: var(--dsw-alias-label-primary);
		}
		.dv-hint {
			margin: 0; font-size: 12px; line-height: 1.5;
			color: var(--dsw-alias-label-tertiary);
		}
		/* Selector pill (figma 'Setting-Cell' selector: h36 r18 platform fill). */
		.dv-select {
			display: inline-flex; align-items: center; align-self: flex-start;
			height: 36px; padding: 0 14px; border: none; border-radius: 18px;
			background: var(--dsw-alias-bg-module-platform);
			font: inherit; font-size: 14px; line-height: 22px;
			color: var(--dsw-alias-label-primary); cursor: pointer;
		}
		.dv-select:focus-visible {
			outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px;
		}
		/* Switch row (label + pill on one line, hint under). */
		.dv-switchRow {
			display: flex; align-items: center; gap: 8px;
		}
		.dv-switch {
			flex: none; width: 36px; height: 20px; border-radius: 10px;
			border: none; cursor: pointer; position: relative;
			background: var(--dsw-alias-fill-tertiary, #e3e4e6);
			transition: background .2s;
		}
		body[data-ds-dark-theme] .dv-switch {
			background: var(--dsw-alias-fill-tertiary, rgb(72 74 79));
		}
		.dv-switch::after {
			content: ""; position: absolute; top: 2px; left: 2px;
			width: 16px; height: 16px; border-radius: 50%;
			background: #fff; transition: left .2s;
			box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
		}
		body[data-ds-dark-theme] .dv-switch::after {
			background: rgb(233 234 236);
			box-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
		}
		.dv-switch[aria-checked="true"] {
			background: var(--dsw-static-deepseek-500, rgb(65 118 230));
		}
		.dv-switch[aria-checked="true"]::after { left: 18px; }
		.dv-switch:focus-visible {
			outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px;
		}
		`;

		/* Chevron replica: the shipped IconChevronDownOutline14's 14px outline
		 * chevron, inlined so the plugin owns every byte it injects. */
		function Chevron({ open }) {
			return h("svg", {
				className: "dv-chevron" + (open ? " dv-chevronOpen" : ""),
				width: 14, height: 14, viewBox: "0 0 14 14", fill: "none",
				"aria-hidden": true,
			},
				h("path", {
					d: "M3.5 5.25L7 8.75L10.5 5.25",
					stroke: "currentColor", "stroke-width": 1.2,
					"stroke-linecap": "round", "stroke-linejoin": "round",
				}),
			);
		}

		/** The preferences card: fold-out chrome + speed-mode select + force switch.
		 * @param props - carries the live locale copy as props.copy. */
		function DeepdivingCard({ copy }) {
			const { useState } = React;
			const t = (key) => copy[key];
			const [open, setOpen] = useState(false);
			const [menuOpen, setMenuOpen] = useState(false);
			const [speed, setSpeed] = useState(readSpeedMode);
			const [force, setForce] = useState(readForceFlow);
			const onSpeed = (id) => {
				const mode = id === "follow" ? "follow" : "constant";
				setSpeed(mode); setMenuOpen(false); write(LS_SPEED, mode);
				window.dispatchEvent(new CustomEvent("dsh-deepdiving:prefs", { detail: { speedMode: mode } }));
			};
			const onForce = () => {
				const next = !force;
				setForce(next); write(LS_FLOW, next ? "1" : "0"); projectForceFlow();
			};
			return h("li", { className: "dv-card" + (open ? " dv-open" : "") },
				h("button", {
					type: "button", className: "dv-header", "aria-expanded": open,
					"aria-label": `${t(open ? "expand" : "collapse")}: ${t("title")}`,
					onClick: () => { setOpen(!open); },
				},
					h("span", { className: "dv-headText" },
						h("span", { className: "dv-name" }, t("title")),
						h("span", { className: "dv-description" }, t("description")),
					),
					h(Chevron, { open }),
				),
				open ? h("div", { className: "dv-body" },
					h("div", { className: "dv-field" },
						h("div", { className: "dv-fieldHead" },
							h("label", { className: "dv-label", htmlFor: "dv-speed" }, t("speedLabel")),
						),
						/* Official Menu dropdown (the same primitive the Language row
						 * uses): themed rows, selected check, keyboard and outside-click
						 * close — instead of a native select whose OS-styled popup
						 * ignores the app theme. */
						h(Menu, {
							open: menuOpen,
							onClose: () => { setMenuOpen(false); },
							items: [
								{ id: "constant", label: t("speedConstant") },
								{ id: "follow", label: t("speedFollow") },
							],
							selectedId: speed,
							onSelect: onSpeed,
							align: "start",
							anchor: h("button", {
								type: "button", id: "dv-speed", className: "dv-select",
								"aria-haspopup": "menu", "aria-expanded": menuOpen,
								onClick: () => { setMenuOpen(!menuOpen); },
							},
								speed === "follow" ? t("speedFollow") : t("speedConstant"),
								h(Chevron, { open: menuOpen }),
							),
						}),
						h("p", { className: "dv-hint" }, t("speedHint")),
					),
					h("div", { className: "dv-field" },
						h("div", { className: "dv-switchRow" },
							h("span", { className: "dv-label", id: "dv-force-label" }, t("forceLabel")),
							h("button", {
								type: "button", className: "dv-switch", role: "switch",
								"aria-checked": String(force), "aria-labelledby": "dv-force-label",
								onClick: onForce,
							}),
						),
						h("p", { className: "dv-hint" }, t("forceHint")),
					),
				) : null,
			);
		}

		/**
		 * Follow-mode pace sampler. Watches the conversation flow (the DOM
		 * container dsh marks [data-conversation-scroll]; reasoning and
		 * assistant streams both append there while a turn runs), converts a
		 * sliding character count into a smoothed chars/s, and maps that onto
		 * --dv-dur: 0 → 12s (still water), ≥250 cps → 2.5s (rapids). Updates
		 * are throttled to whole seconds of duration so the running animation
		 * is not re-timed mid-cycle by noise.
		 */
		function PaceSampler() {
			let observer = null;
			let ticker = null;
			let chars = 0;
			let rate = 0; // EMA of chars/s
			let lastDur = 0;
			const countText = (nodes) => {
				let n = 0;
				for (const node of nodes) {
					if (node.nodeType === Node.TEXT_NODE) n += Math.max(0, node.textContent.length);
					else if (node.nodeType === Node.ELEMENT_NODE) n += node.textContent.length;
				}
				return n;
			};
			const onMutate = (records) => {
				for (const r of records) {
					chars += countText(r.addedNodes);
					if (r.type === "characterData" && r.oldValue !== null) {
						chars += Math.max(0, r.target.textContent.length - r.oldValue.length);
					}
				}
			};
			const tick = () => {
				const cps = chars * 2; // 500ms window -> per second
				chars = 0;
				rate = rate === 0 ? cps : rate * 0.7 + cps * 0.3;
				// Linear map: 0 cps -> 12s, >=250 cps -> 4s. The ceiling equals
				// the constant default, which itself matches chat.deepseek.com's
				// shimmer at its mid sweep speed (~1.5 text widths/s) — the
				// water never races past the official cadence.
				const dur = Math.round((12 - Math.min(rate / 250, 1) * 8) * 2) / 2;
				if (dur !== lastDur) {
					lastDur = dur;
					document.documentElement.style.setProperty("--dv-dur", `${dur}s`);
				}
			};
			this.start = () => {
				this.stop();
				const host = document.querySelector("[data-conversation-scroll]");
				if (host !== null) {
					observer = new MutationObserver(onMutate);
					observer.observe(host, {
						childList: true, subtree: true, characterData: true, characterDataOldValue: true,
					});
				}
				ticker = setInterval(tick, 500);
				tick();
			};
			this.stop = () => {
				if (observer !== null) { observer.disconnect(); observer = null; }
				if (ticker !== null) { clearInterval(ticker); ticker = null; }
				chars = 0; rate = 0;
				document.documentElement.style.removeProperty("--dv-dur");
			};
		}

		/** Services required: the slot registry (runtime) for the settings card. */
		const inject = ["slots"];

		/**
		 * Inject the stylesheet, project preferences, register the settings
		 * card, and own the follow-mode sampler. ctx.effect runs the body
		 * immediately and adopts its return as the unload disposer.
		 * @param ctx - client root context.
		 */
		function apply(ctx) {
			ctx.effect(() => {
				const st = document.createElement("style");
				st.textContent = CSS;
				document.head.appendChild(st);
				projectForceFlow();

				const sampler = new PaceSampler();
				const syncSampler = () => { if (readSpeedMode() === "follow") sampler.start(); else sampler.stop(); };
				const onPrefs = () => syncSampler();
				window.addEventListener("dsh-deepdiving:prefs", onPrefs);
				syncSampler();

				return () => {
					window.removeEventListener("dsh-deepdiving:prefs", onPrefs);
					sampler.stop();
					st.remove();
					document.body.removeAttribute("data-dv-flow");
				};
			}, "deepdiving: style + pace sampler");

			ctx.effect(() => {
				const locale = ctx.get("locale");
				let copy = copyFor(locale === undefined ? "zh" : locale.getSnapshot().active);
				let disposer = null;
				if (locale !== undefined) {
					disposer = locale.subscribe(() => {
						copy = copyFor(locale.getSnapshot().active);
						notify();
					});
				}
				const notify = () => bump((n) => n + 1);
				let n = 0;
				const bump = (fn) => { n = fn(n); rerender(); };
				let listeners = new Set();
				const rerender = () => { for (const l of listeners) l(); };
				// A tiny external-store bridge so the card re-renders on locale flips.
				const subscribe = (l) => {
					listeners.add(l);
					return () => { listeners.delete(l); };
				};
				const getCopy = () => copy;
				const card = () => h(LocaleBridge, { subscribe, getCopy });
				function LocaleBridge({ subscribe: sub, getCopy: gc }) {
					const { useSyncExternalStore } = React;
					const c = useSyncExternalStore(sub, gc);
					return h(DeepdivingCard, { copy: c });
				}
				const unregister = ctx.slots.register({ name: "settings.plugin.item", id: "deepdiving", order: 100 }, card);
				return () => { if (disposer !== null) disposer(); unregister(); };
			}, "deepdiving: settings card");
		}

		return { inject, apply };
	},
});
