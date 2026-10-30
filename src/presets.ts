import { presets, sourceFor, isRetiredPreset, withDarkTheme } from "./demo";
export type Saved = { id: string; name: string; source: string };
export const defaultPresets: Saved[] = presets.map((p) => ({
  id: p.id,
  name: p.name,
  source: sourceFor(p.tokens, p.extra),
}));
export const isDefaultPreset = (id: string) =>
  defaultPresets.some((p) => p.id === id);
// Built-ins always come from code. Preserve previously saved edits as custom copies.
export function normalizePresets(saved: Saved[]): Saved[] {
  const custom = saved
    .filter((p) => !isRetiredPreset(p))
    .flatMap((p) => {
      const builtin = defaultPresets.find(
        (defaultPreset) => defaultPreset.id === p.id,
      );
      if (!builtin) return [p];
      if (builtin.source === withDarkTheme(p.source) && builtin.name === p.name)
        return [];
      return [
        {
          id: `custom:${p.id}`,
          name: `${p.name} copy`,
          source: p.source,
        },
      ];
    });
  return [
    ...defaultPresets,
    ...custom.filter(
      (p, i) => custom.findIndex((other) => other.id === p.id) === i,
    ),
  ];
}
