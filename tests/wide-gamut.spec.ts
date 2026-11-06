import { test, expect, type Page } from "@playwright/test";
import { converter } from "culori";
import { colorGamut, parseDisplayP3 } from "../src/colorGamut";
import { cssColor } from "../src/color";

async function reportSrgbScreen(page: Page) {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (media) => {
      const query = original(media);
      if (media === "(color-gamut: p3)")
        Object.defineProperty(query, "matches", { value: false });
      return query;
    };
  });
}

test("P3 input retains out-of-sRGB channels and alpha without canvas clipping", () => {
  const color = parseDisplayP3("color(display-p3 1 0 0 / 0.5)")!;
  const inspected = colorGamut(color);
  expect(inspected.srgb).toBe(false);
  expect(inspected.p3).toBe(true);
  expect(inspected.srgbChannels[0]).toBeGreaterThan(255);
  expect(inspected.srgbChannels[1]).toBeLessThan(0);
  expect(color.a).toBe(0.5);
  expect(inspected.p3Css).toBe("color(display-p3 1 0 0 / 0.5)");
  expect(
    colorGamut(parseDisplayP3("color(display-p3 0.5 0.5 0.5)")!).srgb,
  ).toBe(true);
  expect(colorGamut({ l: 0.7, c: 0.4, h: 160, a: 1 }).p3).toBe(false);
  expect(parseDisplayP3("#ff0000")).toBeNull();
  expect(parseDisplayP3("invalid")).toBeNull();
});

test("P3 edits survive mode changes and reload when the browser reports an sRGB screen", async ({
  page,
}) => {
  await reportSrgbScreen(page);
  await page.goto("/#color=0.6,0.1,30,1&pickers=OKHCL");
  const editor = page.getByLabel("Display P3 value", { exact: true });
  await editor.fill("color(display-p3 1 0 0 / 0.5)");
  await editor.press("Enter");
  await expect(editor).toHaveValue("color(display-p3 1 0 0 / 0.5)");
  await expect(page.getByLabel("Color gamut", { exact: true })).toHaveText(
    "Outside sRGB · within Display P3",
  );
  const channels = (
    await page.getByLabel("Unclipped sRGB channels").innerText()
  )
    .split(" ")
    .map(Number);
  expect(channels[0]).toBeGreaterThan(255);
  expect(channels[1]).toBeLessThan(0);
  const hash = new URL(page.url()).hash;
  await page.getByLabel("Picker mode", { exact: true }).selectOption("RGB");
  await expect(editor).toHaveValue("color(display-p3 1 0 0 / 0.5)");
  await page.reload();
  await expect(editor).toHaveValue("color(display-p3 1 0 0 / 0.5)");
  expect(new URL(page.url()).hash.split("&")[0]).toBe(hash.split("&")[0]);
  await editor.fill("color(display-p3 0.5 0.5 0.5)");
  await editor.press("Enter");
  await expect(page.getByLabel("Color gamut", { exact: true })).toHaveText(
    "Within sRGB",
  );
});

test("worker-to-screen planes preserve P3 pixels independently of the display media query", async ({
  page,
}) => {
  const supportsP3Canvas = await page.evaluate(
    () =>
      document
        .createElement("canvas")
        .getContext("2d", { colorSpace: "display-p3" })!
        .getContextAttributes().colorSpace === "display-p3",
  );
  test.skip(
    !supportsP3Canvas,
    "This browser only supports sRGB canvas backing stores",
  );
  await reportSrgbScreen(page);
  const color = parseDisplayP3("color(display-p3 1 0 0)")!;
  await page.goto(`/#color=${color.l},${color.c},${color.h},1&pickers=OKHCL`);
  const plane = page.getByRole("group", {
    name: "OKHCL Chroma × Lightness plane",
    exact: true,
  });
  const canvas = plane.locator("canvas");
  const blank = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 160;
    return canvas.toDataURL();
  });
  // Wait for the app to choose the backing store before reading the context.
  await expect
    .poll(() =>
      canvas.evaluate((element) => {
        if (!(element instanceof HTMLCanvasElement))
          throw new Error("Expected canvas");
        return element.toDataURL();
      }),
    )
    .not.toBe(blank);
  // This point is inside P3 and outside sRGB. Comparing in P3 catches either
  // the worker or the destination canvas accidentally using an sRGB backing store.
  const point = { l: 1 - 57 / 159, c: (182 / 255) * 0.4, h: color.h, a: 1 };
  const rgb = converter("rgb")({ mode: "oklch", ...point });
  expect(rgb.r).toBeGreaterThan(1);
  expect(colorGamut(point).p3).toBe(true);
  const css = cssColor(point);
  await expect
    .poll(() =>
      canvas.evaluate((canvas, css) => {
        if (!(canvas instanceof HTMLCanvasElement))
          throw new Error("Expected canvas");
        const ctx = canvas.getContext("2d")!;
        const reference = document
          .createElement("canvas")
          .getContext("2d", { colorSpace: "display-p3" })!;
        reference.fillStyle = css;
        reference.fillRect(0, 0, 1, 1);
        const actual = ctx.getImageData(182, 57, 1, 1, {
          colorSpace: "display-p3",
        });
        const expected = reference.getImageData(0, 0, 1, 1, {
          colorSpace: "display-p3",
        });
        return (
          ctx.getContextAttributes().colorSpace === expected.colorSpace &&
          Array.from(actual.data).every(
            (value, index) => Math.abs(value - expected.data[index]) <= 1,
          )
        );
      }, css),
    )
    .toBe(true);
});
