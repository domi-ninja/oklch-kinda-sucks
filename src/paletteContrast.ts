import { useSyncExternalStore } from "react";
import { APCAcontrast, displayP3toY, sRGBtoY } from "apca-w3";

const gamutQuery = "(color-gamut: p3)";
function subscribeToDisplayGamut(onChange: () => void) {
  const query = window.matchMedia(gamutQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const supportsP3 = () => window.matchMedia(gamutQuery).matches;

export function useDisplayColorSpace(): PredefinedColorSpace {
  return useSyncExternalStore(subscribeToDisplayGamut, supportsP3)
    ? "display-p3"
    : "srgb";
}

// Choose the stronger worst-case APCA magnitude across both composited checker shades.
export function paletteTextColor(
  backgrounds: ReadonlyArray<readonly number[]>,
  colorSpace: PredefinedColorSpace,
) {
  const luminances = backgrounds.map(([r, g, b]) =>
    colorSpace === "display-p3"
      ? displayP3toY([r / 255, g / 255, b / 255])
      : sRGBtoY([r, g, b]),
  );
  const black = Math.min(
    ...luminances.map((y) => Math.abs(APCAcontrast(0, y))),
  );
  const white = Math.min(
    ...luminances.map((y) => Math.abs(APCAcontrast(1, y))),
  );
  return black >= white ? "#000" : "#fff";
}
