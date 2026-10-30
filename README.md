# OKLCH kinda sucks

An OKLCH picker and Tailwind theme editor that uses the current browser to render colors.

## Run it

Use Node 22.12+ and pnpm.

```sh
pnpm install
pnpm dev
```

Open the local URL printed by Vite. Pick a theme color, adjust the plane or sliders, and see the component preview update. Save a preset to keep it in this browser. Export CSS for the compiled stylesheet or export the app for a ZIP you can open offline.

Use Add picker to open synchronized RGB, HSL, HCL, or OKHCL panels. Each panel has its own mode selector and close button. HCL uses CIELCH D50; OKHCL uses OKLCH. RGB and HSL controls use the browser's sRGB result.

The URL updates with every workspace edit. Copy it to restore picker panels, the shared color, selected theme color, unsaved CSS, presets, color format, preview width, tab, and dark mode on another browser. Presets also save locally when you press Save.

The ZIP contains a standalone `index.html`, compiled `styles.css`, editable `theme.css`, and a rebuildable demo in `src/index.html`. Run `npm install && npm run build` in the extracted folder to rebuild the CSS after editing the theme.

## Color formats

CSS mode uses standard OKLCH syntax. Editor % expresses lightness, chroma, hue, and alpha as percentages. Chroma 100% means 0.4; hue 100% means 360 degrees. CSS does not accept percentage hue, so Copy CSS converts it to degrees.

CSS / display shows the native CSS color. Canvas / sRGB shows an 8-bit sRGB canvas readback. Wide-gamut displays may show a difference. RGB values and gamut mapping depend on the browser. Transparent pixels are quantized and may lose RGB precision during canvas readback.

## Development

React 19, TypeScript, Vite 8, Tailwind 4, and a shadcn-style Button built with Radix Slot and CVA. The editor styles compile through the Vite plugin. The demo styles compile separately in a Web Worker with Tailwind's compiler and render in a sandboxed iframe.

Theme CSS accepts Tailwind's CSS configuration, including `@theme` and custom rules. Local Tailwind imports are bundled; arbitrary remote imports and JavaScript plugins are not supported. Every literal `oklch(...)` in the editable stylesheet appears in the color list. Expressions outside the slider ranges can be edited in Theme CSS.

```sh
pnpm build
pnpm exec playwright install chromium firefox webkit
pnpm test
```

Tests cover browser canvas output, alpha, out-of-gamut colors, keyboard sliders, mobile overflow, live compilation, browser presets, and offline exports in Chromium, Firefox, and WebKit.
