import { test, expect } from "@playwright/test";

for (const mode of ["light", "dark"])
  test(`${mode} contrast errors are marked at the component and clear when corrected`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    const frame = page.frameLocator(`iframe[data-preview-mode="${mode}"]`);
    const project = frame.locator("#project");
    await project.scrollIntoViewIfNeeded();
    const audit = frame.locator("#preview-a11y-overlay");
    await expect(audit).toHaveAttribute("data-a11y-failures", "0", {
      timeout: 15000,
    });
    await project.evaluate((el) => {
      el.style.backgroundColor = "rgb(120,120,120)";
      el.style.color = "rgb(121,121,121)";
    });
    const marker = frame
      .getByRole("button", {
        name: /Elements must meet minimum color contrast ratio thresholds/,
      })
      .first();
    await expect(marker).toBeVisible({ timeout: 15000 });
    await marker.hover();
    await expect(frame.locator("#tip")).toContainText("contrast");
    const markerBox = (await marker.boundingBox())!;
    const projectBox = (await project.boundingBox())!;
    expect(markerBox.y).toBeGreaterThanOrEqual(projectBox.y - 2);
    expect(markerBox.y).toBeLessThan(projectBox.y + projectBox.height);
    await project.evaluate((el) => {
      el.style.color = "white";
      el.style.backgroundColor = "black";
    });
    await expect(audit).toHaveAttribute("data-a11y-failures", "0", {
      timeout: 15000,
    });
    await expect(marker).toHaveCount(0);
  });
