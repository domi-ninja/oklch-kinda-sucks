import { useId, useMemo, type CSSProperties } from "react";
import { Copy } from "lucide-react";
import { Button } from "./components/ui/button";
import { NumericInput } from "./NumericInput";
import { checkerColors, cssColor, sampleColor, type Color } from "./color";
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
}: {
  start: Color;
  palette: Palette;
  colors: Color[];
  onChange: (patch: Partial<Pick<Palette, "mode" | "subdivisions">>) => void;
  onSelect: (endpoint: PaletteEndpoint) => void;
  onToggleMiddle: () => void;
  onClose: () => void;
  onCopy: () => void;
}) {
  const brightnessFilter = useId();
  const hexColors = useMemo(
    () => colors.map((color) => sampleColor(cssColor(color)).hex),
    [colors],
  );
  const brightnessReference = useMemo(() => {
    // Composite endpoints before interpolating linear-light RGB so alpha also matches each checker shade.
    const steps = (background: string) => {
      const from = sampleColor(cssColor(start), background).rgb;
      const to = sampleColor(cssColor(palette.end), background).rgb;
      return colors.map(
        (_, index) =>
          `color-mix(in srgb-linear, ${from}, ${to} ${(index / (colors.length - 1)) * 100}%)`,
      );
    };
    return {
      light: steps(checkerColors.light),
      dark: steps(checkerColors.dark),
    };
  }, [start, palette.end, colors.length]);
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
              {[false, true].map((brightness) => (
                <ol
                  key={String(brightness)}
                  className={`palette-strip${brightness ? " palette-brightness" : ""}`}
                  aria-label={
                    brightness ? "Perceived brightness" : "Palette colors"
                  }
                  style={{
                    gridTemplateColumns: `repeat(${colors.length}, minmax(0, 1fr))`,
                    filter: brightness
                      ? `url(#${brightnessFilter})`
                      : undefined,
                  }}
                >
                  {colors.map((color, index) => (
                    <li
                      key={index}
                      className="checker"
                      aria-label={
                        brightness
                          ? `Brightness of color ${index + 1}`
                          : `Color ${index + 1}: ${cssColor(color)}`
                      }
                      title={cssColor(color)}
                    >
                      <span style={{ background: cssColor(color) }} />
                      {!brightness && (
                        <code
                          className="palette-hex"
                          title={`sRGB ${hexColors[index]}`}
                        >
                          {hexColors[index]}
                        </code>
                      )}
                    </li>
                  ))}
                </ol>
              ))}
              <div
                className="palette-strip palette-brightness-reference"
                role="img"
                aria-label="Linear Start to End brightness"
                title="Linear Start to End brightness"
                style={{
                  filter: `url(#${brightnessFilter})`,
                  gridTemplateColumns: `repeat(${colors.length}, minmax(0, 1fr))`,
                }}
              >
                {brightnessReference.light.map((light, index) => (
                  <span className="palette-reference-step" key={index}>
                    <span style={{ backgroundColor: light }} />
                    <span
                      className="palette-reference-dark"
                      style={{
                        backgroundColor: brightnessReference.dark[index],
                      }}
                    />
                  </span>
                ))}
              </div>
            </div>
          </div>
          <span>Brightness / Linear reference · sRGB</span>
        </div>
        <div className="palette-actions">
          <span>{colors.length} colors</span>
          <Button variant="outline" onClick={onCopy}>
            <Copy size={15} />
            Copy palette
          </Button>
        </div>
      </div>
    </section>
  );
}
