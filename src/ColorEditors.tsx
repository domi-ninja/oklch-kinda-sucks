import { useId, useState } from "react";
import { Check } from "lucide-react";
import type { Color } from "./color";
import type { PickerMode } from "./workspace";
import {
  cssFunctions,
  parsePickerExpression,
  pickerExpression,
} from "./pickerModes";
import { colorGamut, parseDisplayP3 } from "./colorGamut";

function ColorField({
  expression,
  name,
  label,
  percent = false,
  parse,
  applyLabel,
  onChange,
}: {
  expression: string;
  name: string;
  label: string;
  percent?: boolean;
  parse: (text: string) => Color | null;
  applyLabel: string;
  onChange: (color: Color) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<{
    source: string;
    value: string;
    error: string | null;
  } | null>(null);
  const currentDraft = draft?.source === expression ? draft : null;
  const value = currentDraft?.value ?? expression;
  const error = currentDraft?.error;
  if (draft && !currentDraft) setDraft(null);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = parse(value);
        if (!parsed) {
          setDraft({
            source: expression,
            value,
            error: `Enter a valid ${name} ${percent ? "percentage expression" : "color"}.`,
          });
          return;
        }
        setDraft(null);
        onChange(parsed);
      }}
    >
      <div className="color-field-heading">
        <label htmlFor={id}>{label}</label>
        <button aria-label={applyLabel} type="submit">
          <Check size={16} />
        </button>
      </div>
      <input
        id={id}
        className="value-field"
        aria-label={`${name}${percent ? " percentage" : ""} value`}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        value={value}
        spellCheck={false}
        onChange={(event) => {
          setDraft({
            source: expression,
            value: event.target.value,
            error: null,
          });
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="error">
          {error}
        </p>
      )}
    </form>
  );
}

export function ColorEditors(props: {
  color: Color;
  mode: PickerMode;
  onChange: (color: Color) => void;
}) {
  const { color, mode, onChange } = props;
  const gamut = colorGamut(color);
  return (
    <div className="color-editors">
      {[false, true].map((percent) => (
        <ColorField
          key={String(percent)}
          expression={pickerExpression(color, mode, percent)}
          name={cssFunctions[mode].toUpperCase()}
          label={percent ? "Editor %" : mode === "RGB" ? "Hex · sRGB" : "CSS"}
          percent={percent}
          parse={(text) => parsePickerExpression(text, mode, percent)}
          applyLabel={percent ? "Apply percentage color" : "Apply color"}
          onChange={onChange}
        />
      ))}
      <ColorField
        expression={gamut.p3Css}
        name="Display P3"
        label="Display P3"
        parse={parseDisplayP3}
        applyLabel="Apply Display P3 color"
        onChange={onChange}
      />
      <div className="color-gamut">
        <output aria-label="Color gamut">
          {gamut.srgb
            ? "Within sRGB"
            : gamut.p3
              ? "Outside sRGB · within Display P3"
              : "Outside Display P3"}
        </output>
        <span>sRGB channels · unclipped</span>
        <output aria-label="Unclipped sRGB channels">
          {gamut.srgbChannels.join(" ")}
        </output>
      </div>
    </div>
  );
}
