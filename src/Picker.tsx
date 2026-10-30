import { useEffect, useId, useRef } from "react";
import { type Color, cssColor, round } from "./color";
import type { PickerMode } from "./workspace";
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
}: {
  color: Color;
  mode?: PickerMode;
  onChange: (color: Color) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const id = useId();
  const values = coordinates(color, mode);
  const config = channels[mode];
  const xAxis = mode === "RGB" ? 0 : 1;
  const yAxis = mode === "RGB" ? 1 : 2;
  const fixed = values[mode === "RGB" ? 2 : 0];
  useEffect(
    function paintBrowserPlane() {
      const ctx = canvas.current?.getContext("2d", { colorSpace: "srgb" });
      if (!ctx) return;
      for (let y = 0; y < 160; y++)
        for (let x = 0; x < 256; x++) {
          const point: Coordinates =
            mode === "RGB"
              ? [(x / 255) * 255, (1 - y / 159) * 255, fixed]
              : [
                  fixed,
                  (x / 255) * channels[mode][1].max,
                  (1 - y / 159) * channels[mode][2].max,
                ];
          ctx.fillStyle = coordinateCss(point, mode);
          ctx.fillRect(x, y, 1, 1);
        }
    },
    [mode, fixed],
  );
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const bounds = e.currentTarget.getBoundingClientRect();
    const next: Coordinates = [...values];
    next[xAxis] =
      Math.max(0, Math.min(1, (e.clientX - bounds.left) / bounds.width)) *
      config[xAxis].max;
    next[yAxis] =
      (1 - Math.max(0, Math.min(1, (e.clientY - bounds.top) / bounds.height))) *
      config[yAxis].max;
    onChange(fromCoordinates(next, mode, color.a));
  };
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
  ].map((dimension) => {
    if (mode !== "OKHCL") return dimension;
    const scale = 100 / dimension.max;
    return {
      ...dimension,
      max: 100,
      step: 0.1,
      unit: "%",
      value: dimension.value * scale,
      change: (value: number) => dimension.change(value / scale),
      paint: (value: number) => dimension.paint(value / scale),
    };
  });
  return (
    <div className="picker">
      <div
        className="plane"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          move(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons) move(e);
        }}
      >
        <canvas
          ref={canvas}
          width={256}
          height={160}
          aria-label={`Browser rendered ${mode} color plane`}
        />
        <span
          className="crosshair"
          style={{
            left: `${Math.max(0, Math.min(100, (values[xAxis] / config[xAxis].max) * 100))}%`,
            top: `${Math.max(0, Math.min(100, (1 - values[yAxis] / config[yAxis].max) * 100))}%`,
            background: cssColor({ ...color, a: 1 }),
          }}
        />
        <span className="plane-label">{config[yAxis].name} ↑</span>
        <span className="plane-label right">{config[xAxis].name} →</span>
      </div>
      {dimensions.map(({ name, max, unit, step, value, change, paint }) => (
        <div className="slider-row" key={name}>
          <label htmlFor={`${id}-${name}`}>{name}</label>
          <input
            id={`${id}-${name}`}
            aria-label={name}
            type="range"
            min="0"
            max={Math.max(max, value)}
            step={step}
            value={value}
            style={{
              backgroundImage: `linear-gradient(to right, ${Array.from({ length: 37 }, (_, i) => paint((i / 36) * Math.max(max, value))).join(",")})`,
            }}
            onChange={(e) => change(Number(e.target.value))}
          />
          <label className="number">
            <input
              aria-label={`${name} value`}
              type="number"
              min="0"
              max={Math.max(max, value)}
              step={step}
              value={round(value, 3)}
              onChange={(e) =>
                change(
                  Math.max(
                    0,
                    Math.min(Math.max(max, value), Number(e.target.value)),
                  ),
                )
              }
            />
            <span>{unit}</span>
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
