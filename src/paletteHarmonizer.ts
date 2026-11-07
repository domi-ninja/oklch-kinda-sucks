import type { Color } from "./color";
import type { PaletteThemeSettings } from "./workspaceSchema";
import { clampColor } from "./colorBounds";
import { interpolateCoordinates } from "./palette";
import { assignPaletteTheme } from "./paletteTheme";
import {
  apcaContrast,
  black,
  white,
  fitColor,
  contrastRatio,
  themeInk,
  solveTextContrast,
  contrastTone,
} from "./themeContrast";
export { themeInk } from "./themeContrast";
export type { ThemeMode } from "./paletteTheme";
export const defaultPaletteTheme: PaletteThemeSettings = {
  chroma: 1,
  mapping: "contrast",
  positions: { light: {}, dark: {} },
};

export function harmonizePalette(
  input: Color[],
  path = input,
  settings = defaultPaletteTheme,
) {
  const source = path.length ? path.map(clampColor) : [white, black];
  const seed = (t: number): Color => {
    const position = t * (source.length - 1),
      index = Math.floor(position);
    const from = source[index],
      to = source[Math.min(index + 1, source.length - 1)];
    const fromHue = from.c < 1e-7 ? to.h : from.h,
      toHue = to.c < 1e-7 ? fromHue : to.h;
    const [h, c, l] = interpolateCoordinates(
      [fromHue, from.c, from.l],
      [toHue, to.c, to.l],
      "OKHCL",
      position - index,
    );
    return { h, c: c * settings.chroma, l, a: 1 };
  };
  const toneAt = (t: number): Color => {
    const sample = fitColor(seed(t));
    if (settings.mapping === "apca") return contrastTone(sample, t, white);
    const ink = themeInk(sample);
    if (apcaContrast(ink, sample) >= 60) return sample;
    const target = solveTextContrast(sample, 60, ink);
    const candidate = fitColor({
      ...sample,
      l: sample.l + Math.max(-0.02, Math.min(0.02, target.l - sample.l)),
    });
    return apcaContrast(ink, candidate) >= apcaContrast(ink, sample) &&
      contrastRatio(ink, candidate) >= contrastRatio(ink, sample)
      ? candidate
      : sample;
  };
  const colors = input.map((_, index) =>
    toneAt(index / Math.max(1, input.length - 1)),
  );
  return {
    light: { colors, ...assignPaletteTheme(toneAt, settings, "light") },
    dark: { colors, ...assignPaletteTheme(toneAt, settings, "dark") },
  };
}
export type HarmonizedPalettes = ReturnType<typeof harmonizePalette>;
export type ThemePalette = HarmonizedPalettes["light"];
