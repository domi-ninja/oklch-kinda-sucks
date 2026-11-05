import { test, expect, type Page } from "@playwright/test";
import { colorFromHash, workspaceStorageKey } from "../src/workspace";
import { workspaceSchema } from "../src/workspaceSchema";

async function readWorkspace(page: Page) {
  return workspaceSchema.parse(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? "null"),
      workspaceStorageKey,
    ),
  );
}
import {
  cssFunctions,
  fromCoordinates,
  parsePickerExpression,
} from "../src/pickerModes";
import { pickerModes } from "../src/workspace";

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

test("each editor parses its picker coordinates and alpha", () => {
  for (const [mode, css, percent, values] of [
    ["RGB", "rgb(255 0 0 / 0.5)", "rgb(100% 0% 0% / 50%)", [255, 0, 0]],
    ["HSL", "hsl(180 50% 25% / 0.5)", "hsl(50% 50% 25% / 50%)", [180, 50, 25]],
    ["HCL", "lch(60 75 180 / 0.5)", "lch(60% 50% 50% / 50%)", [180, 75, 60]],
    [
      "OKHCL",
      "oklch(0.6 0.2 180 / 50%)",
      "oklch(60% 50% 50% / 50%)",
      [180, 0.2, 0.6],
    ],
  ] as const) {
    const expected = fromCoordinates([...values], mode, 0.5);
    for (const parsed of [
      parsePickerExpression(css, mode),
      parsePickerExpression(percent, mode, true),
    ]) {
      expect(parsed).not.toBeNull();
      for (const channel of ["l", "c", "h", "a"] as const)
        expect(parsed![channel]).toBeCloseTo(expected[channel], 6);
    }
    expect(parsePickerExpression("invalid", mode)).toBeNull();
    expect(
      parsePickerExpression(percent.replace("50%)", "101%)"), mode, true),
    ).toBeNull();
  }
});

test("color editors stay stacked, match the mode, and update the shared color", async ({
  page,
}) => {
  await page.goto("/");
  for (const mode of pickerModes) {
    await page.getByLabel("Picker mode", { exact: true }).selectOption(mode);
    const name = cssFunctions[mode].toUpperCase();
    const css = page.getByLabel(`${name} value`, { exact: true });
    const percent = page.getByLabel(`${name} percentage value`, {
      exact: true,
    });
    await expect(css).toBeVisible();
    await expect(percent).toBeVisible();
    const cssBounds = (await css.boundingBox())!;
    const percentBounds = (await percent.boundingBox())!;
    expect(percentBounds.y).toBeGreaterThan(cssBounds.y + cssBounds.height);
    expect(percentBounds.x).toBe(cssBounds.x);
    await css.fill(
      mode === "RGB"
        ? "#808080"
        : mode === "HSL"
          ? "hsl(180 50% 50% / 0.5)"
          : mode === "HCL"
            ? "lch(60 40 180 / 0.5)"
            : "oklch(0.6 0.1 180 / 50%)",
    );
    await css.press("Enter");
    await expect(percent).toHaveValue(
      mode === "RGB" ? /\/ 100%\)$/ : /\/ 50%\)$/,
    );
    await expect(
      page.getByRole("spinbutton", { name: "Alpha value", exact: true }),
    ).toHaveValue(mode === "RGB" ? "1" : "0.5");
    await percent.fill(`${cssFunctions[mode]}(50% 25% 50% / 75%)`);
    await page
      .getByRole("button", { name: "Apply percentage color", exact: true })
      .click();
    await expect(
      page.getByRole("spinbutton", { name: "Alpha value", exact: true }),
    ).toHaveValue("0.75");
    await expect(
      page.getByRole("spinbutton", { name: "Alpha percentage", exact: true }),
    ).toHaveValue("75");
    await expect(css).toHaveValue(
      mode === "RGB"
        ? /^#[0-9a-f]{6,8}$/
        : new RegExp(`^${cssFunctions[mode]}\\(`),
    );
  }
});

