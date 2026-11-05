import { converter } from "culori";
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
export const defaultModeGeneration: ModeGeneration = {
  from: "light",
  background: 0.18,
  contrast: 1,
  chroma: 0.85,
};
const clamp = (value: number, max = 1) => Math.max(0, Math.min(max, value));

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
  const colors = new Map<string, string>();
  const originals = new Map<string, Color>();
  for (const name of inputs.keys()) {
    const color = resolve(name);
    if (!color) continue;
    originals.set(name, color);
    let l =
      settings.background + (sourceBackground - color.l) * settings.contrast;
    // Raised neutral surfaces stay above a dark background and below a light one.
    if (/^--color-(?:card|popover|sidebar)$/.test(name))
      l =
        settings.background +
        (target === "dark" ? 1 : -1) *
          Math.max(0.035, Math.abs(sourceBackground - color.l)) *
          settings.contrast;
    colors.set(
      name,
      cssColor({
        ...color,
        l: clamp(l),
        c: clamp(color.c * settings.chroma, 0.4),
      }),
    );
  }
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
