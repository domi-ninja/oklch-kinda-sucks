import { apcach, calcContrast, crToBg, inColorSpace, maxChroma } from "apcach";
import { cssColor, type Color } from "./color";
import { clampColor } from "./colorBounds";
import type { HarmonizerSettings } from "./workspaceSchema";

export function generateHarmonizer(settings: HarmonizerSettings) {
  const columns = settings.levels.map((level, index) => {
    const dark = index < settings.darkColumns;
    const background = dark
      ? settings.darkBackground
      : settings.lightBackground;
    const contrast = crToBg(
      background,
      level.contrast,
      "apca",
      dark ? "lighter" : "darker",
    );
    const maxima = settings.rows.map((row) =>
      apcach(contrast, maxChroma(level.chroma), row.hue, 100, settings.gamut),
    );
    const common = Math.min(...maxima.map((color) => color.chroma));
    const cells = settings.rows.map((row, rowIndex) => {
      const result =
        settings.chromaMode === "even"
          ? apcach(contrast, common, row.hue, 100, settings.gamut)
          : maxima[rowIndex];
      const color: Color = clampColor({
        l: result.lightness,
        c: result.chroma,
        h: row.hue,
        a: 1,
      });
      const css = cssColor(color);
      return {
        color,
        contrast: calcContrast(css, background, "apca", settings.gamut),
        p3: !inColorSpace(css, "srgb"),
        outOfGamut: !inColorSpace(css, settings.gamut),
      };
    });
    return {
      cells,
      chroma:
        settings.chromaMode === "even"
          ? common
          : Math.max(...maxima.map((color) => color.chroma)),
    };
  });
  return {
    chromas: columns.map((column) => column.chroma),
    rows: settings.rows.map((row, index) => ({
      id: row.id,
      cells: columns.map((column) => column.cells[index]),
    })),
  };
}
export type HarmonizerGrid = ReturnType<typeof generateHarmonizer>;
export type HarmonizerSeed = { start: Color; end: Color; hue: number };
