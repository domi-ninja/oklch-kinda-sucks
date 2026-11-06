import { test, expect } from "@playwright/test";
import { baseTokens, presets, sourceFor } from "../src/demo";
import { parseColor, type Color } from "../src/color";
import { toGamut, wcagContrast } from "culori";
import {
  defaultModeGeneration,
  generateMode,
  readThemeColors,
} from "../src/modeGeneration";
import { workspaceSchema } from "../src/workspaceSchema";
import { workspaceStorageKey } from "../src/workspace";

function tokens(source: string, mode: "light" | "dark") {
  const declarations = readThemeColors(source).declarations;
  return Object.fromEntries(
    [
      ...declarations.filter((entry) => entry.mode === "light"),
      ...(mode === "dark"
        ? declarations.filter((entry) => entry.mode === "dark")
        : []),
    ].map((entry) => [
      entry.name.replace("--color-", ""),
      parseColor(entry.value.replace(/\s*!important$/, "")),
    ]),
  );
}

test("generation anchors lightness, retains hue and alpha, and raises surfaces", () => {
  const source = sourceFor(
    { ...baseTokens, primary: "oklch(0.65 0.16 165 / 60%)" },
    "main { border-radius: 5px; }",
  );
  const generated = generateMode(source, defaultModeGeneration);
  expect(tokens(generated.source, "light")).toEqual(tokens(source, "light"));
  const dark = tokens(generated.source, "dark");
  expect(dark.background?.l).toBe(0.18);
  expect(dark.card?.l).toBe(0.215);
  expect(dark.foreground!.l).toBeGreaterThan(dark["muted-foreground"]!.l);
  expect(dark.foreground!.l).toBeGreaterThan(0.8);
  expect(dark.primary).toEqual({ l: 0.515, c: 0.136, h: 165, a: 0.6 });
  expect(generated.source).toContain("main { border-radius: 5px; }");
  expect(generated.count).toBe(Object.keys(baseTokens).length);
  expect(generated.skipped).toBe(0);
  expect(generateMode(generated.source, defaultModeGeneration).source).toBe(
    generated.source,
  );
  const adjusted = tokens(
    generateMode(source, {
      ...defaultModeGeneration,
      background: 0.25,
      contrast: 0.8,
      chroma: 0.5,
    }).source,
    "dark",
  );
  expect(adjusted.background?.l).toBe(0.25);
  expect(adjusted.foreground!.l).toBeGreaterThan(
    adjusted["muted-foreground"]!.l,
  );
  expect(adjusted.primary?.c).toBe(0.08);
});

test("dark to light pins inherited colors without changing the dark theme", () => {
  const source = sourceFor(baseTokens, "");
  const settings = {
    from: "dark",
    background: 0.985,
    contrast: 1,
    chroma: 1,
  } as const;
  const generated = generateMode(source, settings).source;
  expect(tokens(generated, "dark")).toEqual(tokens(source, "dark"));
  const light = tokens(generated, "light");
  expect(light.background?.l).toBe(0.985);
  expect(light.card?.l).toBe(0.935);
  expect(light.foreground!.l).toBeLessThan(light["muted-foreground"]!.l);
  expect(generateMode(generated, settings).source).toBe(generated);
});

test("foregrounds contrast with their surfaces across themes and directions while retaining text hierarchy", () => {
  const rgb = toGamut("rgb", "oklch");
  const ratio = (text: Color, surface: Color) =>
    wcagContrast(
      rgb({ mode: "oklch", ...text }),
      rgb({ mode: "oklch", ...surface }),
    );
  for (const preset of presets) {
    const source = sourceFor(preset.tokens, preset.extra);
    for (const from of ["light", "dark"] as const) {
      const target = from === "light" ? "dark" : "light";
      const generated = tokens(
        generateMode(source, {
          ...defaultModeGeneration,
          from,
          background: target === "dark" ? 0.18 : 0.985,
          chroma: 1.5,
        }).source,
        target,
      );
      for (const name of Object.keys(generated).filter(
        (name) => name === "foreground" || name.endsWith("-foreground"),
      )) {
        const text = generated[name]!;
        const surface =
          generated[
            name === "foreground"
              ? "background"
              : name.replace(/-foreground$/, "")
          ]!;
        expect(
          ratio(text, surface),
          `${preset.id} ${target} ${name}`,
        ).toBeGreaterThanOrEqual(4.49);
        expect(text.c).toBeLessThanOrEqual(0.03);
      }
      expect(
        ratio(generated.foreground!, generated.background!),
      ).toBeGreaterThan(
        ratio(generated["muted-foreground"]!, generated.background!),
      );
    }
  }
  const source = sourceFor(baseTokens, "");
  const low = tokens(
    generateMode(source, { ...defaultModeGeneration, contrast: 0.5 }).source,
    "dark",
  );
  const high = tokens(
    generateMode(source, { ...defaultModeGeneration, contrast: 1.5 }).source,
    "dark",
  );
  expect(ratio(high.foreground!, high.background!)).toBeGreaterThan(
    ratio(low.foreground!, low.background!) + 2,
  );
});

