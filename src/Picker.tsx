import { useEffect, useRef } from "react";
import { type Color, cssColor, round } from "./color";

export function Picker({
  color,
  onChange,
}: {
  color: Color;
  onChange: (color: Color) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // Repaint the whole plane through the browser; out-of-gamut pixels remain visible.
  useEffect(
    function paintBrowserPlane() {
      const ctx = canvas.current?.getContext("2d", { colorSpace: "srgb" });
      if (!ctx) return;
      for (let y = 0; y < 160; y++)
        for (let x = 0; x < 256; x++) {
          ctx.fillStyle = cssColor({
            l: 1 - y / 159,
            c: (x / 255) * 0.4,
            h: color.h,
            a: 1,
          });
          ctx.fillRect(x, y, 1, 1);
        }
    },
    [color.h],
  );
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const bounds = e.currentTarget.getBoundingClientRect();
    onChange({
      ...color,
      c:
        Math.max(0, Math.min(1, (e.clientX - bounds.left) / bounds.width)) *
        0.4,
      l: 1 - Math.max(0, Math.min(1, (e.clientY - bounds.top) / bounds.height)),
    });
  };
  const dimensions = [
    {
      key: "l",
      name: "Lightness",
      max: 1,
      step: 0.001,
      display: color.l * 100,
      factor: 100,
    },
    {
      key: "c",
      name: "Chroma",
      max: 0.4,
      step: 0.001,
      display: (color.c / 0.4) * 100,
      factor: 250,
    },
    {
      key: "h",
      name: "Hue",
      max: 360,
      step: 0.1,
      display: (color.h / 360) * 100,
      factor: 100 / 360,
    },
    {
      key: "a",
      name: "Alpha",
      max: 1,
      step: 0.001,
      display: color.a * 100,
      factor: 100,
    },
  ] as const;
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
          aria-label="Browser rendered lightness and chroma plane"
        />
        <span
          className="crosshair"
          style={{
            left: `${(color.c / 0.4) * 100}%`,
            top: `${(1 - color.l) * 100}%`,
            background: cssColor({ ...color, a: 1 }),
          }}
        />
        <span className="plane-label">L ↑</span>
        <span className="plane-label right">C →</span>
      </div>
      {dimensions.map(({ key, name, max, step, display, factor }) => {
        const gradient = Array.from({ length: 37 }, (_, i) =>
          cssColor({ ...color, a: 1, [key]: (i / 36) * max }),
        );
        if (key === "a")
          for (let i = 0; i < gradient.length; i++)
            gradient[i] = cssColor({ ...color, a: i / 36 });
        return (
          <div className="slider-row" key={key}>
            <label htmlFor={`slider-${key}`}>{name}</label>
            <input
              id={`slider-${key}`}
              aria-label={name}
              type="range"
              min="0"
              max={max}
              step={step}
              value={color[key]}
              style={{
                backgroundImage: `linear-gradient(to right, ${gradient.join(",")})`,
              }}
              onChange={(e) =>
                onChange({ ...color, [key]: Number(e.target.value) })
              }
            />
            <label className="number">
              <input
                aria-label={`${name} percentage`}
                type="number"
                min="0"
                max="100"
                step=".1"
                value={round(display, 2)}
                onChange={(e) =>
                  onChange({
                    ...color,
                    [key]:
                      Math.max(0, Math.min(100, Number(e.target.value))) /
                      factor,
                  })
                }
              />
              <span>%</span>
            </label>
          </div>
        );
      })}
    </div>
  );
}
