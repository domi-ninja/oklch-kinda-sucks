import { test, expect, type Page } from "@playwright/test";
import { cssColor } from "../src/color";
import {
  bezierCoordinates,
  createPaletteRamp,
  interpolateCoordinates,
} from "../src/palette";
import { channels, type Coordinates } from "../src/pickerModes";
import { pickerPlanes } from "../src/planes";
import { workspaceSchema } from "../src/workspaceSchema";

async function workspace(page: Page) {
  return workspaceSchema.parse(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("oklch-workspace")!),
    ),
  );
}

test("quadratic palette curves blend the control color and alpha and unwrap hue consistently", () => {
  expect(
    bezierCoordinates([0, 0, 0], [0, 255, 0], [255, 0, 255], "RGB", 0.5),
  ).toEqual([63.75, 127.5, 63.75]);
  const start = { l: 0.2, c: 0.04, h: 350, a: 0.2 };
  const middle = { l: 0.9, c: 0.32, h: 40, a: 1 };
  const end = { l: 0.6, c: 0.12, h: 10, a: 0.6 };
  const ramp = createPaletteRamp(start, end, "OKHCL", 8, middle);
  expect(ramp.colors).toHaveLength(9);
  expect(ramp.colors[0]).toEqual(start);
  expect(ramp.colors[8]).toEqual(end);
  for (const [key, value] of Object.entries({ l: 0.65, c: 0.2, h: 20, a: 0.7 }))
    expect(ramp.colors[4][key as keyof typeof middle]).toBeCloseTo(value, 10);
  expect(ramp.controls.middle).toEqual(middle);
  expect(ramp.colors[4]).not.toEqual(middle);
  const straight = createPaletteRamp(start, end, "OKHCL", 8);
  const collinear = createPaletteRamp(
    start,
    end,
    "OKHCL",
    8,
    straight.path[16],
  );
  for (let i = 0; i < 9; i++)
    for (const key of ["l", "c", "h", "a"] as const)
      expect(collinear.colors[i][key]).toBeCloseTo(straight.colors[i][key], 10);
  for (const mode of ["HSL", "HCL", "OKHCL"] as const) {
    expect(
      bezierCoordinates(
        [350, 0.1, 0.2],
        [0, 0.2, 0.4],
        [10, 0.3, 0.6],
        mode,
        0.5,
      )[0],
    ).toBe(0);
    expect(
      bezierCoordinates(
        [350, 0.1, 0.2],
        [270, 0, 0.4],
        [10, 0.3, 0.6],
        mode,
        0.5,
      )[0],
    ).toBe(0);
    const identical = [20, 0.1, 0.5] satisfies Coordinates;
    expect(
      bezierCoordinates(identical, [200, 0.2, 0.5], identical, mode, 0.5)[0],
    ).toBe(290);
    for (let i = 0; i <= 32; i++) {
      const t = i / 32;
      const linear = interpolateCoordinates(
        [350, 0.1, 0.2],
        [10, 0.3, 0.6],
        mode,
        t,
      );
      const curve = bezierCoordinates(
        [350, 0.1, 0.2],
        [0, 0.2, 0.4],
        [10, 0.3, 0.6],
        mode,
        t,
      );
      for (const key of [0, 1, 2] as const)
        expect(curve[key]).toBeCloseTo(linear[key], 10);
    }
  }
});

