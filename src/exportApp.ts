import { strToU8, zipSync } from "fflate";
import { demoDocument } from "./demo";

const templates = import.meta.glob<string>("../export-template/**/*", {
  eager: true,
  query: "?raw",
  import: "default",
});

export function exportAppArchive(source: string, compiledCss: string) {
  const files = Object.fromEntries(
    Object.entries(templates).map(([path, content]) => [
      path.replace("../export-template/", ""),
      strToU8(content),
    ]),
  );
  files["src/theme.css"] = strToU8(source);
  files[".gitignore"] = strToU8("node_modules/\ndist/\n*.local\n");
  files["preview/index.html"] = strToU8(demoDocument(compiledCss, true));
  files["preview/dark.html"] = strToU8(demoDocument(compiledCss, true, true));
  files["preview/styles.css"] = strToU8(compiledCss);
  return zipSync(files) as Uint8Array<ArrayBuffer>;
}
