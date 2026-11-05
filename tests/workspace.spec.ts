import { test, expect } from "@playwright/test";
import { defaultPresets } from "../src/presets";
import {
  colorFromHash,
  createSnapshot,
  encodeWorkspace,
  importSnapshot,
  workspaceStorageKey,
  type Workspace,
} from "../src/workspace";

const workspace: Workspace = {
  version: 1,
  saved: [
    ...defaultPresets,
    {
      id: "custom",
      name: "My palette",
      source: "@theme { --radius-lg: 2rem; }",
    },
  ],
  active: "custom",
  source: "@theme { --radius-lg: 3rem; }",
  color: { l: 0.6, c: 0.2, h: 30, a: 0.5 },
  selected: null,
  tab: "source",
  width: "375px",
  pickers: [
    { id: "first", mode: "RGB" },
    { id: "second", mode: "HSL" },
  ],
};

test("sharing excludes other presets and importing preserves the receiver's saved presets", () => {
  const privatePreset = {
    id: "private",
    name: "Unrelated palette",
    source: "private stylesheet",
  };
  const snapshot = createSnapshot({
    ...workspace,
    saved: [...workspace.saved, privatePreset],
  });
  expect(JSON.stringify(snapshot)).not.toContain(privatePreset.source);
  expect(snapshot.preset?.name).toBe("My palette");
  const receiver = {
    ...workspace,
    saved: [
      { id: "custom", name: "Existing palette", source: "existing stylesheet" },
      privatePreset,
    ],
  };
  const imported = importSnapshot(snapshot, receiver);
  expect(imported.saved).toContainEqual(receiver.saved[0]);
  expect(imported.saved).toContainEqual(privatePreset);
  expect(imported.active).not.toBe("custom");
  expect(
    imported.saved.find((preset) => preset.id === imported.active)?.source,
  ).toBe(snapshot.preset?.source);
  expect(imported.source).toBe(workspace.source);
  expect(colorFromHash("#0.6,0.2,30,50")).toEqual(workspace.color);
});

test("old workspace links migrate into browser storage and a color and picker URL", async ({
  page,
}) => {
  await page.goto(`/#s=${encodeWorkspace(workspace)}`);
  await expect(page.getByLabel("Picker mode", { exact: true })).toHaveCount(2);
  await expect(page.getByLabel("Tailwind theme stylesheet")).toHaveValue(
    workspace.source,
  );
  await expect(page).toHaveURL(/\/#color=0\.6,0\.2,30,0\.5&pickers=RGB,HSL$/);
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      workspaceStorageKey,
    ),
  ).toEqual(workspace);
  await page.reload();
  await expect(page.getByLabel("Tailwind theme stylesheet")).toHaveValue(
    workspace.source,
  );
  await expect(page.getByLabel("Preset", { exact: true })).toHaveValue(
    "custom",
  );
});
