import { test, expect, type Page, type Locator } from "@playwright/test";

async function pixels(page: Page, strip: Locator) {
  const png = await strip.screenshot({ scale: "css" });
  return page.evaluate(
    async (bytes) => {
      const bitmap = await createImageBitmap(
        new Blob([new Uint8Array(bytes)], { type: "image/png" }),
      );
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(bitmap, 0, 0);
      const data = [
        ...context.getImageData(0, 0, canvas.width, canvas.height).data,
      ];
      bitmap.close();
      return { width: canvas.width, height: canvas.height, data };
    },
    [...png],
  );
}

const linear = (channel: number) => {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: number[]) =>
  0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);

async function checkScale(page: Page, count: number, mode?: "light" | "dark") {
  const strip = page.getByRole("list", {
    name: mode ? `Harmonized ${mode} colors` : "Palette colors",
    exact: true,
  });
  await expect(strip).toHaveAttribute("aria-busy", "false");
  await expect(strip.getByRole("listitem")).toHaveCount(count);
  await expect(strip.getByRole("img")).toHaveCount(count);
  const image = await pixels(page, strip);
  const positions = await strip.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return [...element.querySelectorAll("li")].map((cell) => {
      const color = cell
        .querySelector(".palette-cell-color")!
        .getBoundingClientRect();
      const gray = cell
        .querySelector(".palette-cell-brightness")!
        .getBoundingClientRect();
      return {
        x: color.x + color.width / 2 - bounds.x,
        y: color.y - bounds.y,
        grayY: gray.y - bounds.y,
        width: color.width,
        grayWidth: gray.width,
      };
    });
  });
  const read = (x: number, y: number) => {
    const offset = (Math.floor(y) * image.width + Math.floor(x)) * 4;
    return image.data.slice(offset, offset + 3);
  };
  for (const point of positions) {
    expect(point.grayWidth).toBe(point.width);
    for (const offset of [4, 12]) {
      const rgb = read(point.x, point.y + offset);
      const gray = read(point.x, point.grayY + offset);
      expect(Math.max(...gray) - Math.min(...gray)).toBeLessThanOrEqual(1);
      expect(Math.abs(luminance(gray) - luminance(rgb))).toBeLessThan(0.012);
    }
  }
  expect(
    await page
      .locator(".palette-scale-scroll")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  expect(
    await strip.locator(".palette-hex").evaluateAll((labels) =>
      labels.every((el) => {
        const parent = el.parentElement!.getBoundingClientRect();
        const rect = el.getBoundingClientRect();
        return rect.left >= parent.left && rect.right <= parent.right;
      }),
    ),
  ).toBe(true);
}

test("brightness tracks rendered palette colors, alpha and mobile columns", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto("/#color=0.6,0.1,180,1&pickers=RGB");
  await page.getByLabel("RGB value", { exact: true }).fill("#ff0000");
  await page.getByRole("button", { name: "Apply color", exact: true }).click();
  await page
    .getByRole("button", { name: "Create palette", exact: true })
    .click();
  await page.getByRole("button", { name: "End", exact: true }).click();
  await page.getByLabel("RGB value", { exact: true }).fill("#0000ff");
  await page.getByRole("button", { name: "Apply color", exact: true }).click();
  await page.getByLabel("Palette subdivisions", { exact: true }).fill("4");
  await page
    .getByLabel("Palette interpolation", { exact: true })
    .selectOption("RGB");
  await checkScale(page, 5);
  await checkScale(page, 5, "light");
  await checkScale(page, 5, "dark");
  const hex = page
    .getByRole("list", { name: "Palette colors", exact: true })
    .locator(".palette-hex");
  await expect(hex).toHaveCount(5);
  await expect(hex.first()).toHaveText("#ff0000");
  await expect(hex.last()).toHaveText("#0000ff");
  await page
    .getByLabel("Palette interpolation", { exact: true })
    .selectOption("OKHCL");
  await page.getByLabel("RGB value", { exact: true }).fill("#00ff0080");
  await page.getByRole("button", { name: "Apply color", exact: true }).click();
  await expect(hex.last()).toHaveText(/^#[\da-f]{6}80$/);
  await checkScale(page, 5);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Palette subdivisions", { exact: true }).fill("8");
  await checkScale(page, 9);
  await checkScale(page, 9, "light");
  await checkScale(page, 9, "dark");
});
