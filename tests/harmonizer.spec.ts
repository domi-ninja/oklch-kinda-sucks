import { test, expect, type Page } from "@playwright/test";
import { generateHarmonizer } from "../src/harmonizer";
import { defaultHarmonizerSettings } from "../src/harmonizerSettings";
import { workspaceSchema } from "../src/workspaceSchema";

async function workspace(page: Page) {
  return workspaceSchema.parse(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("oklch-workspace")!),
    ),
  );
}

test("harmonizer reproduces APCA levels, common chroma and gamut-specific colors", () => {
  const grid = generateHarmonizer(defaultHarmonizerSettings);
  expect(grid.rows).toHaveLength(5);
  expect(grid.chromas).toHaveLength(9);
  expect(grid.rows[0].cells[0].color.l).toBeCloseTo(0.9668, 3);
  expect(grid.rows[0].cells[0].color.c).toBeCloseTo(0.01875, 4);
  expect(grid.rows[0].cells[0].p3).toBe(true);
  for (const [index, level] of defaultHarmonizerSettings.levels.entries())
    for (const row of grid.rows) {
      expect(row.cells[index].color.c).toBeCloseTo(grid.chromas[index], 10);
      expect(Math.abs(row.cells[index].contrast - level.contrast)).toBeLessThan(
        0.3,
      );
      expect(row.cells[index].outOfGamut).toBe(false);
    }
  const srgb = generateHarmonizer({
    ...defaultHarmonizerSettings,
    gamut: "srgb",
  });
  expect(
    srgb.rows
      .flatMap((row) => row.cells)
      .every((cell) => !cell.p3 && !cell.outOfGamut),
  ).toBe(true);
  const max = generateHarmonizer({
    ...defaultHarmonizerSettings,
    chromaMode: "max",
  });
  expect(
    max.rows.some((row) => row.cells[4].color.c > grid.chromas[4] + 0.01),
  ).toBe(true);
  const capped = generateHarmonizer({
    ...defaultHarmonizerSettings,
    levels: defaultHarmonizerSettings.levels.map((level) => ({
      ...level,
      chroma: 0.02,
    })),
  });
  expect(
    capped.rows
      .flatMap((row) => row.cells)
      .every((cell) => cell.color.c <= 0.020001),
  ).toBe(true);
});

