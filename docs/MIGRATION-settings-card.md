# Settings card migration plan: back into the "插件配置" list (for a future release)

> Researched 2026-08-18 against dsh `0.1.0-rc.7` sources (~/dsh @ 99f6f02, tag dsh-v0.1.0-rc.7).
> Current state: 0.3.3 registers the card as its own tab under `settings.plugins.tab` (works, but a
> whole tab is overweight for one settings card). This note records the verified path back into the
> shared configurable list — to be executed in a future release.

## Why it left

rc.7 turned `settings.plugin.item` from a **list** slot (id-registered) into a **keyed** slot
(`packages/client/ui-slots/src/index.ts:806` throws `keyed slot requires options.key`). The key is
the settings namespace the card edits. Our rc.6-era registration (`id: "deepdiving"`) crashed the
plugin on load, hence the 0.3.3 move to a standalone tab.

## Why the shared list is reachable again (the rc.6 blocker is gone)

The configurable tab renders the **intersection** of two ledgers (`tab-store.ts` header comment):

```
namespaces served by the Host (settings.describe RPC)
  ∩
cards registered into settings.plugin.item (keyed by that namespace)
```

Verified chain, no allowlist anywhere:

1. `packages/host/apiproxy/src/api-proxy.ts:3201` — `settings.describe` handler calls the settings
   service and lists **every registered namespace**, registration order, no filtering.
2. `packages/settings/settings/src/index.ts:866` — plugin-facing registration hook: a host half can
   `ctx.inject(['settings'], sctx => sctx.settings.register(ns, zodSchema, { base, applies }))`.
   The old hard-coded allowlist (the rc.6 comment in our lib/client.js refers to it) no longer
   exists.
3. `packages/client/ui-settings-plugins/src/client/index.ts:89-93` — "A card registered after the
   first read joins the list without a wire call": the tab directory picks up late-registered cards
   automatically.
4. Official example: BashCard registers `{ name: 'settings.plugin.item', key: SHELL_NS }` with its
   host-side namespace registration elsewhere in the same package.

## Migration steps (when we do it)

1. **lib/index.js (host half)** — stop being a no-op. Register a settings namespace:
   - ns: `deepdiving` (matching the localStorage key prefix `dsh-deepdiving:*` used today)
   - zod schema: `speedMode` ('constant' | 'follow'), `multiplier` (0.5–3, steps 0.5),
     `forceFlow` (boolean) — the three controls the card already exposes
   - base: current defaults; `applies: 'live'` (all three take effect without restart)
   - zod becomes a runtime dependency (tiny; acceptable) — or hand-roll a minimal schema object if
     we want to stay zero-dep
2. **lib/client.js (browser half)** — swap the 0.3.3 registration:
   ```js
   ctx.slots.register({ name: "settings.plugins.tab", id: "deepdiving", order: 100, label: ... }, card)
   ```
   →
   ```js
   ctx.slots.register({ name: "settings.plugin.item", key: "deepdiving" }, card)
   ```
   Reads/writes switch from localStorage to the `settings.update` RPC (the card controllers in
   `ui-settings-plugins` — bash-card-controller.ts etc. — are the reference pattern for
   load/patch/revision handling).
3. **Storage upgrade (the real payoff)** — settings move from per-browser localStorage to the
   host's `settings.yaml`: consistent across browsers/machines, visible in one place. Ship a
   one-time localStorage → namespace migration in the client (read old key, PATCH once, drop key).
4. **Optional card facelift** — reuse the exported `CardShell` / field components
   (`card-form.ts`, `fields.tsx`) for official bash-card styling.
5. Version 0.4.0, requires dsh >= 0.1.0-rc.7 (keyed slot + open namespace registration both land
   there). Drop the rc.6 compat note from README when this ships.

## Open questions (check at migration time)

- Does the web profile compose a settings service instance browser cards can reach through
  `settings.update` with revision conflicts handled? (BashCard controller shows the pattern; verify
  our fields' round-trip.)
- zod in a zero-build package: confirm `pnpm pack` ships it under `files:` or inline a minimal
  hand-rolled schema.
- rc.8 may rename or re-scope slots again — re-grep `settings.plugin.item` in the fresh tree first
  (update ~/dsh with `git fetch upstream && git merge --ff-only upstream/master`).
