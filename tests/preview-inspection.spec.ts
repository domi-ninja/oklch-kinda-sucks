import { test, expect } from "@playwright/test";

test("preview hover connects real theme colors without changing the editor", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  const light = page.frameLocator('iframe[data-preview-mode="light"]');
  const dark = page.frameLocator('iframe[data-preview-mode="dark"]');
  await expect(light.locator("main")).toHaveCSS(
    "background-color",
    "oklch(0.985 0.002 180)",
  );
  const before = await page.evaluate(() => ({
    url: location.href,
    workspace: localStorage.getItem("oklch-workspace"),
  }));
  const highlight = (name: string) =>
    page.locator(`[data-theme-token="${name}"][data-preview-highlight]`);
  const connection = (name: string) =>
    page.locator(`[data-connection-token="--${name}"]`);
  const project = light.getByRole("button", {
    name: "Open project",
    exact: true,
  });
  await project.hover();
  await expect(highlight("color-primary")).toHaveCount(1);
  await expect(highlight("color-primary-foreground")).toHaveCount(1);
  await expect(connection("color-primary")).toHaveCount(1);
  await expect(connection("color-primary-foreground")).toHaveCount(1);
  await expect(page.locator(".preview-connections")).toHaveCSS(
    "pointer-events",
    "none",
  );
  const target = await page
    .locator('[data-theme-token="color-primary"] .token-swatch')
    .boundingBox();
  expect(target).not.toBeNull();
  await expect(connection("color-primary").locator("circle")).toHaveAttribute(
    "cx",
    String(target!.x + target!.width / 2),
  );
  expect(
    await page.evaluate(() => ({
      url: location.href,
      workspace: localStorage.getItem("oklch-workspace"),
    })),
  ).toEqual(before);
  await project.click();
  await expect(light.getByRole("status")).toHaveText("Project opened");
  await page.getByRole("button", { name: "Add picker", exact: true }).hover();
  await expect(page.locator(".preview-connections")).toHaveCount(0);
  await expect(page.locator("[data-preview-highlight]")).toHaveCount(0);

  await dark.getByText("Website refresh", { exact: true }).hover();
  await expect(highlight("dark / color-card")).toHaveCount(1);
  await expect(highlight("dark / color-card-foreground")).toHaveCount(1);
  await expect(highlight("color-card")).toHaveCount(0);
  await dark.getByRole("button", { name: "Open project", exact: true }).hover();
  await expect(highlight("color-primary")).toHaveCount(1);
  await expect(highlight("color-primary-foreground")).toHaveCount(1);
  await dark.getByRole("button", { name: "Archive", exact: true }).hover();
  await expect(highlight("dark / color-muted")).toHaveCount(1);
  await expect(highlight("dark / color-border")).toHaveCount(1);

  await page.getByRole("button", { name: "Add picker", exact: true }).hover();
  await light.getByLabel("Name", { exact: true }).focus();
  await expect(highlight("color-background")).toHaveCount(1);
  await expect(highlight("color-foreground")).toHaveCount(1);
  await expect(highlight("color-primary")).toHaveCount(1);
  await expect(light.getByLabel("Name", { exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Add picker", exact: true }).focus();
  await expect(page.locator(".preview-connections")).toHaveCount(0);
});
