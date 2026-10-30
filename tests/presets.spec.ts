import { test, expect } from "@playwright/test";
import { defaultPresets, normalizePresets } from "../src/presets";

test("built-in definitions are restored and saved edits survive as custom copies", () => {
  const original = defaultPresets[0];
  const customSource = original.source + "\n@theme { --radius-lg: 2rem; }";
  const normalized = normalizePresets([
    { ...original, name: "Edited mint", source: customSource },
  ]);
  expect(normalized.find((p) => p.id === original.id)).toEqual(original);
  expect(normalized.find((p) => p.id === `custom:${original.id}`)?.source).toBe(
    customSource,
  );
  expect(normalized.slice(0, defaultPresets.length)).toEqual(defaultPresets);
  expect(normalizePresets(normalized)).toEqual(normalized);
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
    const frame = page.frameLocator(`iframe[title="Tailwind ${mode} preview"]`);
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
      .frameLocator('iframe[title="Tailwind light preview"]')
      .getByRole("button", { name: "Open project" }),
  ).toHaveCSS("background-color", "oklch(0.88 0.23 128)");
});
