import { compile } from "tailwindcss";
import index from "tailwindcss/index.css?raw";
import theme from "tailwindcss/theme.css?raw";
import preflight from "tailwindcss/preflight.css?raw";
import utilities from "tailwindcss/utilities.css?raw";
const sheets: Record<string, string> = {
  tailwindcss: index,
  "./theme.css": theme,
  "./preflight.css": preflight,
  "./utilities.css": utilities,
};
self.onmessage = async (
  event: MessageEvent<{ id: number; source: string; candidates: string[] }>,
) => {
  const { id, source, candidates } = event.data;
  try {
    const compiler = await compile(source, {
      loadStylesheet: async (path) => {
        if (!(path in sheets)) throw new Error(`Unsupported import: ${path}`);
        return { path, content: sheets[path], base: "/" };
      },
    });
    self.postMessage({ id, css: compiler.build(candidates) });
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
