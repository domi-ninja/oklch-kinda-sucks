import { useEffect, useId, useRef } from "react";
import { cssColor, round, type Color } from "./color";
import { channels, fromCoordinates, type Coordinates } from "./pickerModes";
import type { PlaneMapping } from "./planes";
import type { PickerMode } from "./workspaceSchema";
import type { usePlaneRenderer } from "./usePlaneRenderer";

export function ColorPlane({
  color,
  mode,
  values,
  mapping,
  render,
  onChange,
}: {
  color: Color;
  mode: PickerMode;
  values: Coordinates;
  mapping: PlaneMapping;
  render: ReturnType<typeof usePlaneRenderer>;
  onChange: (color: Color) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const captionId = useId();
  const config = channels[mode];
  const fixedValue = values[mapping.fixed];
  const name = `${mode} ${config[mapping.x].name} × ${config[mapping.y].name}`;
  useEffect(
    function paintBrowserPlane() {
      if (canvas.current) render({ mode, mapping, fixedValue }, canvas.current);
    },
    [mode, mapping, fixedValue, render],
  );

  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const next: Coordinates = [...values];
    next[mapping.x] =
      Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) *
      config[mapping.x].max;
    next[mapping.y] =
      (1 -
        Math.max(
          0,
          Math.min(1, (event.clientY - bounds.top) / bounds.height),
        )) *
      config[mapping.y].max;
    onChange(fromCoordinates(next, mode, color.a));
  };

  return (
    <div className="color-plane">
      <div className="plane-caption" id={captionId}>
        {config[mapping.fixed].name} {round(fixedValue, 3)}
        {config[mapping.fixed].unit}
      </div>
      <div
        className="plane"
        role="group"
        aria-label={`${name} plane`}
        aria-describedby={captionId}
        tabIndex={0}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          move(event);
        }}
        onPointerMove={(event) => {
          if (event.buttons) move(event);
        }}
        onKeyDown={(event) => {
          const axis =
            event.key === "ArrowLeft" || event.key === "ArrowRight"
              ? mapping.x
              : event.key === "ArrowUp" || event.key === "ArrowDown"
                ? mapping.y
                : null;
          if (axis === null) return;
          event.preventDefault();
          const next: Coordinates = [...values];
          const direction =
            event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 1;
          next[axis] = Math.max(
            0,
            Math.min(
              Math.max(config[axis].max, values[axis]),
              values[axis] +
                direction * config[axis].step * (event.shiftKey ? 10 : 1),
            ),
          );
          onChange(fromCoordinates(next, mode, color.a));
        }}
      >
        <canvas
          ref={canvas}
          width={256}
          height={160}
          aria-label={`Browser rendered ${name} plane`}
        />
        <span
          className="crosshair"
          style={{
            left: `${Math.max(0, Math.min(100, (values[mapping.x] / config[mapping.x].max) * 100))}%`,
            top: `${Math.max(0, Math.min(100, (1 - values[mapping.y] / config[mapping.y].max) * 100))}%`,
            background: cssColor({ ...color, a: 1 }),
          }}
        />
        <div className="plane-labels">
          <span>{config[mapping.y].name} ↑</span>
          <span>{config[mapping.x].name} →</span>
        </div>
      </div>
    </div>
  );
}
