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

async function checkScale(page: Page, count: number, harmonized = false) {
  const colorName = harmonized ? "Harmonized colors" : "Palette colors";
  const brightnessName = harmonized
    ? "Harmonized brightness"
    : "Perceived brightness";
  const colors = page.getByRole("list", {
    name: colorName,
    exact: true,
  });
  const brightness = page.getByRole("list", {
    name: brightnessName,
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
  for (const name of ["Harmonized colors", "Harmonized brightness"]) {
    const row = page.getByRole("list", { name, exact: true });
    await expect(row).toHaveAttribute("aria-busy", "false");
    await expect(row.getByRole("listitem")).toHaveCount(count);
    expect(
      await row.locator("li").evaluateAll((cells) =>
        cells.map((cell) => {
          const rect = cell.getBoundingClientRect();
          return { x: rect.x, width: rect.width };
        }),
      ),
    ).toEqual(upperCells);
  }
  const scroll = page.locator(".palette-scale-scroll");
  const checked = new Set<number>();
  const dimensions = await scroll.evaluate((element) => ({
    width: element.clientWidth,
    total: element.scrollWidth,
  }));
  for (let left = 0; left < dimensions.total; left += dimensions.width * 0.7) {
    await scroll.evaluate((element, left) => {
      element.scrollLeft = left;
    }, left);
    const image = await pixels(page, scroll);
    const positions = await scroll.evaluate(
      (element, { colorName, brightnessName }) => {
        const bounds = element.getBoundingClientRect();
        return {
          colors: [
            ...element.querySelectorAll(`[aria-label="${colorName}"] li`),
          ].map((cell) => {
            const rect = cell.getBoundingClientRect();
            return {
              x: rect.x + rect.width / 2 - bounds.x,
              y: rect.y - bounds.y,
            };
          }),
          grayY:
            element
              .querySelector(`[aria-label="${brightnessName}"] li`)!
              .getBoundingClientRect().y - bounds.y,
          end: element.scrollLeft + element.clientWidth >= element.scrollWidth,
        };
      },
      { colorName, brightnessName },
    );
    const read = (x: number, y: number) =>
      image.data.slice(
        (Math.floor(y) * image.width + Math.floor(x)) * 4,
        (Math.floor(y) * image.width + Math.floor(x)) * 4 + 3,
      );
    for (const [index, point] of positions.colors.entries()) {
      if (point.x < 2 || point.x > image.width - 2) continue;
      checked.add(index);
      for (const offset of [4, 12]) {
        const rgb = read(point.x, point.y + offset);
        const gray = read(point.x, positions.grayY + offset);
        expect(Math.max(...gray) - Math.min(...gray)).toBeLessThanOrEqual(1);
        expect(Math.abs(luminance(gray) - luminance(rgb))).toBeLessThan(0.012);
      }
    }
    if (positions.end) break;
  }
  expect(checked.size).toBe(count);
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
  await checkScale(page, 5, true);
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
  await checkScale(page, 5, true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Palette subdivisions", { exact: true }).fill("8");
  await checkScale(page, 9);
  await checkScale(page, 9, true);
});
