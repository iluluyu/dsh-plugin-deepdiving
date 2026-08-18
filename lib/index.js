/**
 * Host loader entry for dsh-ui-deepdiving: registers the `deepdiving`
 * settings namespace (schemastery schema) so the Web client's Plugin
 * configuration tab serves this plugin's card.
 *
 * dsh 0.1.0-rc.7 removed the api-proxy allowlist that kept third-party
 * namespaces off the wire — the Host now serves every registered namespace,
 * and the Plugins section keys its cards on the namespace they edit, "so a
 * plugin that registers both halves is paired up automatically"
 * (docs/cookbook/adding-a-settings-card.md). The browser half (lib/client.js)
 * binds a settingsScope on this namespace; preferences persist in the
 * host's settings document instead of per-browser localStorage.
 */
import z from "@deepseek-ai/schemastery";

/**
 * Namespace fields — the three card controls. All `applies: 'live'` (the
 * default): the browser half re-projects on every scope change, no restart.
 *   speedMode  constant | follow — follow hands --dv-dur to the pace sampler
 *   mult       constant-mode multiplier (1x = 4s official shimmer cadence)
 *   forceFlow  keep animating under prefers-reduced-motion
 */
const DEEPDIVING_SCHEMA = z.object({
	speedMode: z.union(["constant", "follow"]).default("constant"),
	mult: z.number().step(0.5).min(0.5).max(3).default(1),
	forceFlow: z.boolean().default(true),
});

/**
 * Register the namespace while a settings provider is composed.
 * @param ctx - host plugin context.
 */
export function apply(ctx) {
	ctx.inject(["settings"], (sctx) => {
		sctx.settings.register("deepdiving", DEEPDIVING_SCHEMA);
	});
}
