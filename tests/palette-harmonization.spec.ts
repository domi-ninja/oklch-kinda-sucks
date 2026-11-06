import { test, expect } from "@playwright/test";
import { converter, formatCss, toGamut } from "culori";
import { calcContrast } from "apcach";
import { harmonizePalette } from "../src/paletteHarmonizer";
import { applyPaletteTheme, themePaletteCss } from "../src/applyPaletteTheme";
import { readThemeColors } from "../src/modeGeneration";
import { baseTokens, sourceFor } from "../src/demo";
import { createPaletteRamp } from "../src/palette";
import { cssColor, type Color } from "../src/color";
import { workspaceSchema } from "../src/workspaceSchema";

const toOklch = converter("oklch");
const p3 = toGamut("p3", "oklch", null, 0);
const example = ["#a9ffeb", "#aacd85", "#ac8a39", "#944929", "#631436"].map(
  (value) => {
    const c = toOklch(value)!;
    return { l: c.l, c: c.c, h: c.h ?? 0, a: 1 };
  },
);
const rendered = (color: Color) =>
  formatCss(p3({ mode: "oklch", l: color.l, c: color.c, h: color.h }));

function foreground(color: Color) {
  expect([0, 1]).toContain(color.l);
  expect(color.c).toBe(0);
  expect(color.a).toBe(1);
}

test("the supplied gradient produces distinct light/dark theme roles with pure black/white text", () => {
  const result = harmonizePalette(example);
  expect(result.light.colors).toHaveLength(5);
  expect(result.dark.colors).toHaveLength(5);
  expect(result.light.tokens.background.l).toBeGreaterThan(0.97);
  expect(result.dark.tokens.background.l).toBeLessThan(0.2);
  for (const mode of ["light", "dark"] as const) {
    const palette = result[mode];
    const background = mode === "light" ? "white" : "black";
    const contrasts = palette.colors.map((color) =>
      calcContrast(rendered(color), background, "apca", "p3"),
    );
    expect(contrasts[2]).toBeCloseTo(72, 1);
    expect(
      contrasts.every(
        (value, index) => index === 0 || value >= contrasts[index - 1],
      ),
    ).toBe(true);
    for (const [role, index] of [
      ["primary", 2],
      ["secondary", 1],
      ["accent", 3],
    ] as const) {
      const fill = palette.tokens[role];
      const text = palette.tokens[`${role}-foreground`];
      expect(fill.h).toBeCloseTo(example[index].h, 4);
      foreground(text);
      expect(
        calcContrast(rendered(text), rendered(fill), "apca", "p3"),
      ).toBeGreaterThan(65);
    }
    for (const [name, color] of Object.entries(palette.tokens)) {
      expect(Object.values(color).every(Number.isFinite)).toBe(true);
      expect(color.a).toBe(1);
      if (name === "foreground" || name.endsWith("-foreground"))
        foreground(color);
    }
    expect(themePaletteCss(palette, mode)).toContain(
      mode === "light" ? "@theme {" : ".dark {",
    );
  }
  expect(result.light.tokens.primary).not.toEqual(result.dark.tokens.primary);
  expect(result.light.tokens.primary).toEqual(result.light.colors[2]);
  expect(result.dark.tokens.primary).toEqual(result.dark.colors[2]);
});

test("theme generation uses the full middle control path independently of the displayed subdivisions", () => {
  const ramp = createPaletteRamp(
    { l: 0.95, c: 0.03, h: 170, a: 0.3 },
    { l: 0.2, c: 0.03, h: 10, a: 0.8 },
    "OKHCL",
    1,
    { l: 0.9, c: 0.3, h: 280, a: 0 },
  );
  const result = harmonizePalette(ramp.colors, ramp.path);
  expect(result.light.colors).toHaveLength(2);
  expect(result.light.tokens.primary.h).toBeCloseTo(ramp.path[16].h, 4);
  expect(result.dark.tokens.primary.h).toBeCloseTo(ramp.path[16].h, 4);
  expect(result.light.tokens.primary.a).toBe(1);
  const neutral = harmonizePalette(
    example.map((color) => ({ ...color, c: 0 })),
  );
  for (const mode of ["light", "dark"] as const)
    for (const color of Object.values(neutral[mode].tokens))
      expect(color.c).toBeLessThan(0.000001);
});

