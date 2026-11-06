import { test, expect } from "@playwright/test";
import { defaultPresets } from "../src/presets";
import {
  createPresetShare,
  importPresetShare,
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

test("sharing carries only the current preset and import preserves the receiver's local workspace", () => {
  const privatePreset = {
    id: "private",
    name: "Unrelated palette",
    source: "private stylesheet",
  };
  const share = createPresetShare({
    ...workspace,
    saved: [...workspace.saved, privatePreset],
  });
  expect(share).toEqual({
    version: 2,
    preset: { name: "My palette", source: workspace.source },
  });
  const receiver = {
    ...workspace,
    color: { l: 0.8, c: 0.1, h: 90, a: 1 },
    palette: {
      end: { l: 0.3, c: 0.1, h: 20, a: 1 },
      endpoint: "end",
      subdivisions: 3,
      mode: "RGB",
    } as const,
    modeGeneration: {
      from: "dark",
      background: 0.98,
      contrast: 1.1,
      chroma: 0.9,
    } as const,
    saved: [
      { id: "custom", name: "Existing palette", source: "existing stylesheet" },
      privatePreset,
    ],
  };
  const imported = importPresetShare(share, receiver);
  expect(imported.saved).toContainEqual(receiver.saved[0]);
  expect(imported.saved).toContainEqual(privatePreset);
  expect(imported.active).not.toBe("custom");
  expect(
    imported.saved.find((preset) => preset.id === imported.active)?.source,
  ).toBe(workspace.source);
  expect(imported.source).toBe(workspace.source);
  expect(imported.color).toEqual(receiver.color);
  expect(imported.palette).toEqual(receiver.palette);
  expect(imported.modeGeneration).toEqual(receiver.modeGeneration);
  expect(imported.pickers).toEqual(receiver.pickers);
  expect(imported.width).toBe(receiver.width);
  expect(imported.tab).toBe(receiver.tab);
  expect(importPresetShare(share, imported)).toEqual(imported);
});
