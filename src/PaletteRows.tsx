import { useMemo } from "react";
import {
  checkerColors,
  cssColor,
  sampleColor,
  sampleChannels,
  type Color,
} from "./color";
import { paletteTextColor, useDisplayColorSpace } from "./paletteContrast";
import type { ThemeMode } from "./paletteHarmonizer";

export function PaletteRows({
  colors,
  variant,
  brightnessFilter,
  pending = false,
}: {
  colors: Color[];
  variant?: ThemeMode;
  brightnessFilter: string;
  pending?: boolean;
}) {
  const space = useDisplayColorSpace();
  const labels = useMemo(
    () =>
      colors.map((color) => {
        const css = cssColor(color),
          sample = sampleColor(css);
        const backgrounds =
          color.a < 1
            ? Object.values(checkerColors).map((background) =>
                sampleChannels(css, background, space),
              )
            : [
                space === "srgb"
                  ? sample
                  : sampleChannels(css, undefined, space),
              ];
        return {
          hex: sample.hex,
          ink: paletteTextColor(
            backgrounds.map((bg) => bg.channels),
            backgrounds[0].colorSpace,
          ),
        };
      }),
    [colors, space],
  );
  return (
    <ol
      className="palette-strip"
      aria-label={variant ? `Harmonized ${variant} colors` : "Palette colors"}
      aria-busy={pending}
    >
      {colors.map((color, index) => (
        <li
          key={index}
          aria-label={`Color ${index + 1}: ${cssColor(color)}`}
          title={cssColor(color)}
        >
          <div className="palette-cell-color checker">
            <span style={{ background: cssColor(color) }} />
            <code
              className="palette-hex"
              style={{ color: labels[index].ink }}
              title={`sRGB ${labels[index].hex}`}
            >
              {labels[index].hex}
            </code>
          </div>
          <div
            className="palette-cell-brightness checker"
            role="img"
            aria-label={`Brightness of color ${index + 1}`}
            style={{ filter: `url(#${brightnessFilter})` }}
          >
            <span style={{ background: cssColor(color) }} />
          </div>
        </li>
      ))}
    </ol>
  );
}
