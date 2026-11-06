import { useRef } from "react";
import { X } from "lucide-react";
import { Button } from "./components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "./components/ui/dialog";
import { NumericInput } from "./NumericInput";
import { cssColor, round } from "./color";
import { useHarmonizer } from "./useHarmonizer";
import type { HarmonizerSettings } from "./workspaceSchema";
import type { HarmonizerSeed } from "./harmonizer";

const hueGradient = `linear-gradient(to right, ${Array.from({ length: 25 }, (_, index) => `oklch(0.7 0.16 ${index * 15})`).join(",")})`;

function ChromaLimit({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
}) {
  const dirty = useRef(false);
  return (
    <span
      onFocusCapture={() => {
        dirty.current = false;
      }}
      onInputCapture={() => {
        dirty.current = true;
      }}
    >
      <NumericInput
        aria-label={label}
        min={0}
        max={0.4}
        step={0.001}
        value={value}
        onValueChange={(next) => {
          if (dirty.current) onChange(next);
        }}
      />
    </span>
  );
}

export default function Harmonizer({
  open,
  value,
  historyGroup,
  onApply,
  onClose,
  onReturnFocus,
}: {
  open: boolean;
  value: HarmonizerSettings;
  historyGroup: () => object;
  onApply: (
    settings: HarmonizerSettings,
    seed: HarmonizerSeed | undefined,
    group: object,
  ) => void;
  onClose: () => void;
  onReturnFocus: () => void;
}) {
  const { settings, grid, pending, error, change } = useHarmonizer(
    value,
    historyGroup,
    onApply,
  );
  const updateRow = (
    id: string,
    patch: Partial<HarmonizerSettings["rows"][number]>,
    seed: boolean,
  ) =>
    change(
      {
        ...settings,
        selectedRow: seed ? id : settings.selectedRow,
        rows: settings.rows.map((row) =>
          row.id === id ? { ...row, ...patch } : row,
        ),
      },
      seed,
    );
  const updateLevel = (
    id: string,
    patch: Partial<HarmonizerSettings["levels"][number]>,
    seed = true,
  ) =>
    change(
      {
        ...settings,
        levels: settings.levels.map((level) =>
          level.id === id ? { ...level, ...patch } : level,
        ),
      },
      seed,
    );
  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="harmonizer-dialog"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onReturnFocus();
        }}
      >
        <DialogTitle className="harmonizer-title">Harmonizer</DialogTitle>
        <div className="harmonizer-options">
          <label>
            Color space
            <select
              aria-label="Harmonizer color space"
              value={settings.gamut}
              onChange={(event) =>
                change({
                  ...settings,
                  gamut: event.target.value === "p3" ? "p3" : "srgb",
                })
              }
            >
              <option value="p3">Display P3</option>
              <option value="srgb">sRGB</option>
            </select>
          </label>
          <label>
            Chroma
            <select
              aria-label="Harmonizer chroma mode"
              value={settings.chromaMode}
              onChange={(event) =>
                change({
                  ...settings,
                  chromaMode: event.target.value === "max" ? "max" : "even",
                })
              }
            >
              <option value="even">Even chroma</option>
              <option value="max">Max chroma</option>
            </select>
          </label>
          <label>
            Dark background
            <input
              aria-label="Harmonizer dark background"
              type="color"
              value={settings.darkBackground}
              onChange={(event) =>
                change({ ...settings, darkBackground: event.target.value })
              }
            />
          </label>
          <label>
            Light background
            <input
              aria-label="Harmonizer light background"
              type="color"
              value={settings.lightBackground}
              onChange={(event) =>
                change({ ...settings, lightBackground: event.target.value })
              }
            />
          </label>
          <label>
            Dark columns
            <span className="number">
              <NumericInput
                aria-label="Harmonizer dark columns"
                min={1}
                max={settings.levels.length - 1}
                step={1}
                value={settings.darkColumns}
                onValueChange={(darkColumns) =>
                  change({ ...settings, darkColumns: Math.round(darkColumns) })
                }
              />
            </span>
          </label>
          <span role="status">
            {pending ? "Generating…" : error ? "Generation failed" : "Ready"}
          </span>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="harmonizer-scroll" aria-busy={pending}>
          <table
            className="harmonizer-grid"
            style={{ minWidth: 168 + settings.levels.length * 96 }}
            aria-label="Harmonizer color levels"
          >
            <thead>
              <tr>
                <th scope="col">Color level</th>
                {settings.levels.map((level, index) => (
                  <th
                    scope="col"
                    key={level.id}
                    className={
                      index < settings.darkColumns
                        ? "harmonizer-dark"
                        : "harmonizer-light"
                    }
                  >
                    <div className="harmonizer-level-heading">
                      <input
                        aria-label={`Level ${index + 1} name`}
                        maxLength={40}
                        value={level.name}
                        onChange={(event) =>
                          updateLevel(
                            level.id,
                            { name: event.target.value },
                            false,
                          )
                        }
                      />
                      <Button
                        variant="ghost"
                        aria-label={`Remove level ${level.name}`}
                        disabled={settings.levels.length <= 2}
                        onClick={() =>
                          change({
                            ...settings,
                            levels: settings.levels.filter(
                              (item) => item.id !== level.id,
                            ),
                            darkColumns: Math.min(
                              settings.levels.length - 2,
                              Math.max(
                                1,
                                settings.darkColumns -
                                  (index < settings.darkColumns ? 1 : 0),
                              ),
                            ),
                          })
                        }
                      >
                        <X size={12} />
                      </Button>
                    </div>
                  </th>
                ))}
              </tr>
              <tr>
                <th scope="row">
                  APCA contrast
                  <br />
                  to background
                </th>
                {settings.levels.map((level, index) => (
                  <td
                    key={level.id}
                    className={
                      index < settings.darkColumns
                        ? "harmonizer-dark"
                        : "harmonizer-light"
                    }
                  >
                    <label className="harmonizer-contrast">
                      APCA
                      <NumericInput
                        aria-label={`APCA contrast ${level.name}`}
                        min={0}
                        max={106}
                        step={1}
                        value={level.contrast}
                        onValueChange={(contrast) =>
                          updateLevel(level.id, { contrast })
                        }
                      />
                    </label>
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">Chroma limit</th>
                {settings.levels.map((level, index) => (
                  <td
                    key={level.id}
                    className={
                      index < settings.darkColumns
                        ? "harmonizer-dark"
                        : "harmonizer-light"
                    }
                  >
                    <div className="harmonizer-chroma">
                      <ChromaLimit
                        label={`Chroma limit ${level.name}`}
                        value={
                          level.chroma ?? round(grid?.chromas[index] ?? 0, 4)
                        }
                        onChange={(chroma) => updateLevel(level.id, { chroma })}
                      />
                      {level.chroma !== undefined && (
                        <Button
                          variant="ghost"
                          aria-label={`Reset chroma limit ${level.name}`}
                          onClick={() =>
                            updateLevel(level.id, { chroma: undefined })
                          }
                        >
                          <X size={12} />
                        </Button>
                      )}
                    </div>
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {settings.rows.map((row, index) => (
                <tr
                  key={row.id}
                  data-harmonizer-row={row.id}
                  data-selected={settings.selectedRow === row.id}
                >
                  <th
                    scope="row"
                    className="harmonizer-row-heading"
                    style={{
                      color: cssColor({ l: 0.85, c: 0.08, h: row.hue, a: 1 }),
                    }}
                  >
                    <div className="harmonizer-row-name">
                      <input
                        aria-label={`Hue row ${index + 1} name`}
                        maxLength={80}
                        value={row.name}
                        onChange={(event) =>
                          updateRow(row.id, { name: event.target.value }, false)
                        }
                      />
                      <Button
                        variant="ghost"
                        aria-label={`Remove hue ${row.name}`}
                        disabled={settings.rows.length <= 1}
                        onClick={() =>
                          change({
                            ...settings,
                            rows: settings.rows.filter(
                              (item) => item.id !== row.id,
                            ),
                            selectedRow:
                              settings.selectedRow === row.id
                                ? null
                                : settings.selectedRow,
                          })
                        }
                      >
                        <X size={12} />
                      </Button>
                    </div>
                    <input
                      type="range"
                      aria-label={`Hue ${row.name}`}
                      min={0}
                      max={360}
                      step={0.1}
                      value={row.hue}
                      style={{ backgroundImage: hueGradient }}
                      onChange={(event) =>
                        updateRow(
                          row.id,
                          { hue: Number(event.target.value) },
                          true,
                        )
                      }
                    />
                    <div className="harmonizer-row-actions">
                      <NumericInput
                        aria-label={`Hue ${row.name} value`}
                        min={0}
                        max={360}
                        step={0.1}
                        value={round(row.hue, 3)}
                        onValueChange={(hue) =>
                          updateRow(row.id, { hue }, true)
                        }
                      />
                      <Button
                        variant="outline"
                        aria-label={`Use ${row.name} palette`}
                        aria-pressed={settings.selectedRow === row.id}
                        disabled={pending || !!error}
                        onClick={() =>
                          change({ ...settings, selectedRow: row.id })
                        }
                      >
                        Use
                      </Button>
                    </div>
                  </th>
                  {settings.levels.map((level, column) => {
                    const cell = grid?.rows.find(
                      (result) => result.id === row.id,
                    )?.cells[column];
                    return (
                      <td
                        key={level.id}
                        className="harmonizer-cell"
                        style={{
                          background: cell ? cssColor(cell.color) : undefined,
                        }}
                        title={
                          cell
                            ? `${row.name} ${level.name}: ${cssColor(cell.color)} · APCA ${round(cell.contrast, 1)}`
                            : undefined
                        }
                        aria-label={
                          cell
                            ? `${row.name} ${level.name}, APCA ${round(cell.contrast, 1)}, ${cssColor(cell.color)}`
                            : `${row.name} ${level.name}`
                        }
                      >
                        {cell &&
                          (cell.outOfGamut ? (
                            <span className="harmonizer-gamut">Out</span>
                          ) : cell.p3 ? (
                            <span className="harmonizer-gamut">P3</span>
                          ) : null)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="harmonizer-add">
          <Button
            variant="outline"
            disabled={settings.rows.length >= 12}
            onClick={() => {
              const id = crypto.randomUUID();
              change({
                ...settings,
                rows: [
                  ...settings.rows,
                  { id, name: `Hue ${settings.rows.length + 1}`, hue: 0 },
                ],
              });
            }}
          >
            Add hue
          </Button>
          <Button
            variant="outline"
            disabled={settings.levels.length >= 16}
            onClick={() =>
              change({
                ...settings,
                levels: [
                  ...settings.levels,
                  {
                    id: crypto.randomUUID(),
                    name: String((settings.levels.length + 1) * 100),
                    contrast: 100,
                  },
                ],
              })
            }
          >
            Add level
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
