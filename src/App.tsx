import { useMemo, useState, useEffect } from "react";
import {
  ArrowDownToLine,
  Check,
  Copy,
  Plus,
  Save,
  Trash2,
  Pencil,
  ExternalLink,
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
import { demoDocument, demoBody, demoScript, presets, sourceFor } from "./demo";
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
      return saved;
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
export function App() {
  const [saved, setSaved] = useState(loadPresets);
  const [active, setActive] = useState(saved[0]?.id ?? "");
  const [source, setSource] = useState(saved[0]?.source ?? defaults[0].source);
  const [color, setColor] = useState<Color>(startingColor);
  const [selected, setSelected] = useState<number | null>(null);
  const [input, setInput] = useState(cssColor(color));
  const [format, setFormat] = useState<"css" | "percent">("css");
  const [message, setMessage] = useState("");
  const [inputError, setInputError] = useState("");
  const [tab, setTab] = useState<"preview" | "source" | "compiled">("preview");
  const [width, setWidth] = useState("100%");
  const compiled = useCompiler(source);
  const entries = useMemo(
    () =>
      [...source.matchAll(/oklch\([^)]*\)/g)].map((match) => ({
        value: match[0],
        index: match.index,
        name:
          source.slice(0, match.index).match(/--([\w-]+):\s*$/)?.[1] ??
          `color-${match.index}`,
      })),
    [source],
  );
  const sample = useMemo(() => {
    try {
      return sampleColor(cssColor(color));
    } catch {
      return null;
    }
  }, [color]);
  const dirty = source !== saved.find((p) => p.id === active)?.source;
  useEffect(
    function protectUnsavedTheme() {
      if (!dirty) return;
      const handler = (event: BeforeUnloadEvent) => event.preventDefault();
      window.addEventListener("beforeunload", handler);
      return () => window.removeEventListener("beforeunload", handler);
    },
    [dirty],
  );
  const update = (next: Color) => {
    setColor(next);
    setInput(format === "css" ? cssColor(next) : percentColor(next));
    setInputError("");
    if (selected !== null && entries[selected]) {
      const entry = entries[selected];
      setSource(
        source.slice(0, entry.index) +
          cssColor(next) +
          source.slice(entry.index + entry.value.length),
      );
    }
    history.replaceState(
      null,
      "",
      `#${next.l},${next.c},${next.h},${next.a * 100}`,
    );
  };
  useEffect(function restoreHash() {
    const handler = () => {
      const next = startingColor();
      setColor(next);
      setInput(cssColor(next));
      setSelected(null);
      setFormat("css");
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  const persist = (next: Saved[]) => {
    try {
      localStorage.setItem("oklch-presets", JSON.stringify(next));
      setSaved(next);
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
    setActive(id);
    setSource(p.source);
    setSelected(null);
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
      "styles.css": strToU8(compiled.css),
      "theme.css": strToU8(source),
      "src/index.html": strToU8(
        `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="../styles.css"><title>Palette studio</title></head><body>${demoBody}<script>${demoScript}</script></body></html>`,
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
        <aside className="left-column">
          <section className="panel color-panel">
            <div className="panel-heading">
              <h2>Color</h2>
              <button
                onClick={() => {
                  setSelected(null);
                  setMessage("Picker detached from theme");
                }}
                className="text-button"
              >
                {selected !== null
                  ? entries[selected]?.name.replace("color-", "")
                  : "Free pick"}
              </button>
            </div>
            <Picker color={color} onChange={update} />
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
                  setFormat("css");
                  setInput(cssColor(color));
                }}
              >
                CSS
              </button>
              <button
                aria-pressed={format === "percent"}
                onClick={() => {
                  setFormat("percent");
                  setInput(percentColor(color));
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
                  onChange={(e) => setInput(e.target.value)}
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
                    setActive(p.id);
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
                    setActive(next[0]?.id ?? "");
                    setSource(next[0]?.source ?? defaults[0].source);
                    setSelected(null);
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
              {entries.map((entry, i) => (
                <button
                  key={i}
                  className={`token ${selected === i ? "selected" : ""}`}
                  onClick={() => {
                    const next = parseColor(entry.value);
                    if (!next) {
                      setMessage(
                        "This expression cannot be edited with sliders. Edit it in the stylesheet.",
                      );
                      return;
                    }
                    setSelected(i);
                    setColor(next);
                    setInput(
                      format === "css" ? cssColor(next) : percentColor(next),
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
                  onClick={() => setTab(value)}
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
                  onChange={(e) => setWidth(e.target.value)}
                >
                  <option value="100%">Responsive</option>
                  <option value="375px">375px</option>
                  <option value="768px">768px</option>
                </select>
                <Button
                  variant="ghost"
                  aria-label="Open standalone preview"
                  disabled={
                    !compiled.css || compiled.pending || !!compiled.error
                  }
                  onClick={() => {
                    const url = URL.createObjectURL(
                      new Blob([demoDocument(compiled.css)], {
                        type: "text/html",
                      }),
                    );
                    window.open(url, "_blank", "noopener");
                    setTimeout(() => URL.revokeObjectURL(url), 60000);
                  }}
                >
                  <ExternalLink size={16} />
                </Button>
              </div>
              <div className="iframe-wrap">
                <iframe
                  title="Tailwind component preview"
                  sandbox="allow-scripts"
                  srcDoc={demoDocument(compiled.css)}
                  style={{ width, maxWidth: "100%" }}
                />
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
                setSource(e.target.value);
                setSelected(null);
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
      <footer>
        <span>OKLCH kinda sucks.</span>
        <span aria-live="polite">
          {message ||
            (format === "percent"
              ? "Editor % normalizes hue. Copy CSS exports degrees."
              : "Browser rendering. Local presets.")}
        </span>
      </footer>
    </>
  );
}
