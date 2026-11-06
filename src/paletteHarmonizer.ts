import { converter, toGamut } from "culori";
import { APCAcontrast, displayP3toY } from "apca-w3";
import type { Color } from "./color";
import { clampColor } from "./colorBounds";

type Background = "black" | "white";
const toP3 = toGamut("p3", "oklch", null, 0);
const toOklch = converter("oklch");

function contrast(color: Color, background: Background) {
  const rgb = toP3({ mode: "oklch", l: color.l, c: color.c, h: color.h });
  const base = background === "white" ? 1 : 0;
  const y = displayP3toY([
    rgb.r * color.a + base * (1 - color.a),
    rgb.g * color.a + base * (1 - color.a),
    rgb.b * color.a + base * (1 - color.a),
  ]);
  return Math.abs(APCAcontrast(y, base));
}

function fit(color: Color): Color {
  const mapped = toOklch(
    toP3({ mode: "oklch", l: color.l, c: color.c, h: color.h }),
  );
  return clampColor({ ...color, l: mapped.l, c: mapped.c });
}

// Retain hue, alpha and chroma intent while solving an even APCA progression between the endpoints.
export function harmonizePalette(input: Color[]) {
  const colors = input.map(clampColor);
  const white = colors.map((color) => contrast(color, "white"));
  const black = colors.map((color) => contrast(color, "black"));
  const sum = (values: number[]) =>
    values.reduce((total, value) => total + value, 0);
  const background: Background = sum(white) >= sum(black) ? "white" : "black";
  const contrasts = background === "white" ? white : black;
  const from = contrasts[0] ?? 0;
  const to = contrasts.at(-1) ?? from;
  return {
    background,
    colors: colors.map((color, index) => {
      if (index === 0 || index === colors.length - 1) return color;
      if (color.a === 0) return fit(color);
      const target = from + ((to - from) * index) / (colors.length - 1);
      let low = 0;
      let high = 1;
      let best = fit(color);
      let error = Math.abs(contrast(best, background) - target);
      for (const l of [0, 1]) {
        const candidate = fit({ ...color, l });
        const nextError = Math.abs(contrast(candidate, background) - target);
        if (nextError < error) {
          best = candidate;
          error = nextError;
        }
      }
      for (let iteration = 0; iteration < 18; iteration++) {
        const l = (low + high) / 2;
        const candidate = fit({ ...color, l });
        const measured = contrast(candidate, background);
        const nextError = Math.abs(measured - target);
        if (nextError < error) {
          best = candidate;
          error = nextError;
        }
        const needsLighter =
          background === "black" ? measured < target : measured > target;
        if (needsLighter) low = l;
        else high = l;
      }
      return best;
    }),
  };
}
export type HarmonizedPalette = ReturnType<typeof harmonizePalette>;
