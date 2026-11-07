type Mode = "light" | "dark";
type Declaration = {
  name: string;
  value: string;
  start: number;
  end: number;
  mode: Mode;
};
type Block = { mode: Mode | null; end: number };

// Keep declaration ranges so palette application preserves unrelated CSS.
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
