import { useId, type CSSProperties } from "react";
import { Copy } from "lucide-react";
import { Button } from "./components/ui/button";
import { NumericInput } from "./NumericInput";
import { checkerColors, cssColor, type Color } from "./color";
import { PaletteRows } from "./PaletteRows";
import { useHarmonizedPalette } from "./useHarmonizedPalette";
import { paletteLabels } from "./palette";
import {
  pickerModes,
  palettePoints,
  type Palette,
  type PaletteEndpoint,
} from "./workspaceSchema";

export function PaletteControls({
  start,
  palette,
  colors,
  onChange,
  onSelect,
  onToggleMiddle,
  onClose,
  onCopy,
  onCopyHarmonized,
}: {
  start: Color;
  palette: Palette;
  colors: Color[];
  onChange: (patch: Partial<Pick<Palette, "mode" | "subdivisions">>) => void;
  onSelect: (endpoint: PaletteEndpoint) => void;
  onToggleMiddle: () => void;
  onClose: () => void;
  onCopy: () => void;
  onCopyHarmonized: (colors: Color[]) => void;
}) {
  const brightnessFilter = useId();
  const harmony = useHarmonizedPalette(colors);
  const harmonizedColors =
    harmony.palette?.colors.length === colors.length
      ? harmony.palette.colors
      : colors;
  return (
    <section className="panel palette-panel" aria-label="Palette">
      <div className="panel-heading">
        <h2>Palette</h2>
        <Button variant="outline" onClick={onClose}>
          Single color
        </Button>
      </div>
      <div className="palette-controls">
        <div
          className="palette-endpoints"
          role="group"
          aria-label="Edit palette color"
        >
          {palettePoints.map((endpoint) => {
            const pointColor = endpoint === "start" ? start : palette[endpoint];
            if (!pointColor) return null;
            return (
              <Button
                key={endpoint}
                variant="outline"
                aria-pressed={palette.endpoint === endpoint}
                onClick={() => onSelect(endpoint)}
              >
                <span
                  className="palette-choice-color"
                  style={{ background: cssColor(pointColor) }}
                  aria-hidden="true"
                />
                {paletteLabels[endpoint]}
              </Button>
            );
          })}
          <Button variant="outline" onClick={onToggleMiddle}>
            {palette.middle ? "Remove middle color" : "Add middle color"}
          </Button>
        </div>
        <div className="palette-config">
          <label>
            Subdivisions
            <span className="number">
              <NumericInput
                aria-label="Palette subdivisions"
                min={1}
                max={64}
                step={1}
                value={palette.subdivisions}
                onValueChange={(subdivisions) =>
                  onChange({
                    subdivisions: Math.round(subdivisions),
                  })
                }
              />
            </span>
          </label>
          <label>
            Interpolation
            <select
              aria-label="Palette interpolation"
              value={palette.mode}
              onChange={(event) => {
                const mode = pickerModes.find(
                  (mode) => mode === event.target.value,
                );
                if (mode) onChange({ mode });
              }}
            >
              {pickerModes.map((mode) => (
                <option key={mode}>{mode}</option>
              ))}
            </select>
          </label>
        </div>
        <div
          className="palette-scales"
          style={
            {
              "--checker-dark": checkerColors.dark,
              "--checker-light": checkerColors.light,
            } as CSSProperties
          }
        >
          <svg
            width="0"
            height="0"
            aria-hidden="true"
            className="palette-filter"
          >
            <defs>
              <filter
                id={brightnessFilter}
                x="0"
                y="0"
                width="100%"
                height="100%"
              >
                {/* Linear-light sRGB weights preserve luminance after checkerboard compositing. */}
                <feColorMatrix
                  colorInterpolationFilters="linearRGB"
                  type="matrix"
                  values="0.2126 0.7152 0.0722 0 0
                          0.2126 0.7152 0.0722 0 0
                          0.2126 0.7152 0.0722 0 0
                          0      0      0      1 0"
                />
              </filter>
            </defs>
          </svg>
          <div className="palette-scale-scroll">
            <div
              className="palette-scale-content"
              style={{ minWidth: colors.length * 88 }}
            >
              <span className="palette-row-heading">Original</span>
              <PaletteRows
                colors={colors}
                brightnessFilter={brightnessFilter}
              />
              <span className="palette-row-heading">
                {harmony.pending
                  ? "Harmonizing…"
                  : harmony.error
                    ? "Harmonization failed"
                    : `Harmonized · ${harmony.palette?.background === "white" ? "light" : "dark"} background`}
              </span>
              <PaletteRows
                colors={harmonizedColors}
                harmonized
                brightnessFilter={brightnessFilter}
                pending={harmony.pending}
              />
            </div>
          </div>
          {harmony.error && (
            <span role="alert" className="error">
              {harmony.error}
            </span>
          )}
        </div>
        <div className="palette-actions">
          <span>{colors.length} colors</span>
          <Button variant="outline" onClick={onCopy}>
            <Copy size={15} />
            Copy palette
          </Button>
          <Button
            variant="outline"
            disabled={harmony.pending || !!harmony.error || !harmony.palette}
            onClick={() => {
              if (harmony.palette) onCopyHarmonized(harmony.palette.colors);
            }}
          >
            <Copy size={15} />
            Copy harmonized
          </Button>
        </div>
      </div>
    </section>
  );
}
