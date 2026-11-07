import { converter, toGamut } from "culori";
import { APCAcontrast, displayP3toY } from "apca-w3";
import type { PaletteThemeSettings } from "./workspaceSchema";
import type { Color } from "./color";
import { clampColor } from "./colorBounds";
import { interpolateCoordinates } from "./palette";

export type ThemeMode = "light" | "dark";
type Background = "black" | "white";
const toP3 = toGamut("p3", "oklch", null, 0);
const toOklch = converter("oklch");
const black: Color = { l: 0, c: 0, h: 0, a: 1 };
const white: Color = { l: 1, c: 0, h: 0, a: 1 };

function luminance(color: Color) {
  const rgb = toP3({ mode: "oklch", l: color.l, c: color.c, h: color.h });
  return displayP3toY([rgb.r, rgb.g, rgb.b]);
}
function contrast(color: Color, background: Background) {
  return Math.abs(
    APCAcontrast(luminance(color), background === "white" ? 1 : 0),
  );
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
function solve(color: Color, target: number, background: Background) {
  let low = 0;
  let high = 1;
  let best = fit(color);
  let error = Math.abs(contrast(best, background) - target);
  for (let iteration = 0; iteration < 20; iteration++) {
    const l = iteration === 0 ? 0 : iteration === 1 ? 1 : (low + high) / 2;
    const candidate = fit({ ...color, l });
    const measured = contrast(candidate, background);
    const nextError = Math.abs(measured - target);
    if (nextError < error) {
      best = candidate;
      error = nextError;
    }
    if (iteration < 2) continue;
    const needsLighter =
      background === "black" ? measured < target : measured > target;
    if (needsLighter) low = l;
    else high = l;
  }
  return best;
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
    const background: Background = dark ? "black" : "white";
    const at = seed;
    const surface = (color: Color, cap: number) => ({
      ...color,
      c: Math.min(color.c, cap + Math.max(0, settings.chroma - 1) * 0.4),
    });
    const first = fit({ ...surface(at(0), 0.008), l: 0.985 });
    const last = fit({ ...surface(at(1), 0.018), l: 0.18 });
    const from = contrast(first, background);
    const to = contrast(last, background);
    // Give the primary midpoint strong contrast, with a separate progression on either side.
    const middle = 72;
    const colorAt = (t: number) => {
      if (t === 0) return first;
      if (t === 1) return last;
      const target =
        t <= 0.5
          ? from + (middle - from) * t * 2
          : middle + (to - middle) * (t - 0.5) * 2;
      return solve(at(t), target, background);
    };
    const positions: Record<string, number> = {
      background: dark ? 1 : 0,
      card: dark ? 0.97 : 0.02,
      popover: dark ? 0.97 : 0.02,
      primary: 0.5,
      secondary: 0.25,
      accent: 0.75,
      muted: dark ? 0.93 : 0.07,
      border: dark ? 0.85 : 0.15,
      input: dark ? 0.85 : 0.15,
      ring: 0.5,
      sidebar: dark ? 0.97 : 0.02,
      "sidebar-primary": 0.5,
      "sidebar-accent": 0.75,
      "sidebar-border": dark ? 0.85 : 0.15,
      "sidebar-ring": 0.5,
    };
    const tokens: Record<string, Color> = {};
    for (const [role, fallback] of Object.entries(positions)) {
      positions[role] = settings.positions[mode][role] ?? fallback;
      const sample = colorAt(positions[role]);
      tokens[role] =
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
        ].includes(role)
          ? fit(surface(sample, role === "background" ? 0.018 : 0.025))
          : sample;
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
      const chosen = settings.positions[mode][role];
      tokens[role] =
        chosen === undefined
          ? themeInk(tokens[fill])
          : colorAt(chosen).l >= 0.5
            ? white
            : black;
      positions[role] = chosen ?? (tokens[role].l === 1 ? 0 : 1);
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
