import { test, expect } from "@playwright/test";

test("palette picking always previews both themes without writing the preset", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/#color=0.8,0.15,90,1&pickers=OKHCL");
  const frames = ["light", "dark"].map((mode) =>
    page.frameLocator(`iframe[data-preview-mode="${mode}"]`),
  );
  const colors = () =>
    Promise.all(
      frames.map((frame) =>
        frame.locator("html").evaluate(() => ({
          main: getComputedStyle(document.querySelector("main")!)
            .backgroundColor,
          primary: getComputedStyle(document.querySelector("#project")!)
            .backgroundColor,
          card: getComputedStyle(document.querySelector("section")!)
            .backgroundColor,
        })),
      ),
    );
  await expect(frames[0].locator("#project")).toBeVisible();
  for (const frame of frames)
    await expect(frame.locator("main")).toHaveCSS("background-color", /oklch/);
  const original = await colors();
  const source = () =>
    page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("oklch-workspace")!).source as string,
    );
  const originalSource = await source();
  await page
    .getByRole("button", { name: "Create palette", exact: true })
    .click();
  const apply = page.getByRole("button", {
    name: "Apply palette to preset",
    exact: true,
  });
  await expect(apply).toBeEnabled();
  await expect.poll(colors).not.toEqual(original);
  const preview = await colors();
  await page.mouse.move(0, 0);
  await expect.poll(colors).toEqual(preview);
  await page.getByRole("button", { name: "End", exact: true }).click();
  await page
    .getByLabel("OKLCH value", { exact: true })
    .fill("oklch(.3 .15 30)");
  await page.getByRole("button", { name: "Apply color", exact: true }).click();
  await page.mouse.move(0, 0);
  await expect(apply).toBeEnabled();
  await expect.poll(colors).not.toEqual(preview);
  expect(await source()).toBe(originalSource);
  await page.locator('.token[title="color-primary"]').click();
  await expect(
    page.getByRole("region", { name: "Palette", exact: true }),
  ).toHaveCount(0);
  await expect.poll(colors).toEqual(original);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(apply).toBeEnabled();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect.poll(colors).not.toEqual(original);
});

test("preset changes suspend palette preview until a picker is edited", async ({
  page,
}) => {
  await page.goto("/#color=0.8,0.15,90,1&pickers=OKHCL");
  await page
    .getByRole("button", { name: "Create palette", exact: true })
    .click();
  const apply = page.getByRole("button", {
    name: "Apply palette to preset",
    exact: true,
  });
  await expect(apply).toBeEnabled();
  const frame = page.frameLocator('iframe[data-preview-mode="light"]');
  const override = () =>
    frame
      .locator("html")
      .evaluate((el) => el.style.getPropertyValue("--color-primary"));
  await expect.poll(override).not.toBe("");
  await page.getByLabel("Preset", { exact: true }).selectOption({ index: 2 });
  await expect.poll(override).toBe("");
  await expect(
    page.getByRole("region", { name: "Palette", exact: true }),
  ).toBeVisible();
  await page.getByLabel("OKLCH value", { exact: true }).focus();
  await expect.poll(override).not.toBe("");
});

test("Improve contrast keeps card metadata readable for a white/cyan/blue palette", async ({
  page,
}) => {
  await page.goto(
    "/#color=1,0,0,1&pickers=OKHCL&palette=1&start=1,0,0,1&end=0.3,0.2,300,1&middle=0.9,0.2,180,1&point=start&steps=4&interpolation=OKHCL&mode=contrast&chroma=1",
  );
  await expect(
    page.getByRole("button", { name: "Apply palette to preset", exact: true }),
  ).toBeEnabled();
  const frame = page.frameLocator('iframe[data-preview-mode="light"]');
  const muted = frame.locator(".text-muted-foreground").first();
  await expect(muted).toHaveCSS("color", "oklch(0 0 0)");
  await expect(frame.locator("section").first()).toHaveCSS(
    "background-color",
    /^oklch\(1 0 /,
  );
  await expect(frame.locator("#preview-a11y-overlay")).toBeAttached();
  await expect(frame.locator(".summary")).not.toHaveText(/Checking/);
  await expect(
    frame.getByRole("button", { name: /1:1 contrast ratio/ }),
  ).toHaveCount(0);
});
