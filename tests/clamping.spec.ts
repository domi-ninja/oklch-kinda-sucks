import { test, expect, type Page } from "@playwright/test";
import { clampColor } from "../src/colorBounds";
import type { Color } from "../src/color";
import {
  channels,
  coordinates,
  fromCoordinates,
  parsePickerExpression,
} from "../src/pickerModes";
import { createPaletteRamp } from "../src/palette";
import { pickerModes, workspaceSchema } from "../src/workspaceSchema";
import { workspaceStorageKey } from "../src/workspace";

function expectBounded(color: Color) {
  expect(Object.values(color).every(Number.isFinite)).toBe(true);
  expect(color.l).toBeGreaterThanOrEqual(0);
  expect(color.l).toBeLessThanOrEqual(1);
  expect(color.c).toBeGreaterThanOrEqual(0);
  expect(color.c).toBeLessThanOrEqual(0.4);
  expect(color.h).toBeGreaterThanOrEqual(0);
  expect(color.h).toBeLessThan(360);
  expect(color.a).toBeGreaterThanOrEqual(0);
  expect(color.a).toBeLessThanOrEqual(1);
}

async function readState(page: Page) {
  const stored: unknown = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    workspaceStorageKey,
  );
  const parsed = workspaceSchema.parse(stored);
  expect(stored).toEqual(parsed);
  return parsed;
}

test("conversions, expression submissions and palette ramps stay inside their fixed bounds", () => {
  expect(clampColor({ l: -100, c: 5.337977, h: 721, a: 2 })).toEqual({
    l: 0,
    c: 0.4,
    h: 1,
    a: 1,
  });
  expectBounded(clampColor({ l: Infinity, c: NaN, h: -Infinity, a: NaN }));
  for (const mode of pickerModes) {
    const config = channels[mode];
    for (const x of [0, config[0].max / 2, config[0].max])
      for (const y of [0, config[1].max / 2, config[1].max])
        for (const z of [0, config[2].max / 2, config[2].max]) {
          const color = fromCoordinates([x, y, z], mode, 0.5);
          expectBounded(color);
          for (const projection of ["HCL", "OKHCL"] as const)
            for (const [index, value] of coordinates(
              color,
              projection,
            ).entries()) {
              expect(value).toBeGreaterThanOrEqual(0);
              expect(value).toBeLessThanOrEqual(
                channels[projection][index].max,
              );
            }
        }
    expectBounded(fromCoordinates([9999, 9999, -9999], mode, 3));
  }
  for (const [mode, expression, percent] of [
    ["HCL", "lch(-153.38 1104.786 300.005 / 1)", false],
    ["HSL", "hsl(180 999% -999% / 1)", false],
    ["RGB", "rgb(999 -999 999 / 1)", false],
    ["OKHCL", "oklch(999% 999% 999% / 100%)", true],
  ] as const) {
    const color = parsePickerExpression(expression, mode, percent);
    expect(color).not.toBeNull();
    expectBounded(color!);
  }
  for (const mode of ["HCL", "OKHCL"] as const) {
    const ramp = createPaletteRamp(
      { l: 0.722826, c: 5.337977, h: 197.027128, a: 1 },
      { l: 1.5, c: 2, h: 800, a: 1 },
      mode,
      10,
    );
    for (const color of [...ramp.colors, ...ramp.path]) expectBounded(color);
  }
});

test("the reported URL and broken stored endpoints recover without discarding the workspace", async ({
  page,
}) => {
  await page.goto(
    "/#color=0.722826,5.337977,197.027128,1&pickers=HSL,HCL,OKHCL",
  );
  await expect(page.getByLabel("OKLCH value", { exact: true })).toHaveValue(
    "oklch(0.7228 0.4 197.03 / 100%)",
  );
  await expect(page).toHaveURL(
    /#color=0\.722826,0\.4,197\.027128,1&pickers=HSL,HCL,OKHCL$/,
  );
  const original = await readState(page);
  await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key)!);
    state.color = { l: -1, c: 5.337977, h: 800, a: 1 };
    state.palette = {
      end: { l: 2, c: 3, h: -100, a: 1 },
      endpoint: "end",
      subdivisions: 10,
      mode: "HCL",
    };
    localStorage.setItem(key, JSON.stringify(state));
    history.replaceState(null, "", "/");
  }, workspaceStorageKey);
  await page.reload();
  await expect(page.getByLabel("OKLCH value", { exact: true })).toHaveValue(
    "oklch(1 0.4 260 / 100%)",
  );
  const recovered = await readState(page);
  expect(recovered.color).toEqual({ l: 0, c: 0.4, h: 80, a: 1 });
  expect(recovered.palette?.end).toEqual({ l: 1, c: 0.4, h: 260, a: 1 });
  expect(recovered.source).toBe(original.source);
  expect(recovered.saved).toEqual(original.saved);
  expect(recovered.active).toBe(original.active);
  expect(recovered.pickers).toEqual(original.pickers);
  await expect(
    page
      .getByRole("list", { name: "Palette colors", exact: true })
      .locator("li"),
  ).toHaveCount(11);
});

test("extreme palette edits keep native and percentage limits fixed and allow replacing numeric drafts", async ({
  page,
}) => {
  await page.goto(
    "/#color=0.722826,5.337977,197.027128,1&pickers=HSL,HCL,OKHCL",
  );
  await page
    .getByRole("button", { name: "Create palette", exact: true })
    .click();
  const hcl = page.getByRole("region", {
    name: "Color picker HCL 2",
    exact: true,
  });
  for (const endpoint of ["Start", "End"]) {
    await page.getByRole("button", { name: endpoint, exact: true }).click();
    await hcl
      .getByRole("spinbutton", { name: "Chroma value", exact: true })
      .fill("150");
    await hcl
      .getByRole("spinbutton", { name: "Lightness value", exact: true })
      .fill("0");
    await hcl
      .getByRole("spinbutton", { name: "Lightness value", exact: true })
      .press("Tab");
    for (const name of ["Hue", "Chroma", "Lightness"]) {
      const slider = hcl.getByRole("slider", { name, exact: true });
      await slider.focus();
      await slider.press("End");
      await slider.press("Home");
    }
    const state = await readState(page);
    expectBounded(state.color);
    expectBounded(state.palette!.end);
    const limits = await page
      .locator(".slider-row input")
      .evaluateAll((elements) =>
        elements.every((element) => {
          const input = element as HTMLInputElement;
          return (
            Number.isFinite(input.valueAsNumber) &&
            input.valueAsNumber >= Number(input.min) &&
            input.valueAsNumber <= Number(input.max) &&
            (input.type !== "range" || input.max === "100")
          );
        }),
      );
    expect(limits).toBe(true);
  }
  const percentage = page
    .getByRole("region", { name: "Color picker OKHCL 3", exact: true })
    .getByRole("spinbutton", { name: "Lightness percentage", exact: true });
  await percentage.fill("0.784");
  await percentage.press("ControlOrMeta+A");
  await percentage.pressSequentially("100");
  await expect(percentage).toHaveValue("100");
  await percentage.press("Tab");
  expectBounded((await readState(page)).palette!.end);
  await page.reload();
  for (const stateColor of [
    (await readState(page)).color,
    (await readState(page)).palette!.end,
  ])
    expectBounded(stateColor);
});
