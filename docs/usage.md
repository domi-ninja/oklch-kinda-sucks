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

Copy the address bar to share the current color and open picker modes. Use Share preset in the Presets panel to share the theme's name and current stylesheet, including unsaved edits. A recipient imports a local preset and keeps their own picker setup. Palette settings and generation controls are not part of a preset link.

Opening a shared preset returns to a normal color URL after import. Use Share preset to share the imported theme again. Saved presets remain local; a share link does not create a synced account or cloud backup.

## Palettes

Create palette adds a second color. Select Start or End, or drag an S or E circle on a picker. Subdivisions count intervals: four subdivisions produce five colors. Choose RGB, HSL, HCL, or OKHCL for interpolation. Hue takes the shorter route around the circle.

Add middle color enables a quadratic Bézier curve. Select Middle or drag its M handle to pull the curve using the selected interpolation space. The middle control is not a generated swatch or a point the curve must pass through. Remove middle color returns to linear interpolation without changing the endpoints.

Intermediate markers show the generated steps and cannot be edited. Copy palette copies CSS variables for those colors. Palettes save in this browser; a color URL shares only the active endpoint.

Hex labels sit directly on each swatch. APCA contrast chooses black or white text against both checkerboard shades, including transparency. Contrast uses Display P3 on supported screens and browser canvases, otherwise sRGB. Hex values remain sRGB.

The grayscale strip below the palette matches each color's relative luminance on a standard sRGB display, including its transparency over the checkerboard. It uses linear-light luminance, not an RGB average or the picker's lightness channel. Actual perceived brightness varies with the display, viewing conditions, and observer.

Harmonized light and Harmonized dark each have a color strip and a brightness strip. The original gradient is read from light on the left to dark on the right. Its hue and chroma path supplies the theme colors, including the middle control, while APCA adjusts the tones for each mode. Generated theme fills are opaque and text is pure black or white. All six rows share the same step count and scroll together.

Apply palette to preset fills both modes of the current preset draft: backgrounds, cards, primary, secondary, accent, muted, borders, inputs, rings, and sidebar colors. Primary starts at the middle hue; secondary and accent start at the quarter points. Both modes keep the original gradient direction. The compact Chroma slider uses a quadratic response for finer adjustment at low saturation and boosts surface tints above 100%; gamut fitting still limits colors that cannot be displayed. Drag a token label below either harmonized scale into a free color slot. The preview updates when a free target is reached; releasing commits the move. Occupied slots in the same lane keep their token. The draggable labels are Background, Primary, Secondary, Accent, and Card. Other tokens keep their automatic assignments. Explicitly positioning Card uses the exact harmonized slot color instead of its automatic chroma cap. Arrow keys move a focused token to the next free slot. Reset positions beside each harmonized heading restores that mode’s automatic assignments. These settings save in this browser and support undo. Error colors keep their existing fills. Custom CSS and non-color settings are preserved. Undo reverses the apply action in one step. Use the usual preset save controls to keep the updated stylesheet as a saved preset.

Hover over the palette panel to try its mapped light and dark colors in the component previews. Moving the mouse outside restores the current preset. Hovering does not save changes or add an undo step, and preview scroll positions and form inputs stay in place.

The harmonized swatches label the colors picked for Background, Primary, Secondary, and Accent. If a picked color falls between the displayed steps, its exact color appears as an additional labeled swatch below that strip.

Copy light theme and Copy dark theme copy the generated token declarations for their respective modes.

### Harmonizer

Open Harmonizer above the pickers for a hue-by-contrast grid. Use selects a row and sets the palette's Start and End to its first and last colors. Moving a row's Hue slider selects that row and updates both endpoints. An existing palette keeps its interpolation mode, subdivisions, and optional middle control; the middle control takes the new hue.

The initial grid has nine levels and five hues. APCA fields set contrast targets against the dark or light background. Even chroma uses a common chroma across each column; Max chroma finds the maximum for each swatch. Chroma limit caps a column, and its reset button restores automatic calculation. Choose sRGB or Display P3; P3 badges mark colors outside sRGB. Hover a swatch for its CSS value and measured APCA contrast.

Hue rows, levels, backgrounds, and settings save in this browser and support undo. Using the grid changes the palette, not the preset stylesheet. The grid's intermediate colors follow its contrast targets; the palette's intermediate colors follow its interpolation mode. Harmonizer settings are excluded from both kinds of share link.

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
