import { cssColor, type Color } from "./color";
import { clampColor } from "./colorBounds";
import { coordinates, fromCoordinates, type Coordinates } from "./pickerModes";
import type { PaletteEndpoint, PickerMode } from "./workspaceSchema";

export const paletteLabels = {
  start: "Start",
  middle: "Middle",
  end: "End",
} satisfies Record<PaletteEndpoint, string>;

function hueDelta(from: number, to: number) {
  return ((((to - from + 540) % 360) + 360) % 360) - 180;
}

function quadratic(start: number, middle: number, end: number, t: number) {
  return (1 - t) ** 2 * start + 2 * (1 - t) * t * middle + t ** 2 * end;
}

export function bezierCoordinates(
  start: Coordinates,
  middle: Coordinates,
  end: Coordinates,
  mode: PickerMode,
  t: number,
): Coordinates {
  const result: Coordinates = [
    quadratic(start[0], middle[0], end[0], t),
    quadratic(start[1], middle[1], end[1], t),
    quadratic(start[2], middle[2], end[2], t),
  ];
  if (mode !== "RGB") {
    const from =
      start[1] < 0.000001
        ? middle[1] < 0.000001
          ? end[0]
          : middle[0]
        : start[0];
    const to =
      end[1] < 0.000001 ? (middle[1] < 0.000001 ? from : middle[0]) : end[0];
    const unwrappedEnd = from + hueDelta(from, to);
    const center = (from + unwrappedEnd) / 2;
    // Lift the control hue nearest the straight path's midpoint before blending.
    // Wrapping intermediate lerps separately can introduce a jump in the curve.
    const control =
      middle[1] < 0.000001 ? center : center + hueDelta(center, middle[0]);
    result[0] = ((quadratic(from, control, unwrappedEnd, t) % 360) + 360) % 360;
  }
  return result;
}

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
    const delta = hueDelta(fromHue, toHue);
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
  middle?: Color,
) {
  start = clampColor(start);
  end = clampColor(end);
  middle = middle && clampColor(middle);
  const from = coordinates(start, mode);
  const to = coordinates(end, mode);
  const control = middle && coordinates(middle, mode);
  const cache = new Map<number, Color>([
    [0, start],
    [1, end],
  ]);
  const at = (t: number) => {
    const existing = cache.get(t);
    if (existing) return existing;
    const color = fromCoordinates(
      control
        ? bezierCoordinates(from, control, to, mode, t)
        : interpolateCoordinates(from, to, mode, t),
      mode,
      middle
        ? quadratic(start.a, middle.a, end.a, t)
        : start.a + (end.a - start.a) * t,
    );
    cache.set(t, color);
    return color;
  };
  return {
    controls: { start, middle, end },
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
    controls: {
      start: project(palette.controls.start),
      middle: palette.controls.middle && project(palette.controls.middle),
      end: project(palette.controls.end),
    },
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
