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
    const positions = await scroll.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        colors: [
          ...element.querySelectorAll(".palette-strip:first-child li"),
        ].map((cell) => {
          const rect = cell.getBoundingClientRect();
          return {
            x: rect.x + rect.width / 2 - bounds.x,
            y: rect.y - bounds.y,
          };
        }),
        grayY:
          element
            .querySelector(".palette-brightness li")!
            .getBoundingClientRect().y - bounds.y,
        end: element.scrollLeft + element.clientWidth >= element.scrollWidth,
      };
    });
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
});

test("linear brightness reference ignores the middle control and matches endpoint brightness", async ({
  page,
}) => {
  await page.goto("/#color=0.6,0.1,180,1&pickers=RGB");
  const apply = page.getByRole("button", { name: "Apply color", exact: true });
  const editor = page.getByLabel("RGB value", { exact: true });
  await editor.fill("#ff0000");
  await apply.click();
  await page
    .getByRole("button", { name: "Create palette", exact: true })
    .click();
  await page.getByRole("button", { name: "End", exact: true }).click();
  await editor.fill("#0000ff");
  await apply.click();
  await page.getByLabel("Palette subdivisions", { exact: true }).fill("2");
  const reference = page.getByRole("img", {
    name: "Linear Start to End brightness",
    exact: true,
  });
  const actual = page.getByRole("list", {
    name: "Perceived brightness",
    exact: true,
  });
  await expect(reference).toBeVisible();
  const original = await pixels(page, reference);
  await page
    .getByRole("button", { name: "Add middle color", exact: true })
    .click();
  await editor.fill("#ffffff");
  await apply.click();
  const bent = await pixels(page, actual);
  const unchanged = await pixels(page, reference);
  expect(
    unchanged.data.every(
      (value, index) => Math.abs(value - original.data[index]) <= 1,
    ),
  ).toBe(true);
  const at = (image: typeof original, index: number, y = 4) => {
    const x = Math.floor(1 + ((index + 0.5) * (image.width - 2)) / 3);
    return image.data.slice(
      (y * image.width + x) * 4,
      (y * image.width + x) * 4 + 3,
    );
  };
  const levels = [0, 1, 2].map((index) => luminance(at(unchanged, index)));
  expect(Math.abs(levels[1] - (levels[0] + levels[2]) / 2)).toBeLessThan(0.01);
  expect(luminance(at(bent, 1))).toBeGreaterThan(levels[1] + 0.15);
  for (const index of [0, 2])
    expect(Math.abs(luminance(at(bent, index)) - levels[index])).toBeLessThan(
      0.01,
    );
  await page.getByRole("button", { name: "End", exact: true }).click();
  await editor.fill("#00ff0080");
  await apply.click();
  const translucent = await pixels(page, actual);
  const translucentReference = await pixels(page, reference);
  for (const index of [0, 2])
    for (const y of [4, 12])
      expect(
        Math.abs(
          luminance(at(translucent, index, y)) -
            luminance(at(translucentReference, index, y)),
        ),
      ).toBeLessThan(0.01);
});
