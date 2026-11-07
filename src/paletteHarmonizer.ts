import { converter, toGamut } from "culori";
import { APCAcontrast, displayP3toY } from "apca-w3";
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
export function harmonizePalette(input: Color[], path = input) {
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
    return { h, c, l, a: 1 };
  };
  function generate(mode: ThemeMode) {
    const dark = mode === "dark";
    const background: Background = dark ? "black" : "white";
    const at = (t: number) => seed(dark ? 1 - t : t);
    const first = fit({
      ...at(0),
      l: dark ? 0.18 : 0.985,
      c: Math.min(at(0).c, dark ? 0.018 : 0.008),
    });
    const last = fit({
      ...at(1),
      l: dark ? 0.985 : 0.18,
      c: Math.min(at(1).c, dark ? 0.008 : 0.018),
    });
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
    const card = fit({
      ...first,
      l: Math.min(1, first.l + (dark ? 0.04 : 0.012)),
      c: Math.min(first.c, 0.012),
    });
    const mutedSeed = at(0.1);
    const muted = solve(
      { ...mutedSeed, c: Math.min(mutedSeed.c, 0.02) },
      dark ? 96 : 92,
      dark ? "white" : "black",
    );
    const border = fit({
      ...at(0.15),
      l: first.l + (dark ? 0.16 : -0.12),
      c: Math.min(at(0.15).c, 0.02),
    });
    const positions = {
      background: 0,
      secondary: dark ? 0.75 : 0.25,
      primary: 0.5,
      accent: dark ? 0.25 : 0.75,
    };
    const primary = colorAt(positions.primary);
    const secondary = colorAt(positions.secondary);
    const accent = colorAt(positions.accent);
    const foreground = dark ? white : black;
    const tokens: Record<string, Color> = {
      background: first,
      foreground,
      card,
      "card-foreground": foreground,
      popover: card,
      "popover-foreground": foreground,
      primary,
      "primary-foreground": themeInk(primary),
      secondary,
      "secondary-foreground": themeInk(secondary),
      accent,
      "accent-foreground": themeInk(accent),
      muted,
      "muted-foreground": foreground,
      border,
      input: border,
      ring: primary,
      sidebar: card,
      "sidebar-foreground": foreground,
      "sidebar-primary": primary,
      "sidebar-primary-foreground": themeInk(primary),
      "sidebar-accent": accent,
      "sidebar-accent-foreground": themeInk(accent),
      "sidebar-border": border,
      "sidebar-ring": primary,
    };
    return {
      colors: input.map((_, index) =>
        colorAt(index / Math.max(1, input.length - 1)),
      ),
      tokens,
      picks: Object.entries(positions)
        .map(([role, position]) => ({ role, position, color: tokens[role] }))
        .sort((a, b) => a.position - b.position),
    };
  }
  return { light: generate("light"), dark: generate("dark") };
}
export type HarmonizedPalettes = ReturnType<typeof harmonizePalette>;
export type ThemePalette = HarmonizedPalettes[ThemeMode];