test("hue changes seed both palette endpoints, group undo and persist without editing the preset", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const initial = await workspace(page);
  const trigger = page.getByRole("button", { name: "Harmonizer", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Harmonizer", exact: true });
  await expect(dialog.getByRole("status")).toHaveText("Ready");
  await expect(dialog.getByRole("table")).toHaveCount(1);
  await expect(dialog.locator(".harmonizer-cell")).toHaveCount(45);
  expect((await workspace(page)).harmonizer).toBeUndefined();
  await dialog
    .getByRole("button", { name: "Use Red palette", exact: true })
    .click();
  await expect
    .poll(() => workspace(page).then((state) => state.harmonizer?.selectedRow))
    .toBe("red");
  const selected = await workspace(page);
  const hue = dialog.getByRole("slider", { name: "Hue Red", exact: true });
  const bounds = (await hue.boundingBox())!;
  await page.mouse.move(
    bounds.x + bounds.width * 0.15,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width * 0.55,
    bounds.y + bounds.height / 2,
    { steps: 12 },
  );
  await page.mouse.up();
  await expect(dialog.getByRole("status")).toHaveText("Ready");
  const finalHue = Number(await hue.inputValue());
  expect(finalHue).toBeGreaterThan(170);
  await expect
    .poll(() => workspace(page).then((state) => state.harmonizer?.rows[0].hue))
    .toBe(finalHue);
  const edited = await workspace(page);
  expect(edited.harmonizer!.rows[0].hue).toBeGreaterThan(170);
  expect(edited.color.h).toBe(edited.harmonizer!.rows[0].hue);
  expect(edited.palette!.end.h).toBe(edited.color.h);
  expect(edited.color.l).toBeGreaterThan(edited.palette!.end.l);
  expect(edited.source).toBe(initial.source);
  await hue.press("Control+z");
  await expect
    .poll(() =>
      workspace(page).then((state) => ({
        color: state.color,
        palette: state.palette,
        harmonizer: state.harmonizer,
      })),
    )
    .toEqual({
      color: selected.color,
      palette: selected.palette,
      harmonizer: selected.harmonizer,
    });
  await expect(dialog.getByRole("status")).toHaveText("Ready");
  await hue.press("Control+Shift+z");
  await expect
    .poll(() => workspace(page).then((state) => state.harmonizer))
    .toEqual(edited.harmonizer);
  await expect(dialog.getByRole("status")).toHaveText("Ready");
  await dialog
    .getByRole("button", { name: "Close harmonizer", exact: true })
    .click();
  await expect(trigger).toBeFocused();
  await page.reload();
  expect((await workspace(page)).harmonizer).toEqual(edited.harmonizer);
  await trigger.click();
  await expect(dialog.getByRole("status")).toHaveText("Ready");
  await expect(
    dialog.getByRole("slider", { name: "Hue Red", exact: true }),
  ).toHaveValue(String(edited.harmonizer!.rows[0].hue));
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page
    .getByRole("button", { name: "Add middle color", exact: true })
    .click();
  await page
    .getByLabel("Palette interpolation", { exact: true })
    .selectOption("HCL");
  const curved = (await workspace(page)).palette!;
  await trigger.click();
  await expect(dialog.getByRole("status")).toHaveText("Ready");
  await dialog
    .getByRole("button", { name: "Use Azure palette", exact: true })
    .click();
  await expect
    .poll(() => workspace(page).then((state) => state.harmonizer?.selectedRow))
    .toBe("azure");
  expect((await workspace(page)).palette).toMatchObject({
    mode: curved.mode,
    subdivisions: curved.subdivisions,
    endpoint: curved.endpoint,
    middle: { ...curved.middle, h: 250 },
    end: { h: 250 },
  });
  expect((await workspace(page)).color.h).toBe(250);
  await dialog
    .getByRole("slider", { name: "Hue Azure", exact: true })
    .press("Home");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(() =>
      workspace(page).then((state) => ({
        hue: state.harmonizer?.rows.find((row) => row.id === "azure")?.hue,
        start: state.color.h,
        end: state.palette?.end.h,
      })),
    )
    .toEqual({ hue: 0, start: 0, end: 0 });
});

test("harmonizer controls edit the grid and remain contained on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Harmonizer", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Harmonizer", exact: true });
  await expect(dialog.getByRole("status")).toHaveText("Ready");
  await dialog
    .getByLabel("Harmonizer color space", { exact: true })
    .selectOption("srgb");
  await expect(dialog.getByRole("status")).toHaveText("Ready");
  await expect(dialog.locator(".harmonizer-gamut")).toHaveCount(0);
  await dialog
    .getByLabel("Harmonizer chroma mode", { exact: true })
    .selectOption("max");
  await expect(dialog.getByRole("status")).toHaveText("Ready");
  const cap = dialog.getByRole("spinbutton", {
    name: "Chroma limit 500",
    exact: true,
  });
  await cap.fill("0.02");
  await cap.press("Tab");
  await expect
    .poll(() =>
      workspace(page).then((state) => state.harmonizer!.levels[4].chroma),
    )
    .toBe(0.02);
  await dialog
    .getByRole("button", { name: "Reset chroma limit 500", exact: true })
    .click();
  await expect
    .poll(() =>
      workspace(page).then((state) => state.harmonizer!.levels[4].chroma),
    )
    .toBeUndefined();
  await dialog.getByRole("button", { name: "Add hue", exact: true }).click();
  await expect(dialog.locator("tbody tr")).toHaveCount(6);
  await dialog.getByRole("button", { name: "Add level", exact: true }).click();
  await expect(dialog.locator(".harmonizer-cell")).toHaveCount(60);
  await expect(dialog.getByRole("status")).toHaveText("Ready");
  const overflow = await dialog.evaluate((el) => ({
    dialog: el.scrollWidth > el.clientWidth,
    page: document.documentElement.scrollWidth > innerWidth,
  }));
  expect(overflow).toEqual({ dialog: false, page: false });
});