test("plane rendering catches up to the latest hue after rapid changes", async ({
  page,
}) => {
  await page.goto("/");
  const hue = page.getByRole("spinbutton", {
    name: "Hue percentage",
    exact: true,
  });
  for (const value of [10, 40, 60, 80]) await hue.fill(String(value));
  await expect
    .poll(() =>
      page
        .locator("canvas")
        .first()
        .evaluate((canvas) => {
          if (!(canvas instanceof HTMLCanvasElement))
            throw new Error("Expected canvas");
          const context = canvas.getContext("2d")!;
          const actual = [...context.getImageData(128, 80, 1, 1).data];
          const reference = document.createElement("canvas").getContext("2d")!;
          reference.fillStyle = `oklch(${1 - 80 / 159} ${(128 / 255) * 0.4} 288)`;
          reference.fillRect(0, 0, 1, 1);
          return actual.every(
            (value, index) =>
              value === reference.getImageData(0, 0, 1, 1).data[index],
          );
        }),
    )
    .toBe(true);
});

test("all modes share one color, fill their planes, and close independently", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("Picker mode", { exact: true })).toBeVisible();
  const original = (await readWorkspace(page)).color;
  for (const mode of pickerModes) {
    await page.getByLabel("Picker mode", { exact: true }).selectOption(mode);
    await expect(
      page.getByLabel(`${cssFunctions[mode].toUpperCase()} value`, {
        exact: true,
      }),
    ).toHaveValue(
      mode === "RGB"
        ? /^#[0-9a-f]{6,8}$/
        : new RegExp(`^${cssFunctions[mode]}\\(`),
    );
    expect((await readWorkspace(page)).color).toEqual(original);
    await expect
      .poll(() =>
        page
          .locator("canvas")
          .first()
          .evaluate((element) => {
            if (!(element instanceof HTMLCanvasElement))
              throw new Error("Expected canvas");
            const data = element
              .getContext("2d")!
              .getImageData(0, 0, element.width, element.height).data;
            return Array.from(data).every(
              (channel, i) => i % 4 !== 3 || channel === 255,
            );
          }),
      )
      .toBe(true);
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
    await expect(
      panels
        .nth(i)
        .getByRole("button", { name: "sRGB preview", exact: true })
        .locator(".swatch-color"),
    ).toHaveAttribute("style", /background: rgb\(0,\s*255,\s*0\)/);
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
  await expect(
    panels
      .first()
      .getByRole("button", { name: "sRGB preview", exact: true })
      .locator(".swatch-color"),
  ).toHaveAttribute("style", /background: rgb\(0,\s*255,\s*0\)/);
});

test("Share exports the active workspace to another browser", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add picker" }).click();
  await page
    .getByLabel("Picker mode", { exact: true })
    .last()
    .selectOption("HCL");
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
  const snapshot = await readWorkspace(page);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const shareLink = page.getByLabel("Share link", { exact: true });
  await expect(shareLink).toBeVisible();
  const url = await shareLink.inputValue();
  expect(snapshot.pickers.map((p) => p.mode)).toEqual(["OKHCL", "HCL"]);
  expect(snapshot.source).toContain("--radius-lg: 2rem");
  expect(snapshot.selected).not.toBeNull();
  const context = await browser.newContext();
  const shared = await context.newPage();
  await shared.goto(url);
  for (const [index, mode] of ["OKHCL", "HCL"].entries())
    await expect(
      shared.getByLabel("Picker mode", { exact: true }).nth(index),
    ).toHaveValue(mode);
  expect(await readWorkspace(shared)).toEqual(snapshot);
  await expect(shared.getByLabel("Tailwind theme stylesheet")).toHaveValue(
    snapshot.source,
  );
  await shared.reload();
  expect(await readWorkspace(shared)).toEqual(snapshot);
  await shared.getByRole("tab", { name: "Preview", exact: true }).click();
  await expect(shared.getByLabel("Preview width", { exact: true })).toHaveValue(
    "375px",
  );
  await expect(
    shared
      .frameLocator('iframe[title="Tailwind dark preview"]')
      .locator("html"),
  ).toHaveClass("dark");
  await context.close();
});

