import { lazy, Suspense, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  Plus,
  Save,
  Trash2,
  Pencil,
  ExternalLink,
  X,
  Link,
  LoaderCircle,
  Undo2,
  Redo2,
} from "lucide-react";
import { Button } from "./components/ui/button";
import { Picker } from "./Picker";
import { PaletteControls } from "./PaletteControls";
import { ModeGenerator } from "./ModeGenerator";
import { defaultModeGeneration } from "./modeGeneration";
import { createPaletteRamp, paletteCss } from "./palette";
import { ColorEditors } from "./ColorEditors";
import { ColorSwatches } from "./ColorSwatches";
import { useAppUpdate } from "./useAppUpdate";
import { PreviewFrame } from "./PreviewFrame";
import { PreviewConnections } from "./PreviewConnections";
import { defaultHarmonizerSettings } from "./harmonizerSettings";
import {
  cssColor,
  parseColor,
  sampleColor,
  initialColor,
  type Color,
} from "./color";
import { demoDocument } from "./demo";
import {
  useWorkspace,
  pickerModes,
  createPresetShare,
  pickedColor,
  type Workspace,
} from "./workspace";
import type { PresetShare, PaletteEndpoint } from "./workspaceSchema";
import { saveShare } from "./sharing";
import { useCompiler } from "./useCompiler";

