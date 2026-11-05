import { test, expect, type Page } from "@playwright/test";
import {
  createPaletteRamp,
  interpolateCoordinates,
  palettePaths,
} from "../src/palette";
import { channels, coordinates } from "../src/pickerModes";
import { pickerPlanes } from "../src/planes";
import { workspaceSchema } from "../src/workspaceSchema";
import { workspaceStorageKey } from "../src/workspace";

async function workspace(page: Page) {
  return workspaceSchema.parse(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      workspaceStorageKey,
    ),
  );
}

async function rgba(page: Page, index: number) {
  return page
    .getByRole("list", { name: "Palette colors", exact: true })
    .locator("li > span")
    .nth(index)
    .evaluate((element) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d")!;
      context.fillStyle = getComputedStyle(element).backgroundColor;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    });
}

test("palette lerp uses the selected coordinates, shortest hue and linear alpha", () => {
  expect(interpolateCoordinates([255, 0, 0], [0, 0, 255], "RGB", 0.5)).toEqual([
    127.5, 0, 127.5,
  ]);
  for (const mode of ["HSL", "HCL", "OKHCL"] as const) {
    expect(
      interpolateCoordinates([350, 0.1, 0.2], [10, 0.3, 0.8], mode, 0.5),
    ).toEqual([0, 0.2, 0.5]);
    expect(
      interpolateCoordinates([10, 0.1, 0.2], [350, 0.3, 0.8], mode, 0.5)[0],
    ).toBe(0);
    expect(
      interpolateCoordinates([0, 0, 0.2], [240, 0.3, 0.8], mode, 0.5)[0],
    ).toBe(240);
  }
  const start = { l: 0.2, c: 0.1, h: 350, a: 0.2 };
  const end = { l: 0.8, c: 0.3, h: 10, a: 0.8 };
  const ramp = createPaletteRamp(start, end, "OKHCL", 4);
  expect(ramp.colors).toHaveLength(5);
  expect(ramp.colors[0]).toEqual(start);
  expect(ramp.colors[4]).toEqual(end);
  expect(ramp.colors[2]).toEqual({ l: 0.5, c: 0.2, h: 0, a: 0.5 });
  expect(
    palettePaths(
      [
        { x: 95, y: 20 },
        { x: 5, y: 80 },
      ],
      "x",
    ),
  ).toEqual([
    [
      { x: 95, y: 20 },
      { x: 100, y: 50 },
    ],
    [
      { x: 0, y: 50 },
      { x: 5, y: 80 },
    ],
  ]);
  expect(
    palettePaths(
      [
        { x: 100, y: 20 },
        { x: 0, y: 80 },
      ],
      "x",
    )
      .flat()
      .every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
  ).toBe(true);
});

