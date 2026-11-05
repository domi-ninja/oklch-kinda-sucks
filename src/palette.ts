import { cssColor, type Color } from "./color";
import { clampColor } from "./colorBounds";
import { coordinates, fromCoordinates, type Coordinates } from "./pickerModes";
import type { PaletteEndpoint, PickerMode } from "./workspaceSchema";

export function interpolateCoordinates(
  start: Coordinates,
  end: Coordinates,
  mode: PickerMode,
  t: number,
): Coordinates {
  const result: Coordinates = [
    start[0] + (end[0] - start[0]) * t,
    start[1] + (end[1] - start[1]) * t,
    start[2] + (end[2] - start[2]) * t,
  ];
  if (mode !== "RGB") {
    const fromHue = start[1] < 0.000001 ? end[0] : start[0];
    const toHue = end[1] < 0.000001 ? fromHue : end[0];
    const delta = ((((toHue - fromHue + 540) % 360) + 360) % 360) - 180;
    result[0] = (((fromHue + delta * t) % 360) + 360) % 360;
  }
  return result;
}

// Subdivisions count intervals: four subdivisions produce five palette colors.
export function createPaletteRamp(
  start: Color,
  end: Color,
  mode: PickerMode,
  subdivisions: number,
) {
  start = clampColor(start);
  end = clampColor(end);
  const from = coordinates(start, mode);
  const to = coordinates(end, mode);
  const cache = new Map<number, Color>([
    [0, start],
    [1, end],
  ]);
  const at = (t: number) => {
    const existing = cache.get(t);
    if (existing) return existing;
    const color = fromCoordinates(
      interpolateCoordinates(from, to, mode, t),
      mode,
      start.a + (end.a - start.a) * t,
    );
    cache.set(t, color);
    return color;
  };
  return {
    colors: Array.from({ length: subdivisions + 1 }, (_, index) =>
      at(index / subdivisions),
    ),
    path: Array.from({ length: 33 }, (_, index) => at(index / 32)),
  };
}

export type PaletteRamp = ReturnType<typeof createPaletteRamp>;
export type PaletteEditor = PaletteRamp & {
  endpoint: PaletteEndpoint;
  onSelect: (endpoint: PaletteEndpoint) => void;
  onChange: (endpoint: PaletteEndpoint, color: Color) => void;
};

export function projectPalette(palette: PaletteRamp, mode: PickerMode) {
  const project = (color: Color) => ({
    color,
    values: coordinates(color, mode),
  });
  return {
    colors: palette.colors.map(project),
    path: palette.path.map(project),
  };
}
export type PlanePalette = ReturnType<typeof projectPalette> &
  Omit<PaletteEditor, keyof PaletteRamp>;

export type PlanePoint = { x: number; y: number };

// Break paths at the hue seam instead of drawing a false line across the plane.
export function palettePaths(points: PlanePoint[], hueAxis: "x" | "y" | null) {
  if (!points.length) return [];
  const paths: PlanePoint[][] = [];
  let current = [points[0]];
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1];
    const next = points[index];
    if (hueAxis && Math.abs(next[hueAxis] - previous[hueAxis]) > 50) {
      const increasing = next[hueAxis] < previous[hueAxis];
      const unwrapped = next[hueAxis] + (increasing ? 100 : -100);
      const boundary = increasing ? 100 : 0;
      const span = unwrapped - previous[hueAxis];
      const t = span === 0 ? 0 : (boundary - previous[hueAxis]) / span;
      const edge = {
        x: previous.x + (next.x - previous.x) * t,
        y: previous.y + (next.y - previous.y) * t,
        [hueAxis]: boundary,
      };
      current.push(edge);
      paths.push(current);
      current = [{ ...edge, [hueAxis]: 100 - boundary }, next];
    } else current.push(next);
  }
  paths.push(current);
  return paths;
}

export function paletteCss(colors: Color[]) {
  return `:root {\n${colors.map((color, index) => `  --palette-${index}: ${cssColor(color)};`).join("\n")}\n}`;
}
