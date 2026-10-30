import { test, expect } from "@playwright/test";
import { decodeWorkspace } from "../src/workspace";
import { fromCoordinates } from "../src/pickerModes";

test("RGB, HSL and CIELCH conversions preserve the color and alpha", () => {
  const rgb = fromCoordinates([255, 0, 0], "RGB", 0.5);
  const hsl = fromCoordinates([0, 100, 50], "HSL", 0.5);
  expect(rgb.l).toBeCloseTo(0.628, 3);
  expect(rgb.c).toBeCloseTo(0.2577, 3);
  expect(rgb.h).toBeCloseTo(29.23, 1);
  expect(hsl).toEqual(rgb);
  expect(fromCoordinates([40.85, 106.84, 54.29], "HCL", 0.5).l).toBeCloseTo(
    rgb.l,
    3,
  );
  expect(rgb.a).toBe(0.5);
});

test("all modes share one color, fill their planes, and close independently", async ({
  page,
}) => {
  await page.goto("/");
  const original = await page
    .getByLabel("OKLCH value", { exact: true })
    .inputValue();
  for (const mode of ["RGB", "HSL", "HCL", "OKHCL"]) {
    await page.getByLabel("Picker mode", { exact: true }).selectOption(mode);
    await expect(page.getByLabel("OKLCH value", { exact: true })).toHaveValue(
      original,
    );
    expect(
      await page.locator("canvas").evaluate((element) => {
        if (!(element instanceof HTMLCanvasElement))
          throw new Error("Expected canvas");
        const data = element
          .getContext("2d")!
          .getImageData(0, 0, element.width, element.height).data;
        return Array.from(data).every(
          (channel, i) => i % 4 !== 3 || channel === 255,
        );
      }),
    ).toBe(true);
  }
  for (const mode of ["RGB", "HSL", "HCL"]) {
    await page.getByRole("button", { name: "Add picker", exact: true }).click();
    await page
      .getByLabel("Picker mode", { exact: true })
      .last()
      .selectOption(mode);
  }
  const panels = page.locator(".color-panel");
  const hsl = page.getByRole("region", {
    name: "Color picker HSL 3",
    exact: true,
  });
  await hsl
    .getByRole("spinbutton", { name: "Hue value", exact: true })
    .fill("120");
  await hsl
    .getByRole("spinbutton", { name: "Saturation value", exact: true })
    .fill("100");
  await hsl
    .getByRole("spinbutton", { name: "Lightness value", exact: true })
    .fill("50");
  for (let i = 0; i < 4; i++)
    await expect(panels.nth(i).locator(".output-row").first()).toContainText(
      "#00ff00",
    );
  const bounds = await panels.evaluateAll((elements) =>
    elements.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, right: r.right };
    }),
  );
  expect(new Set(bounds.map((b) => b.y)).size).toBe(1);
  for (let i = 1; i < bounds.length; i++)
    expect(bounds[i].x).toBeGreaterThan(bounds[i - 1].right);
  await hsl.getByRole("button", { name: "Close picker" }).click();
  await expect(panels).toHaveCount(3);
  for (const [index, mode] of ["OKHCL", "RGB", "HCL"].entries())
    await expect(
      page.getByLabel("Picker mode", { exact: true }).nth(index),
    ).toHaveValue(mode);
  while (await panels.count())
    await panels.first().getByRole("button", { name: "Close picker" }).click();
  await page.reload();
  await expect(panels).toHaveCount(0);
  await page.getByRole("button", { name: "Add picker" }).click();
  await expect(panels).toHaveCount(1);
  await expect(panels.first().locator(".output-row").first()).toContainText(
    "#00ff00",
  );
});

test("URL restores the entire unsaved workspace without browser storage", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add picker" }).click();
  await page
    .getByLabel("Picker mode", { exact: true })
    .last()
    .selectOption("HCL");
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  await page.getByLabel("Preview width", { exact: true }).selectOption("375px");
  await page.getByRole("tab", { name: "Theme CSS", exact: true }).click();
  const editor = page.getByLabel("Tailwind theme stylesheet");
  await editor.fill(
    (await editor.inputValue()) + "\n@theme { --radius-lg: 2rem; }",
  );
  await page
    .locator(".token")
    .filter({ has: page.locator(".token-name", { hasText: /^primary$/ }) })
    .click();
  await page
    .getByLabel("OKLCH value", { exact: true })
    .first()
    .fill("oklch(0.65 0.2 45 / 70%)");
  await page
    .getByRole("button", { name: "Apply color", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Editor %", exact: true })
    .first()
    .click();
  const url = page.url();
  const snapshot = decodeWorkspace(new URL(url).hash)!;
  expect(snapshot.pickers.map((p) => p.mode)).toEqual(["OKHCL", "HCL"]);
  expect(snapshot.darkPreview).toBe(true);
  expect(snapshot.source).toContain("--radius-lg: 2rem");
  expect(snapshot.selected).not.toBeNull();
  const context = await browser.newContext();
  const shared = await context.newPage();
  await shared.goto(url);
  for (const [index, mode] of ["OKHCL", "HCL"].entries())
    await expect(
      shared.getByLabel("Picker mode", { exact: true }).nth(index),
    ).toHaveValue(mode);
  expect(decodeWorkspace(new URL(shared.url()).hash)).toEqual(snapshot);
  await expect(shared.getByLabel("Tailwind theme stylesheet")).toHaveValue(
    snapshot.source,
  );
  await shared.reload();
  expect(decodeWorkspace(new URL(shared.url()).hash)).toEqual(snapshot);
  await shared.getByRole("tab", { name: "Preview", exact: true }).click();
  await expect(
    shared.getByRole("button", { name: "Dark mode", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(shared.getByLabel("Preview width", { exact: true })).toHaveValue(
    "375px",
  );
  await expect(shared.frameLocator("iframe").locator("html")).toHaveClass(
    "dark",
  );
  await context.close();
});

test("URL navigation restores picker modes and malformed state falls back safely", async ({
  page,
}) => {
  await page.goto("/");
  const first = page.url();
  await page.getByRole("button", { name: "Add picker", exact: true }).click();
  await page
    .getByLabel("Picker mode", { exact: true })
    .last()
    .selectOption("HSL");
  const second = page.url();
  await page.goto(first);
  await expect(page.locator(".color-panel")).toHaveCount(1);
  await page.goto(second);
  await expect(page.locator(".color-panel")).toHaveCount(2);
  await expect(
    page.getByLabel("Picker mode", { exact: true }).last(),
  ).toHaveValue("HSL");
  await page.goto("/#s=not-valid-workspace-data");
  await expect(page.locator(".color-panel")).toHaveCount(1);
  await expect(page.getByLabel("Picker mode", { exact: true })).toHaveValue(
    "OKHCL",
  );
  expect(decodeWorkspace(new URL(page.url()).hash)).not.toBeNull();
});
