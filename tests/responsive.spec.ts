import { test, expect } from "@playwright/test";

const fourPickers = "/#color=0.6,0.15,180,1&pickers=RGB,HSL,HCL,OKHCL";

test("mobile pickers use half-width columns and wrap their controls and theme tokens", async ({
  page,
}) => {
  for (const width of [320, 390, 430, 760]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(fourPickers);
    const panels = page.locator(".color-panel");
    await expect(panels).toHaveCount(4);
    const boxes = await panels.evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, bottom: box.bottom };
      }),
    );
    expect(boxes[0].width).toBeCloseTo((width - 48) / 2);
    expect(boxes[1].width).toBe(boxes[0].width);
    expect(boxes[0].y).toBe(boxes[1].y);
    expect(boxes[2].x).toBe(boxes[0].x);
    expect(boxes[2].y).toBeGreaterThanOrEqual(
      Math.max(boxes[0].bottom, boxes[1].bottom),
    );
    const tokens = page.locator(".token-pair").first().locator(".token");
    const light = (await tokens.nth(0).boundingBox())!;
    const dark = (await tokens.nth(1).boundingBox())!;
    expect(dark.x).toBe(light.x);
    expect(dark.y).toBeGreaterThanOrEqual(light.y + light.height);
    const overflow = await page
      .locator(
        ".color-panel,.slider-row,.panel-heading,.picker-panel-heading,.color-editors,.swatches,.token,.preview-toolbar,.export-bar",
      )
      .evaluateAll((elements) =>
        elements
          .filter((element) => element.scrollWidth > element.clientWidth + 1)
          .map((element) => element.className),
      );
    expect(overflow).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    const alpha = panels
      .first()
      .getByRole("spinbutton", { name: "Alpha percentage", exact: true });
    await alpha.fill("0.784");
    await alpha.press("ControlOrMeta+A");
    await alpha.pressSequentially("100");
    await expect(alpha).toHaveValue("100");
    await alpha.press("Tab");
    for (const mode of ["light", "dark"]) {
      const frame = page.frameLocator(
        `iframe[title="shadcn/ui ${mode} preview"]`,
      );
      await expect(
        frame.getByRole("button", { name: "Open project" }),
      ).toHaveCSS("background-color", /oklch/);
      expect(
        await frame
          .locator("html")
          .evaluate((element) => element.scrollWidth <= innerWidth),
      ).toBe(true);
    }
    const lightPreview = (await page
      .getByTitle("shadcn/ui light preview", { exact: true })
      .boundingBox())!;
    const darkPreview = (await page
      .getByTitle("shadcn/ui dark preview", { exact: true })
      .boundingBox())!;
    expect(darkPreview.x).toBe(lightPreview.x);
    expect(darkPreview.y).toBeGreaterThan(lightPreview.y + lightPreview.height);
  }
});

test("tablet sections fit the viewport while desktop keeps its picker row", async ({
  page,
}) => {
  for (const width of [768, 1024, 1366, 1920, 2560]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(fourPickers);
    const panels = page.locator(".color-panel");
    await expect(panels).toHaveCount(4);
    const rows = await panels.evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().y),
    );
    expect(new Set(rows).size).toBe(width <= 1100 ? 2 : 1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
});
