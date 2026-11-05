import { useMemo, useState } from "react";
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
} from "lucide-react";
import { zipSync, strToU8 } from "fflate";
import { Button } from "./components/ui/button";
import { Picker } from "./Picker";
import { PaletteControls } from "./PaletteControls";
import { createPaletteRamp, paletteCss } from "./palette";
import { ColorEditors } from "./ColorEditors";
import { ColorSwatches } from "./ColorSwatches";
import { useAppUpdate } from "./useAppUpdate";
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
  createSnapshot,
  pickedColor,
  type Workspace,
} from "./workspace";
import type { Snapshot, PaletteEndpoint } from "./workspaceSchema";
import { saveShare } from "./sharing";
import { useCompiler } from "./useCompiler";

import {
  defaultPresets as defaults,
  isDefaultPreset,
  normalizePresets,
  type Saved,
} from "./presets";
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
export function App({ shared }: { shared?: Snapshot }) {
  const { state, set, setColor, updateState } = useWorkspace(
    initialWorkspace,
    shared,
  );
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
          )
        : undefined,
    [start, palette?.end, palette?.mode, palette?.subdivisions],
  );
  const [message, setMessage] = useState("");
  const updateAvailable = useAppUpdate();
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareError, setShareError] = useState("");
  const compiled = useCompiler(source);
  const entries = useMemo(
    () =>
      [...source.matchAll(/oklch\([^)]*\)/g)].map((match) => ({
        value: match[0],
        index: match.index,
        name:
          (source.lastIndexOf(".dark {", match.index) >
          source.lastIndexOf("}", match.index)
            ? "dark / "
            : "") +
          (source.slice(0, match.index).match(/--([\w-]+):\s*$/)?.[1] ??
            `color-${match.index}`),
      })),
    [source],
  );
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
  const dirty = source !== saved.find((p) => p.id === active)?.source;
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
    setSharing(true);
    setShareError("");
    setShareUrl("");
    try {
      const url = await saveShare(createSnapshot(state));
      setShareUrl(url);
      await copy(url);
    } catch (error) {
      setShareError(
        error instanceof Error
          ? error.message
          : "Could not create share link. Try again.",
      );
    } finally {
      setSharing(false);
    }
  };
  const exportApp = () => {
    const files = {
      "index.html": strToU8(demoDocument(compiled.css, true)),
      "dark.html": strToU8(demoDocument(compiled.css, true, true)),
      "styles.css": strToU8(compiled.css),
      "theme.css": strToU8(source),
      "src/index.html": strToU8(
        demoDocument(compiled.css, true).replace(
          'href="./styles.css"',
          'href="../styles.css"',
        ),
      ),
      "src/dark.html": strToU8(
        demoDocument(compiled.css, true, true).replace(
          'href="./styles.css"',
          'href="../styles.css"',
        ),
      ),
      "package.json": strToU8(
        JSON.stringify(
          {
            private: true,
            scripts: { build: "tailwindcss -i theme.css -o styles.css" },
            devDependencies: {
              tailwindcss: "^4.3.3",
              "@tailwindcss/cli": "^4.3.3",
            },
          },
          null,
          2,
        ),
      ),
    };
    const presetName =
      (saved.find((preset) => preset.id === active)?.name ?? "custom-theme")
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "") || "custom-theme";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    download(
      `${presetName}-${timestamp}.zip`,
      zipSync(files) as Uint8Array<ArrayBuffer>,
      "application/zip",
    );
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
          <div className="picker-toolbar">
            {message && <span role="status">{message}</span>}
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
            <Button variant="outline" disabled={sharing} onClick={share}>
              {sharing ? (
                <LoaderCircle size={15} className="motion-safe:animate-spin" />
              ) : (
                <Link size={15} />
              )}
              Share
            </Button>
            {!palette && (
              <Button variant="outline" onClick={createPalette}>
                Create palette
              </Button>
            )}
            {updateAvailable && (
              <>
                <span role="status">Update available</span>
                <Button variant="outline" onClick={() => location.reload()}>
                  Reload
                </Button>
              </>
            )}
            {shareUrl && (
              <input
                className="share-link"
                aria-label="Share link"
                readOnly
                value={shareUrl}
                onFocus={(event) => event.currentTarget.select()}
              />
            )}
            {shareError && (
              <span role="alert" className="error">
                {shareError}
              </span>
            )}
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
              onClose={() => {
                set("color", color);
                set("palette", undefined);
                set("selected", null);
              }}
              onCopy={() => copy(paletteCss(ramp.colors))}
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
          <section className="panel">
            <div className="panel-heading">
              <h2>Presets</h2>
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
            </div>
          </section>
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
                        setColor(next);
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
                <span>shadcn/ui</span>
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
                    <iframe
                      title={`shadcn/ui ${mode.label.toLowerCase()} preview`}
                      sandbox="allow-scripts"
                      srcDoc={demoDocument(compiled.css, false, mode.dark)}
                      style={{ width, maxWidth: "100%" }}
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
              disabled={!compiled.css || compiled.pending || !!compiled.error}
              onClick={exportApp}
            >
              <ArrowDownToLine size={15} />
              Export app
            </Button>
          </div>
        </section>
      </main>
    </>
  );
}
