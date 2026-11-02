import { test, expect } from "@playwright/test";
import { unzipSync, strFromU8 } from "fflate";
import { parseColor, cssColor, percentColor } from "../src/color";

test("percentage notation round-trips into valid CSS", () => {
  const color = { l: 0.7, c: 0.15, h: 150, a: 0.5 };
  const parsed = parseColor(percentColor(color))!;
  expect(parsed.l).toBeCloseTo(color.l, 3);
  expect(parsed.c).toBeCloseTo(color.c, 3);
  expect(parsed.h).toBeCloseTo(color.h, 1);
  expect(cssColor(parsed)).not.toMatch(/%\s*\//);
  expect(parseColor("oklch(bad)")).toBeNull();
});

test("browser sampling matches independent sRGB canvas, including alpha and out-of-gamut", async ({
  page,
}) => {
  await page.goto("/");
  for (const value of [
    "oklch(0.7 0.15 150)",
    "oklch(0.7 0.15 150 / 50%)",
    "oklch(1 0.4 184.41 / 88.16%)",
    "oklch(0 0.4 0 / 0%)",
  ]) {
    await page.getByLabel("OKLCH value", { exact: true }).fill(value);
    await page.getByRole("button", { name: "Apply color" }).click();
    const expected = await page.evaluate((value) => {
      const c = document.createElement("canvas");
      c.width = c.height = 1;
      const ctx = c.getContext("2d", { colorSpace: "srgb" })!;
      ctx.fillStyle = value;
      ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data];
    }, value);
    const hex =
      "#" +
      expected
        .slice(0, 3)
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("") +
      (expected[3] === 255 ? "" : expected[3].toString(16).padStart(2, "0"));
    await expect(page.locator(".output-row").first()).toContainText(hex);
  }
  const alpha = await page.locator("canvas").evaluate((c) => {
    if (!(c instanceof HTMLCanvasElement)) throw new Error("Expected canvas");
    const ctx = c.getContext("2d")!;
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    return Array.from(data)
      .filter((_, i) => i % 4 === 3)
      .every((a) => a === 255);
  });
  expect(alpha).toBe(true);
  await page.getByLabel("OKLCH value", { exact: true }).fill("nope");
  await page.getByRole("button", { name: "Apply color" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
});

test("theme edits compile, presets persist, and exported app works offline", async ({
  page,
}) => {
  await page.goto("/");
  const frame = page.frameLocator('iframe[title="Tailwind light preview"]');
  await expect(frame.getByRole("button", { name: "Open project" })).toHaveCSS(
    "background-color",
    /oklch/,
  );
  await page
    .locator(".token")
    .filter({ has: page.locator(".token-name", { hasText: /^primary$/ }) })
    .click();
  await page
    .getByLabel("OKLCH value", { exact: true })
    .fill("oklch(0.6 0.2 30)");
  await page.getByRole("button", { name: "Apply color" }).click();
  await expect(frame.getByRole("button", { name: "Open project" })).toHaveCSS(
    "background-color",
    "oklch(0.6 0.2 30)",
  );
  page.once("dialog", (d) => d.accept("My palette"));
  await page.getByRole("button", { name: "Create preset" }).click();
  await page.reload();
  await page
    .getByLabel("Preset", { exact: true })
    .selectOption({ label: "My palette" });
  await expect(frame.getByRole("button", { name: "Open project" })).toHaveCSS(
    "background-color",
    "oklch(0.6 0.2 30)",
  );
  await page.getByRole("tab", { name: "Theme CSS", exact: true }).click();
  await page
    .getByLabel("Tailwind theme stylesheet")
    .fill(
      '@import "tailwindcss"; @theme { --color-primary: oklch(0.5 0.1 200); } @theme { --radius-lg: 2rem; }',
    );
  await expect(page.getByRole("button", { name: "Export app" })).toBeEnabled();
  await page.getByRole("tab", { name: "Preview", exact: true }).click();
  await expect(frame.getByRole("button", { name: "Open project" })).toHaveCSS(
    "border-radius",
    "32px",
  );
  await page.clock.setFixedTime(new Date("2026-11-02T12:34:56.789Z"));
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export app" }).click();
  const downloaded = await downloading;
  expect(downloaded.suggestedFilename()).toBe(
    "my-palette-2026-11-02T12-34-56-789Z.zip",
  );
  const path = await downloaded.path();
  const { readFile } = await import("node:fs/promises");
  const files = unzipSync(await readFile(path!));
  expect(Object.keys(files)).toContain("styles.css");
  expect(strFromU8(files["theme.css"])).toContain("oklch(0.5 0.1 200)");
  const { mkdtemp, writeFile, mkdir } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join, dirname } = await import("node:path");
  const { pathToFileURL } = await import("node:url");
  const extracted = await mkdtemp(join(tmpdir(), "palette-test-"));
  for (const [name, data] of Object.entries(files)) {
    const target = join(extracted, name);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, data);
  }
  await page.context().setOffline(true);
  await page.goto(pathToFileURL(join(extracted, "index.html")).href);
  await expect(page.getByRole("button", { name: "Open project" })).toHaveCSS(
    "background-color",
    "oklch(0.5 0.1 200)",
  );
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toHaveText("Settings saved");
});

