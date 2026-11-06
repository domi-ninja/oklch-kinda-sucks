import { converter, toGamut, wcagContrast, type Rgb } from "culori";
import { cssColor, type Color } from "./color";
import type { ModeGeneration } from "./workspaceSchema";

type Mode = ModeGeneration["from"];
type Declaration = {
  name: string;
  value: string;
  start: number;
  end: number;
  mode: Mode;
};
type Block = { mode: Mode | null; end: number };
const toOklch = converter("oklch");
const toSrgb = toGamut("rgb", "oklch");
export const defaultModeGeneration: ModeGeneration = {
  from: "light",
  background: 0.18,
  contrast: 1,
  chroma: 0.85,
};
const clamp = (value: number, max = 1) => Math.max(0, Math.min(max, value));
const isForeground = (name: string) =>
  name === "--color-foreground" || name.endsWith("-foreground");

function composite(rgb: Rgb, alpha: number, background: Rgb): Rgb {
  return {
    mode: "rgb",
    r: rgb.r * alpha + background.r * (1 - alpha),
    g: rgb.g * alpha + background.g * (1 - alpha),
    b: rgb.b * alpha + background.b * (1 - alpha),
  };
}

function rendered(color: Color, background: Rgb): Rgb {
  return composite(toSrgb({ mode: "oklch", ...color }), color.a, background);
}

// Foregrounds may be reused on cards, and translucent fills expose that backing.
function textBackgrounds(
  name: string,
  colors: ReadonlyMap<string, Color>,
  fallback: Color,
  dark: boolean,
) {
  const canvas = dark ? 0 : 1;
  const background = rendered(colors.get("--color-background") ?? fallback, {
    mode: "rgb",
    r: canvas,
    g: canvas,
    b: canvas,
  });
  const backing = [background];
  for (const surface of ["card", "popover", "sidebar"]) {
    const color = colors.get(`--color-${surface}`);
    if (color) backing.push(rendered(color, background));
  }
  if (name === "--color-foreground") return backing;
  const surface = colors.get(name.replace(/-foreground$/, ""));
  const surfaces = surface
    ? backing.map((base) => rendered(surface, base))
    : backing;
  return name === "--color-muted-foreground"
    ? [...backing, ...surfaces]
    : surfaces;
}

function textContrast(color: Color, backgrounds: Rgb[]) {
  const rgb = toSrgb({ mode: "oklch", ...color });
  return Math.min(
    ...backgrounds.map((background) =>
      wcagContrast(composite(rgb, color.a, background), background),
    ),
  );
}

function deriveForeground(
  name: string,
  original: Color,
  originals: ReadonlyMap<string, Color>,
  generated: ReadonlyMap<string, Color>,
  settings: ModeGeneration,
) {
  const fallback = {
    l: settings.from === "light" ? 1 : 0.18,
    c: 0,
    h: 0,
    a: 1,
  };
  const sourceRatio = textContrast(
    original,
    textBackgrounds(name, originals, fallback, settings.from === "dark"),
  );
  const backgrounds = textBackgrounds(
    name,
    generated,
    { ...fallback, l: settings.background },
    settings.from === "light",
  );
  const muted = name === "--color-muted-foreground";
  const body = /^--color-(?:(?:card|popover|sidebar)-)?foreground$/.test(name);
  const intent = Math.max(
    body ? 7 : 4.5,
    Math.min(muted ? 6 : body ? 12 : 7, sourceRatio),
  );
  const desired = Math.max(4.5, intent * settings.contrast) + 0.05;
  const color = { ...original, c: clamp(original.c * settings.chroma, 0.03) };
  const black = textContrast({ ...color, l: 0 }, backgrounds);
  const white = textContrast({ ...color, l: 1 }, backgrounds);
  let passing = white > black ? 1 : 0;
  let failing = 1 - passing;
  const achievable = Math.min(desired, Math.max(white, black));
  // Search only lightness; keep the text's hue, restrained tint, and alpha.
  for (let i = 0; i < 20; i++) {
    const l = (passing + failing) / 2;
    if (textContrast({ ...color, l }, backgrounds) >= achievable) passing = l;
    else failing = l;
  }
  return { ...color, l: passing };
}

// Keep source ranges so generation only edits destination color declarations.
export function readThemeColors(source: string) {
  const declarations: Declaration[] = [];
  const blocks: Block[] = [];
  const stack: Block[] = [];
  let boundary = 0;
  const readDeclaration = (end: number) => {
    const mode = stack.at(-1)?.mode;
    if (!mode) return;
    const text = source.slice(boundary, end);
    const clean = text.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
      " ".repeat(comment.length),
    );
    const match = clean.match(/^\s*(--color-[\w-]+)\s*:\s*([\s\S]*?\S)\s*$/);
    if (!match) return;
    const start = boundary + clean.indexOf(match[2], clean.indexOf(":") + 1);
    declarations.push({
      name: match[1],
      value: match[2],
      start,
      end: start + match[2].length,
      mode,
    });
  };
  for (let i = 0; i < source.length; i++) {
    if (source.startsWith("/*", i)) {
      const end = source.indexOf("*/", i + 2);
      if (end === -1) throw new Error("Close the stylesheet comment first.");
      i = end + 1;
    } else if (source[i] === '"' || source[i] === "'") {
      const quote = source[i];
      while (++i < source.length && source[i] !== quote)
        if (source[i] === "\\") i++;
    } else if (source[i] === "{") {
      const selector = source
        .slice(boundary, i)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .trim();
      const mode: Mode | null = /^(?:\.dark|:root\.dark|html\.dark)$/.test(
        selector,
      )
        ? "dark"
        : /^@theme\b|^(?::root|html)$/.test(selector)
          ? "light"
          : selector.startsWith("@")
            ? (stack.at(-1)?.mode ?? null)
            : null;
      const block = { mode, end: -1 };
      blocks.push(block);
      stack.push(block);
      boundary = i + 1;
    } else if (source[i] === ";" || source[i] === "}") {
      readDeclaration(i);
      if (source[i] === "}") {
        const block = stack.pop();
        if (!block) throw new Error("Fix the stylesheet braces first.");
        block.end = i;
      }
      boundary = i + 1;
    }
  }
  if (stack.length) throw new Error("Close the stylesheet block first.");
  return { declarations, blocks };
}

