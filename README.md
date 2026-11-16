# OKLCH kinda sucks

Build shadcn/ui themes in your browser and compare the same color across synchronized RGB, HSL, HCL, and OKHCL pickers. See your edits in light and dark component previews together, then export CSS or a runnable React app.

- **Color spaces.** Edit colors side by side, compare native display color with sRGB, and inspect colors outside the sRGB gamut.
- **Palettes.** Build gradients in your chosen color space and generate light and dark themes with draggable color assignments.
- **Exports.** Download theme CSS or a React/Vite/Tailwind/shadcn/ui project with the sample panels and both theme modes.

## Try it

[Open color.domi.ninja](https://color.domi.ninja). No installation needed.

1. Choose a preset and click a theme color.
2. Adjust it with the picker, sliders, or color fields. Add pickers to compare color spaces. Light and dark previews update together.
3. Save your changes in this browser, use Save as new for a copy, or Discard changes to restore the preset.

Use Create palette to build a gradient and preview its harmonized light and dark themes. Apply palette to preset fills both modes of the current theme.

[Compare a blue in all four color spaces](https://color.domi.ninja/#color=0.6,0.2,260,1&pickers=RGB,HSL,HCL,OKHCL). The link opens `oklch(0.6 0.2 260)` in synchronized pickers. Change a slider in one picker to see the other representations update.

## Share or export

- Copy the address bar to share the current color or full palette and open picker modes.
- Use Share preset in the Presets panel to create a link to the current theme, including unsaved edits. Opening it adds a local preset without replacing the recipient's picker setup.
- CSS downloads the stylesheet. Export app downloads the runnable project. Follow the included README to install dependencies and start it.

Saved presets and unfinished work stay in your browser. Clearing browser storage removes them.

## Guides

- [Using the app](docs/usage.md): palettes, color formats, and exported apps.
- [Development](docs/development.md): local setup, tests, architecture, and deployment.
- [Sharing and storage](docs/sharing.md): URL and persistence rules for developers and agents.
