import { test, expect } from "@playwright/test";
import { checkDemoForms } from "./demo-form-checks";

test("light and dark previews validate forms and manage modal focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  for (const mode of ["light", "dark"]) {
    const frame = page.frameLocator(`iframe[data-preview-mode="${mode}"]`);
    await expect(frame.locator("main")).toHaveCSS("background-color", /oklch/);
    await checkDemoForms(frame);
    const name = frame.getByLabel("Name", { exact: true });
    await name.fill(" ");
    await name.press("Enter");
    await name.hover();
    await expect(
      page.locator(
        '[data-theme-token="color-destructive"][data-preview-highlight]',
      ),
    ).toHaveCount(1);
    await name.fill("Updated project");
    await expect(
      page.locator(
        '[data-theme-token="color-destructive"][data-preview-highlight]',
      ),
    ).toHaveCount(0);
    await name.press("Enter");
  }
});

test("preview dialogs fit mobile and retain drafts over theme updates", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const frame = page.frameLocator('iframe[data-preview-mode="light"]');
  await expect(frame.locator("main")).toHaveCSS("background-color", /oklch/);
  await frame
    .getByRole("button", { name: "Edit notification email", exact: true })
    .click();
  const dialog = frame.getByRole("dialog", {
    name: "Notification email",
    exact: true,
  });
  await dialog
    .getByRole("textbox", { name: "Email address", exact: true })
    .fill("draft@example.com");
  await page.locator('[data-theme-token="color-background"]').click();
  await page
    .getByLabel("OKLCH value", { exact: true })
    .fill("oklch(0.9 0.02 90)");
  await page.getByRole("button", { name: "Apply color", exact: true }).click();
  await expect(dialog).toHaveCSS("background-color", "oklch(0.9 0.02 90)");
  await expect(
    dialog.getByRole("textbox", { name: "Email address", exact: true }),
  ).toHaveValue("draft@example.com");
  const bounds = await dialog.evaluate((el) => {
    const box = el.getBoundingClientRect();
    return {
      fits:
        box.x >= 0 &&
        box.right <= innerWidth &&
        box.y >= 0 &&
        box.bottom <= innerHeight,
      overflow: el.scrollWidth > el.clientWidth,
    };
  });
  expect(bounds).toEqual({ fits: true, overflow: false });
});
