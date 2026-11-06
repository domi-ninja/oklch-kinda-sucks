import { test, expect, type Page, type Locator } from "@playwright/test";

async function pixels(page: Page, strip: Locator) {
  const png = await strip.screenshot();
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

async function checkScale(page: Page, count: number) {
  const colors = page.getByRole("list", {
    name: "Palette colors",
    exact: true,
  });
  const brightness = page.getByRole("list", {
    name: "Perceived brightness",
    exact: true,
  });
  await expect(brightness.getByRole("listitem")).toHaveCount(count);
  const upperCells = await colors.locator("li").evaluateAll((cells) =>
    cells.map((cell) => {
      const rect = cell.getBoundingClientRect();
      return { x: rect.x, width: rect.width };
    }),
  );
  const lowerCells = await brightness.locator("li").evaluateAll((cells) =>
    cells.map((cell) => {
      const rect = cell.getBoundingClientRect();
      return { x: rect.x, width: rect.width };
    }),
  );
  expect(lowerCells).toEqual(upperCells);
  const [upper, lower] = await Promise.all([
    pixels(page, colors),
    pixels(page, brightness),
  ]);
  const read = (image: typeof upper, x: number, y: number) =>
    image.data.slice((y * image.width + x) * 4, (y * image.width + x) * 4 + 3);
  for (let index = 0; index < count; index++) {
    const x = Math.floor(1 + ((index + 0.5) * (upper.width - 2)) / count);
    for (const y of [4, 12]) {
      const rgb = read(upper, x, y);
      const gray = read(lower, x, y);
      expect(Math.max(...gray) - Math.min(...gray)).toBeLessThanOrEqual(1);
      expect(Math.abs(luminance(gray) - luminance(rgb))).toBeLessThan(0.012);
    }
  }
}

test("brightness tracks rendered palette colors, alpha and mobile columns", async ({
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
  await page.getByLabel("Palette subdivisions", { exact: true }).fill("4");
  await page
    .getByLabel("Palette interpolation", { exact: true })
    .selectOption("RGB");
  await checkScale(page, 5);
  await page
    .getByLabel("Palette interpolation", { exact: true })
    .selectOption("OKHCL");
  await page.getByLabel("RGB value", { exact: true }).fill("#00ff0080");
  await page.getByRole("button", { name: "Apply color", exact: true }).click();
  await checkScale(page, 5);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Palette subdivisions", { exact: true }).fill("8");
  await checkScale(page, 9);
});
