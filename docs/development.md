# Development

## Run locally

Use Node 24 or later and pnpm.

```sh
pnpm install
pnpm dev
```

The development command starts Vite on port 5173 and the share API on port 5174. Set `SHARE_DB_PATH` to choose a SQLite file. The default is `.data/shares.sqlite`.

## Code layout

- `src/App.tsx` owns the editor UI, preset actions, and downloads.
- `src/workspaceHistory.ts` stores up to 100 undo steps in memory. `src/useWorkspaceHistory.ts` groups pointer, keyboard, and field edits and binds shortcuts, including messages from sandboxed previews. Workspace setters batch related changes into one step.
- `src/workspace.ts` handles browser persistence, color URLs, and preset imports. `src/workspaceSchema.ts` validates workspace and share data.
- `src/sharing.ts` calls the share API. Read [Sharing and storage](sharing.md) before changing payloads or URL behavior.
- Picker planes render in workers. The demo stylesheet compiles in a separate Tailwind worker. Sandboxed light and dark iframes receive CSS updates in place, preserving their scroll positions and form state. `previewBridge.js` reports hovered or focused elements and their theme tokens; `PreviewConnections.tsx` draws the links without rerendering the editor.
- `export-template` contains the React/Vite/shadcn/ui project sources. `src/exportApp.ts` packages them with the current theme and standalone preview snapshots. The React samples use shadcn/Radix Dialog and AlertDialog; HTML previews use native modal dialogs. Both validate on submit, associate field errors, and restore trigger focus. Live previews allow scripts and form events while retaining sandboxed origins. `tests/demo-form-checks.ts` checks their shared behavior. The export module loads on demand. The editor's stylesheet excludes template files from its Tailwind source scan.
- `server.ts` serves the built app and immutable preset links. Ordinary editor state stays in browser storage.

Theme CSS accepts Tailwind's CSS configuration, including `@theme` and custom rules. Local Tailwind imports are bundled. Remote imports and JavaScript plugins are not supported. Literal `oklch(...)` values appear in the token list; expressions outside the slider ranges can be edited in Theme CSS.

## Checks

```sh
pnpm build
node --test scripts/server.test.mjs
pnpm exec playwright install chromium firefox webkit
pnpm test
```

Browser tests cover rendering, color bounds, numeric editing, palettes, preset actions, generation, sharing, responsive layout, and standalone exports.

To install and build the downloaded React project and exercise its controls:

```sh
EXPORT_BUILD=1 pnpm exec playwright test tests/export-app.spec.ts --project=chromium
```

This additional check needs registry access and installs dependencies in a temporary folder. It is skipped by the ordinary suite.

## Deployment

`pp plan` validates `deploy.yml`. `pp deploy` builds and deploys the app and Node server to color.domi.ninja. Deployment state stays in the ignored `.deploy` directory.

The `shares` volume keeps `/data/shares.sqlite` across deployments. Removing that volume deletes saved preset links. HTML is served without caching, hashed assets are immutable, and `/api/version` lets open tabs detect a new deployment.
