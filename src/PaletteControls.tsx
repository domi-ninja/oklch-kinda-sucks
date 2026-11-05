import { Copy } from "lucide-react";
import { Button } from "./components/ui/button";
import { NumericInput } from "./NumericInput";
import { cssColor, type Color } from "./color";
import {
  pickerModes,
  type Palette,
  type PaletteEndpoint,
} from "./workspaceSchema";

export function PaletteControls({
  start,
  palette,
  colors,
  onChange,
  onSelect,
  onClose,
  onCopy,
}: {
  start: Color;
  palette: Palette;
  colors: Color[];
  onChange: (patch: Partial<Pick<Palette, "mode" | "subdivisions">>) => void;
  onSelect: (endpoint: PaletteEndpoint) => void;
  onClose: () => void;
  onCopy: () => void;
}) {
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
          aria-label="Edit palette endpoint"
        >
          {(["start", "end"] as const).map((endpoint) => (
            <Button
              key={endpoint}
              variant="outline"
              aria-pressed={palette.endpoint === endpoint}
              onClick={() => onSelect(endpoint)}
            >
              <span
                className="palette-choice-color"
                style={{
                  background: cssColor(
                    endpoint === "start" ? start : palette.end,
                  ),
                }}
                aria-hidden="true"
              />
              {endpoint === "start" ? "Start" : "End"}
            </Button>
          ))}
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
        <ol
          className="palette-strip"
          aria-label="Palette colors"
          style={{
            gridTemplateColumns: `repeat(${colors.length}, minmax(0, 1fr))`,
          }}
        >
          {colors.map((color, index) => (
            <li
              key={index}
              className="checker"
              aria-label={`Color ${index + 1}: ${cssColor(color)}`}
              title={cssColor(color)}
            >
              <span style={{ background: cssColor(color) }} />
            </li>
          ))}
        </ol>
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
