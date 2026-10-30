import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  Check,
  Copy,
  Plus,
  Save,
  Trash2,
  Pencil,
  ExternalLink,
  X,
} from "lucide-react";
import { zipSync, strToU8 } from "fflate";
import { Button } from "./components/ui/button";
import { Picker } from "./Picker";
import {
  cssColor,
  percentColor,
  parseColor,
  sampleColor,
  initialColor,
  type Color,
} from "./color";
import {
  demoDocument,
  presets,
  sourceFor,
  withDarkTheme,
  isRetiredPreset,
} from "./demo";
import { useWorkspace, pickerModes, type Workspace } from "./workspace";
import { useCompiler } from "./useCompiler";

type Saved = { id: string; name: string; source: string };
const defaults = presets.map((p) => ({
  id: p.id,
  name: p.name,
  source: sourceFor(p.tokens, p.extra),
}));
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
      return saved
        .filter((p) => !isRetiredPreset(p))
        .map((p) => ({ ...p, source: withDarkTheme(p.source) }));
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
function startingColor() {
  try {
    const c = location.hash.slice(1).split(",").map(Number);
    if (c.length === 4)
      return (
        parseColor(`oklch(${c[0]} ${c[1]} ${c[2]} / ${c[3]}%)`) ?? initialColor
      );
  } catch {
    /* Use the starting swatch. */
  }
  return initialColor;
}
function initialWorkspace(): Workspace {
  const saved = loadPresets();
  const color = startingColor();
  return {
    version: 1,
    saved,
    active: saved[0]?.id ?? "",
    source: saved[0]?.source ?? defaults[0].source,
    color,
    selected: null,
    input: cssColor(color),
    format: "css",
    tab: "preview",
    width: "100%",
    pickers: [{ id: "initial", mode: "OKHCL" }],
  };
}
export function App() {
  const { state, set } = useWorkspace(initialWorkspace);
  const {
    saved,
    active,
    source,
    color,
    selected,
    input,
    format,
    tab,
    width,
    pickers,
  } = state;
  const [message, setMessage] = useState("");
  const [inputError, setInputError] = useState("");
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
    set("color", next);
    set("input", format === "css" ? cssColor(next) : percentColor(next));
    setInputError("");
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
    download(
      "palette-studio.zip",
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
            gridTemplateColumns: `repeat(${Math.max(1, pickers.length)}, 340px)`,
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
          </div>
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
              <div className="panel-heading">
                <h2>Color</h2>
                <button
                  onClick={() => {
                    set("selected", null);
                    setMessage("Picker detached from theme");
                  }}
                  className="text-button"
                >
                  {selected !== null
                    ? entries[selected]?.name.replace("color-", "")
                    : "Free pick"}
                </button>
              </div>
              <Picker color={color} mode={panel.mode} onChange={update} />
              <div className="swatches">
                <div className="checker">
                  <div style={{ background: cssColor(color) }}>
                    <span>CSS / display</span>
                  </div>
                </div>
                <div className="checker">
                  <div style={{ background: sample?.rgb }}>
                    <span>Canvas / sRGB</span>
                  </div>
                </div>
              </div>
              <div className="format-switch">
                <button
                  aria-pressed={format === "css"}
                  onClick={() => {
                    set("format", "css");
                    set("input", cssColor(color));
                  }}
                >
                  CSS
                </button>
                <button
                  aria-pressed={format === "percent"}
                  onClick={() => {
                    set("format", "percent");
                    set("input", percentColor(color));
                  }}
                >
                  Editor %
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const parsed = parseColor(input);
                  if (parsed) update(parsed);
                  else
                    setInputError(
                      "Enter OKLCH with L 0–1, C 0–0.4, hue in degrees, or editor percentages.",
                    );
                }}
              >
                <div className="value-field">
                  <input
                    aria-label="OKLCH value"
                    value={input}
                    onChange={(e) => set("input", e.target.value)}
                    spellCheck={false}
                  />
                  <button aria-label="Apply color" type="submit">
                    <Check size={16} />
                  </button>
                </div>
                {inputError && (
                  <p role="alert" className="error">
                    {inputError}
                  </p>
                )}
              </form>
              <div className="output-row">
                <span>{sample?.hex ?? "Canvas unavailable"}</span>
                <button
                  aria-label="Copy hex"
                  onClick={() => sample && copy(sample.hex)}
                >
                  <Copy size={15} />
                </button>
              </div>
              <div className="output-row">
                <span>{sample?.rgb}</span>
                <button
                  aria-label="Copy RGB"
                  onClick={() => sample && copy(sample.rgb)}
                >
                  <Copy size={15} />
                </button>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => copy(cssColor(color))}
              >
                <Copy size={15} />
                Copy CSS
              </Button>
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
                onClick={() => {
                  const name = prompt("Preset name", "Untitled");
                  if (!name?.trim()) return;
                  const p = {
                    id: crypto.randomUUID(),
                    name: name.trim(),
                    source,
                  };
                  if (persist([...saved, p])) {
                    set("active", p.id);
                    setMessage("Preset created");
                  }
                }}
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
                  if (!active) {
                    setMessage("Create a preset first");
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
                Save{dirty ? " *" : ""}
              </Button>
              <Button
                variant="outline"
                aria-label="Rename preset"
                disabled={!active}
                onClick={() => {
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
                disabled={!active}
                onClick={() => {
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
              <h2>Tailwind theme</h2>
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
                        set("color", next);
                        set(
                          "input",
                          format === "css"
                            ? cssColor(next)
                            : percentColor(next),
                        );
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
            <div className="tabs" role="tablist" aria-label="Preview views">
              {(["preview", "source", "compiled"] as const).map((value) => (
                <button
                  key={value}
                  role="tab"
                  aria-selected={tab === value}
                  onClick={() => set("tab", value)}
                >
                  {value === "preview"
                    ? "Preview"
                    : value === "source"
                      ? "Theme CSS"
                      : "Compiled CSS"}
                </button>
              ))}
            </div>
            <span className={compiled.error ? "error" : "muted"}>
              {compiled.pending
                ? "Compiling…"
                : compiled.error
                  ? "Compile error"
                  : "Tailwind 4.3"}
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
                <span>/ demo</span>
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
                        aria-label={`Open ${mode.label.toLowerCase()} preview`}
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
                      title={`Tailwind ${mode.label.toLowerCase()} preview`}
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
              aria-label="Tailwind theme stylesheet"
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
              onClick={() => download("tailwind.css", compiled.css, "text/css")}
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
