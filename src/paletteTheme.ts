import { converter } from "culori";
import type { Color } from "./color";
import type { PaletteThemeSettings } from "./workspaceSchema";
import { contrastRatio, sharedThemeInk, themeInk } from "./themeContrast";
export type ThemeMode = "light" | "dark";
const toLab = converter("oklab"),
  toLch = converter("oklch");
function mix(a: Color, b: Color, amount: number): Color {
  const x = toLab({ mode: "oklch", ...a }),
    y = toLab({ mode: "oklch", ...b });
  const result = toLch({
    mode: "oklab",
    l: x.l + (y.l - x.l) * amount,
    a: x.a + (y.a - x.a) * amount,
    b: x.b + (y.b - x.b) * amount,
  });
  return { l: result.l, c: result.c, h: result.h ?? 0, a: 1 };
}

// Role choices do not alter the tone palette. Shared text must work on both the page and cards.
export function assignPaletteTheme(
  toneAt: (position: number) => Color,
  settings: PaletteThemeSettings,
  mode: ThemeMode,
) {
  const dark = mode === "dark",
    apca = settings.mapping === "apca";
  const positions: Record<string, number> = {
    background: dark ? (apca ? 0.98 : 0.875) : 0.05,
    card: dark ? (apca ? 0.96 : 1) : 0,
    primary: apca ? 0.55 : dark ? 0.25 : 1,
    secondary: dark ? (apca ? 0.94 : 0.75) : apca ? 0.1 : 0.25,
    accent: apca ? (dark ? 0.88 : 0.15) : 0.45,
  };
  const tokens: Record<string, Color> = {};
  for (const [role, fallback] of Object.entries(positions)) {
    positions[role] = settings.positions[mode][role] ?? fallback;
    tokens[role] = toneAt(positions[role]);
  }
  tokens.foreground = sharedThemeInk([tokens.background, tokens.card]);
  for (const role of ["card", "primary", "secondary", "accent"])
    tokens[`${role}-foreground`] = themeInk(tokens[role]);
  const resolved: Record<string, Color> = {
    ...tokens,
    muted: mix(tokens.card, tokens.foreground, 0.05),
    border: mix(tokens.card, tokens.foreground, 0.15),
    "muted-foreground": tokens.foreground,
  };
  const pairs = [
    ["foreground", "background"],
    ["foreground", "card"],
    ["muted-foreground", "muted"],
    ["primary-foreground", "primary"],
    ["secondary-foreground", "secondary"],
    ["accent-foreground", "accent"],
    ["card-foreground", "card"],
  ];
  const checks = pairs.map(([foreground, background]) => ({
    foreground,
    background,
    ratio: contrastRatio(resolved[foreground], resolved[background]),
  }));
  const tokenPicks = Object.entries(positions).map(([role, position]) => ({
    role,
    position,
    color: tokens[role],
  }));
  return {
    tokens,
    resolved,
    checks,
    positions,
    tokenPicks,
    picks: tokenPicks
      .filter((pick) => pick.role !== "card")
      .sort((a, b) => a.position - b.position),
  };
}