test("mobile layout fits and sliders work with keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const slider = page.getByRole("slider", { name: "Hue", exact: true });
  const before = await slider.inputValue();
  await slider.focus();
  await slider.press("ArrowRight");
  expect(await slider.inputValue()).not.toBe(before);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("preset rename, save, delete and compiler recovery", async ({ page }) => {
  await page.goto("/");
  page.once("dialog", (dialog) => dialog.accept("Temporary"));
  await page.getByRole("button", { name: "Create preset" }).click();
  page.once("dialog", (dialog) => dialog.accept("Renamed"));
  await page.getByRole("button", { name: "Rename preset" }).click();
  await expect(
    page.getByLabel("Preset", { exact: true }).locator("option:checked"),
  ).toHaveText("Renamed");
  await page.getByRole("tab", { name: "Theme CSS", exact: true }).click();
  await page
    .getByLabel("Tailwind theme stylesheet")
    .fill('@import "missing.css";');
  await expect(page.getByRole("alert")).toContainText("Unsupported import");
  await expect(page.getByRole("button", { name: "Export app" })).toBeDisabled();
  await page
    .getByLabel("Tailwind theme stylesheet")
    .fill(
      '@import "tailwindcss"; @theme { --color-primary: oklch(0.5 0.1 200); }',
    );
  await expect(page.getByRole("button", { name: "Export app" })).toBeEnabled();
  await page.getByRole("button", { name: /^Save/ }).click();
  await page.reload();
  await page
    .getByLabel("Preset", { exact: true })
    .selectOption({ label: "Renamed" });
  await page.getByRole("tab", { name: "Theme CSS", exact: true }).click();
  await expect(page.getByLabel("Tailwind theme stylesheet")).toHaveValue(
    /oklch\(0.5 0.1 200\)/,
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete preset" }).click();
  await expect(
    page.getByLabel("Preset", { exact: true }).locator("option"),
  ).toHaveCount(4);
});

test("light and dark previews stay stacked and both export offline", async ({
  page,
}) => {
  await page.goto("/");
  const light = page.frameLocator('iframe[title="Tailwind light preview"]');
  const dark = page.frameLocator('iframe[title="Tailwind dark preview"]');
  await expect(light.locator("main")).toHaveCSS(
    "background-color",
    "oklch(0.985 0.002 180)",
  );
  await expect(dark.locator("main")).toHaveCSS(
    "background-color",
    "oklch(0.18 0.008 260)",
  );
  await expect(light.locator("html")).toHaveCSS("color-scheme", "light");
  await expect(dark.locator("html")).toHaveCSS("color-scheme", "dark");
  const lightBounds = await page
    .getByTitle("Tailwind light preview", { exact: true })
    .boundingBox();
  const darkBounds = await page
    .getByTitle("Tailwind dark preview", { exact: true })
    .boundingBox();
  expect(darkBounds!.x).toBe(lightBounds!.x);
  expect(darkBounds!.y).toBeGreaterThan(lightBounds!.y + lightBounds!.height);
  await page
    .locator(".token")
    .filter({ has: page.locator(".token-name", { hasText: /^primary$/ }) })
    .click();
  await page
    .getByLabel("OKLCH value", { exact: true })
    .fill("oklch(0.6 0.2 30)");
  await page.getByRole("button", { name: "Apply color", exact: true }).click();
  for (const frame of [light, dark])
    await expect(frame.getByRole("button", { name: "Open project" })).toHaveCSS(
      "background-color",
      "oklch(0.6 0.2 30)",
    );
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export app" }).click();
  const { readFile, mkdtemp, writeFile, mkdir } =
    await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join, dirname } = await import("node:path");
  const { pathToFileURL } = await import("node:url");
  const files = unzipSync(await readFile((await (await downloading).path())!));
  const extracted = await mkdtemp(join(tmpdir(), "palette-pair-"));
  for (const [name, data] of Object.entries(files)) {
    const path = join(extracted, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }
  await page.context().setOffline(true);
  for (const [name, background] of [
    ["index.html", "oklch(0.985 0.002 180)"],
    ["dark.html", "oklch(0.18 0.008 260)"],
  ]) {
    await page.goto(pathToFileURL(join(extracted, name)).href);
    await expect(page.locator("main")).toHaveCSS(
      "background-color",
      background,
    );
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status")).toHaveText("Settings saved");
  }
});