export function generateMode(source: string, settings: ModeGeneration) {
  const { declarations, blocks } = readThemeColors(source);
  const target: Mode = settings.from === "light" ? "dark" : "light";
  const light = new Map<string, string>();
  const dark = new Map<string, string>();
  for (const declaration of declarations)
    (declaration.mode === "dark" ? dark : light).set(
      declaration.name,
      declaration.value,
    );
  // Dark mode inherits light tokens that do not have an explicit override.
  const inputs =
    settings.from === "light" ? light : new Map([...light, ...dark]);
  const resolve = (name: string, seen = new Set<string>()): Color | null => {
    if (seen.has(name)) return null;
    seen.add(name);
    const value = inputs.get(name)?.replace(/\s*!important\s*$/i, "");
    if (!value) return null;
    const alias = value.match(/^var\(\s*(--color-[\w-]+)\s*\)$/);
    if (alias) return resolve(alias[1], seen);
    const color = toOklch(value);
    return color && Number.isFinite(color.l) && Number.isFinite(color.c)
      ? { l: color.l, c: color.c, h: color.h ?? 0, a: color.alpha ?? 1 }
      : null;
  };
  const sourceBackground =
    resolve("--color-background")?.l ?? (settings.from === "light" ? 1 : 0.18);
  const originals = new Map<string, Color>();
  for (const name of inputs.keys()) {
    const color = resolve(name);
    if (color) originals.set(name, color);
  }
  const generated = new Map<string, Color>();
  for (const [name, color] of originals) {
    if (isForeground(name)) continue;
    let l =
      settings.background + (sourceBackground - color.l) * settings.contrast;
    // Raised neutral surfaces stay above a dark background and below a light one.
    if (/^--color-(?:card|popover|sidebar)$/.test(name))
      l =
        settings.background +
        (target === "dark" ? 1 : -1) *
          Math.max(0.035, Math.abs(sourceBackground - color.l)) *
          settings.contrast;
    generated.set(name, {
      ...color,
      l: clamp(l),
      c: clamp(color.c * settings.chroma, 0.4),
    });
  }
  for (const [name, color] of originals)
    if (isForeground(name))
      generated.set(
        name,
        deriveForeground(name, color, originals, generated, settings),
      );
  // Preserve declaration order so token selection and generated CSS stay stable.
  const colors = new Map(
    [...originals].map(
      ([name, color]) =>
        [name, cssColor(generated.get(name) ?? color)] as const,
    ),
  );
  if (!colors.size)
    throw new Error("No color tokens found in the source mode.");

  const edits: { start: number; end: number; text: string }[] = [];
  const appendToBlock = (block: Block, text: string) => {
    const previous = source
      .slice(0, block.end)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .trimEnd();
    return {
      start: block.end,
      end: block.end,
      text: `${/[;{}]$/.test(previous) ? "" : ";"}\n${text}\n`,
    };
  };
  const missing = new Map(colors);
  for (const declaration of declarations) {
    const value = colors.get(declaration.name);
    if (declaration.mode !== target || !value) continue;
    edits.push({
      start: declaration.start,
      end: declaration.end,
      text:
        value +
        (/!important\s*$/i.test(declaration.value) ? " !important" : ""),
    });
    missing.delete(declaration.name);
  }
  if (missing.size) {
    const text = [...missing]
      .map(([name, value]) => `  ${name}: ${value};`)
      .join("\n");
    const block = [...blocks].reverse().find((block) => block.mode === target);
    edits.push(
      block
        ? appendToBlock(block, text)
        : {
            start: source.length,
            end: source.length,
            text: `\n\n${target === "dark" ? ".dark" : "@theme"} {\n${target === "dark" ? "  color-scheme: dark;\n" : ""}${text}\n}\n`,
          },
    );
  }
  // Pin inherited dark colors before replacing the light values they relied on.
  if (settings.from === "dark") {
    const inherited = [...originals].filter(([name]) => !dark.has(name));
    if (inherited.length) {
      const text = inherited
        .map(
          ([name, color]) =>
            `  ${name}: ${light.get(name) ?? cssColor(color)};`,
        )
        .join("\n");
      const block = [...blocks]
        .reverse()
        .find((block) => block.mode === "dark");
      edits.push(
        block
          ? appendToBlock(block, text)
          : {
              start: source.length,
              end: source.length,
              text: `\n\n.dark {\n  color-scheme: dark;\n${text}\n}\n`,
            },
      );
    }
  }
  let result = source;
  for (const edit of edits.sort((a, b) => b.start - a.start))
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
  return {
    source: result,
    count: colors.size,
    skipped: inputs.size - colors.size,
  };
}
