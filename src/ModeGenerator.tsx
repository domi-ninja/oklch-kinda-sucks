import { useId, useState } from "react";
import { Button } from "./components/ui/button";
import { NumericInput } from "./NumericInput";
import { round } from "./color";
import { generateMode } from "./modeGeneration";
import type { ModeGeneration } from "./workspaceSchema";

export function ModeGenerator({
  source,
  settings,
  onSettingsChange,
  onApply,
}: {
  source: string;
  settings: ModeGeneration;
  onSettingsChange: (settings: ModeGeneration) => void;
  onApply: (source: string) => void;
}) {
  const id = useId();
  const [undo, setUndo] = useState<{ before: string; after: string } | null>(
    null,
  );
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const target = settings.from === "light" ? "dark" : "light";
  const parameters = [
    { key: "background", label: "Background lightness", min: 0, max: 100 },
    { key: "contrast", label: "Contrast", min: 50, max: 150 },
    { key: "chroma", label: "Chroma", min: 0, max: 150 },
  ] as const;
  return (
    <form
      className="panel mode-generator"
      aria-label="Mode generation"
      onSubmit={(event) => {
        event.preventDefault();
        try {
          const result = generateMode(source, settings);
          setUndo({ before: source, after: result.source });
          onApply(result.source);
          setError("");
          setStatus(
            `Generated ${target} mode · ${result.count} colors${result.skipped ? ` · ${result.skipped} skipped` : ""}`,
          );
        } catch (error) {
          setError(
            error instanceof Error ? error.message : "Could not generate mode.",
          );
          setStatus("");
        }
      }}
    >
      <select
        aria-label="Generate mode direction"
        value={settings.from}
        onChange={(event) => {
          const from = event.target.value === "dark" ? "dark" : "light";
          onSettingsChange({
            ...settings,
            from,
            background: from === "light" ? 0.18 : 0.985,
            chroma: from === "light" ? 0.85 : 1,
          });
        }}
      >
        <option value="light">Light → dark</option>
        <option value="dark">Dark → light</option>
      </select>
      {parameters.map(({ key, label, min, max }) => (
        <div className="mode-parameter" key={key}>
          <label htmlFor={`${id}-${key}`}>{label}</label>
          <input
            id={`${id}-${key}`}
            type="range"
            aria-label={`${label} slider`}
            min={min}
            max={max}
            step={0.5}
            value={settings[key] * 100}
            onChange={(event) =>
              onSettingsChange({
                ...settings,
                [key]: Number(event.target.value) / 100,
              })
            }
          />
          <span className="number">
            <NumericInput
              aria-label={`${label} percent`}
              min={min}
              max={max}
              step={0.5}
              value={round(settings[key] * 100, 2)}
              onValueChange={(value) =>
                onSettingsChange({ ...settings, [key]: value / 100 })
              }
            />
            <span>%</span>
          </span>
        </div>
      ))}
      <div className="mode-actions">
        <Button type="submit">Generate {target} mode</Button>
        <Button
          type="button"
          variant="outline"
          disabled={!undo || undo.after !== source}
          onClick={() => {
            if (!undo || undo.after !== source) return;
            onApply(undo.before);
            setUndo(null);
            setStatus("");
            setError("");
          }}
        >
          Undo
        </Button>
      </div>
      {error && (
        <span role="alert" className="error">
          {error}
        </span>
      )}
      {status && !error && undo?.after === source && (
        <span role="status">{status}</span>
      )}
    </form>
  );
}