test("text chooses its polarity from each surface, restrains tint and retains transparency", () => {
  const source = sourceFor(
    {
      ...baseTokens,
      foreground: "oklch(0.21 0.2 260)",
      "primary-foreground": "oklch(1 0 40)",
    },
    "",
  );
  const dark = tokens(
    generateMode(source, defaultModeGeneration).source,
    "dark",
  );
  expect(dark["primary-foreground"]!.l).toBeGreaterThan(dark.primary!.l);
  expect(dark.foreground!.c).toBe(0.03);
  expect(dark.foreground!.h).toBe(260);
  const bright = tokens(
    generateMode(source, { ...defaultModeGeneration, background: 0.9 }).source,
    "dark",
  );
  expect(bright.foreground!.l).toBeLessThan(0.4);
  const translucent = sourceFor(
    { ...baseTokens, "primary-foreground": "oklch(0.2 0.02 45 / 60%)" },
    "",
  );
  expect(
    tokens(generateMode(translucent, defaultModeGeneration).source, "dark")[
      "primary-foreground"
    ]!.a,
  ).toBe(0.6);
});

test("rendered body text, muted text and labels remain readable in light and dark previews", async ({
  page,
}) => {
  await page.goto("/");
  page.on("dialog", (dialog) => dialog.accept());
  for (const preset of presets) {
    await page.getByLabel("Preset", { exact: true }).selectOption(preset.id);
    for (const from of ["light", "dark"]) {
      const target = from === "light" ? "dark" : "light";
      await page
        .getByLabel("Generate mode direction", { exact: true })
        .selectOption(from);
      await page
        .getByRole("button", { name: `Generate ${target} mode`, exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Export app", exact: true }),
      ).toBeEnabled();
      const frame = page.frameLocator(
        `iframe[title="shadcn/ui ${target} preview"]`,
      );
      const contrasts = await frame.locator("main").evaluate((main) => {
        const canvas = document.createElement("canvas");
        canvas.width = 2;
        canvas.height = 1;
        const context = canvas.getContext("2d", {
          colorSpace: "srgb",
          willReadFrequently: true,
        })!;
        const luminance = (rgb: number[]) =>
          rgb
            .map((value) => {
              const channel = value / 255;
              return channel <= 0.04045
                ? channel / 12.92
                : ((channel + 0.055) / 1.055) ** 2.4;
            })
            .reduce(
              (sum, value, index) =>
                sum + value * [0.2126, 0.7152, 0.0722][index],
              0,
            );
        return ["main", "#project", "#remove", "#status", "header > span"].map(
          (selector) => {
            const element =
              selector === "main" ? main : main.querySelector(selector)!;
            const ancestors: Element[] = [];
            for (
              let parent: Element | null = element;
              parent;
              parent = parent.parentElement
            )
              ancestors.unshift(parent);
            context.fillStyle = "white";
            context.fillRect(0, 0, 2, 1);
            for (const parent of ancestors) {
              context.fillStyle = getComputedStyle(parent).backgroundColor;
              context.fillRect(0, 0, 2, 1);
            }
            context.fillStyle = getComputedStyle(element).color;
            context.fillRect(1, 0, 1, 1);
            const values = Array.from(context.getImageData(0, 0, 2, 1).data);
            const background = luminance(values.slice(0, 3));
            const text = luminance(values.slice(4, 7));
            return {
              selector,
              ratio:
                (Math.max(text, background) + 0.05) /
                (Math.min(text, background) + 0.05),
            };
          },
        );
      });
      for (const { selector, ratio } of contrasts)
        expect(
          ratio,
          `${preset.id} ${target} ${selector}`,
        ).toBeGreaterThanOrEqual(selector === "main" ? 7 : 4.45);
    }
  }
});

test("generation preserves unrelated CSS and handles aliases, literals, missing blocks and invalid expressions", () => {
  const source = `/* .dark { --color-background: oklch(0.1 0 0); } */
@theme { --color-background: #fff; --color-foreground: #000; --color-primary: oklch(70% 0.2 200 / 50%); --color-ring: var(--color-primary); --color-other: var(--outside); --radius-lg: 1rem; }
main::before { content: "} ; .dark {"; }
.dark { --color-foreground: #eee !important; --radius-lg: 2rem; }
main { --color-primary: hotpink; }
`;
  const generated = generateMode(source, defaultModeGeneration);
  expect(generated.count).toBe(4);
  expect(generated.skipped).toBe(1);
  expect(tokens(generated.source, "dark").ring).toEqual(
    tokens(generated.source, "dark").primary,
  );
  expect(generated.source).toContain(" !important;");
  expect(generated.source).toContain(
    'main::before { content: "} ; .dark {"; }',
  );
  expect(generated.source).toContain("main { --color-primary: hotpink; }");
  expect(generated.source).toContain("--radius-lg: 2rem;");
  const bare =
    "@theme { --color-background: oklch(1 0 0); --color-foreground: oklch(0 0 0); }";
  expect(generateMode(bare, defaultModeGeneration).source).toContain(".dark {");
  const noSemicolon = generateMode(
    `${bare}\n.dark { color-scheme: dark }`,
    defaultModeGeneration,
  ).source;
  expect(noSemicolon).toContain("color-scheme: dark ;\n");
  expect(
    readThemeColors(noSemicolon).declarations.filter(
      (entry) => entry.mode === "dark",
    ),
  ).toHaveLength(2);
  expect(() =>
    generateMode(
      "@theme { --color-primary: var(--external); }",
      defaultModeGeneration,
    ),
  ).toThrow("No color tokens");
  expect(() => generateMode("@theme {", defaultModeGeneration)).toThrow(
    "Close the stylesheet block",
  );
});

test("mode UI generates both directions, preserves the source preview, and undoes edits", async ({
  page,
}) => {
  await page.goto("/");
  const form = page.getByRole("form", { name: "Mode generation" });
  const light = page.frameLocator('iframe[title="shadcn/ui light preview"]');
  const dark = page.frameLocator('iframe[title="shadcn/ui dark preview"]');
  await expect(light.locator("main")).toHaveCSS(
    "background-color",
    "oklch(0.985 0.002 180)",
  );
  await form
    .getByLabel("Background lightness percent", { exact: true })
    .fill("22");
  await form.getByLabel("Contrast percent", { exact: true }).fill("80");
  await form.getByLabel("Chroma percent", { exact: true }).fill("100");
  await form
    .getByRole("button", { name: "Generate dark mode", exact: true })
    .click();
  await expect(dark.locator("main")).toHaveCSS(
    "background-color",
    "oklch(0.22 0.002 180)",
  );
  await expect(light.locator("main")).toHaveCSS(
    "background-color",
    "oklch(0.985 0.002 180)",
  );
  await expect(
    dark.getByRole("button", { name: "Open project", exact: true }),
  ).toHaveCSS("background-color", "oklch(0.488 0.16 165)");
  await form.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(dark.locator("main")).toHaveCSS(
    "background-color",
    "oklch(0.18 0.008 260)",
  );
  await form
    .getByLabel("Generate mode direction", { exact: true })
    .selectOption("dark");
  await form.getByLabel("Contrast percent", { exact: true }).fill("100");
  await form
    .getByRole("button", { name: "Generate light mode", exact: true })
    .click();
  await expect(light.locator("main")).toHaveCSS(
    "background-color",
    "oklch(0.985 0.008 260)",
  );
  await expect(dark.locator("main")).toHaveCSS(
    "background-color",
    "oklch(0.18 0.008 260)",
  );
  await expect(
    dark.getByRole("button", { name: "Open project", exact: true }),
  ).toHaveCSS("background-color", "oklch(0.65 0.16 165)");
  await form.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(light.locator("main")).toHaveCSS(
    "background-color",
    "oklch(0.985 0.002 180)",
  );
});

test("generation controls survive reload and share snapshots and fit mobile", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  const form = page.getByRole("form", { name: "Mode generation" });
  await form
    .getByLabel("Background lightness percent", { exact: true })
    .fill("24");
  await form.getByLabel("Contrast percent", { exact: true }).fill("90");
  await form.getByLabel("Chroma percent", { exact: true }).fill("75");
  await form
    .getByRole("button", { name: "Generate dark mode", exact: true })
    .click();
  await expect(form.getByRole("status")).toContainText("15 colors");
  await page.reload();
  for (const [label, value] of [
    ["Background lightness", "24"],
    ["Contrast", "90"],
    ["Chroma", "75"],
  ])
    await expect(
      form.getByLabel(`${label} percent`, { exact: true }),
    ).toHaveValue(value);
  const state = workspaceSchema.parse(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      workspaceStorageKey,
    ),
  );
  expect(state.modeGeneration).toEqual({
    from: "light",
    background: 0.24,
    contrast: 0.9,
    chroma: 0.75,
  });
  expect(new URL(page.url()).hash).not.toContain("modeGeneration");
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await form.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const link = page.getByLabel("Share link", { exact: true });
  await expect(link).toHaveValue(/\/share\//);
  const context = await browser.newContext();
  try {
    const shared = await context.newPage();
    await shared.goto(await link.inputValue());
    await expect(
      shared.getByLabel("Chroma percent", { exact: true }),
    ).toHaveValue("75");
    const snapshot = workspaceSchema.parse(
      await shared.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!),
        workspaceStorageKey,
      ),
    );
    expect(snapshot.modeGeneration).toEqual(state.modeGeneration);
    expect(snapshot.source).toBe(state.source);
  } finally {
    await context.close();
  }
});
