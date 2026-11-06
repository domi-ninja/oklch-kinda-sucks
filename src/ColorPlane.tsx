import { useEffect, useId, useRef, type ReactNode } from "react";
import { cssColor, type Color } from "./color";
import { channels, fromCoordinates, type Coordinates } from "./pickerModes";
import { paletteLabels, palettePaths, type PlanePalette } from "./palette";
import type { PlaneMapping } from "./planes";
import {
  palettePoints,
  type PaletteEndpoint,
  type PickerMode,
} from "./workspaceSchema";
import type { usePlaneRenderer } from "./usePlaneRenderer";

function endpointFromTarget(
  target: EventTarget | null,
): PaletteEndpoint | null {
  if (!(target instanceof Element)) return null;
  const endpoint = target
    .closest("[data-palette-endpoint]")
    ?.getAttribute("data-palette-endpoint");
  return palettePoints.find((point) => point === endpoint) ?? null;
}

export function ColorPlane({
  color,
  mode,
  values,
  mapping,
  control,
  render,
  onChange,
  palette,
}: {
  color: Color;
  mode: PickerMode;
  values: Coordinates;
  mapping: PlaneMapping;
  control: ReactNode;
  render: ReturnType<typeof usePlaneRenderer>;
  onChange: (color: Color) => void;
  palette?: PlanePalette;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const dragging = useRef<PaletteEndpoint | null>(null);
  const controlsId = useId();
  const config = channels[mode];
  const fixedValue = values[mapping.fixed];
  const name = `${mode} ${config[mapping.x].name} × ${config[mapping.y].name}`;
  useEffect(
    function paintBrowserPlane() {
      if (canvas.current) render({ mode, mapping, fixedValue }, canvas.current);
    },
    [mode, mapping, fixedValue, render],
  );

  const position = (point: Coordinates) => ({
    x: Math.max(
      0,
      Math.min(100, (point[mapping.x] / config[mapping.x].max) * 100),
    ),
    y: Math.max(
      0,
      Math.min(100, (1 - point[mapping.y] / config[mapping.y].max) * 100),
    ),
  });
  const source = (endpoint: PaletteEndpoint | null) =>
    (endpoint && palette?.controls[endpoint]) || { color, values };
  const change = (next: Coordinates, endpoint: PaletteEndpoint | null) => {
    const nextColor = fromCoordinates(next, mode, source(endpoint).color.a);
    if (endpoint && palette) palette.onChange(endpoint, nextColor);
    else onChange(nextColor);
  };
  const move = (
    event: React.PointerEvent<HTMLDivElement>,
    endpoint: PaletteEndpoint | null,
  ) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const next: Coordinates = [...source(endpoint).values];
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
    change(next, endpoint);
  };
  const paths = palette
    ? palettePaths(
        palette.path.map((point) => position(point.values)),
        mode === "RGB" ? null : mapping.x === 0 ? "x" : null,
      )
    : [];
  const crosshair = position(values);

  return (
    <div className="color-plane">
      <div className="plane-controls" id={controlsId}>
        {control}
      </div>
      <div
        className="plane"
        role="group"
        aria-label={`${name} plane`}
        aria-describedby={controlsId}
        tabIndex={0}
        onPointerDown={(event) => {
          if (document.activeElement instanceof HTMLInputElement)
            document.activeElement.blur();
          const hit = endpointFromTarget(event.target);
          const endpoint = palette ? (hit ?? palette.endpoint) : null;
          dragging.current = endpoint;
          event.currentTarget.setPointerCapture(event.pointerId);
          if (endpoint && palette) palette.onSelect(endpoint);
          if (!hit) move(event, endpoint);
        }}
        onPointerMove={(event) => {
          if (event.buttons)
            move(event, dragging.current ?? palette?.endpoint ?? null);
        }}
        onPointerUp={() => {
          dragging.current = null;
        }}
        onPointerCancel={() => {
          dragging.current = null;
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
          const endpoint = palette
            ? (endpointFromTarget(event.target) ?? palette.endpoint)
            : null;
          const base = source(endpoint).values;
          const next: Coordinates = [...base];
          const direction =
            event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 1;
          next[axis] = Math.max(
            0,
            Math.min(
              config[axis].max,
              base[axis] +
                direction * config[axis].step * (event.shiftKey ? 10 : 1),
            ),
          );
          change(next, endpoint);
        }}
      >
        <canvas
          ref={canvas}
          width={256}
          height={160}
          aria-label={`Browser rendered ${name} plane`}
        />
        {palette ? (
          <>
            <svg
              className="palette-path"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
              focusable="false"
            >
              {paths.map((path, index) => (
                <g key={index}>
                  <polyline
                    points={path
                      .map((point) => `${point.x},${point.y}`)
                      .join(" ")}
                    fill="none"
                    stroke="#0009"
                    strokeWidth={3}
                    vectorEffect="non-scaling-stroke"
                  />
                  <polyline
                    points={path
                      .map((point) => `${point.x},${point.y}`)
                      .join(" ")}
                    fill="none"
                    stroke="white"
                    strokeWidth={1.5}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              ))}
            </svg>
            {palette.colors.slice(1, -1).map((point, index) => {
              const at = position(point.values);
              return (
                <span
                  key={index}
                  className="palette-step"
                  aria-hidden="true"
                  style={{
                    left: `${at.x}%`,
                    top: `${at.y}%`,
                    background: cssColor({ ...point.color, a: 1 }),
                  }}
                />
              );
            })}
            {palettePoints
              .filter((point) => palette.controls[point])
              .map((endpoint) => {
                const point = source(endpoint);
                const at = position(point.values);
                return (
                  <button
                    key={endpoint}
                    type="button"
                    className="palette-endpoint"
                    data-palette-endpoint={endpoint}
                    aria-label={`${endpoint === "middle" ? "Middle control" : paletteLabels[endpoint]} color in ${name} plane`}
                    aria-pressed={palette.endpoint === endpoint}
                    style={{ left: `${at.x}%`, top: `${at.y}%` }}
                    onClick={() => palette.onSelect(endpoint)}
                  >
                    <span
                      className="endpoint-circle"
                      style={{ background: cssColor({ ...point.color, a: 1 }) }}
                      aria-hidden="true"
                    >
                      {paletteLabels[endpoint][0]}
                    </span>
                  </button>
                );
              })}
          </>
        ) : (
          <span
            className="crosshair"
            style={{
              left: `${crosshair.x}%`,
              top: `${crosshair.y}%`,
              background: cssColor({ ...color, a: 1 }),
            }}
          />
        )}
        <div className="plane-labels">
          <span>{config[mapping.y].name} ↑</span>
          <span>{config[mapping.x].name} →</span>
        </div>
      </div>
    </div>
  );
}