test("applying a theme changes both color blocks, preserves semantic error fills and unrelated CSS, and is idempotent", () => {
  const source = sourceFor(
    { ...baseTokens, primary: "oklch(.6 .1 60) !important" },
    "main { border-radius: 7px; }",
  );
  const palette = harmonizePalette(example);
  const result = applyPaletteTheme(source, palette);
  const entries = readThemeColors(result).declarations;
  for (const mode of ["light", "dark"] as const) {
    const tokens = new Map(
      entries
        .filter((entry) => entry.mode === mode)
        .map((entry) => [entry.name, entry.value]),
    );
    expect(tokens.get("--color-primary")).toContain(
      cssColor(palette[mode].tokens.primary),
    );
    for (const [name, color] of Object.entries(palette[mode].tokens))
      expect(tokens.get(`--color-${name}`)).toContain(cssColor(color));
    const text = tokens.get("--color-destructive-foreground");
    expect(text).toMatch(/^oklch\([01] 0 0/);
  }
  expect(result).toContain(" !important");
  expect(result).toContain("main { border-radius: 7px; }");
  expect(result).toContain(`--color-destructive: ${baseTokens.destructive}`);
  expect(applyPaletteTheme(result, palette)).toBe(result);
  const sparse = applyPaletteTheme(
    '@import "tailwindcss"; @theme { --radius-lg: 6px; }',
    palette,
  );
  expect(sparse).toContain(".dark {");
  expect(sparse).toContain("--radius-lg: 6px;");
});

test("both theme previews copy independently and apply to the current preset in one undo step", async ({
  page,
}) => {
  await page.goto("/#color=0.95,0.02,170,1&pickers=OKHCL");
  await page
    .getByRole("button", { name: "Create palette", exact: true })
    .click();
  await page.getByRole("button", { name: "End", exact: true }).click();
  const editor = page.getByLabel("OKLCH value", { exact: true });
  const apply = page.getByRole("button", { name: "Apply color", exact: true });
  await editor.fill("oklch(.3 .12 10)");
  await apply.click();
  await page
    .getByRole("button", { name: "Add middle color", exact: true })
    .click();
  await editor.fill("oklch(.85 .2 90)");
  await apply.click();
  const button = page.getByRole("button", {
    name: "Apply palette to preset",
    exact: true,
  });
  await expect(button).toBeEnabled();
  for (const mode of ["light", "dark"] as const) {
    await expect(
      page.getByRole("list", {
        name: `Harmonized ${mode} colors`,
        exact: true,
      }),
    ).toHaveAttribute("aria-busy", "false");
    await expect(
      page
        .getByRole("list", {
          name: `Harmonized ${mode} brightness`,
          exact: true,
        })
        .getByRole("listitem"),
    ).toHaveCount(5);
  }
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          sessionStorage.setItem("copied-theme", text);
        },
      },
    }),
  );
  for (const mode of ["light", "dark"] as const) {
    await page
      .getByRole("button", { name: `Copy ${mode} theme`, exact: true })
      .click();
    expect(
      await page.evaluate(() => sessionStorage.getItem("copied-theme")),
    ).toContain(mode === "light" ? "@theme {" : ".dark {");
  }
  const workspace = async () =>
    workspaceSchema.parse(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("oklch-workspace")!),
      ),
    );
  const before = await workspace();
  const frame = page.frameLocator('iframe[title="shadcn/ui light preview"]');
  await page.mouse.move(0, 0);
  await expect
    .poll(() =>
      frame
        .locator("html")
        .evaluate((el) => el.style.getPropertyValue("--color-primary")),
    )
    .toBe("");
  const oldColor = await frame
    .getByRole("button", { name: "Open project", exact: true })
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  await button.click();
  await expect
    .poll(async () => (await workspace()).source)
    .not.toBe(before.source);
  const after = await workspace();
  expect(after.palette).toEqual(before.palette);
  expect(after.color).toEqual(before.color);
  expect(after.saved).toEqual(before.saved);
  for (const mode of ["light", "dark"] as const)
    expect(
      readThemeColors(after.source).declarations.some(
        (entry) => entry.mode === mode && entry.name === "--color-primary",
      ),
    ).toBe(true);
  await expect
    .poll(() =>
      frame
        .getByRole("button", { name: "Open project", exact: true })
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    )
    .not.toBe(oldColor);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await workspace()).source).toBe(before.source);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect.poll(async () => (await workspace()).source).toBe(after.source);
  await page.reload();
  expect((await workspace()).source).toBe(after.source);
  await expect(button).toBeEnabled();
  await page.getByLabel("Palette subdivisions", { exact: true }).fill("64");
  await expect(button).toBeEnabled();
  await expect(
    page
      .getByRole("list", { name: "Harmonized dark colors", exact: true })
      .getByRole("listitem"),
  ).toHaveCount(65);
});
