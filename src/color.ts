export type Color = { l: number; c: number; h: number; a: number };
export const initialColor: Color = { l: 0.9403, c: 0.1, h: 184.41, a: 1 };
export const round = (n: number, places = 4) => Number(n.toFixed(places));
export const cssColor = (c: Color) =>
  `oklch(${round(c.l)} ${round(c.c)} ${round(c.h, 2)} / ${round(c.a * 100, 2)}%)`;
// CSS hue accepts angles, never percentages. The all-percent form is an editor notation.
export const percentColor = (c: Color) =>
  `oklch(${round(c.l * 100, 2)}% ${round((c.c / 0.4) * 100, 2)}% ${round((c.h / 360) * 100, 2)}% / ${round(c.a * 100, 2)}%)`;
export function parseColor(text: string): Color | null {
  const match = text
    .trim()
    .match(
      /^oklch\(\s*([\d.+-]+)(%?)\s+([\d.+-]+)(%?)\s+([\d.+-]+)(%|deg)?\s*(?:\/\s*([\d.+-]+)(%?))?\s*\)$/i,
    );
  if (!match) return null;
  const [, l, lp, c, cp, h, hp, a, ap] = match;
  const result = {
    l: Number(l) / (lp ? 100 : 1),
    c: Number(c) * (cp ? 0.004 : 1),
    h: Number(h) * (hp === "%" ? 3.6 : 1),
    a: a === undefined ? 1 : Number(a) / (ap ? 100 : 1),
  };
  return Object.values(result).every(Number.isFinite) &&
    result.l >= 0 &&
    result.l <= 1 &&
    result.c >= 0 &&
    result.c <= 0.4 &&
    result.a >= 0 &&
    result.a <= 1
    ? { ...result, h: ((result.h % 360) + 360) % 360 }
    : null;
}
const sampleContexts = new Map<
  PredefinedColorSpace,
  CanvasRenderingContext2D
>();
export const checkerColors = { dark: "#a6a6a6", light: "#bfbfbf" };
export function sampleChannels(
  color: string,
  background?: string,
  colorSpace: PredefinedColorSpace = "srgb",
) {
  let ctx = sampleContexts.get(colorSpace);
  if (!ctx) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    ctx =
      canvas.getContext("2d", {
        colorSpace,
        willReadFrequently: true,
      }) ?? undefined;
    if (ctx) sampleContexts.set(colorSpace, ctx);
  }
  if (!ctx) throw new Error("Canvas 2D is unavailable");
  ctx.fillStyle = "#000";
  ctx.fillStyle = color;
  const parsed = ctx.fillStyle;
  ctx.fillStyle = "#fff";
  ctx.fillStyle = color;
  if (ctx.fillStyle !== parsed) throw new Error("Invalid CSS color");
  ctx.clearRect(0, 0, 1, 1);
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = color;
  }
  ctx.fillRect(0, 0, 1, 1);
  const image = ctx.getImageData(0, 0, 1, 1, { colorSpace });
  const [r, g, b, a] = image.data;
  // Browsers can ignore P3 requests; contrast must use the actual readback space.
  return {
    channels: [r, g, b, a] as const,
    colorSpace: image.colorSpace ?? "srgb",
  };
}
export function sampleColor(color: string, background?: string) {
  const sample = sampleChannels(color, background);
  const [r, g, b, a] = sample.channels;
  return {
    ...sample,
    rgb: `rgb(${r} ${g} ${b} / ${round(a / 255)})`,
    hex: `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}${a === 255 ? "" : a.toString(16).padStart(2, "0")}`,
  };
}
