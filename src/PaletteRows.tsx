import { useMemo } from "react";
import {
  checkerColors,
  cssColor,
  sampleColor,
  sampleChannels,
  type Color,
} from "./color";
import { paletteTextColor, useDisplayColorSpace } from "./paletteContrast";
import type { ThemeMode, ThemePalette } from "./paletteHarmonizer";

const noPicks: ThemePalette["picks"] = [];

export function PaletteRows({
  colors,
  variant,
  picks = noPicks,
  brightnessFilter,
  pending = false,
}: {
  colors: Color[];
  variant?: ThemeMode;
  picks?: ThemePalette["picks"];
  brightnessFilter: string;
  pending?: boolean;
}) {
  const displayColorSpace = useDisplayColorSpace();
  const labels = useMemo(
    () =>
      [...colors, ...picks.map((pick) => pick.color)].map((color) => {
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
    [colors, picks, displayColorSpace],
  );
  const extraPicks = picks.filter(
    (pick) => !Number.isInteger(pick.position * (colors.length - 1)),
  );
  return (
    <>
      {[false, true].map((brightness) => (
        <ol
          key={String(brightness)}
          className={`palette-strip${brightness ? " palette-brightness" : picks.length ? " palette-with-roles" : ""}`}
          aria-label={
            brightness
              ? variant
                ? `Harmonized ${variant} brightness`
                : "Perceived brightness"
              : variant
                ? `Harmonized ${variant} colors`
                : "Palette colors"
          }
          aria-busy={pending}
          style={{
            gridTemplateColumns: `repeat(${colors.length}, minmax(0, 1fr))`,
            filter: brightness ? `url(#${brightnessFilter})` : undefined,
          }}
        >
          {colors.map((color, index) => {
            const role = picks.find(
              (pick) => pick.position * (colors.length - 1) === index,
            )?.role;
            return (
              <li
                key={index}
                className="checker"
                title={`${role ? `${role}: ` : ""}${cssColor(color)}`}
                aria-label={`${brightness ? "Brightness of color" : "Color"} ${index + 1}${role ? ` (${role})` : ""}${brightness ? "" : `: ${cssColor(color)}`}`}
              >
                <span style={{ background: cssColor(color) }} />
                {!brightness && (
                  <>
                    <code
                      className="palette-hex"
                      style={{ color: labels[index].color }}
                      title={`sRGB ${labels[index].hex}`}
                    >
                      {labels[index].hex}
                    </code>
                    {role && (
                      <span
                        className="palette-role"
                        style={{ color: labels[index].color }}
                      >
                        {role[0].toUpperCase() + role.slice(1)}
                      </span>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ol>
      ))}
      {extraPicks.length > 0 && (
        <ul
          className="palette-extra-picks"
          aria-label={`Harmonized ${variant} additional samples`}
        >
          {extraPicks.map((pick) => {
            const label = labels[colors.length + picks.indexOf(pick)];
            return (
              <li
                key={pick.role}
                title={cssColor(pick.color)}
                style={{ background: cssColor(pick.color), color: label.color }}
              >
                <code>{label.hex}</code>
                <span className="palette-role">
                  {pick.role[0].toUpperCase() + pick.role.slice(1)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