test("color and open picker modes go in the URL; the workspace stays local", async ({
  page,
  browser,
}) => {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/shares")) writes.push(request.method());
  });
  await page.goto("/");
  await expect(page.getByLabel("Picker mode", { exact: true })).toBeVisible();
  const first = page.url();
  await page.getByRole("button", { name: "Add picker", exact: true }).click();
  await page
    .getByLabel("Picker mode", { exact: true })
    .last()
    .selectOption("HSL");
  expect(new URL(page.url()).hash).toContain("pickers=OKHCL,HSL");
  await page
    .getByLabel("OKLCH value", { exact: true })
    .fill("oklch(0.6 0.2 30 / 50%)");
  await page
    .getByRole("button", { name: "Apply color", exact: true })
    .first()
    .click();
  const second = page.url();
  expect(new URL(second).hash).toBe("#color=0.6,0.2,30,0.5&pickers=OKHCL,HSL");
  await page.reload();
  await expect(page.locator(".color-panel")).toHaveCount(2);
  await expect(
    page.getByLabel("Picker mode", { exact: true }).last(),
  ).toHaveValue("HSL");
  await page.goto(first);
  await expect(page.locator(".color-panel")).toHaveCount(1);
  expect(colorFromHash(new URL(page.url()).hash)).toEqual(
    colorFromHash(new URL(first).hash),
  );
  await page.goto(second);
  await expect(page.getByLabel("OKLCH value", { exact: true })).toHaveValue(
    "oklch(0.6 0.2 30 / 50%)",
  );
  await page.goto("/#s=not-valid-workspace-data");
  await expect(page.locator(".color-panel")).toHaveCount(2);
  await expect(page.getByLabel("OKLCH value", { exact: true })).toHaveValue(
    "oklch(0.6 0.2 30 / 50%)",
  );
  expect(writes).toEqual([]);
  const context = await browser.newContext();
  const other = await context.newPage();
  await other.goto(second);
  await expect(other.locator(".color-panel")).toHaveCount(2);
  await expect(other.getByLabel("OKLCH value", { exact: true })).toHaveValue(
    "oklch(0.6 0.2 30 / 50%)",
  );
  await context.close();
});

test("OKHCL percentages control native color coordinates and survive URL restoration", async ({
  page,
}) => {
  await page.goto("/");
  for (const name of ["Hue", "Chroma", "Lightness", "Alpha"]) {
    await expect(
      page.getByRole("slider", { name, exact: true }),
    ).toHaveAttribute("max", "100");
    await expect(
      page
        .getByRole("spinbutton", { name: `${name} percentage`, exact: true })
        .locator(".."),
    ).toContainText("%");
  }
  await expect(
    page.getByRole("spinbutton", { name: "Lightness percentage", exact: true }),
  ).toHaveValue("94.03");
  await expect(
    page.getByRole("spinbutton", { name: "Chroma percentage", exact: true }),
  ).toHaveValue("25");
  await page
    .getByRole("spinbutton", { name: "Hue percentage", exact: true })
    .fill("50");
  await page
    .getByRole("spinbutton", { name: "Chroma percentage", exact: true })
    .fill("60");
  await page
    .getByRole("spinbutton", { name: "Lightness percentage", exact: true })
    .fill("70");
  await page
    .getByRole("spinbutton", { name: "Alpha percentage", exact: true })
    .fill("50");
  await expect(page.getByLabel("OKLCH value", { exact: true })).toHaveValue(
    "oklch(0.7 0.24 180 / 50%)",
  );
  await page.getByRole("slider", { name: "Hue", exact: true }).focus();
  await page
    .getByRole("slider", { name: "Hue", exact: true })
    .press("ArrowRight");
  await expect(
    page.getByRole("spinbutton", { name: "Hue percentage", exact: true }),
  ).toHaveValue("50.1");
  expect((await readWorkspace(page)).color.h).toBeCloseTo(180.36);
  await page.reload();
  await expect(
    page.getByRole("spinbutton", { name: "Hue percentage", exact: true }),
  ).toHaveValue("50.1");
  await expect(
    page.getByRole("spinbutton", { name: "Chroma percentage", exact: true }),
  ).toHaveValue("60");
  await expect(
    page.getByRole("spinbutton", { name: "Lightness percentage", exact: true }),
  ).toHaveValue("70");
  await expect(
    page.getByRole("spinbutton", { name: "Alpha percentage", exact: true }),
  ).toHaveValue("50");
  await page.getByLabel("Picker mode", { exact: true }).selectOption("HCL");
  await expect(
    page
      .getByRole("spinbutton", { name: "Hue value", exact: true })
      .locator(".."),
  ).toContainText("°");
  await page.getByLabel("Picker mode", { exact: true }).selectOption("OKHCL");
  await expect(
    page.getByRole("spinbutton", { name: "Hue percentage", exact: true }),
  ).toHaveValue("50.1");
});
