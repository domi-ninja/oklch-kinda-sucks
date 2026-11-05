import { useId, useState } from "react";
import { Check } from "lucide-react";
import type { Color } from "./color";
import type { PickerMode } from "./workspace";
import {
  cssFunctions,
  parsePickerExpression,
  pickerExpression,
} from "./pickerModes";

function ColorField({
  color,
  mode,
  percent,
  onChange,
}: {
  color: Color;
  mode: PickerMode;
  percent: boolean;
  onChange: (color: Color) => void;
}) {
  const id = useId();
  const expression = pickerExpression(color, mode, percent);
  const [draft, setDraft] = useState<{
    source: string;
    value: string;
    error: string | null;
  } | null>(null);
  const currentDraft = draft?.source === expression ? draft : null;
  const value = currentDraft?.value ?? expression;
  const error = currentDraft?.error;
  if (draft && !currentDraft) setDraft(null);
  const name = cssFunctions[mode].toUpperCase();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = parsePickerExpression(value, mode, percent);
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
        <label htmlFor={id}>{percent ? "Editor %" : "CSS"}</label>
        <button
          aria-label={percent ? "Apply percentage color" : "Apply color"}
          type="submit"
        >
          <Check size={16} />
        </button>
      </div>
      <textarea
        id={id}
        className="value-field"
        aria-label={`${name}${percent ? " percentage" : ""} value`}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        rows={3}
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
  return (
    <div className="color-editors">
      <ColorField {...props} percent={false} />
      <ColorField {...props} percent />
    </div>
  );
}
