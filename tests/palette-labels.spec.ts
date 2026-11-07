import { test, expect } from "@playwright/test";
import { paletteTextColor } from "../src/paletteContrast";
import { calcContrast } from "apcach";
import { readThemeColors } from "../src/themeColors";

test("APCA label colors account for polarity, hue, and both checker shades", () => {
  for (const space of ["srgb", "display-p3"] as const) {
    expect(paletteTextColor([[0, 0, 0]], space)).toBe("#fff");
    expect(paletteTextColor([[255, 255, 255]], space)).toBe("#000");
    expect(paletteTextColor([[0, 0, 255]], space)).toBe("#fff");
    expect(paletteTextColor([[0, 255, 0]], space)).toBe("#000");
    expect(
      paletteTextColor(
        [
          [166, 166, 166],
          [191, 191, 191],
        ],
        space,
      ),
    ).toBe("#000");
    expect(
      paletteTextColor(
        [
          [83, 83, 83],
          [95, 95, 95],
        ],
        space,
      ),
    ).toBe("#fff");
  }
});

test("harmonized role labels identify the exact colors applied in both modes at any subdivision count", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#color=0.95,0.03,170,1&pickers=OKHCL");
  await page
    .getByRole("button", { name: "Create palette", exact: true })
    .click();
  const apply = page.getByRole("button", {
    name: "Apply palette to preset",
    exact: true,
  });
  for (const subdivisions of [4, 3, 1]) {
    await page
      .getByLabel("Palette subdivisions", { exact: true })
      .fill(String(subdivisions));
    await expect(apply).toBeEnabled();
    await apply.click();
    const source = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("oklch-workspace")!).source as string,
    );
    const { declarations } = readThemeColors(source);
    for (const [index, mode] of (["light", "dark"] as const).entries()) {
      const group = page.locator(".palette-mode-rows").nth(index);
      await expect(group.locator(".palette-role")).toHaveText(
        mode === "light"
          ? ["Background", "Secondary", "Primary", "Accent"]
          : ["Background", "Accent", "Primary", "Secondary"],
      );
      await expect(
        page
          .getByRole("list", { name: `Harmonized ${mode} colors`, exact: true })
          .getByRole("listitem"),
      ).toHaveCount(subdivisions + 1);
      for (const role of ["background", "primary", "secondary", "accent"]) {
        const swatch = group
          .locator("li")
          .filter({ has: page.locator(".palette-role", { hasText: role }) });
        const token = declarations.find(
          (entry) => entry.mode === mode && entry.name === `--color-${role}`,
        )!;
        expect(await swatch.getAttribute("title")).toContain(token.value);
        const label = swatch.locator(".palette-role");
        expect(
          await label.evaluate((element) => getComputedStyle(element).color),
        ).toMatch(/^rgb\((?:0, 0, 0|255, 255, 255)\)$/);
        const bounds = await label.evaluate((element) => ({
          label: element.getBoundingClientRect().width,
          cell: element.parentElement!.getBoundingClientRect().width,
        }));
        expect(bounds.label).toBeLessThanOrEqual(bounds.cell);
      }
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  }
});

test("hex labels are centered directly on swatches and adapt to transparency", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#color=0,0,0,1&pickers=RGB");
  await page
    .getByRole("button", { name: "Create palette", exact: true })
    .click();
  await page.getByRole("button", { name: "End", exact: true }).click();
  const editor = page.getByLabel("RGB value", { exact: true });
  const apply = page.getByRole("button", { name: "Apply color", exact: true });
  await editor.fill("#ffffff");
  await apply.click();
  await page.getByLabel("Palette subdivisions", { exact: true }).fill("2");
  const labels = page
    .getByRole("list", { name: "Palette colors", exact: true })
    .locator(".palette-hex");
  await expect(labels.first()).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(labels.last()).toHaveCSS("color", "rgb(0, 0, 0)");
  const layout = await labels.evaluateAll((elements) =>
    elements.map((label) => {
      const range = document.createRange();
      range.selectNodeContents(label);
      const text = range.getBoundingClientRect();
      const swatch = label.parentElement!.getBoundingClientRect();
      return {
        dx: Math.abs(text.x + text.width / 2 - swatch.x - swatch.width / 2),
        dy: Math.abs(text.y + text.height / 2 - swatch.y - swatch.height / 2),
        background: getComputedStyle(label).backgroundColor,
      };
    }),
  );
  for (const label of layout) {
    expect(label.dx).toBeLessThan(1);
    expect(label.dy).toBeLessThan(1);
    expect(label.background).toBe("rgba(0, 0, 0, 0)");
  }
  await editor.fill("#00000080");
  await apply.click();
  await expect(labels.last()).toHaveCSS("color", "rgb(255, 255, 255)");
  await editor.fill("#00000000");
  await apply.click();
  await expect(labels.last()).toHaveCSS("color", "rgb(0, 0, 0)");
});

test("label contrast follows sRGB and Display P3 screen changes", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    const media = "(color-gamut: p3)";
    const query = original(media);
    let matches = false;
    Object.defineProperty(query, "matches", { get: () => matches });
    window.matchMedia = (value) => (value === media ? query : original(value));
    window.addEventListener("test-display-gamut", (event) => {
      matches = (event as CustomEvent<boolean>).detail;
      query.dispatchEvent(
        new MediaQueryListEvent("change", { matches, media }),
      );
    });
  });
  await page.goto("/#color=0.65,0.3,160,1&pickers=OKHCL");
  await page
    .getByRole("button", { name: "Create palette", exact: true })
    .click();
  const label = page.locator(".palette-hex").first();
  await expect(label).toHaveCSS("color", "rgb(0, 0, 0)");
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("test-display-gamut", { detail: true }),
    ),
  );
  const sample = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { colorSpace: "display-p3" })!;
    ctx.fillStyle = "oklch(0.65 0.3 160)";
    ctx.fillRect(0, 0, 1, 1);
    const image = ctx.getImageData(0, 0, 1, 1, { colorSpace: "display-p3" });
    const [r, g, b] = image.data;
    return image.colorSpace === "display-p3"
      ? {
          css: `color(display-p3 ${r / 255} ${g / 255} ${b / 255})`,
          gamut: "p3" as const,
        }
      : { css: `rgb(${r} ${g} ${b})`, gamut: "srgb" as const };
  });
  const black = calcContrast("black", sample.css, "apca", sample.gamut);
  const white = calcContrast("white", sample.css, "apca", sample.gamut);
  await expect(label).toHaveCSS(
    "color",
    black >= white ? "rgb(0, 0, 0)" : "rgb(255, 255, 255)",
  );
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("test-display-gamut", { detail: false }),
    ),
  );
  await expect(label).toHaveCSS("color", "rgb(0, 0, 0)");
});
