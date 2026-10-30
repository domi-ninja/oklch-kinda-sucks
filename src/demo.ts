export const demoBody = `<main class="min-h-screen bg-background text-foreground p-6 font-sans text-sm">
  <header class="flex items-center justify-between border-b border-border pb-6 mb-6"><strong>Studio / projects</strong><span class="rounded-full bg-secondary px-3 py-2 text-secondary-foreground">Personal workspace</span></header>
  <div class="grid gap-6 md:grid-cols-2">
    <section class="rounded-xl border border-border bg-card p-6 text-card-foreground"><div class="flex justify-between mb-6"><strong>Website refresh</strong><span class="text-muted-foreground">01</span></div><div class="h-2 rounded-full bg-secondary mb-6"><div class="h-2 w-2/3 rounded-full bg-primary"></div></div><div class="flex gap-3"><button id="project" class="rounded-lg bg-primary px-4 py-3 text-primary-foreground hover:opacity-80">Open project</button><button id="archive" class="rounded-lg border border-border px-4 py-3 hover:bg-muted">Archive</button></div></section>
    <section class="rounded-xl border border-border bg-card p-6"><strong>Activity</strong><div class="flex items-center gap-3 mt-6"><span class="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground">JD</span><div>Jamie updated the palette<div class="text-muted-foreground mt-2">Just now</div></div></div><div class="mt-6 rounded-lg bg-muted text-muted-foreground p-3" id="status" role="status">All changes saved</div></section>
    <section class="rounded-xl border border-border bg-card p-6"><strong>Project settings</strong><label class="block mt-6 mb-3" for="project-name">Name</label><input id="project-name" value="Website refresh" class="w-full rounded-lg border border-border bg-background p-3 text-foreground focus:outline-primary"/><label class="flex items-center gap-3 my-6"><input type="checkbox" checked class="accent-primary"/> Email notifications</label><button id="save" class="rounded-lg bg-primary px-4 py-3 text-primary-foreground">Save changes</button></section>
    <section class="rounded-xl border border-border bg-card p-6"><strong>Team members</strong><div class="flex justify-between py-6 border-b border-border"><span>Jamie Davis</span><span class="text-muted-foreground">Owner</span></div><div class="flex justify-between py-6"><span>Alex Chen</span><span class="text-muted-foreground">Editor</span></div><button id="remove" class="rounded-lg bg-destructive px-4 py-3 text-destructive-foreground">Remove member</button></section>
  </div>
</main>`;
export const demoScript = `document.getElementById('save').onclick=()=>document.getElementById('status').textContent='Settings saved';document.getElementById('project').onclick=()=>document.getElementById('status').textContent='Project opened';document.getElementById('archive').onclick=()=>document.getElementById('status').textContent='Project archived';document.getElementById('remove').onclick=()=>document.getElementById('status').textContent='Member removed';`;
export function demoDocument(css: string) {
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Palette studio preview</title><style>${css.replace(/<\/style/gi, "<\\/style")}</style></head><body>${demoBody}<script>${demoScript}</script></body></html>`;
}
export const candidates = [
  ...new Set(
    demoBody
      .match(/class="([^"]+)"/g)
      ?.flatMap((value) => value.slice(7, -1).split(/\s+/)),
  ),
];
export const baseTokens: Record<string, string> = {
  background: "oklch(0.985 0.002 180)",
  foreground: "oklch(0.21 0.018 180)",
  card: "oklch(1 0 0)",
  "card-foreground": "oklch(0.21 0.018 180)",
  primary: "oklch(0.65 0.16 165)",
  "primary-foreground": "oklch(0.16 0.03 165)",
  secondary: "oklch(0.93 0.03 165)",
  "secondary-foreground": "oklch(0.3 0.05 165)",
  muted: "oklch(0.95 0.008 180)",
  "muted-foreground": "oklch(0.49 0.025 180)",
  accent: "oklch(0.9 0.08 165)",
  "accent-foreground": "oklch(0.25 0.05 165)",
  destructive: "oklch(0.55 0.2 25)",
  "destructive-foreground": "oklch(1 0 0)",
  border: "oklch(0.88 0.012 180)",
};
export const sourceFor = (tokens: Record<string, string>, extra: string) =>
  `@import "tailwindcss";\n\n@theme {\n${Object.entries(tokens)
    .map(([key, value]) => `  --color-${key}: ${value};`)
    .join("\n")}\n}\n\n${extra}`;
export type Preset = {
  id: string;
  name: string;
  tokens: Record<string, string>;
  extra: string;
};
export const presets: Preset[] = [
  {
    id: "mint",
    name: "Mint studio",
    tokens: baseTokens,
    extra: "@theme {\n  --radius-lg: 0.5rem;\n  --radius-xl: 0.75rem;\n}",
  },
  {
    id: "cobalt",
    name: "Cobalt",
    tokens: {
      ...baseTokens,
      primary: "oklch(0.55 0.24 265)",
      "primary-foreground": "oklch(1 0 0)",
      accent: "oklch(0.9 0.05 265)",
    },
    extra: "",
  },
  {
    id: "midnight",
    name: "Midnight",
    tokens: {
      ...baseTokens,
      background: "oklch(0.17 0.015 260)",
      foreground: "oklch(0.95 0.01 260)",
      card: "oklch(0.22 0.02 260)",
      "card-foreground": "oklch(0.95 0.01 260)",
      border: "oklch(0.34 0.02 260)",
      muted: "oklch(0.28 0.02 260)",
      "muted-foreground": "oklch(0.75 0.02 260)",
      secondary: "oklch(0.3 0.03 165)",
    },
    extra: "",
  },
];
