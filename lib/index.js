/**
 * Host loader entry for the browser-only deepdiving plugin.
 * Zero-build package: this file is hand-maintained source AND the shipped artifact.
 *
 * Intentionally host-inert today. The natural home for the `forceFlow`
 * preference would be a settings namespace (ctx.settings.register), and this
 * file carried exactly that in development — but the host's api-proxy serves
 * settings namespaces to the Web client from a hard-coded allowlist
 * (WEB_SETTINGS_NAMESPACES in dsh-host-apiproxy: "adding a section to that
 * page is a decision made here rather than by the registering plugin…
 * deferred work"), so a third-party namespace can never reach the browser.
 * The preference therefore lives in the browser's localStorage (see
 * lib/client.js: the Settings-card toggle and the body[data-dv-flow]
 * projection both read/write it), which also matches the effect's nature —
 * reduced-motion is a per-browser signal, so a per-browser preference is the
 * consistent scope. Revisit if dsh ever opens the allowlist to plugins.
 */

/** Provides no host-side behavior. */
export function apply() {}
