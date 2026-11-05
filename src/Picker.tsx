import { useId, useMemo } from "react";
import { ColorPlane } from "./ColorPlane";
import { pickerPlanes } from "./planes";
import { usePlaneRenderer } from "./usePlaneRenderer";
import { type Color, cssColor, round } from "./color";
import type { PickerMode } from "./workspace";
import { NumericInput } from "./NumericInput";
import { projectPalette, type PaletteEditor } from "./palette";
import {
  channels,
  coordinates,
  coordinateCss,
  fromCoordinates,
  type Coordinates,
} from "./pickerModes";
export function Picker({
  color,
  mode = "OKHCL",
  onChange,
  palette,
}: {
  color: Color;
  mode?: PickerMode;
  onChange: (color: Color) => void;
  palette?: PaletteEditor;
}) {
  const id = useId();
  const values = coordinates(color, mode);
  const config = channels[mode];
  const render = usePlaneRenderer();
  const projection = useMemo(
    () => (palette ? projectPalette(palette, mode) : undefined),
    [palette?.colors, palette?.path, mode],
  );
  const dimensions = [
    ...config.map((channel, index) => ({
      ...channel,
      value: values[index],
      change: (value: number) => {
        const next: Coordinates = [...values];
        next[index] = value;
        onChange(fromCoordinates(next, mode, color.a));
      },
      paint: (value: number) => {
        const next: Coordinates = [...values];
        next[index] = value;
        return coordinateCss(next, mode);
      },
    })),
    {
      name: "Alpha",
      max: 1,
      unit: "",
      step: 0.001,
      value: color.a,
      change: (a: number) => onChange({ ...color, a }),
      paint: (a: number) => cssColor({ ...color, a }),
    },
  ];
  return (
    <div className="picker">
      <div className="color-planes">
        {pickerPlanes(mode).map((mapping) => (
          <ColorPlane
            key={mapping.fixed}
            color={color}
            mode={mode}
            values={values}
            mapping={mapping}
            render={render}
            onChange={onChange}
            palette={
              palette && projection ? { ...palette, ...projection } : undefined
            }
          />
        ))}
      </div>
      {dimensions.map(({ name, max, unit, step, value, change, paint }) => (
        <div className="slider-row" key={name}>
          <label htmlFor={`${id}-${name}`}>{name}</label>
          <input
            id={`${id}-${name}`}
            aria-label={name}
            type="range"
            min="0"
            max={Math.max(100, (value / max) * 100)}
            step={0.1}
            value={(value / max) * 100}
            style={{
              backgroundImage: `linear-gradient(to right, ${Array.from({ length: 37 }, (_, i) => paint((i / 36) * Math.max(max, value))).join(",")})`,
            }}
            onChange={(e) => change((Number(e.target.value) / 100) * max)}
          />
          <label className="number">
            <NumericInput
              aria-label={`${name} value`}
              min={0}
              max={Math.max(max, value)}
              step={step}
              value={round(value, 3)}
              onValueChange={change}
            />
            <span>{unit}</span>
          </label>
          <label className="number">
            <NumericInput
              aria-label={`${name} percentage`}
              min={0}
              max={Math.max(100, (value / max) * 100)}
              step={0.1}
              value={round((value / max) * 100, 3)}
              onValueChange={(value) => change((value / 100) * max)}
            />
            <span>%</span>
          </label>
        </div>
      ))}
      <div className="picker-expression">
        {coordinateCss(
          [round(values[0], 3), round(values[1], 3), round(values[2], 3)],
          mode,
          round(color.a),
        )}
      </div>
    </div>
  );
}
