import { test, expect } from "@playwright/test";
import { converter, formatCss, toGamut } from "culori";
import { calcContrast } from "apcach";
import { harmonizePalette } from "../src/paletteHarmonizer";
import { createPaletteRamp } from "../src/palette";
import type { Color } from "../src/color";

const p3 = toGamut("p3", "oklch", null, 0);
const rgb = converter("p3");
function measured(color: Color, background: "black" | "white") {
  const mapped = p3({ mode: "oklch", l: color.l, c: color.c, h: color.h });
  const base = background === "white" ? 1 : 0;
  const composite = formatCss({
    mode: "p3",
    r: mapped.r * color.a + base * (1 - color.a),
    g: mapped.g * color.a + base * (1 - color.a),
    b: mapped.b * color.a + base * (1 - color.a),
  });
  return calcContrast(composite, background, "apca", "p3");
}

test("harmonization selects the contrast background, preserves endpoints and spaces APCA in either direction", () => {
  for (const range of [
    [0.98, 0.8, "black"],
    [0.35, 0.1, "white"],
  ] as const) {
    const source = createPaletteRamp(
      { l: range[0], c: 0.02, h: 90, a: 1 },
      { l: range[1], c: 0.02, h: 90, a: 1 },
      "OKHCL",
      8,
      { l: 1, c: 0.25, h: 120, a: 1 },
    ).colors;
    // Use only the dark endpoints for the dark-palette case, independent of a bright control.
    const input =
      range[2] === "white"
        ? source.map((color, index) => ({
            ...color,
            l: range[0] + ((range[1] - range[0]) * index) / 8,
          }))
        : source;
    for (const colors of [input, [...input].reverse()]) {
      const result = harmonizePalette(colors);
      expect(result.background).toBe(range[2]);
      expect(result.colors[0]).toEqual(colors[0]);
      expect(result.colors.at(-1)).toEqual(colors.at(-1));
      const first = measured(result.colors[0], result.background);
      const last = measured(result.colors.at(-1)!, result.background);
      for (const [index, color] of result.colors.entries()) {
        expect(color.h).toBe(colors[index].h);
        expect(color.a).toBe(colors[index].a);
        expect(color.c).toBeLessThanOrEqual(colors[index].c + 0.00001);
        expect(
          Math.abs(
            measured(color, result.background) -
              (first + ((last - first) * index) / 8),
          ),
        ).toBeLessThan(0.12);
        const channels = rgb({
          mode: "oklch",
          l: color.l,
          c: color.c,
          h: color.h,
        });
        for (const channel of [channels.r, channels.g, channels.b]) {
          expect(channel).toBeGreaterThanOrEqual(-0.00001);
          expect(channel).toBeLessThanOrEqual(1.00001);
        }
      }
    }
  }
  expect(
    harmonizePalette([
      { l: 0.9, c: 0, h: 0, a: 1 },
      { l: 0.8, c: 0, h: 0, a: 1 },
    ]).background,
  ).toBe("black");
  expect(
    harmonizePalette([
      { l: 0.2, c: 0, h: 0, a: 1 },
      { l: 0.1, c: 0, h: 0, a: 1 },
    ]).background,
  ).toBe("white");
});

test("transparent and neutral harmonized colors stay finite and retain their alpha and hue", () => {
  const source = createPaletteRamp(
    { l: 0.7, c: 0, h: 90, a: 0.3 },
    { l: 0.2, c: 0, h: 90, a: 0.8 },
    "OKHCL",
    8,
    { l: 0.95, c: 0, h: 90, a: 0 },
  ).colors;
  const result = harmonizePalette(source);
  for (const [index, color] of result.colors.entries()) {
    expect(Object.values(color).every(Number.isFinite)).toBe(true);
    expect(color.c).toBeLessThan(0.000001);
    expect(color.a).toBe(source[index].a);
    expect(color.h).toBe(source[index].h);
    expect(color.l).toBeGreaterThanOrEqual(0);
    expect(color.l).toBeLessThanOrEqual(1);
  }
});

test("the inline harmonic comparison updates, stays derived, and copies its own CSS", async ({
  page,
}) => {
  await page.goto("/#color=0.95,0.02,90,1&pickers=OKHCL");
  await page
    .getByRole("button", { name: "Create palette", exact: true })
    .click();
  await page.getByRole("button", { name: "End", exact: true }).click();
  const editor = page.getByLabel("OKLCH value", { exact: true });
  const apply = page.getByRole("button", { name: "Apply color", exact: true });
  await editor.fill("oklch(0.15 0.02 90)");
  await apply.click();
  await page
    .getByRole("button", { name: "Add middle color", exact: true })
    .click();
  await editor.fill("oklch(1 0.2 90)");
  await apply.click();
  const original = page.getByRole("list", {
    name: "Palette colors",
    exact: true,
  });
  const harmonized = page.getByRole("list", {
    name: "Harmonized colors",
    exact: true,
  });
  const brightness = page.getByRole("list", {
    name: "Harmonized brightness",
    exact: true,
  });
  await expect(harmonized).toHaveAttribute("aria-busy", "false");
  await expect(brightness.getByRole("listitem")).toHaveCount(5);
  expect(await harmonized.locator("li").nth(2).getAttribute("title")).not.toBe(
    await original.locator("li").nth(2).getAttribute("title"),
  );
  await expect(harmonized.locator("li").first()).toHaveAttribute(
    "title",
    (await original.locator("li").first().getAttribute("title"))!,
  );
  const state = await page.evaluate(() =>
    localStorage.getItem("oklch-workspace"),
  );
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          sessionStorage.setItem("copied-palette", text);
        },
      },
    }),
  );
  await page
    .getByRole("button", { name: "Copy harmonized", exact: true })
    .click();
  const css = await page.evaluate(() =>
    sessionStorage.getItem("copied-palette"),
  );
  expect(css?.match(/--palette-/g)).toHaveLength(5);
  expect(css).toContain(
    (await harmonized.locator("li").nth(2).getAttribute("title"))!,
  );
  expect(
    await page.evaluate(() => localStorage.getItem("oklch-workspace")),
  ).toBe(state);
  await page.getByRole("button", { name: "End", exact: true }).click();
  await editor.fill("oklch(0.8 0.02 90)");
  await apply.click();
  await editor.fill("oklch(0.7 0.02 90)");
  await apply.click();
  await expect(harmonized).toHaveAttribute("aria-busy", "false");
  await expect(harmonized.locator("li").last()).toHaveAttribute(
    "title",
    (await original.locator("li").last().getAttribute("title"))!,
  );
  await page.getByLabel("Palette subdivisions", { exact: true }).fill("64");
  await expect(harmonized).toHaveAttribute("aria-busy", "false");
  await expect(harmonized.getByRole("listitem")).toHaveCount(65);
});
