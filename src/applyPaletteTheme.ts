import { converter } from "culori";
import { cssColor, type Color } from "./color";
import { readThemeColors } from "./modeGeneration";
import {
  themeInk,
  type HarmonizedPalettes,
  type ThemeMode,
  type ThemePalette,
} from "./paletteHarmonizer";

const toOklch = converter("oklch");

export function palettePreviewColors(
  source: string,
  palettes: HarmonizedPalettes,
) {
  const { declarations } = readThemeColors(applyPaletteTheme(source, palettes));
  const light = Object.fromEntries(
    declarations
      .filter((entry) => entry.mode === "light")
      .map(({ name, value }) => [name, value]),
  );
  return {
    light,
    dark: {
      ...light,
      ...Object.fromEntries(
        declarations
          .filter((entry) => entry.mode === "dark")
          .map(({ name, value }) => [name, value]),
      ),
    },
  };
}

export function themePaletteCss(palette: ThemePalette, mode: ThemeMode) {
  const declarations = Object.entries(palette.tokens)
    .map(([name, color]) => `  --color-${name}: ${cssColor(color)};`)
    .join("\n");
  return `${mode === "dark" ? ".dark" : "@theme"} {\n${declarations}\n}`;
}

// Replace color declarations in place, retaining unrelated CSS and explicit !important flags.
export function applyPaletteTheme(
  source: string,
  palettes: HarmonizedPalettes,
) {
  const { declarations, blocks } = readThemeColors(source);
  const original = {
    light: new Map<string, string>(),
    dark: new Map<string, string>(),
  };
  for (const entry of declarations)
    original[entry.mode].set(entry.name, entry.value);
  const edits: { start: number; end: number; text: string }[] = [];
  let appended = "";
  for (const mode of ["light", "dark"] as const) {
    const colors = new Map(
      Object.entries(palettes[mode].tokens).map(([name, color]) => [
        `--color-${name}`,
        color,
      ]),
    );
    const inherited =
      mode === "dark"
        ? new Map([...original.light, ...original.dark])
        : original.light;
    const resolve = (name: string, seen = new Set<string>()): Color | null => {
      const generated = colors.get(name);
      if (generated) return generated;
      if (seen.has(name)) return null;
      seen.add(name);
      const value = inherited.get(name)?.replace(/\s*!important\s*$/i, "");
      if (!value) return null;
      const alias = value.match(/^var\(\s*(--color-[\w-]+)\s*\)$/);
      if (alias) return resolve(alias[1], seen);
      const color = toOklch(value);
      return color ? { l: color.l, c: color.c, h: color.h ?? 0, a: 1 } : null;
    };
    // Existing semantic fills such as destructive keep their color, but their text becomes pure black/white.
    for (const name of inherited.keys()) {
      if (!name.endsWith("-foreground") || colors.has(name)) continue;
      const fill =
        resolve(name.replace(/-foreground$/, "")) ??
        palettes[mode].tokens.background;
      colors.set(name, themeInk(fill));
    }
    const missing = new Map(colors);
    for (const entry of declarations) {
      const color = colors.get(entry.name);
      if (entry.mode !== mode || !color) continue;
      edits.push({
        start: entry.start,
        end: entry.end,
        text:
          cssColor(color) +
          (/!important\s*$/i.test(entry.value) ? " !important" : ""),
      });
      missing.delete(entry.name);
    }
    if (!missing.size) continue;
    const text = [...missing]
      .map(([name, color]) => `  ${name}: ${cssColor(color)};`)
      .join("\n");
    const block = [...blocks].reverse().find((block) => block.mode === mode);
    if (block) {
      const before = source
        .slice(0, block.end)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .trimEnd();
      edits.push({
        start: block.end,
        end: block.end,
        text: `${/[;{}]$/.test(before) ? "" : ";"}\n${text}\n`,
      });
    } else
      appended += `\n\n${mode === "dark" ? ".dark" : "@theme"} {\n${mode === "dark" ? "  color-scheme: dark;\n" : ""}${text}\n}\n`;
  }
  let result = source;
  for (const edit of edits.sort((a, b) => b.start - a.start))
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
  return result + appended;
}
