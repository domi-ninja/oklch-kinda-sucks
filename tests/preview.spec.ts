import { test, expect } from "@playwright/test";

test("color updates preserve independent preview scroll positions and form state", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const light = page.frameLocator('iframe[title="shadcn/ui light preview"]');
  const dark = page.frameLocator('iframe[title="shadcn/ui dark preview"]');
  await expect(light.locator("main")).toHaveCSS(
    "background-color",
    "oklch(0.985 0.002 180)",
  );
  await expect(dark.locator("main")).toHaveCSS(
    "background-color",
    "oklch(0.18 0.008 260)",
  );
  await light.getByLabel("Name", { exact: true }).fill("Keep this draft");
  await dark
    .getByRole("checkbox", { name: "Email notifications", exact: true })
    .uncheck();
  await light.locator("html").evaluate(() => scrollTo(0, 320));
  await dark.locator("html").evaluate(() => scrollTo(0, 620));
  await expect
    .poll(() => light.locator("html").evaluate(() => scrollY))
    .toBe(320);
  await expect
    .poll(() => dark.locator("html").evaluate(() => scrollY))
    .toBe(620);
  await page.locator('.token[title="color-primary"]').click();
  for (const color of [
    "oklch(0.6 0.2 30)",
    "oklch(0.55 0.12 240)",
    "oklch(0.7 0.15 90)",
  ]) {
    await page.getByLabel("OKLCH value", { exact: true }).fill(color);
    await page
      .getByRole("button", { name: "Apply color", exact: true })
      .click();
    for (const frame of [light, dark])
      await expect(
        frame.getByRole("button", { name: "Open project", exact: true }),
      ).toHaveCSS("background-color", color);
    await expect
      .poll(() => light.locator("html").evaluate(() => scrollY))
      .toBe(320);
    await expect
      .poll(() => dark.locator("html").evaluate(() => scrollY))
      .toBe(620);
    await expect(light.getByLabel("Name", { exact: true })).toHaveValue(
      "Keep this draft",
    );
    await expect(
      dark.getByRole("checkbox", { name: "Email notifications", exact: true }),
    ).not.toBeChecked();
  }
});
