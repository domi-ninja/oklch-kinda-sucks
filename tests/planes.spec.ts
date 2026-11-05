import { test, expect } from "@playwright/test";
import { channels, coordinateCss, type Coordinates } from "../src/pickerModes";
import { pickerPlanes } from "../src/planes";
import { pickerModes } from "../src/workspaceSchema";

test("all three channel pairings render the browser's color at their held coordinate", async ({
  page,
}) => {
  for (const mode of pickerModes) {
    await page.goto(`/#color=0.6,0.1,180,0.5&pickers=${mode}`);
    await expect(page.locator(".plane")).toHaveCount(3);
    const config = channels[mode];
    for (const mapping of pickerPlanes(mode)) {
      const name = `${mode} ${config[mapping.x].name} × ${config[mapping.y].name} plane`;
      const plane = page.getByRole("group", { name, exact: true });
      await expect(plane).toBeVisible();
      const point: Coordinates = [0, 0, 0];
      point[mapping.fixed] = Number(
        await page
          .getByRole("spinbutton", {
            name: `${config[mapping.fixed].name} value`,
            exact: true,
          })
          .inputValue(),
      );
      point[mapping.x] = (64 / 255) * config[mapping.x].max;
      point[mapping.y] = (1 - 96 / 159) * config[mapping.y].max;
      const css = coordinateCss(point, mode);
      await expect
        .poll(() =>
          plane.locator("canvas").evaluate((element, css) => {
            if (!(element instanceof HTMLCanvasElement))
              throw new Error("Expected canvas");
            const actual = element
              .getContext("2d")!
              .getImageData(64, 96, 1, 1).data;
            const reference = document
              .createElement("canvas")
              .getContext("2d", { colorSpace: "srgb" })!;
            reference.fillStyle = css;
            reference.fillRect(0, 0, 1, 1);
            const expected = reference.getImageData(0, 0, 1, 1).data;
            return (
              actual[3] === 255 &&
              Array.from(actual).every(
                (value, index) => Math.abs(value - expected[index]) <= 2,
              )
            );
          }, css),
        )
        .toBe(true);
    }
  }
});

test("each plane changes its two channels, preserves the third and alpha, and updates every crosshair", async ({
  page,
}) => {
  for (const mode of pickerModes) {
    await page.goto(`/#color=0.6,0.1,180,0.5&pickers=${mode}`);
    const config = channels[mode];
    const readValues = async () =>
      Promise.all(
        config.map((channel) =>
          page
            .getByRole("spinbutton", {
              name: `${channel.name} value`,
              exact: true,
            })
            .inputValue()
            .then(Number),
        ),
      );
    await expect(page.locator(".plane")).toHaveCount(3);
    for (const mapping of pickerPlanes(mode)) {
      const before = await readValues();
      const plane = page.getByRole("group", {
        name: `${mode} ${config[mapping.x].name} × ${config[mapping.y].name} plane`,
        exact: true,
      });
      const box = (await plane.boundingBox())!;
      const x = Math.round(box.width * 0.4);
      const y = Math.round(box.height * 0.35);
      await plane.click({ position: { x, y } });
      const after = await readValues();
      const tolerance = mode === "RGB" || mode === "HSL" ? 1.5 : 0.005;
      expect(
        Math.abs(after[mapping.fixed] - before[mapping.fixed]),
      ).toBeLessThanOrEqual(tolerance);
      expect(
        Math.abs(after[mapping.x] - (x / box.width) * config[mapping.x].max),
      ).toBeLessThanOrEqual(
        Math.max(tolerance, (2 / box.width) * config[mapping.x].max),
      );
      expect(
        Math.abs(
          after[mapping.y] - (1 - y / box.height) * config[mapping.y].max,
        ),
      ).toBeLessThanOrEqual(
        Math.max(tolerance, (2 / box.height) * config[mapping.y].max),
      );
      await expect(
        page.getByRole("spinbutton", { name: "Alpha value", exact: true }),
      ).toHaveValue("0.5");
      for (const other of pickerPlanes(mode)) {
        const marker = page
          .getByRole("group", {
            name: `${mode} ${config[other.x].name} × ${config[other.y].name} plane`,
            exact: true,
          })
          .locator(".crosshair");
        const position = await marker.evaluate((element) => ({
          x: parseFloat((element as HTMLElement).style.left),
          y: parseFloat((element as HTMLElement).style.top),
        }));
        expect(
          Math.abs(
            position.x -
              Math.max(
                0,
                Math.min(100, (after[other.x] / config[other.x].max) * 100),
              ),
          ),
        ).toBeLessThan(0.2);
        expect(
          Math.abs(
            position.y -
              Math.max(
                0,
                Math.min(100, (1 - after[other.y] / config[other.y].max) * 100),
              ),
          ),
        ).toBeLessThan(0.2);
      }
    }
  }
  await page.goto("/#color=0.6,0.1,180,0.5&pickers=OKHCL");
  const hueLightness = page.getByRole("group", {
    name: "OKHCL Hue × Lightness plane",
    exact: true,
  });
  await hueLightness.focus();
  await hueLightness.press("ArrowRight");
  await expect(
    page.getByRole("spinbutton", { name: "Hue value", exact: true }),
  ).toHaveValue("180.1");
  await hueLightness.press("ArrowUp");
  await expect(
    page.getByRole("spinbutton", { name: "Lightness value", exact: true }),
  ).toHaveValue("0.601");
  await expect(
    page.getByRole("spinbutton", { name: "Chroma value", exact: true }),
  ).toHaveValue("0.1");
});