test("middle control edits bend the ramp, undo cleanly and survive reload", async ({
  page,
}) => {
  await page.goto("/#color=0.6,0.08,350,0.6&pickers=OKHCL");
  await page
    .getByRole("button", { name: "Create palette", exact: true })
    .click();
  await page.getByRole("button", { name: "End", exact: true }).click();
  await page
    .getByLabel("OKLCH value", { exact: true })
    .fill("oklch(0.4 0.12 10 / 40%)");
  await page.getByRole("button", { name: "Apply color", exact: true }).click();
  await page.getByLabel("Palette subdivisions", { exact: true }).fill("8");
  const before = await workspace(page);
  await page
    .getByRole("button", { name: "Add middle color", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Middle", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-palette-endpoint="middle"]')).toHaveCount(3);
  const initialMiddle = (await workspace(page)).palette!.middle!;
  await page
    .getByLabel("OKLCH value", { exact: true })
    .fill("oklch(0.9 0.3 50 / 90%)");
  await page.getByRole("button", { name: "Apply color", exact: true }).click();
  const curved = await workspace(page);
  expect(curved.color).toEqual(before.color);
  expect(curved.palette!.end).toEqual(before.palette!.end);
  const steps = page
    .getByRole("list", { name: "Palette colors", exact: true })
    .locator("li");
  await expect(steps).toHaveCount(9);
  await expect(steps.nth(4)).toHaveAttribute(
    "title",
    "oklch(0.7 0.2 25 / 70%)",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(() => workspace(page).then((state) => state.palette!.middle))
    .toEqual(initialMiddle);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect
    .poll(() => workspace(page).then((state) => state.palette))
    .toEqual(curved.palette);
  await page
    .getByRole("button", { name: "Remove middle color", exact: true })
    .click();
  await expect(page.locator('[data-palette-endpoint="middle"]')).toHaveCount(0);
  expect((await workspace(page)).color).toEqual(before.color);
  expect((await workspace(page)).palette!.end).toEqual(before.palette!.end);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator('[data-palette-endpoint="middle"]')).toHaveCount(3);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Middle", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect((await workspace(page)).palette).toEqual(curved.palette);
  expect(new URL(page.url()).hash).toBe("#color=0.9,0.3,50,0.9&pickers=OKHCL");
});

test("middle handles support dragging and keyboard editing in every picker and fit on phones", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/#color=0.6,0.1,170,0.65&pickers=RGB,HSL,HCL,OKHCL");
  await page
    .getByRole("button", { name: "Create palette", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add middle color", exact: true })
    .click();
  const before = await workspace(page);
  for (const [index, mode] of (
    ["RGB", "HSL", "HCL", "OKHCL"] as const
  ).entries()) {
    const mapping = pickerPlanes(mode)[0];
    const config = channels[mode];
    const name = `${mode} ${config[mapping.x].name} × ${config[mapping.y].name}`;
    const plane = page
      .locator(".color-panel")
      .nth(index)
      .getByRole("group", { name: `${name} plane`, exact: true });
    const handle = plane.getByRole("button", {
      name: `Middle control color in ${name} plane`,
      exact: true,
    });
    await handle.scrollIntoViewIfNeeded();
    const start = (await handle.boundingBox())!;
    const bounds = (await plane.boundingBox())!;
    await page.mouse.move(
      start.x + start.width / 2,
      start.y + start.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      bounds.x + bounds.width * 0.3,
      bounds.y + bounds.height * 0.25,
      { steps: 8 },
    );
    await page.mouse.up();
    await expect
      .poll(() => handle.evaluate((el) => parseFloat(el.style.left)))
      .toBeCloseTo(30, 0);
    await expect
      .poll(() => handle.evaluate((el) => parseFloat(el.style.top)))
      .toBeCloseTo(25, 0);
    await expect
      .poll(async () => {
        const middle = (await workspace(page)).palette!.middle!;
        return (
          (await page
            .getByLabel("OKLCH value", { exact: true })
            .inputValue()) === cssColor(middle)
        );
      })
      .toBe(true);
    const dragged = (await workspace(page)).palette!.middle!;
    await handle.focus();
    await handle.press("ArrowRight");
    await handle.press("Control+z");
    await expect
      .poll(() => workspace(page).then((state) => state.palette!.middle))
      .toEqual(dragged);
    const after = await workspace(page);
    expect(after.color).toEqual(before.color);
    expect(after.palette!.end).toEqual(before.palette!.end);
    expect(after.palette!.middle!.a).toBe(0.65);
    expect(after.palette!.endpoint).toBe("middle");
  }
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page
        .locator(".palette-controls")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
});