test("palette controls change visible interpolation, subdivisions, and copied CSS", async ({
  page,
}) => {
  await page.goto("/#color=0.6,0.1,180,1&pickers=RGB");
  await page.getByLabel("RGB value", { exact: true }).fill("#ff0000");
  await page.getByRole("button", { name: "Apply color", exact: true }).click();
  await page
    .getByRole("button", { name: "Create palette", exact: true })
    .click();
  await page.getByRole("button", { name: "End", exact: true }).click();
  await page.getByLabel("RGB value", { exact: true }).fill("#0000ff");
  await page.getByRole("button", { name: "Apply color", exact: true }).click();
  const endpoints = await workspace(page);
  await page.getByLabel("Palette subdivisions", { exact: true }).fill("2");
  await page
    .getByLabel("Palette interpolation", { exact: true })
    .selectOption("RGB");
  await expect(
    page
      .getByRole("list", { name: "Palette colors", exact: true })
      .getByRole("listitem"),
  ).toHaveCount(3);
  await expect(page.locator(".palette-endpoint")).toHaveCount(6);
  await expect(page.locator(".palette-step")).toHaveCount(3);
  const rgb = await rgba(page, 1);
  expect(rgb[0]).toBeCloseTo(128, -1);
  expect(rgb[1]).toBe(0);
  expect(rgb[2]).toBeCloseTo(128, -1);
  await page
    .getByLabel("Palette interpolation", { exact: true })
    .selectOption("HSL");
  const hsl = await rgba(page, 1);
  expect(hsl[0]).toBeGreaterThanOrEqual(254);
  expect(hsl[1]).toBeLessThanOrEqual(1);
  expect(hsl[2]).toBeGreaterThanOrEqual(254);
  for (const mode of ["HCL", "OKHCL"]) {
    await page
      .getByLabel("Palette interpolation", { exact: true })
      .selectOption(mode);
    expect(await rgba(page, 1)).not.toEqual(hsl);
  }
  const current = await workspace(page);
  expect(current.color).toEqual(endpoints.color);
  expect(current.palette?.end).toEqual(endpoints.palette?.end);
  await page.getByLabel("Palette subdivisions", { exact: true }).fill("8");
  await expect(
    page
      .getByRole("list", { name: "Palette colors", exact: true })
      .getByRole("listitem"),
  ).toHaveCount(9);
  await expect(page.locator(".palette-step")).toHaveCount(21);
  expect(
    await page
      .locator(".palette-step")
      .evaluateAll((elements) =>
        elements.every(
          (element) =>
            getComputedStyle(element).pointerEvents === "none" &&
            element.getAttribute("tabindex") === null,
        ),
      ),
  ).toBe(true);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          sessionStorage.setItem("palette-copy", text);
        },
      },
    }),
  );
  await page.getByRole("button", { name: "Copy palette", exact: true }).click();
  const css = await page.evaluate(() => sessionStorage.getItem("palette-copy"));
  expect(css).toContain(":root {");
  expect(css?.match(/--palette-/g)).toHaveLength(9);
  await page.getByRole("button", { name: "Single color", exact: true }).click();
  await expect(page.getByLabel("RGB value", { exact: true })).toHaveValue(
    "#0000ff",
  );
});

test("both endpoint handles edit the correct color on all three planes", async ({
  page,
}) => {
  await page.goto("/#color=0.6,0.1,180,0.4&pickers=OKHCL,HSL");
  await page
    .getByRole("button", { name: "Create palette", exact: true })
    .click();
  await page
    .getByRole("spinbutton", { name: "Chroma value", exact: true })
    .first()
    .fill("0.123");
  const beforeSelection = await workspace(page);
  await page
    .getByRole("group", { name: "OKHCL Chroma × Lightness plane", exact: true })
    .getByRole("button", { name: /^End color in / })
    .click();
  expect((await workspace(page)).palette?.end).toEqual(
    beforeSelection.palette?.end,
  );
  const original = await workspace(page);
  for (const mapping of pickerPlanes("OKHCL")) {
    const config = channels.OKHCL;
    const plane = page.getByRole("group", {
      name: `OKHCL ${config[mapping.x].name} × ${config[mapping.y].name} plane`,
      exact: true,
    });
    const end = plane.getByRole("button", { name: /^End color in / });
    await plane.scrollIntoViewIfNeeded();
    const handle = (await end.boundingBox())!;
    const bounds = (await plane.boundingBox())!;
    const before = (await workspace(page)).palette!.end;
    await page.mouse.move(
      handle.x + handle.width / 2,
      handle.y + handle.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      bounds.x + bounds.width * 0.4,
      bounds.y + bounds.height * 0.35,
      { steps: 5 },
    );
    await page.mouse.up();
    await expect
      .poll(async () => {
        const latest = coordinates(
          (await workspace(page)).palette!.end,
          "OKHCL",
        );
        return (
          Math.abs(latest[mapping.x] - config[mapping.x].max * 0.4) <=
            (2 * config[mapping.x].max) / bounds.width &&
          Math.abs(latest[mapping.y] - config[mapping.y].max * 0.65) <=
            (2 * config[mapping.y].max) / bounds.height
        );
      })
      .toBe(true);
    const after = await workspace(page);
    expect(after.color).toEqual(original.color);
    expect(after.palette?.endpoint).toBe("end");
    expect(after.palette?.end.a).toBe(0.4);
    expect(coordinates(after.palette!.end, "OKHCL")[mapping.fixed]).toBeCloseTo(
      coordinates(before, "OKHCL")[mapping.fixed],
      6,
    );
  }
  const startHandle = page
    .getByRole("group", { name: "OKHCL Chroma × Lightness plane", exact: true })
    .getByRole("button", { name: /^Start color in / });
  const endBefore = (await workspace(page)).palette!.end;
  await startHandle.focus();
  await startHandle.press("ArrowRight");
  const changed = await workspace(page);
  expect(changed.palette?.endpoint).toBe("start");
  expect(changed.color.c).toBeCloseTo(original.color.c + 0.001, 6);
  expect(changed.palette?.end).toEqual(endBefore);
  await expect(page.locator(".palette-endpoint")).toHaveCount(12);
});

