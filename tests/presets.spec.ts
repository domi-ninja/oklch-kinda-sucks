import { test, expect } from "@playwright/test";
import { defaultPresets } from "../src/presets";

test("discard restores built-in and saved custom presets, the selected picker, and browser storage", async ({
  page,
}) => {
  await page.goto("/");
  const discard = page.getByRole("button", {
    name: "Discard changes",
    exact: true,
  });
  const picker = page.getByLabel("OKLCH value", { exact: true });
  const preview = page
    .frameLocator('iframe[title="shadcn/ui light preview"]')
    .getByRole("button", { name: "Open project", exact: true });
  await page.locator('.token[title="color-primary"]').click();
  await picker.fill("oklch(0.7 0.2 45)");
  await page.getByRole("button", { name: "Apply color", exact: true }).click();
  await expect(preview).toHaveCSS("background-color", "oklch(0.7 0.2 45)");
  await page.setViewportSize({ width: 390, height: 844 });
  await discard.click();
  await expect(picker).toHaveValue("oklch(0.72 0.16 165 / 100%)");
  await expect(preview).toHaveCSS("background-color", "oklch(0.72 0.16 165)");
  await picker.fill("oklch(0.7 0.2 45)");
  await page.getByRole("button", { name: "Apply color", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept("My saved theme"));
  await page.getByRole("button", { name: "Save as new", exact: true }).click();
  await picker.fill("oklch(0.6 0.1 230)");
  await page.getByRole("button", { name: "Apply color", exact: true }).click();
  await expect(preview).toHaveCSS("background-color", "oklch(0.6 0.1 230)");
  await page.locator(".preset-actions").scrollIntoViewIfNeeded();
  await expect(page.locator(".preset-actions")).toBeInViewport();
  expect(
    await page
      .locator(".preset-actions")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await discard.click();
  await expect(picker).toHaveValue("oklch(0.7 0.2 45 / 100%)");
  await expect(preview).toHaveCSS("background-color", "oklch(0.7 0.2 45)");
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel("Preset", { exact: true }).locator("option:checked"),
  ).toHaveText("My saved theme");
  await expect(picker).toHaveValue("oklch(0.7 0.2 45 / 100%)");
  await expect(preview).toHaveCSS("background-color", "oklch(0.7 0.2 45)");
});

test("discard removes added tokens and detaches their picker from the restored preset", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Theme CSS", exact: true }).click();
  const stylesheet = page.getByLabel("shadcn/ui theme stylesheet", {
    exact: true,
  });
  const saved = await stylesheet.inputValue();
  await stylesheet.fill(
    `${saved}\n@theme { --color-added: oklch(0.6 0.1 20); }`,
  );
  await page.locator('.token[title="color-added"]').click();
  await page
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await expect(stylesheet).toHaveValue(saved);
  await page
    .getByLabel("OKLCH value", { exact: true })
    .fill("oklch(0.5 0.1 30)");
  await page.getByRole("button", { name: "Apply color", exact: true }).click();
  await expect(stylesheet).toHaveValue(saved);
});

test("built-ins stay protected and Brutalist can be saved as an editable copy", async ({
  page,
}) => {
  await page.goto("/");
  const selector = page.getByLabel("Preset", { exact: true });
  for (const preset of defaultPresets) {
    await selector.selectOption(preset.id);
    await expect(
      page.getByRole("button", { name: "Rename preset" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Delete preset" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Save as new", exact: true }),
    ).toBeEnabled();
  }
  await selector.selectOption("brutalist");
  for (const mode of ["light", "dark"]) {
    const frame = page.frameLocator(
      `iframe[title="shadcn/ui ${mode} preview"]`,
    );
    await expect(frame.getByRole("button", { name: "Open project" })).toHaveCSS(
      "border-radius",
      "0px",
    );
    await expect(frame.getByRole("button", { name: "Open project" })).toHaveCSS(
      "background-color",
      "oklch(0.88 0.23 128)",
    );
    await expect(frame.locator("section").first()).toHaveCSS(
      "border-top-width",
      "2px",
    );
    await expect(frame.locator("section").first()).toHaveCSS(
      "box-shadow",
      /5px 5px/,
    );
  }
  await page
    .locator(".token")
    .filter({ has: page.locator(".token-name", { hasText: /^primary$/ }) })
    .click();
  await page
    .getByLabel("OKLCH value", { exact: true })
    .fill("oklch(0.7 0.2 45)");
  await page.getByRole("button", { name: "Apply color", exact: true }).click();
  page.once("dialog", (d) => d.accept("My brutalist"));
  await page.getByRole("button", { name: "Save as new", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Delete preset" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Rename preset" }),
  ).toBeEnabled();
  await page.reload();
  await expect(selector.locator("option:checked")).toHaveText("My brutalist");
  await selector.selectOption("brutalist");
  await expect(
    page
      .frameLocator('iframe[title="shadcn/ui light preview"]')
      .getByRole("button", { name: "Open project" }),
  ).toHaveCSS("background-color", "oklch(0.88 0.23 128)");
});
