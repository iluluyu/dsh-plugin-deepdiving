/**
 * dsh-ui-deepdiving — browser half (zero-build: hand-maintained source AND
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
 * Since 0.4 preferences persist in the host's settings document through the
 * official plugin-settings path (docs/cookbook/adding-a-settings-card.md):
 * the Host half (lib/index.js) registers the `deepdiving` namespace, this
 * half binds a settingsScope on it (revision-fenced reads/writes over
 * settings.describe/mutate), and the card claims its keyed slot under
 * settings.plugin.item — the configurable tab pairs the two halves by
 * namespace. The pre-0.4 localStorage keys are migrated once, then dropped;
 * they remain a read-only fallback while the namespace is unserved. Copy is
 * bilingual (zh/en) through the locale service's active snapshot.
 */
window.__ModuleLoader__.load({
	id: "dsh-ui-deepdiving",
	factory: (require) => {
		const React = require("react");
		const h = React.createElement;
		const { Menu, Pill } = require("@deepseek-ai/dsh-client-ui-primitives");

		const LS_FLOW = "dsh-deepdiving:force-flow";
		const LS_SPEED = "dsh-deepdiving:speed-mode";
		const LS_MULT = "dsh-deepdiving:constant-mult";
		/** Speed semantics: 1x = the official chat.deepseek.com shimmer
		 * cadence (a 4s cycle here — the constant mode's base). A multiplier
		 * k maps to duration 4/k seconds; the scale's steps are 0.5x each. */
		const MULTS = [0.5, 1, 1.5, 2, 2.5, 3];
		const BASE_S = 4;
		/** Namespace defaults — mirror of the Host-half schema (lib/index.js):
		 * speedMode constant, mult 1, forceFlow ON. */
		const DEFAULTS = { speedMode: "follow", mult: 1, forceFlow: true };

		/* Legacy localStorage readers — read-only fallback while the settings
		 * namespace is unserved (loading) or unavailable, and the source of the
		 * one-shot migration once it is. */
		function readForceFlow() {
			try { return window.localStorage.getItem(LS_FLOW) !== "0"; } catch { return DEFAULTS.forceFlow; }
		}
		function readSpeedMode() {
			try {
				const v = window.localStorage.getItem(LS_SPEED);
				if (v === "constant" || v === "follow") return v;
				return DEFAULTS.speedMode;
			} catch { return DEFAULTS.speedMode; }
		}
		function readMult() {
			try {
				const v = Number(window.localStorage.getItem(LS_MULT));
				return MULTS.includes(v) ? v : DEFAULTS.mult;
			} catch { return DEFAULTS.mult; }
		}
		function clearLegacy() {
			try {
				window.localStorage.removeItem(LS_SPEED);
				window.localStorage.removeItem(LS_MULT);
				window.localStorage.removeItem(LS_FLOW);
			} catch { /* storage blocked: the keys are inert */ }
		}

		/** Current prefs: the namespace's resolved value once served, with the
		 * legacy localStorage keys as the pre-Host fallback. Shared by the
		 * runtime reapply and the card render. */
		function prefsFrom(snap) {
			if (snap !== undefined && snap.status === "ready"
				&& typeof snap.value === "object" && snap.value !== null) {
				const v = snap.value;
				return {
					speedMode: v.speedMode === "follow" ? "follow" : "constant",
					mult: MULTS.includes(v.mult) ? v.mult : DEFAULTS.mult,
					forceFlow: typeof v.forceFlow === "boolean" ? v.forceFlow : DEFAULTS.forceFlow,
				};
			}
			return { speedMode: readSpeedMode(), mult: readMult(), forceFlow: readForceFlow() };
		}

		/* Bilingual copy, selected off the locale service's active id. Kept
		 * terse — one line per role, the settings-section house style. */
		const COPY = {
			zh: {
				title: "Deep diving",
				description: "“Deep diving…” 状态条的流光动画。",
				expand: "展开", collapse: "收起",
				speedLabel: "流动速度",
				speedConstant: "恒定",
				speedFollow: "跟随生成速度",
				multLabel: "速度倍速",
				forceLabel: "减弱动态时仍流动",
				forceHint: "忽略浏览器的减弱动态请求。",
				modified: "已自定义",
				reset: "恢复默认",
				unavailable: "设置服务不可用，暂时只读。",
			},
			en: {
				title: "Deep diving",
				description: "The flowing light on the “Deep diving…” status line.",
				expand: "Expand", collapse: "Collapse",
				speedLabel: "Flow speed",
				speedConstant: "Constant",
				speedFollow: "Follow generation speed",
				multLabel: "Speed",
				forceLabel: "Flow under reduced motion",
				forceHint: "Ignore the browser's reduced-motion request.",
				modified: "Customized",
				reset: "Reset to defaults",
				unavailable: "Settings service unavailable — read-only for now.",
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
			animation: dv-deepdiving-flow var(--dv-dur, 4s) linear infinite; /* 4s = 1x base */
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
		/* "Customized" badge: appears in the header once the user layer has
		 * any of our keys; a reset clears it. */
		.dv-badge {
			flex: none; font-size: 11px; line-height: 1;
			padding: 4px 8px; border-radius: 999px;
			color: var(--dsw-alias-label-tertiary);
			background: var(--dsw-alias-bg-module-platform);
		}
		/* Reset-to-defaults row: quiet text button in brand color. */
		.dv-reset {
			appearance: none; border: 0; background: none; font: inherit;
			font-size: 13px; line-height: 1.5; padding: 0;
			align-self: flex-start; cursor: pointer;
			color: var(--dsw-alias-brand-primary);
		}
		.dv-reset:focus-visible {
			outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px;
		}
		.dv-select:disabled, .dv-switch:disabled { opacity: .5; cursor: default; }
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
		/* Segmented speed scale: the official Pill idiom (view-switcher tabs)
		 * laid out one per row-width cell — fills the field width evenly. */
		.dv-scale {
			display: flex; gap: 6px; width: 100%;
		}
		.dv-scale > * {
			flex: 1; justify-content: center;
			height: 28px; border-radius: 14px;
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

		/** The speed scale: official Pill chips (view-switcher idiom), one
		 * per cell, laid out edge to edge across the field width. Labels
		 * carry the multiplier; 3x left, 0.5x right.
		 * @param props - value (multiplier), ticks (label pairs), onChange.
		 */
		function SpeedScale({ value, ticks, onChange }) {
			return h("div", { className: "dv-scale", role: "group" },
				ticks.map(([mult, label]) =>
					h(Pill, {
						key: String(mult), active: mult === value,
						onClick: () => { onChange(mult); },
						"aria-pressed": mult === value,
						"aria-label": String(label) + "x",
					}, String(label) + "\u00d7"),
				),
			);
		}

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

		/** The preferences card: fold-out chrome + speed-mode select + force
		 * switch. Preference state is the settingsScope snapshot (the host
		 * namespace the Host half registers); writes are revision-fenced
		 * scope.set/unset calls, so the card holds no preference state of its
		 * own — only the fold-out and menu-open flags are local.
		 * @param props - the live locale copy and the bound settings scope. */
		function DeepdivingCard({ copy, scope }) {
			const { useState, useSyncExternalStore } = React;
			const t = (key) => copy[key];
			const [open, setOpen] = useState(false);
			const [menuOpen, setMenuOpen] = useState(false);
			const snap = useSyncExternalStore(
				(listener) => scope.subscribe(listener),
				() => scope.getSnapshot(),
			);
			const ready = snap.status === "ready";
			const writable = ready && snap.writable !== false;
			const overridden = ready && snap.user !== undefined
				&& ["speedMode", "mult", "forceFlow"].some((k) => k in snap.user);
			const p = prefsFrom(snap);
			const speed = p.speedMode, mult = p.mult, force = p.forceFlow;
			/* Tick labels fast-to-slow: 3x .. 0.5x. */
			const TICKS = MULTS.map(m => [m, String(m).replace(".", ".")]).reverse();
			/* Writes carry the snapshot's revision; the controller re-reads on
			 * conflict, and the next snapshot re-renders card and runtime in
			 * one step. */
			const onSpeed = (id) => {
				setMenuOpen(false);
				if (writable) void scope.set("speedMode", id === "follow" ? "follow" : "constant");
			};
			const applyMult = (m) => {
				/* Applies only in constant mode (the scale is hidden in follow). */
				if (writable) void scope.set("mult", m);
			};
			const onForce = () => {
				if (writable) void scope.set("forceFlow", !force);
			};
			const onReset = () => {
				void scope.unset("speedMode");
				void scope.unset("mult");
				void scope.unset("forceFlow");
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
					overridden ? h("span", { className: "dv-badge" }, t("modified")) : null,
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
					),
					speed === "constant"
						? h("div", { className: "dv-field" },
							h("div", { className: "dv-fieldHead" },
								h("label", { className: "dv-label", id: "dv-mult-label" }, t("multLabel")),
							),
							h(SpeedScale, { value: mult, ticks: TICKS, onChange: applyMult }),
						)
						: null,
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
					snap.status === "unavailable" ? h("p", { className: "dv-hint" }, t("unavailable")) : null,
					overridden ? h("div", { className: "dv-field" },
						h("button", { type: "button", className: "dv-reset", onClick: onReset }, t("reset")),
					) : null,
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
				bind(); // cheap no-op once attached
				const cps = chars * 2; // 500ms window -> per second
				chars = 0;
				/* Asymmetric EMA: rise fast (0.5) so a burst of tokens reads
				 * within a second; fall slow (0.82) so the water glides back
				 * to stillness instead of snapping between paragraphs. */
				const a = cps > rate ? 0.5 : 0.18;
				rate = rate === 0 ? cps : rate * (1 - a) + cps * a;
				/* Calibrated to real usage: typical API turns stream at
				 * ~40-60 tok/s (Zhipu GLM ~50, DeepSeek V3 60; ~3 chars per
				 * token -> ~150 cps), which is where the user actually lives.
				 * Mapping:
				 *   0 cps              -> 12s  still water
				 *   150cps (~50 tok/s) ->  4s  = official shimmer cadence
				 *   750cps (~250 tok/s) -> 2s  = 2x official pace (rapids,
				 *                               Cerebras-class ceiling)
				 * Linear to the official knee, then log-interpolated with a
				 * 0.7 exponent so the climb from 50 to 250 tok/s stays felt. */
				/* Follow curve: 0 -> 12s, 150cps(~50tok/s) -> 4s official
				 * cadence, 750cps ceiling -> 2s. No user multiplier here —
				 * follow mode's pace is owned by the token stream itself; the
				 * speed scale applies to constant mode only. */
				let dur;
				if (rate <= 150) {
					dur = 12 - (rate / 150) * 8;
				} else {
					const t = Math.pow(
						Math.min(1, Math.log(rate / 150) / Math.log(750 / 150)), 0.7);
					dur = 4 + (2 - 4) * t;
				}
				dur = Math.round(dur * 10) / 10;
				if (dur !== lastDur) {
					lastDur = dur;
					document.documentElement.style.setProperty("--dv-dur", `${dur}s`);
				}
			};
			this.start = () => {
				this.stop();
				bind();
				ticker = setInterval(tick, 500);
				tick();
			};
			/** Attach the observer to the conversation flow host. The host may
			 * mount after plugin activation (session switch, first render), so
			 * a 2s re-bind watchdog keeps trying until it exists — the outline
			 * plugin's discovery pattern. No-ops once bound. */
			const bind = () => {
				if (observer !== null) return;
				const host = document.querySelector("[data-conversation-scroll]");
				if (host === null) return;
				observer = new MutationObserver(onMutate);
				observer.observe(host, {
					childList: true, subtree: true, characterData: true, characterDataOldValue: true,
				});
			};
			this.stop = () => {
				if (observer !== null) { observer.disconnect(); observer = null; }
				if (ticker !== null) { clearInterval(ticker); ticker = null; }
				chars = 0; rate = 0;
				/* --dv-dur stays: switching to constant re-applies it via
				 * applyConstant; the unload disposer clears it instead. */
			};
		}

		/** Services required: the slot registry (runtime) for the card, the
		 * locale service for bilingual copy, and the settings transport trio —
		 * the settingsScope binder plus the connection/remote its invalidation
		 * rides on (docs/cookbook/adding-a-settings-card.md). */
		const inject = ["slots", "locale", "connection", "remote", "settingsScope"];

		/**
		 * Bind the namespace scope, inject the stylesheet, keep the runtime
		 * (force-flow projection + pace sampler) in step with every settings
		 * change, and register the card under its keyed slot. ctx.effect runs
		 * the body immediately and adopts its return as the unload disposer.
		 * @param ctx - client root context.
		 */
		function apply(ctx) {
			/* The official plugin-settings path: the Host half registers the
			 * `deepdiving` namespace (lib/index.js); this scope fences every
			 * read/write with the revision it read and follows
			 * settings/document-updated invalidations on our own lifecycle. */
			const scope = ctx.settingsScope.bind({ namespace: "deepdiving" });

			/* One-shot migration of the pre-0.4 localStorage preferences into
			 * the host document: values that differ from the schema defaults
			 * become user-layer overrides, then the legacy keys are dropped. A
			 * settings document that already has an opinion wins. */
			let migrated = false;
			const migrate = (snap) => {
				if (migrated || snap.status !== "ready") return;
				migrated = true;
				const user = snap.user;
				const owned = user !== undefined
					&& ["speedMode", "mult", "forceFlow"].some((k) => k in user);
				if (owned) { clearLegacy(); return; }
				const legacy = prefsFrom(undefined); // reads the localStorage fallback
				if (legacy.speedMode !== DEFAULTS.speedMode) void scope.set("speedMode", legacy.speedMode);
				if (legacy.mult !== DEFAULTS.mult) void scope.set("mult", legacy.mult);
				if (legacy.forceFlow !== DEFAULTS.forceFlow) void scope.set("forceFlow", legacy.forceFlow);
				clearLegacy();
			};

			ctx.effect(() => {
				const st = document.createElement("style");
				st.textContent = CSS;
				document.head.appendChild(st);

				const sampler = new PaceSampler();
				/* Every scope change re-projects: the force-flow flag onto
				 * body[data-dv-flow], and either the sampler (follow) or the
				 * constant duration (--dv-dur = base / mult). */
				const reapply = () => {
					const snap = scope.getSnapshot();
					migrate(snap);
					const p = prefsFrom(snap);
					if (p.forceFlow) document.body.setAttribute("data-dv-flow", "");
					else document.body.removeAttribute("data-dv-flow");
					if (p.speedMode === "follow") sampler.start();
					else {
						sampler.stop();
						/* constant mode: duration = base / multiplier (1x = 4s
						 * official cadence; 3x -> 1.33s, 0.5x -> 8s) */
						document.documentElement.style.setProperty("--dv-dur", BASE_S / p.mult + "s");
					}
				};
				const off = scope.subscribe(reapply);
				reapply();

				return () => {
					off();
					sampler.stop();
					st.remove();
					document.body.removeAttribute("data-dv-flow");
					document.documentElement.style.removeProperty("--dv-dur");
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
				const card = () => h(LocaleBridge, { subscribe, getCopy, scope });
				function LocaleBridge({ subscribe: sub, getCopy: gc, scope: sc }) {
					const { useSyncExternalStore } = React;
					const c = useSyncExternalStore(sub, gc);
					return h(DeepdivingCard, { copy: c, scope: sc });
				}
				/* rc.7 keyed slot: the card claims the `deepdiving` namespace the
				 * Host half registers, and the Plugin-configuration tab pairs the
				 * two halves by that key — "a plugin that registers both halves is
				 * paired up automatically". slots.inject waits for the parent's
				 * children declaration, so ordering against ui-settings-plugins
				 * never matters. */
				const unregister = ctx.slots.inject("settings.plugin.item", () =>
					ctx.slots.register({ name: "settings.plugin.item", key: "deepdiving" }, card));
				return () => { if (disposer !== null) disposer(); unregister(); };
			}, "deepdiving: settings card");
		}

		return { inject, apply };
	},
});