import {
  defaultPresets as defaults,
  isDefaultPreset,
  normalizePresets,
  type Saved,
} from "./presets";
const Harmonizer = lazy(() => import("./Harmonizer"));
function loadPresets(): Saved[] {
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem("oklch-presets") ?? "null",
    );
    if (
      Array.isArray(saved) &&
      saved.every(
        (p) =>
          typeof p.id === "string" &&
          typeof p.name === "string" &&
          typeof p.source === "string",
      )
    )
      return normalizePresets(saved);
  } catch {
    /* Use built-ins when storage is unavailable. */
  }
  return defaults;
}
function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function initialWorkspace(): Workspace {
  const saved = loadPresets();
  return {
    version: 1,
    saved,
    active: saved[0]?.id ?? "",
    source: saved[0]?.source ?? defaults[0].source,
    color: initialColor,
    selected: null,
    tab: "preview",
    width: "100%",
    pickers: [{ id: "initial", mode: "OKHCL" }],
  };
}
function themeEntries(source: string) {
  return [...source.matchAll(/oklch\([^)]*\)/g)].map((match) => ({
    value: match[0],
    index: match.index,
    name:
      (source.lastIndexOf(".dark {", match.index) >
      source.lastIndexOf("}", match.index)
        ? "dark / "
        : "") +
      (source.slice(0, match.index).match(/--([\w-]+):\s*$/)?.[1] ??
        `color-${match.index}`),
  }));
}
type PresetShareResult = { active: string; name: string; source: string } & (
  | { status: "ready"; url: string; copied: boolean }
  | { status: "error"; message: string }
);
export function App({ shared }: { shared?: PresetShare }) {
  const {
    state,
    set,
    setColor,
    updateState,
    editWorkspace,
    historyGroup,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useWorkspace(initialWorkspace, shared);
  const {
    saved,
    active,
    source,
    color: start,
    palette,
    selected,
    tab,
    width,
    pickers,
  } = state;
  const color = pickedColor(state);
  const ramp = useMemo(
    () =>
      palette
        ? createPaletteRamp(
            start,
            palette.end,
            palette.mode,
            palette.subdivisions,
            palette.middle,
          )
        : undefined,
    [
      start,
      palette?.end,
      palette?.mode,
      palette?.subdivisions,
      palette?.middle,
    ],
  );
  const [message, setMessage] = useState("");
  const [harmonizerView, setHarmonizerView] = useState<
    "unopened" | "open" | "closed"
  >("unopened");
  const harmonizerTrigger = useRef<HTMLButtonElement>(null);
  const updateAvailable = useAppUpdate();
  const [sharing, setSharing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [shareResult, setShareResult] = useState<PresetShareResult | null>(
    null,
  );
  const compiled = useCompiler(source);
  const entries = useMemo(() => themeEntries(source), [source]);
  const pairedEntries = useMemo(() => {
    const groups = new Map<
      string,
      { entry: (typeof entries)[number]; index: number }[]
    >();
    entries.forEach((entry, index) => {
      const name = entry.name.replace(/^dark \/ /, "");
      const group = groups.get(name) ?? [];
      group.push({ entry, index });
      groups.set(name, group);
    });
    return [...groups.entries()].map(([name, colors]) => ({
      name,
      colors: colors.sort(
        (a, b) =>
          Number(a.entry.name.startsWith("dark / ")) -
          Number(b.entry.name.startsWith("dark / ")),
      ),
    }));
  }, [entries]);
  const sample = useMemo(() => {
    try {
      return sampleColor(cssColor(color));
    } catch {
      return null;
    }
  }, [color]);
  const activePreset = saved.find((p) => p.id === active);
  const currentShare =
    shareResult?.active === active &&
    shareResult.source === source &&
    shareResult.name === activePreset?.name
      ? shareResult
      : null;
  const dirty = source !== activePreset?.source;
  const discardPresetChanges = () => {
    if (!activePreset) return;
    const selectedName =
      selected === null ? undefined : entries[selected]?.name;
    const restored = themeEntries(activePreset.source);
    const index = restored.findIndex((entry) => entry.name === selectedName);
    const restoredColor = index < 0 ? null : parseColor(restored[index].value);
    set("source", activePreset.source);
    set("selected", restoredColor ? index : null);
    if (restoredColor) setColor(restoredColor);
    setMessage("Preset changes discarded");
  };
  const update = (next: Color) => {
    setColor(next);
    if (selected !== null && entries[selected]) {
      const entry = entries[selected];
      set(
        "source",
        source.slice(0, entry.index) +
          cssColor(next) +
          source.slice(entry.index + entry.value.length),
      );
    }
  };
  const selectEndpoint = (endpoint: PaletteEndpoint) => {
    if (palette && palette.endpoint !== endpoint) {
      updateState("palette", (current) =>
        current ? { ...current, endpoint } : current,
      );
      set("selected", null);
    }
  };
  const updateEndpoint = (endpoint: PaletteEndpoint, next: Color) => {
    if (palette && palette.endpoint !== endpoint) {
      updateState("palette", (current) =>
        current ? { ...current, endpoint } : current,
      );
      set("selected", null);
      setColor(next);
    } else update(next);
  };
  const createPalette = () => {
    set("palette", {
      end: {
        ...color,
        l:
          color.l >= 0.5
            ? Math.max(0.2, color.l - 0.35)
            : Math.min(0.85, color.l + 0.35),
        h: (color.h + 90) % 360,
      },
      endpoint: "start",
      subdivisions: 4,
      mode: "OKHCL",
    });
    set("selected", null);
  };
  const togglePaletteMiddle = () => {
    if (!palette || !ramp) return;
    if (palette.middle) {
      set("palette", {
        ...palette,
        middle: undefined,
        endpoint: palette.endpoint === "middle" ? "start" : palette.endpoint,
      });
      if (palette.endpoint === "middle") set("selected", null);
    } else {
      set("palette", {
        ...palette,
        middle: ramp.path[(ramp.path.length - 1) / 2],
        endpoint: "middle",
      });
      set("selected", null);
    }
  };
  const persist = (next: Saved[]) => {
    try {
      localStorage.setItem("oklch-presets", JSON.stringify(next));
      set("saved", next);
      return true;
    } catch {
      setMessage("Browser storage is full or unavailable");
      return false;
    }
  };
  const createPreset = () => {
    const name = prompt(
      "Preset name",
      `${saved.find((p) => p.id === active)?.name ?? "Untitled"} copy`,
    );
    if (!name?.trim()) return;
    const preset = { id: crypto.randomUUID(), name: name.trim(), source };
    if (persist([...saved, preset])) {
      set("active", preset.id);
      setMessage("Preset created");
    }
  };
  const choose = (id: string) => {
    const p = saved.find((p) => p.id === id);
    if (!p) return;
    if (dirty && !confirm("Discard unsaved preset changes?")) return;
    set("active", id);
    set("source", p.source);
    set("selected", null);
  };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Copied");
    } catch {
      setMessage("Clipboard unavailable. Select and copy the value.");
    }
  };
  const share = async () => {
    if (!activePreset) return;
    const context = { active, source, name: activePreset.name };
    setSharing(true);
    setShareResult(null);
    try {
      const url = await saveShare(createPresetShare(state));
      let copied = false;
      try {
        await navigator.clipboard.writeText(url);
        copied = true;
      } catch {
        // The link stays available for manual copying.
      }
      setShareResult({ ...context, status: "ready", url, copied });
    } catch (error) {
      setShareResult({
        ...context,
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not create share link. Try again.",
      });
    } finally {
      setSharing(false);
    }
  };
  const exportApp = async () => {
    setExporting(true);
    try {
      const { exportAppArchive } = await import("./exportApp");
      const presetName =
        (saved.find((preset) => preset.id === active)?.name ?? "custom-theme")
          .normalize("NFKC")
          .toLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, "-")
          .replace(/^-+|-+$/g, "") || "custom-theme";
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      download(
        `${presetName}-${timestamp}.zip`,
        exportAppArchive(source, compiled.css),
        "application/zip",
      );
    } catch {
      setMessage("Could not export app. Try again.");
    } finally {
      setExporting(false);
    }
  };
  return (
    <>
      <a href="#workspace" className="skip">
        Skip to workspace
      </a>
      <main id="workspace" className="workspace">
        <aside
          className="left-column"
          style={{
            gridTemplateColumns: `var(--picker-columns, repeat(${Math.max(1, pickers.length)}, 340px))`,
          }}
        >
          {updateAvailable && (
            <div className="app-update" role="status">
              <strong>Update available</strong>
              <Button onClick={() => location.reload()}>Reload</Button>
            </div>
          )}
          <div className="picker-toolbar">
            {message && <span role="status">{message}</span>}
            <div
              className="history-controls"
              role="group"
              aria-label="Edit history"
            >
              <Button
                variant="outline"
                onClick={undo}
                disabled={!canUndo}
                aria-keyshortcuts="Control+Z Meta+Z"
                title="Undo (Ctrl/Cmd+Z)"
              >
                <Undo2 size={15} />
                Undo
              </Button>
              <Button
                variant="outline"
                onClick={redo}
                disabled={!canRedo}
                aria-keyshortcuts="Control+Y Control+Shift+Z Meta+Shift+Z"
                title="Redo (Ctrl+Y or Ctrl/Cmd+Shift+Z)"
              >
                <Redo2 size={15} />
                Redo
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={() =>
                set("pickers", [
                  ...pickers,
                  { id: crypto.randomUUID(), mode: "OKHCL" },
                ])
              }
            >
              <Plus size={15} />
              Add picker
            </Button>
            {!palette && (
              <Button variant="outline" onClick={createPalette}>
                Create palette
              </Button>
            )}
            <Button
              ref={harmonizerTrigger}
              variant="outline"
              onClick={() => setHarmonizerView("open")}
            >
              Harmonizer
            </Button>
          </div>
          {palette && ramp && (
            <PaletteControls
              start={start}
              palette={palette}
              colors={ramp.colors}
              onChange={(patch) =>
                updateState("palette", (current) =>
                  current ? { ...current, ...patch } : current,
                )
              }
              onSelect={selectEndpoint}
              onToggleMiddle={togglePaletteMiddle}
              onClose={() => {
                set("color", color);
                set("palette", undefined);
                set("selected", null);
              }}
              onCopy={() => copy(paletteCss(ramp.colors))}
              onCopyHarmonized={(colors) => copy(paletteCss(colors))}
            />
          )}
          {pickers.map((panel, panelIndex) => (
            <section
              className="panel color-panel"
              key={panel.id}
              aria-label={`Color picker ${panel.mode} ${panelIndex + 1}`}
            >
              <div className="picker-panel-heading">
                <select
                  aria-label="Picker mode"
                  value={panel.mode}
                  onChange={(e) => {
                    const mode = pickerModes.find(
                      (mode) => mode === e.target.value,
                    );
                    if (mode)
                      set(
                        "pickers",
                        pickers.map((p) =>
                          p.id === panel.id ? { ...p, mode } : p,
                        ),
                      );
                  }}
                >
                  {pickerModes.map((mode) => (
                    <option key={mode}>{mode}</option>
                  ))}
                </select>
                <Button
                  variant="ghost"
                  aria-label="Close picker"
                  onClick={() =>
                    set(
                      "pickers",
                      pickers.filter((p) => p.id !== panel.id),
                    )
                  }
                >
                  <X size={15} />
                </Button>
              </div>
              <Picker
                color={color}
                mode={panel.mode}
                onChange={update}
                palette={
                  palette && ramp
                    ? {
                        ...ramp,
                        endpoint: palette.endpoint,
                        onSelect: selectEndpoint,
                        onChange: updateEndpoint,
                      }
                    : undefined
                }
              />
              <ColorSwatches display={cssColor(color)} srgb={sample?.rgb} />
              <ColorEditors
                key={panel.mode}
                color={color}
                mode={panel.mode}
                onChange={update}
              />
            </section>
          ))}
        </aside>
        <div className="theme-column">
          <section className="panel" aria-labelledby="presets-heading">
            <div className="panel-heading">
              <h2 id="presets-heading">Presets</h2>
              <Button
                variant="ghost"
                aria-label="Create preset"
                onClick={createPreset}
              >
                <Plus size={16} />
              </Button>
            </div>
            <select
              aria-label="Preset"
              value={active}
              onChange={(e) => choose(e.target.value)}
            >
              <option value="" disabled>
                Select preset
              </option>
              {saved.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <div className="preset-actions">
              <Button
                variant="outline"
                onClick={() => {
                  if (!active || isDefaultPreset(active)) {
                    createPreset();
                    return;
                  }
                  if (
                    persist(
                      saved.map((p) =>
                        p.id === active ? { ...p, source } : p,
                      ),
                    )
                  )
                    setMessage("Preset saved");
                }}
              >
                <Save size={15} />
                {!active || isDefaultPreset(active)
                  ? "Save as new"
                  : `Save${dirty ? " *" : ""}`}
              </Button>
              <Button
                variant="outline"
                aria-label="Rename preset"
                disabled={!active || isDefaultPreset(active)}
                onClick={() => {
                  if (isDefaultPreset(active)) return;
                  const name = prompt(
                    "Preset name",
                    saved.find((p) => p.id === active)?.name,
                  );
                  if (name?.trim())
                    persist(
                      saved.map((p) =>
                        p.id === active ? { ...p, name: name.trim() } : p,
                      ),
                    );
                }}
              >
                <Pencil size={15} />
              </Button>
              <Button
                variant="outline"
                aria-label="Delete preset"
                disabled={!active || isDefaultPreset(active)}
                onClick={() => {
                  if (isDefaultPreset(active)) return;
                  if (!confirm("Delete this preset?")) return;
                  const next = saved.filter((p) => p.id !== active);
                  if (persist(next)) {
                    set("active", next[0]?.id ?? "");
                    set("source", next[0]?.source ?? defaults[0].source);
                    set("selected", null);
                  }
                }}
              >
                <Trash2 size={15} />
              </Button>
              {dirty && activePreset && (
                <Button
                  variant="outline"
                  className="basis-full"
                  onClick={discardPresetChanges}
                >
                  Discard changes
                </Button>
              )}
              <Button
                variant="outline"
                className="basis-full"
                disabled={sharing || !activePreset}
                onClick={share}
              >
                {sharing ? (
                  <LoaderCircle
                    size={15}
                    className="motion-safe:animate-spin"
                  />
                ) : (
                  <Link size={15} />
                )}
                Share preset
              </Button>
              {currentShare?.status === "ready" && (
                <>
                  <input
                    className="share-link basis-full"
                    aria-label="Preset share link"
                    readOnly
                    value={currentShare.url}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <span className="basis-full" role="status">
                    {currentShare.copied
                      ? "Preset link copied"
                      : "Preset link ready"}
                  </span>
                </>
              )}
              {currentShare?.status === "error" && (
                <span className="error basis-full" role="alert">
                  {currentShare.message}
                </span>
              )}
            </div>
          </section>
          <ModeGenerator
            source={source}
            settings={state.modeGeneration ?? defaultModeGeneration}
            onSettingsChange={(settings) => set("modeGeneration", settings)}
            onApply={(next) => {
              set("source", next);
              set("selected", null);
            }}
          />
          <section className="panel theme-panel">
            <div className="panel-heading">
              <h2>shadcn/ui theme</h2>
              <span className="muted">{entries.length} colors</span>
            </div>
            <div className="token-list">
              {pairedEntries.map((group) => (
                <div className="token-pair" key={group.name}>
                  {group.colors.map(({ entry, index: i }) => (
                    <button
                      key={i}
                      title={entry.name}
                      data-theme-token={entry.name}
                      className={`token ${selected === i ? "selected" : ""}`}
                      onClick={() => {
                        const next = parseColor(entry.value);
                        if (!next) {
                          setMessage(
                            "This expression cannot be edited with sliders. Edit it in the stylesheet.",
                          );
                          return;
                        }
                        set("selected", i);
                        setColor(next, false);
                      }}
                    >
                      <span className="token-swatch checker">
                        <span style={{ background: entry.value }} />
                      </span>
                      <span className="token-name">
                        {entry.name.replace(/^color-/, "")}
                      </span>
                      <span className="token-value">
                        {entry.value.replace("oklch(", "").replace(")", "")}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </section>
        </div>
        <section className="panel preview-panel">
          <div className="panel-heading preview-heading">
            <div className="tabs" role="tablist" aria-label="shadcn/ui views">
              {(["preview", "source", "compiled"] as const).map((value) => (
                <button
                  key={value}
                  role="tab"
                  aria-selected={tab === value}
                  onClick={() => set("tab", value)}
                >
                  {value === "preview"
                    ? "Components"
                    : value === "source"
                      ? "Theme CSS"
                      : "Generated CSS"}
                </button>
              ))}
            </div>
            <span className={compiled.error ? "error" : "muted"}>
              {compiled.pending
                ? "Compiling…"
                : compiled.error
                  ? "Compile error"
                  : "Ready"}
            </span>
          </div>
          {compiled.error && (
            <pre role="alert" className="compile-error">
              {compiled.error}
            </pre>
          )}
          {tab === "preview" && (
            <>
              <div className="preview-toolbar">
                <select
                  aria-label="Preview width"
                  value={width}
                  onChange={(e) =>
                    set("width", e.target.value as Workspace["width"])
                  }
                >
                  <option value="100%">Responsive</option>
                  <option value="375px">375px</option>
                  <option value="768px">768px</option>
                </select>
              </div>
              <div className="iframe-wrap">
                {[
                  { label: "Light", dark: false },
                  { label: "Dark", dark: true },
                ].map((mode) => (
                  <section className="preview-variant" key={mode.label}>
                    <div className="preview-variant-heading">
                      <h2>{mode.label}</h2>
                      <Button
                        variant="ghost"
                        aria-label={`Open shadcn/ui ${mode.label.toLowerCase()} preview`}
                        disabled={
                          !compiled.css || compiled.pending || !!compiled.error
                        }
                        onClick={() => {
                          const url = URL.createObjectURL(
                            new Blob(
                              [demoDocument(compiled.css, false, mode.dark)],
                              { type: "text/html" },
                            ),
                          );
                          window.open(url, "_blank", "noopener");
                          setTimeout(() => URL.revokeObjectURL(url), 60000);
                        }}
                      >
                        <ExternalLink size={16} />
                      </Button>
                    </div>
                    <PreviewFrame
                      css={compiled.css}
                      dark={mode.dark}
                      width={width}
                    />
                  </section>
                ))}
              </div>
            </>
          )}
          {tab === "source" && (
            <textarea
              className="code-editor"
              aria-label="shadcn/ui theme stylesheet"
              spellCheck={false}
              value={source}
              onChange={(e) => {
                set("source", e.target.value);
                set("selected", null);
              }}
            />
          )}
          {tab === "compiled" && (
            <pre className="compiled-code" tabIndex={0}>
              {compiled.css}
            </pre>
          )}
          <div className="export-bar">
            <span className="muted">
              {Math.round(compiled.css.length / 1024)} KB CSS
            </span>
            <Button
              variant="outline"
              disabled={!compiled.css || compiled.pending || !!compiled.error}
              onClick={() =>
                download("shadcn-theme.css", compiled.css, "text/css")
              }
            >
              <ArrowDownToLine size={15} />
              CSS
            </Button>
            <Button
              disabled={
                !compiled.css ||
                compiled.pending ||
                !!compiled.error ||
                exporting
              }
              onClick={exportApp}
            >
              {exporting ? (
                <LoaderCircle size={15} className="motion-safe:animate-spin" />
              ) : (
                <ArrowDownToLine size={15} />
              )}
              Export app
            </Button>
          </div>
        </section>
      </main>
      {harmonizerView !== "unopened" && (
        <Suspense fallback={<span role="status">Opening harmonizer…</span>}>
          <Harmonizer
            open={harmonizerView === "open"}
            value={state.harmonizer ?? defaultHarmonizerSettings}
            historyGroup={historyGroup}
            onClose={() => setHarmonizerView("closed")}
            onReturnFocus={() => harmonizerTrigger.current?.focus()}
            onApply={(settings, seed, group) => {
              editWorkspace(
                (previous) => ({
                  ...previous,
                  harmonizer: settings,
                  ...(seed
                    ? {
                        color: seed.start,
                        selected: null,
                        palette: previous.palette
                          ? {
                              ...previous.palette,
                              end: seed.end,
                              middle: previous.palette.middle
                                ? {
                                    ...previous.palette.middle,
                                    h: seed.hue % 360,
                                  }
                                : undefined,
                            }
                          : {
                              end: seed.end,
                              endpoint: "start",
                              mode: "OKHCL",
                              subdivisions: settings.levels.length - 1,
                            },
                      }
                    : {}),
                }),
                group,
              );
            }}
          />
        </Suspense>
      )}
      <PreviewConnections />
    </>
  );
}
