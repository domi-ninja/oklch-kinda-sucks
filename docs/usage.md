# Using the app

Open [color.domi.ninja](https://color.domi.ninja), choose a preset, and click one of its colors. Adjust it with a picker or edit its CSS value. Light and dark previews update together.

Hover an element in either preview to outline it and connect its colors to the matching theme swatches. Keyboard focus does the same for preview controls.

## Pickers and color fields

Add picker opens another synchronized RGB, HSL, HCL, or OKHCL picker. Each has three planes covering every pair of color channels while holding the third at its current value. HCL uses CIELCH D50; OKHCL uses OKLCH. RGB and HSL describe the browser's sRGB result.

RGB's color editor accepts hex. The other editors accept their color space's CSS syntax. Editor % sits below the CSS field. Sliders show native values and percentages together. Native and percentage inputs accept typing before clamping a completed value.

Every picker also accepts `color(display-p3 ...)` in its Display P3 field. The gamut status describes the selected source color, not the monitor's coverage. Unclipped sRGB channels use a 0–255 scale and can be negative or exceed 255 for colors outside sRGB. Switching picker modes preserves the source color; editing RGB or HSL uses sRGB.

RGB 100% means 255. HCL chroma 100% means 150, OKHCL chroma 100% means 0.4, and hue 100% means 360 degrees. Percentage hue is editor notation; CSS hue uses degrees.

Display color uses the native CSS color. sRGB preview shows an 8-bit sRGB canvas readback. Hover or focus either swatch for details. Wide-gamut displays may show a difference. Rendering and gamut mapping depend on the browser. Transparent pixels are quantized and can lose RGB precision during canvas readback.

## Undo and redo

Use Undo and Redo above the pickers, or Ctrl+Z to undo and Ctrl+Y or Ctrl+Shift+Z to redo. Cmd+Z and Cmd+Shift+Z work on macOS. Text fields keep their normal text undo while focused. The shortcuts also work from preview buttons.

History covers colors, palette settings, presets, generated modes, generator settings, and picker layout. A drag or continuous field edit is one step. Selecting a token or endpoint and switching preview tabs or widths do not add steps. Undo keeps the current preview tab and width.

The last 100 steps stay in memory until reload. Undoing saved preset changes updates browser storage too. A new edit clears redo.

## Presets and sharing

Built-in presets are protected. Save as new creates an editable copy. Save updates a custom preset, and Discard changes restores its saved stylesheet and the selected picker color. Browser storage keeps saved presets and unfinished work across reloads.

Copy the address bar to share the current color or complete palette and open picker modes. Use Share preset in the Presets panel to share the theme's name and current stylesheet, including unsaved edits. A recipient imports a local preset and keeps their own picker setup. Palette settings and generation controls are not part of a preset link.

Opening a shared preset returns to a normal color URL after import. Use Share preset to share the imported theme again. Saved presets remain local; a share link does not create a synced account or cloud backup.

## Palettes

Create palette adds a second color. Select Start or End, or drag an S or E circle on a picker. Subdivisions count intervals: four subdivisions produce five colors. Choose RGB, HSL, HCL, or OKHCL for interpolation. Hue takes the shorter route around the circle.

Add middle color enables a quadratic Bézier curve. Select Middle or drag its M handle to pull the curve using the selected interpolation space. The middle control is not a generated swatch or a point the curve must pass through. Remove middle color returns to linear interpolation without changing the endpoints.

Intermediate markers show the generated steps and cannot be edited. Copy palette copies CSS variables for those colors. Palettes save in this browser and in the address bar, including control colors, subdivisions, interpolation, harmonization, chroma, and token assignments.

Hex labels sit directly on each swatch. APCA contrast chooses black or white text against both checkerboard shades, including transparency. Contrast uses Display P3 on supported screens and browser canvases, otherwise sRGB. Hex values remain sRGB.

The grayscale strip below the palette matches each color's relative luminance on a standard sRGB display, including its transparency over the checkerboard. It uses linear-light luminance, not an RGB average or the picker's lightness channel. Actual perceived brightness varies with the display, viewing conditions, and observer.

Harmonized light and Harmonized dark each show a color strip, a matching brightness strip, and draggable token labels. Both keep the original hue direction. Generated fills are opaque; text is black or white.

Improve contrast preserves the sampled colors and accepts only contrast-improving lightness nudges of at most 0.02. In the light theme, Card starts at the original gradient start. Background starts at 5% of the gradient. In the dark theme, Card starts at the dark end.

APCA tones has exact white and black endpoints. Intermediate tones target evenly spaced APCA contrast against white while retaining the palette’s hue and chroma. Theme roles choose positions independently of tone generation. Text colors are checked against their actual surfaces; the accessibility overlay flags remaining issues.

Chroma is a compact slider with a quadratic response for finer low-saturation control. Drag Background, Primary, Secondary, Accent, or Card into a free slot in its lane. Reaching a free target previews its new color before release; occupied slots reject the drop. Arrow keys move a focused token to the next free slot. Reset positions beside each mode heading restores automatic assignments. Undo reverses edits.

Editing palette controls or color pickers previews the mapped theme without writing its stylesheet. Working with presets or Theme CSS suspends this preview so those views show the actual theme. Clicking a theme color exits palette mode and loads that token into the pickers. Preview scroll and form drafts remain in place.

Swatches and token slots wrap to fit the available width.

Apply palette to preset updates both modes of the draft. It sets the core theme colors and preserves error fills and unrelated CSS. Muted surfaces and borders derive from Card and Foreground. Shared muted text uses Foreground so it remains readable on cards. Popover, input, ring, and any existing sidebar variables inherit their main tokens through CSS aliases. Use the preset save controls to save the stylesheet. Copy light theme and Copy dark theme copy their respective declarations.

## Preview forms and dialogs

Press Enter in the project name field to submit it. A blank name shows an error and keeps focus in the field. Edit notification email opens a dialog that validates the address format before saving. Cancel and Escape discard the email draft. Remove member opens a confirmation dialog; Cancel receives focus first. Restore member reverses a confirmed removal. These sample interactions reset on reload.

Accessibility checks run automatically inside both component previews using axe-core. The overlay reports WCAG contrast ratios; APCA is the palette generation metric. Red outlines and numbered markers identify detected violations. Hover or focus a marker for the failure details, including measured and required text contrast. Amber markers identify checks that need review. Results refresh after theme or component changes; they are automated checks, not an accessibility certification. Diagnostic markers stay in the editor and are omitted from exports.

## Export

CSS downloads the compiled stylesheet. Export app downloads a React, TypeScript, Vite, Tailwind CSS, and shadcn/ui project containing all four sample panels and a light/dark toggle.

Unzip it, use Node 24 or later, and run:

```sh
npm install
npm run dev
```

Edit `src/theme.css` for colors and `src/App.tsx` for sample UI. Use the mode button or add `?theme=dark` to the URL. `npm run build` creates `dist` for static hosting. The included README has the project commands and component paths.

The `preview` folder contains standalone light and dark HTML snapshots. Open them directly without installing dependencies. Rebuilding the React app writes `dist`; export again from the editor to refresh the standalone snapshots.
