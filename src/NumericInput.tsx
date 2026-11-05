import { useState, type ComponentProps } from "react";

type NumericInputProps = Omit<
  ComponentProps<"input">,
  "value" | "onChange" | "type" | "min" | "max"
> & {
  value: number;
  min: number;
  max: number;
  onValueChange: (value: number) => void;
};

// Keep the user's text while editing, even when color conversion changes the value.
export function NumericInput({
  value,
  min,
  max,
  onValueChange,
  ...props
}: NumericInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (input: HTMLInputElement) => {
    if (input.value.trim() && Number.isFinite(input.valueAsNumber))
      onValueChange(Math.max(min, Math.min(max, input.valueAsNumber)));
    setDraft(null);
  };
  return (
    <input
      {...props}
      type="number"
      min={min}
      max={max}
      value={draft ?? value}
      onFocus={(event) => setDraft(event.currentTarget.value)}
      onChange={(event) => {
        setDraft(event.currentTarget.value);
        const next = event.currentTarget.valueAsNumber;
        if (Number.isFinite(next) && next >= min && next <= max)
          onValueChange(next);
      }}
      onBlur={(event) => commit(event.currentTarget)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit(event.currentTarget);
        }
        if (event.key === "Escape") {
          event.preventDefault();
          event.currentTarget.value = String(value);
          setDraft(null);
          event.currentTarget.blur();
        }
      }}
    />
  );
}
