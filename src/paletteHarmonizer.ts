import { converter, toGamut } from "culori";
import { APCAcontrast, displayP3toY } from "apca-w3";
import type { PaletteThemeSettings } from "./workspaceSchema";
import type { Color } from "./color";
import { clampColor } from "./colorBounds";
import { interpolateCoordinates } from "./palette";

export type ThemeMode = "light" | "dark";
const toP3 = toGamut("p3", "oklch", null, 0);
const toOklch = converter("oklch");
const black: Color = { l: 0, c: 0, h: 0, a: 1 };
const white: Color = { l: 1, c: 0, h: 0, a: 1 };

function luminance(color: Color) {
  const rgb = toP3({ mode: "oklch", l: color.l, c: color.c, h: color.h });
  return displayP3toY([rgb.r, rgb.g, rgb.b]);
}
function inkContrast(color: Color, ink: Color) {
  return Math.abs(APCAcontrast(luminance(ink), luminance(color)));
}
export function themeInk(color: Color): Color {
  const y = luminance(color);
  return Math.abs(APCAcontrast(0, y)) >= Math.abs(APCAcontrast(1, y))
    ? black
    : white;
}
function fit(color: Color): Color {
  const mapped = toOklch(
    toP3({ mode: "oklch", l: color.l, c: color.c, h: color.h }),
  );
  return clampColor({ ...color, l: mapped.l, c: mapped.c, a: 1 });
}
// Find the closest lightness meeting the text-on-fill contrast target.
function solve(color: Color, target: number, ink: Color) {
  let low = 0;
  let high = 1;
  for (let i = 0; i < 22; i++) {
    const l = (low + high) / 2;
    const measured = inkContrast(fit({ ...color, l }), ink);
    if (ink.l === 0 ? measured < target : measured > target) low = l;
    else high = l;
  }
  return fit({ ...color, l: ink.l === 0 ? high : low });
}

// Source order is light to dark. Sample its hue/chroma path before retuning lightness for each mode.
export const defaultPaletteTheme: PaletteThemeSettings = {
  chroma: 1,
  positions: { light: {}, dark: {} },
};

export function harmonizePalette(
  input: Color[],
  path = input,
  settings = defaultPaletteTheme,
) {
  const source = path.length ? path.map(clampColor) : [white, black];
  const seed = (t: number): Color => {
    const position = t * (source.length - 1);
    const index = Math.floor(position);
    const from = source[index];
    const to = source[Math.min(index + 1, source.length - 1)];
    const [h, c, l] = interpolateCoordinates(
      [from.h, from.c, from.l],
      [to.h, to.c, to.l],
      "OKHCL",
      position - index,
    );
    return { h, c: c * settings.chroma, l, a: 1 };
  };
  function generate(mode: ThemeMode) {
    const dark = mode === "dark";
    const ink = dark ? white : black;
    const first = fit({ ...seed(0), l: dark ? 0.38 : 0.9 });
    const last = fit({ ...seed(1), l: dark ? 0.18 : 0.76 });
    const startContrast = Math.max(75, inkContrast(first, ink));
    const endContrast = Math.max(75, inkContrast(last, ink));
    const colorAt = (t: number) => {
      const sample = fit(seed(t));
      if (settings.mapping === "palette") {
        return inkContrast(sample, ink) >= 75 ? sample : solve(sample, 75, ink);
      }
      const adjusted = solve(
        sample,
        startContrast + (endContrast - startContrast) * t,
        ink,
      );
      const bounded = fit({
        ...adjusted,
        l: Math.max(
          dark ? 0.18 : 0.76,
          Math.min(dark ? 0.38 : 0.9, adjusted.l),
        ),
      });
      return inkContrast(bounded, ink) >= 75
        ? bounded
        : solve(bounded, 75, ink);
    };
    const positions: Record<string, number> = {
      background: dark ? 1 : 0,
      card: dark ? 0.75 : 0.25,
      popover: dark ? 0.75 : 0.25,
      primary: 0.5,
      secondary: 0.25,
      accent: 0.75,
      muted: 0.5,
      border: dark ? 0.25 : 0.75,
      input: dark ? 0.25 : 0.75,
      ring: 0.5,
      sidebar: dark ? 0.75 : 0.25,
      "sidebar-primary": 0.5,
      "sidebar-accent": 0.75,
      "sidebar-border": dark ? 0.25 : 0.75,
      "sidebar-ring": 0.5,
    };
    const tokens: Record<string, Color> = {};
    for (const [role, fallback] of Object.entries(positions)) {
      positions[role] = settings.positions[mode][role] ?? fallback;
      const sample = colorAt(positions[role]);
      const automaticSurface =
        settings.mapping !== "palette" &&
        settings.positions[mode][role] === undefined &&
        [
          "background",
          "card",
          "popover",
          "muted",
          "border",
          "input",
          "sidebar",
          "sidebar-border",
        ].includes(role);
      const fill = automaticSurface
        ? fit({
            ...sample,
            c: Math.min(
              sample.c,
              (role === "background" ? 0.012 : 0.02) * settings.chroma,
            ),
          })
        : sample;
      tokens[role] = inkContrast(fill, ink) >= 75 ? fill : solve(fill, 75, ink);
    }
    for (const role of [
      "foreground",
      "card-foreground",
      "popover-foreground",
      "primary-foreground",
      "secondary-foreground",
      "accent-foreground",
      "muted-foreground",
      "sidebar-foreground",
      "sidebar-primary-foreground",
      "sidebar-accent-foreground",
    ]) {
      const fill =
        role === "foreground" ? "background" : role.replace(/-foreground$/, "");
      tokens[role] = themeInk(tokens[fill]);
    }
    return {
      colors: input.map((_, index) =>
        colorAt(index / Math.max(1, input.length - 1)),
      ),
      tokens,
      positions,
      tokenPicks: Object.entries(positions)
        .filter(([role]) =>
          ["background", "secondary", "primary", "accent", "card"].includes(
            role,
          ),
        )
        .map(([role, position]) => ({ role, position, color: tokens[role] })),
      picks: Object.entries(positions)
        .filter(([role]) =>
          ["background", "primary", "secondary", "accent"].includes(role),
        )
        .map(([role, position]) => ({ role, position, color: tokens[role] }))
        .sort((a, b) => a.position - b.position),
    };
  }
  return { light: generate("light"), dark: generate("dark") };
}
export type HarmonizedPalettes = ReturnType<typeof harmonizePalette>;
export type ThemePalette = HarmonizedPalettes[ThemeMode];
