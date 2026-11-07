import {
  useId,
  useLayoutEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { Copy } from "lucide-react";
import { Button } from "./components/ui/button";
import { NumericInput } from "./NumericInput";
import { checkerColors, cssColor, type Color } from "./color";
import { ThemeTokenSlots } from "./ThemeTokenSlots";
import { PaletteRows } from "./PaletteRows";
import { useHarmonizedPalette } from "./useHarmonizedPalette";
import { defaultPaletteTheme } from "./paletteHarmonizer";
import { paletteLabels } from "./palette";
import type {
  HarmonizedPalettes,
  ThemeMode,
  ThemePalette,
} from "./paletteHarmonizer";
import {
  pickerModes,
  palettePoints,
  type Palette,
  type PaletteEndpoint,
} from "./workspaceSchema";

const tokenTracks = [
  ["background", "secondary", "primary", "accent"],
  ["card"],
];

export function PaletteControls({
  start,
  palette,
  colors,
  path,
  onChange,
  onSelect,
  onToggleMiddle,
  onClose,
  onCopy,
  onCopyHarmonized,
  onApply,
  onPreviewChange,
}: {
  start: Color;
  palette: Palette;
  colors: Color[];
  path: Color[];
  onChange: (
    patch: Partial<Pick<Palette, "mode" | "subdivisions" | "theme">>,
  ) => void;
  onSelect: (endpoint: PaletteEndpoint) => void;
  onToggleMiddle: () => void;
  onClose: () => void;
  onCopy: () => void;
  onCopyHarmonized: (palette: ThemePalette, mode: ThemeMode) => void;
  onApply: (palettes: HarmonizedPalettes) => void;
  onPreviewChange: (palettes: HarmonizedPalettes | null) => void;
}) {
  const brightnessFilter = useId();
  const settings = palette.theme ?? defaultPaletteTheme;
  const [dragPreview, setDragPreview] = useState<{
    mode: ThemeMode;
    role: string;
    position: number;
  } | null>(null);
  const previewSettings = useMemo(
    () =>
      dragPreview
        ? {
            ...settings,
            positions: {
              ...settings.positions,
              [dragPreview.mode]: {
                ...settings.positions[dragPreview.mode],
                [dragPreview.role]: dragPreview.position,
              },
            },
          }
        : settings,
    [settings, dragPreview],
  );
  const harmony = useHarmonizedPalette(colors, path, previewSettings);
  const [applyError, setApplyError] = useState("");
  const [hovered, setHovered] = useState(false);
  useLayoutEffect(
    function syncHoveredPalettePreview() {
      onPreviewChange(
        (hovered || dragPreview) && !harmony.error
          ? (harmony.palette ?? null)
          : null,
      );
      return () => onPreviewChange(null);
    },
    [hovered, dragPreview, harmony.palette, harmony.error, onPreviewChange],
  );
  return (
    <section
      className="panel palette-panel"
      aria-label="Palette"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onPointerCancel={() => setHovered(false)}
    >
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
          <label>
            Harmonization
            <select
              aria-label="Harmonization"
              value={settings.mapping ?? "apca"}
              onChange={(event) =>
                onChange({
                  theme: {
                    ...settings,
                    mapping:
                      event.target.value === "palette" ? "palette" : "apca",
                  },
                })
              }
            >
              <option value="apca">APCA tones</option>
              <option value="palette">Palette tones</option>
            </select>
          </label>
          <label className="palette-chroma">
            Chroma <output>{Math.round(settings.chroma * 100)}%</output>
            <input
              type="range"
              aria-label="Palette chroma"
              min="0"
              max="1"
              step="0.001"
              aria-valuetext={`${Math.round(settings.chroma * 100)}%`}
              value={Math.sqrt(settings.chroma / 3)}
              onChange={(event) =>
                onChange({
                  theme: {
                    ...settings,
                    chroma: 3 * Number(event.target.value) ** 2,
                  },
                })
              }
            />
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
              {(["light", "dark"] as const).map((mode) => {
                const generated = harmony.palette?.[mode].colors;
                return (
                  <div className="palette-mode-rows" key={mode}>
                    <div className="palette-harmony-heading">
                      <span className="palette-row-heading">
                        Harmonized {mode}
                        {harmony.pending ? " · generating…" : ""}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        aria-label={`Reset ${mode} token positions`}
                        disabled={
                          Object.keys(settings.positions[mode]).length === 0
                        }
                        onClick={() => {
                          setDragPreview(null);
                          onChange({
                            theme: {
                              ...settings,
                              positions: { ...settings.positions, [mode]: {} },
                            },
                          });
                        }}
                      >
                        Reset positions
                      </Button>
                    </div>

                    <PaletteRows
                      colors={
                        generated?.length === colors.length ? generated : colors
                      }
                      variant={mode}
                      hideRoles
                      picks={
                        generated?.length === colors.length
                          ? harmony.palette?.[mode].picks
                          : undefined
                      }
                      brightnessFilter={brightnessFilter}
                      pending={harmony.pending}
                    />
                    {tokenTracks.map((track) => (
                      <ThemeTokenSlots
                        key={track[0]}
                        onPreview={(role, position) =>
                          setDragPreview((current) =>
                            position === null
                              ? null
                              : current?.mode === mode &&
                                  current.role === role &&
                                  current.position === position
                                ? current
                                : { mode, role, position },
                          )
                        }
                        mode={mode}
                        count={colors.length}
                        picks={(
                          harmony.palette?.[mode].tokenPicks ?? []
                        ).filter((pick) => track.includes(pick.role))}
                        onMove={(role, position) =>
                          onChange({
                            theme: {
                              ...settings,
                              positions: {
                                ...settings.positions,
                                [mode]: {
                                  ...settings.positions[mode],
                                  [role]: position,
                                },
                              },
                            },
                          })
                        }
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
          {(harmony.error || applyError) && (
            <span role="alert" className="error">
              {harmony.error || applyError}
            </span>
          )}
        </div>
        <div className="palette-actions">
          <span>{colors.length} colors</span>
          <Button variant="outline" onClick={onCopy}>
            <Copy size={15} />
            Copy palette
          </Button>
          {(["light", "dark"] as const).map((mode) => (
            <Button
              key={mode}
              variant="outline"
              disabled={harmony.pending || !!harmony.error || !harmony.palette}
              onClick={() => {
                if (harmony.palette)
                  onCopyHarmonized(harmony.palette[mode], mode);
              }}
            >
              <Copy size={15} />
              Copy {mode} theme
            </Button>
          ))}
          <Button
            disabled={harmony.pending || !!harmony.error || !harmony.palette}
            onClick={() => {
              if (!harmony.palette) return;
              try {
                onApply(harmony.palette);
                setApplyError("");
              } catch (error) {
                setApplyError(
                  error instanceof Error
                    ? error.message
                    : "Could not apply the palette.",
                );
              }
            }}
          >
            Apply palette to preset
          </Button>
        </div>
      </div>
    </section>
  );
}
