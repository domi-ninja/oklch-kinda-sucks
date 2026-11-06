import { presets, sourceFor } from "./demo";
export type Saved = { id: string; name: string; source: string };
export const defaultPresets: Saved[] = presets.map((p) => ({
  id: p.id,
  name: p.name,
  source: sourceFor(p.tokens, p.extra),
}));
export const isDefaultPreset = (id: string) =>
  defaultPresets.some((p) => p.id === id);
// Built-ins come from code; custom presets retain their browser-saved values.
export function normalizePresets(saved: Saved[]): Saved[] {
  const custom = saved.filter(
    (preset) => !isDefaultPreset(preset.id) && preset.id !== "midnight",
  );
  return [
    ...defaultPresets,
    ...custom.filter(
      (p, i) => custom.findIndex((other) => other.id === p.id) === i,
    ),
  ];
}
