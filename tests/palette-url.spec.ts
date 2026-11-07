import { test, expect } from "@playwright/test";
import { restoreWorkspaceHash, workspaceHash } from "../src/workspace";
import { defaultPresets } from "../src/presets";
import type { Workspace } from "../src/workspaceSchema";

const initial: Workspace = {
  version: 1,
  saved: defaultPresets,
  active: defaultPresets[0].id,
  source: defaultPresets[0].source,
  color: { l: 0.9, c: 0.03, h: 100, a: 1 },
  selected: null,
  tab: "preview",
  width: "100%",
  pickers: [{ id: "a", mode: "OKHCL" }],
};

test("palette URL restores controls, all colors, mode, chroma, and token assignments", () => {
  const state: Workspace = {
    ...initial,
    palette: {
      end: { l: 0.2, c: 0.1, h: 280, a: 0.7 },
      middle: { l: 0.7, c: 0.15, h: 170, a: 0.8 },
      endpoint: "middle",
      subdivisions: 16,
      mode: "HSL",
      theme: {
        mapping: "contrast",
        chroma: 1.47,
        positions: { light: { card: 0.25 }, dark: { primary: 0.75 } },
      },
    },
  };
  const hash = workspaceHash(state);
  const restored = restoreWorkspaceHash(
    { ...initial, source: "recipient stylesheet" },
    hash,
  );
  expect(restored.palette).toEqual(state.palette);
  expect(restored.color).toEqual(state.color);
  expect(restored.source).toBe("recipient stylesheet");
  expect(
    restoreWorkspaceHash(restored, "#color=.4,.1,50,1&pickers=RGB").palette,
  ).toBeUndefined();
  expect(
    restoreWorkspaceHash(initial, "#color=.4,.1,50,1&palette=1&steps=999")
      .palette,
  ).toBeUndefined();
});

test("copying the address restores a curved palette in a fresh browser", async ({
  page,
  browser,
}) => {
  await page.goto("/#color=.9,.03,100,1&pickers=OKHCL");
  await page
    .getByRole("button", { name: "Create palette", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add middle color", exact: true })
    .click();
  await page.getByLabel("Palette subdivisions", { exact: true }).fill("12");
  await page
    .getByLabel("Palette interpolation", { exact: true })
    .selectOption("HSL");
  await page
    .getByLabel("Harmonization", { exact: true })
    .selectOption("contrast");
  await page
    .getByRole("slider", { name: "Palette chroma", exact: true })
    .fill("0.5");
  await page
    .getByLabel("OKLCH value", { exact: true })
    .fill("oklch(.7 .15 170 / .8)");
  await page.getByRole("button", { name: "Apply color", exact: true }).click();
  const url = page.url();
  const context = await browser.newContext();
  const fresh = await context.newPage();
  await fresh.goto(url);
  await expect(
    fresh.getByLabel("Palette subdivisions", { exact: true }),
  ).toHaveValue("12");
  await expect(
    fresh.getByLabel("Palette interpolation", { exact: true }),
  ).toHaveValue("HSL");
  await expect(fresh.getByLabel("Harmonization", { exact: true })).toHaveValue(
    "contrast",
  );
  await expect(
    fresh.getByRole("slider", { name: "Palette chroma", exact: true }),
  ).toHaveAttribute("aria-valuetext", "75%");
  await expect(
    fresh.getByRole("button", { name: "Middle", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    fresh
      .getByRole("list", { name: "Palette colors", exact: true })
      .getByRole("listitem"),
  ).toHaveCount(13);
  await expect(
    fresh.getByRole("button", { name: "Apply palette to preset", exact: true }),
  ).toBeEnabled();
  await fresh.locator('.token[title="color-primary"]').click();
  expect(
    new URLSearchParams(new URL(fresh.url()).hash.slice(1)).has("palette"),
  ).toBe(false);
  await context.close();
});
