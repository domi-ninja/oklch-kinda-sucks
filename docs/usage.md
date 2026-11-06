# Using the app

Open [color.domi.ninja](https://color.domi.ninja), choose a preset, and click one of its colors. Adjust it with a picker or edit its CSS value. Light and dark previews update together.

Hover an element in either preview to outline it and connect its colors to the matching theme swatches. Keyboard focus does the same for preview controls.

## Pickers and color fields

Add picker opens another synchronized RGB, HSL, HCL, or OKHCL picker. Each has three planes covering every pair of color channels while holding the third at its current value. HCL uses CIELCH D50; OKHCL uses OKLCH. RGB and HSL describe the browser's sRGB result.

RGB's color editor accepts hex. The other editors accept their color space's CSS syntax. Editor % sits below the CSS field. Sliders show native values and percentages together. Native and percentage inputs accept typing before clamping a completed value.

RGB 100% means 255. HCL chroma 100% means 150, OKHCL chroma 100% means 0.4, and hue 100% means 360 degrees. Percentage hue is editor notation; CSS hue uses degrees.

Display color uses the native CSS color. sRGB preview shows an 8-bit sRGB canvas readback. Hover or focus either swatch for details. Wide-gamut displays may show a difference. Rendering and gamut mapping depend on the browser. Transparent pixels are quantized and can lose RGB precision during canvas readback.

## Undo and redo

Use Undo and Redo above the pickers, or Ctrl+Z to undo and Ctrl+Y or Ctrl+Shift+Z to redo. Cmd+Z and Cmd+Shift+Z work on macOS. Text fields keep their normal text undo while focused. The shortcuts also work from preview buttons.

History covers colors, palette settings, presets, generated modes, generator settings, and picker layout. A drag or continuous field edit is one step. Selecting a token or endpoint and switching preview tabs or widths do not add steps. Undo keeps the current preview tab and width.

The last 100 steps stay in memory until reload. Undoing saved preset changes updates browser storage too. A new edit clears redo.

## Presets and sharing

Built-in presets are protected. Save as new creates an editable copy. Save updates a custom preset, and Discard changes restores its saved stylesheet and the selected picker color. Browser storage keeps saved presets and unfinished work across reloads.

Copy the address bar to share the current color and open picker modes. Use Share preset in the Presets panel to share the theme's name and current stylesheet, including unsaved edits. A recipient imports a local preset and keeps their own picker setup. Palette settings and generation controls are not part of a preset link.

Opening a shared preset returns to a normal color URL after import. Use Share preset to share the imported theme again. Saved presets remain local; a share link does not create a synced account or cloud backup.

## Palettes

Create palette adds a second color. Select Start or End, or drag an S or E circle on a picker. Subdivisions count intervals: four subdivisions produce five colors. Choose RGB, HSL, HCL, or OKHCL for interpolation. Hue takes the shorter route around the circle.

Add middle color enables a quadratic Bézier curve. Select Middle or drag its M handle to pull the curve using the selected interpolation space. The middle control is not a generated swatch or a point the curve must pass through. Remove middle color returns to linear interpolation without changing the endpoints.

Intermediate markers show the generated steps and cannot be edited. Copy palette copies CSS variables for those colors. Palettes save in this browser; a color URL shares only the active endpoint.

## Generate the other theme mode

Choose Light → dark or Dark → light above the theme colors. Adjust Background lightness, Contrast, and Chroma, then click Generate. Undo restores the previous stylesheet.

Surfaces use OKHCL lightness. Body text, muted text, and button labels derive contrast from their matching surfaces. Text tint is limited separately from accent saturation. Generation preserves hue, alpha, and the source mode's colors. Generator controls stay local; generated colors are part of the preset stylesheet.

## Preview forms and dialogs

Save changes validates the project name and focuses the field if it is blank. Edit notification email opens a dialog that validates the address format before saving. Cancel and Escape discard the email draft. Remove member opens a confirmation dialog; Cancel receives focus first. Restore member reverses a confirmed removal. These sample interactions reset on reload.

## Export

CSS downloads the compiled stylesheet. Export app downloads a React, TypeScript, Vite, Tailwind CSS, and shadcn/ui project containing all four sample panels and a light/dark toggle.

Unzip it, use Node 24 or later, and run:

```sh
npm install
npm run dev
```

Edit `src/theme.css` for colors and `src/App.tsx` for sample UI. Use the mode button or add `?theme=dark` to the URL. `npm run build` creates `dist` for static hosting. The included README has the project commands and component paths.

The `preview` folder contains standalone light and dark HTML snapshots. Open them directly without installing dependencies. Rebuilding the React app writes `dist`; export again from the editor to refresh the standalone snapshots.
