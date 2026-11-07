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
- `src/palette.ts` generates linear or quadratic Bézier palettes in the selected color space, including alpha. Polar hue endpoints follow the shorter arc; the middle control hue is lifted nearest the straight path midpoint before quadratic blending. Picker planes project the same sampled curve and its independent control colors.
- `src/paletteHarmonizer.ts` derives light and dark theme candidates from the original light-to-dark palette path. Both modes keep the source direction. APCA mode uses nearby mode-specific tones, restrained automatic surface tints, and a minimum text-on-fill contrast target of Lc 75. Palette mode preserves readable source colors and only corrects insufficient text contrast. Both fit Display P3. Palette theme settings control chroma and independent token positions for each mode. Generated fills are opaque; foregrounds are exactly black or white. The full sampled Bézier path supplies semantic role hues even when few subdivisions are displayed. `useHarmonizedPalette.ts` calculates in a worker and keeps only the latest queued edit. `PaletteRows.tsx` renders the original, light, and dark color/brightness pairs. Candidates remain derived until Apply palette to preset uses `applyPaletteTheme.ts` to update both color blocks in the current draft as one undoable action. Unrelated CSS, error fills, and declaration importance are preserved.
- `src/Harmonizer.tsx` provides the hue-by-contrast grid, modeled on [Evil Martians' Harmonizer](https://harmonizer.evilmartians.com/). `harmonizer.ts` uses the MIT-licensed [apcach](https://github.com/antiflasher/apcach) library for APCA targets and gamut searches. `useHarmonizer.ts` runs calculations in a worker, replaces queued work with the latest request, and carries the originating history group through asynchronous results. Selecting a row seeds the palette endpoints without changing theme CSS. Grid settings stay in browser storage.
- Picker planes render in workers. Both worker and destination canvases request Display P3 backing stores regardless of the screen's `color-gamut` media query, which can exclude partially P3-capable displays. `colorGamut.ts` converts the source OKLCH color directly for P3 editing and gamut inspection, without an sRGB canvas round trip.
- The demo stylesheet compiles in a separate Tailwind worker. Sandboxed light and dark iframes receive CSS updates in place, preserving their scroll positions and form state. `previewBridge.js` reports hovered or focused elements and their theme tokens; `PreviewConnections.tsx` draws the links without rerendering the editor.
- `previewA11y.js` runs the bundled axe-core engine inside each sandboxed iframe. Diagnostics render outside the sample in a shadow root, with red violation markers, amber review markers, and focusable details. Audits are debounced and stale results are discarded. Scroll and resize reposition markers without recompiling or remounting previews. Exports omit the diagnostic scripts.
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
