import { test, expect } from "@playwright/test";

test("palette hover previews both modes without saving, updates live, and restores state on exit", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#color=0.95,0.02,170,1&pickers=OKHCL");
  await page
    .getByRole("button", { name: "Create palette", exact: true })
    .click();
  await page.getByRole("button", { name: "End", exact: true }).click();
  await page
    .getByLabel("OKLCH value", { exact: true })
    .fill("oklch(.25 .12 20)");
  await page.getByRole("button", { name: "Apply color", exact: true }).click();
  const panel = page.getByRole("region", { name: "Palette", exact: true });
  const apply = panel.getByRole("button", {
    name: "Apply palette to preset",
    exact: true,
  });
  await expect(apply).toBeEnabled();
  const light = page.frameLocator('iframe[title="shadcn/ui light preview"]');
  const dark = page.frameLocator('iframe[title="shadcn/ui dark preview"]');
  await light.getByLabel("Name", { exact: true }).fill("Preserve this draft");
  await light.locator("html").evaluate(() => scrollTo(0, 320));
  await dark.locator("html").evaluate(() => scrollTo(0, 620));
  await page.mouse.move(0, 0);
  const colors = () =>
    Promise.all(
      [light, dark].map((frame) =>
        frame.locator("html").evaluate(() => {
          const button = document.querySelector("#project")!;
          const style = getComputedStyle(button);
          return { background: style.backgroundColor, text: style.color };
        }),
      ),
    );
  const source = () =>
    page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("oklch-workspace")!).source as string,
    );
  const originalColors = await colors();
  const before = await page.evaluate(() => ({
    stored: localStorage.getItem("oklch-workspace"),
    hash: location.hash,
  }));
  await panel.getByRole("heading", { name: "Palette", exact: true }).hover();
  await expect.poll(colors).not.toEqual(originalColors);
  for (const [index, color] of (await colors()).entries())
    expect(color).not.toEqual(originalColors[index]);
  expect(
    await page.evaluate(() => ({
      stored: localStorage.getItem("oklch-workspace"),
      hash: location.hash,
    })),
  ).toEqual(before);
  const firstPreview = await colors();
  await panel
    .getByLabel("Palette interpolation", { exact: true })
    .selectOption("HSL");
  await expect(apply).toBeEnabled();
  await expect.poll(colors).not.toEqual(firstPreview);
  const previewColors = await colors();
  const unchangedSource = await source();
  await page.mouse.move(0, 0);
  await expect.poll(colors).toEqual(originalColors);
  expect(await source()).toBe(unchangedSource);
  await expect(light.getByLabel("Name", { exact: true })).toHaveValue(
    "Preserve this draft",
  );
  await expect
    .poll(() => light.locator("html").evaluate(() => scrollY))
    .toBe(320);
  await expect
    .poll(() => dark.locator("html").evaluate(() => scrollY))
    .toBe(620);

  await apply.click();
  await expect.poll(source).not.toBe(unchangedSource);
  await page.mouse.move(0, 0);
  await expect.poll(colors).toEqual(previewColors);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(source).toBe(unchangedSource);
  await expect.poll(colors).toEqual(originalColors);
  await panel.getByRole("heading", { name: "Palette", exact: true }).hover();
  await expect.poll(colors).toEqual(previewColors);
  await panel
    .getByRole("button", { name: "Single color", exact: true })
    .click();
  await expect(panel).toHaveCount(0);
  await expect.poll(colors).toEqual(originalColors);
});

test("touch pointers do not leave a palette hover preview active", async ({
  page,
}) => {
  await page.goto("/#color=0.95,0.02,170,1&pickers=OKHCL");
  await page
    .getByRole("button", { name: "Create palette", exact: true })
    .click();
  await page.mouse.move(0, 0);
  const panel = page.getByRole("region", { name: "Palette", exact: true });
  await expect(
    panel.getByRole("button", { name: "Apply palette to preset", exact: true }),
  ).toBeEnabled();
  await panel.dispatchEvent("pointerover", { pointerType: "touch" });
  for (const mode of ["light", "dark"]) {
    await expect
      .poll(() =>
        page
          .frameLocator(`iframe[title="shadcn/ui ${mode} preview"]`)
          .locator("html")
          .evaluate((el) => el.style.getPropertyValue("--color-primary")),
      )
      .toBe("");
  }
});