test("palette paths cross the hue seam without a false line through other hues", async ({
  page,
}) => {
  await page.goto("/#color=0.65,0.15,350,1&pickers=OKHCL");
  await page
    .getByRole("button", { name: "Create palette", exact: true })
    .click();
  await page.getByRole("button", { name: "End", exact: true }).click();
  await page
    .getByLabel("OKLCH value", { exact: true })
    .fill("oklch(0.65 0.15 10)");
  await page.getByRole("button", { name: "Apply color", exact: true }).click();
  await page.getByLabel("Palette subdivisions", { exact: true }).fill("1");
  const plane = page.getByRole("group", {
    name: "OKHCL Hue × Lightness plane",
    exact: true,
  });
  await expect(plane.locator("polyline")).toHaveCount(4);
  await expect(page.locator(".palette-step")).toHaveCount(0);
  const paths = await plane.locator("polyline").evaluateAll((elements) =>
    elements.map((element) =>
      element
        .getAttribute("points")!
        .split(" ")
        .map((point) => Number(point.split(",")[0])),
    ),
  );
  expect(
    paths.every((path) =>
      path.every(
        (value, index) => index === 0 || Math.abs(value - path[index - 1]) < 10,
      ),
    ),
  ).toBe(true);
});

test("palette saves locally, shares both endpoints, and fits on phones", async ({
  page,
  browser,
}) => {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/api/shares"))
      writes.push(request.url());
  });
  await page.goto("/#color=0.65,0.1,180,0.7&pickers=OKHCL,HSL,RGB");
  await page
    .getByRole("button", { name: "Create palette", exact: true })
    .click();
  await page.getByRole("button", { name: "End", exact: true }).click();
  await page
    .getByLabel("OKLCH value", { exact: true })
    .fill("oklch(0.7 0.12 40 / 40%)");
  await page
    .getByRole("button", { name: "Apply color", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Palette interpolation", { exact: true })
    .selectOption("HCL");
  await page.getByLabel("Palette subdivisions", { exact: true }).fill("6");
  const saved = await workspace(page);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "End", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect((await workspace(page)).palette).toEqual(saved.palette);
  const colorLink = page.url();
  expect(writes).toHaveLength(0);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect(
      await page
        .locator(".color-panel")
        .evaluateAll((elements) =>
          elements.every((element) => element.scrollLeft === 0),
        ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const share = page.getByLabel("Share link", { exact: true });
  await expect(share).toBeVisible();
  const url = await share.inputValue();
  expect(writes).toHaveLength(1);
  const context = await browser.newContext();
  const shared = await context.newPage();
  await shared.goto(colorLink);
  await expect(
    shared.getByRole("button", { name: "Create palette", exact: true }),
  ).toBeVisible();
  await shared.goto(url);
  await expect(
    shared.getByLabel("Palette interpolation", { exact: true }),
  ).toHaveValue("HCL");
  await expect(
    shared.getByLabel("Palette subdivisions", { exact: true }),
  ).toHaveValue("6");
  const imported = await workspace(shared);
  expect(imported.palette).toEqual(saved.palette);
  expect(imported.color).toEqual(saved.color);
  await context.close();
});
