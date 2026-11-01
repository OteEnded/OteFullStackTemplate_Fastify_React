# Frontend

React 19 + Vite + **Tailwind 4** (CSS-first, no `tailwind.config.js`). Builds into
`../Backend/public/dist`, which Fastify serves on the same origin as the API.

```bash
npm install
npm run dev      # Vite dev server; /api is proxied to the backend's app.port
npm run build    # tsc -b && vite build → ../Backend/public/dist
npm run lint
```
(PowerShell blocks `npm`? use `npm.cmd`.)

## Routes

| Path | What |
|---|---|
| `/` | Public page (`PublicLayout` + `pages/LandingPage`) |
| `/login` | Sign-in card (`AuthLayout`): password and/or Login with Oteracount — whatever the server enabled; a note when auth is off |
| `/console` | Dashboard: server health + the demo widget |
| `/console/items` | DEMO — template items list, form dialog, archive confirm, toasts |
| `/console/settings` | Appearance (theme) + About (from `/api/health`) |
| `/console/ui` | Kitchen sink of every component — **dev server only** (absent from builds) |
| anything else | 404 |

## Layout

```
src/
  styles/tokens.css       colour + layout tokens — the ONLY file with colour values (light + dark)
  styles/fonts.css        self-hosted Space Grotesk (latin) + Noto Sans Thai (thai), woff2 in assets/fonts
  styles/base.css         reset, focus ring, sr-only, skip link        (@layer base)
  styles/components.css   .btn .input .card .chip .callout .table … + shells (@layer components)
  index.css               Tailwind entry: @theme inline maps the tokens to utilities
  components/ui/          primitives: Button, Field/Input/Select/…, Dialog, useConfirm, Menu,
                          Toaster, DataTable, Toolbar, Chip, Card/StatCard/…, Tabs, CopyButton, …
  components/shell/       ConsoleLayout (grouped nav, drawer < 900px), AuthLayout, PublicLayout
  components/icons/       custom SVG icons when lucide-react lacks one
  lib/                    theme, api helpers (useLoad), toast, overlay (drag-safe dismiss), lazyWithReload
  auth/                   AuthProvider (GET /api/auth/me, login/logout), useAuth(), RequireSignIn (console gate)
  features/template-items DEMO feature — delete the folder (the wizard does it)
  nav.ts                  the console's side nav (groups, icons, optional permission per item)
  api.ts                  getJson / postJson — GET + POST only, { ok, data } / { ok:false, message, code }
  config.ts               runtime /config.json (3 s timeout, falls back to defaults)
```

## Rules

- **Tokens only.** No hex colours and no `dark:` utilities in components — use `bg-panel`,
  `text-muted`, `border-line`, `var(--accent)`… Tailwind's stock palette is switched off.
- **Theme:** `light | dark | system`, stored under the shared key `ote:theme`. A first visit
  follows the device; `index.html` paints the theme before any CSS/JS, falling back to DARK.
- **Icons:** named imports from `lucide-react`, rendered through `<Icon icon={X} />`.
- **No `window.confirm`** — `useConfirm()`. Toasts: `toast.ok('Saved')`.
- **Demo wiring** in shared files is marked `// @demo` or `@demo-start` / `@demo-end`.
- App name/subtitle come from `public/config.json` (`config.example.json` documents the shape).
- **Test the look:** `cd ../test && npm run ui` drives every page in both themes at desktop and
  phone width and writes screenshots to `test/shots/active/`.

## Config

`public/config.json` (runtime, not bundled):

```json
{ "app": { "name": "FullStack Template", "subtitle": "…" }, "api": { "base_url": "" } }
```

Leave `api.base_url` empty to call the API on the page's own origin (the normal setup).
