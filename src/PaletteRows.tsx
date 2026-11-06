import { useMemo } from "react";
import {
  checkerColors,
  cssColor,
  sampleColor,
  sampleChannels,
  type Color,
} from "./color";
import { paletteTextColor, useDisplayColorSpace } from "./paletteContrast";

export function PaletteRows({
  colors,
  harmonized = false,
  brightnessFilter,
  pending = false,
}: {
  colors: Color[];
  harmonized?: boolean;
  brightnessFilter: string;
  pending?: boolean;
}) {
  const displayColorSpace = useDisplayColorSpace();
  const labels = useMemo(
    () =>
      colors.map((color) => {
        const css = cssColor(color);
        const sample = sampleColor(css);
        const backgrounds =
          color.a < 1
            ? Object.values(checkerColors).map((background) =>
                sampleChannels(css, background, displayColorSpace),
              )
            : [
                displayColorSpace === "srgb"
                  ? sample
                  : sampleChannels(css, undefined, displayColorSpace),
              ];
        return {
          hex: sample.hex,
          color: paletteTextColor(
            backgrounds.map((background) => background.channels),
            backgrounds[0].colorSpace,
          ),
        };
      }),
    [colors, displayColorSpace],
  );
  return (
    <>
      {[false, true].map((brightness) => (
        <ol
          key={String(brightness)}
          className={`palette-strip${brightness ? " palette-brightness" : ""}`}
          aria-label={
            brightness
              ? harmonized
                ? "Harmonized brightness"
                : "Perceived brightness"
              : harmonized
                ? "Harmonized colors"
                : "Palette colors"
          }
          aria-busy={pending}
          style={{
            gridTemplateColumns: `repeat(${colors.length}, minmax(0, 1fr))`,
            filter: brightness ? `url(#${brightnessFilter})` : undefined,
          }}
        >
          {colors.map((color, index) => (
            <li
              key={index}
              className="checker"
              title={cssColor(color)}
              aria-label={`${brightness ? "Brightness of color" : "Color"} ${index + 1}${brightness ? "" : `: ${cssColor(color)}`}`}
            >
              <span style={{ background: cssColor(color) }} />
              {!brightness && (
                <code
                  className="palette-hex"
                  style={{ color: labels[index].color }}
                  title={`sRGB ${labels[index].hex}`}
                >
                  {labels[index].hex}
                </code>
              )}
            </li>
          ))}
        </ol>
      ))}
    </>
  );
}
