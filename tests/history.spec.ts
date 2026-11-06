import { test, expect, type Page } from "@playwright/test";
import { defaultPresets } from "../src/presets";
import { createHistory, workspaceHistory } from "../src/workspaceHistory";
import { workspaceSchema, type Workspace } from "../src/workspaceSchema";

const initial: Workspace = {
  version: 1,
  saved: defaultPresets,
  active: defaultPresets[0].id,
  source: defaultPresets[0].source,
  color: { l: 0.6, c: 0.1, h: 180, a: 1 },
  selected: null,
  tab: "preview",
  width: "100%",
  pickers: [{ id: "first", mode: "OKHCL" }],
};

async function readWorkspace(page: Page) {
  return workspaceSchema.parse(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("oklch-workspace")!),
    ),
  );
}

test("history groups edits, drops cancelled gestures, preserves views and clears a redo branch", () => {
  const group = {};
  let history = createHistory(initial);
  for (const l of [0.5, 0.4, 0.3])
    history = workspaceHistory(history, {
      type: "change",
      group,
      record: true,
      change: (state) => ({ ...state, color: { ...state.color, l } }),
    });
  expect(history.past).toEqual([initial]);
  history = workspaceHistory(history, {
    type: "change",
    group: {},
    record: false,
    change: (state) => ({ ...state, tab: "source", width: "375px" }),
  });
  history = workspaceHistory(history, { type: "undo" });
  expect(history.present.color).toEqual(initial.color);
  expect(history.present.tab).toBe("source");
  expect(history.present.width).toBe("375px");
  history = workspaceHistory(history, { type: "redo" });
  expect(history.present.color.l).toBe(0.3);
  history = workspaceHistory(history, { type: "undo" });
  history = workspaceHistory(history, {
    type: "change",
    group: {},
    record: true,
    change: (state) => ({ ...state, source: "new branch" }),
  });
  expect(history.future).toEqual([]);
  expect(workspaceHistory(history, { type: "redo" })).toBe(history);
  let cancelled = createHistory(initial);
  for (const l of [0.5, initial.color.l])
    cancelled = workspaceHistory(cancelled, {
      type: "change",
      group,
      record: true,
      change: (state) => ({ ...state, color: { ...state.color, l } }),
    });
  expect(cancelled.past).toEqual([]);
  for (let i = 0; i < 120; i++)
    cancelled = workspaceHistory(cancelled, {
      type: "change",
      group: {},
      record: true,
      change: (state) => ({ ...state, source: String(i) }),
    });
  expect(cancelled.past).toHaveLength(100);
});

test("a color drag undoes color and theme together with every shortcut", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  const redo = page.getByRole("button", { name: "Redo", exact: true });
  await expect(undo).toBeDisabled();
  await page.locator('[data-theme-token="color-primary"]').click();
  await expect(undo).toBeDisabled();
  const before = await readWorkspace(page);
  const oldUrl = page.url();
  const plane = page.getByRole("group", {
    name: "OKHCL Chroma × Lightness plane",
    exact: true,
  });
  await plane.scrollIntoViewIfNeeded();
  const box = (await plane.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.4, {
    steps: 6,
  });
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7, {
    steps: 6,
  });
  await page.mouse.up();
  const after = await readWorkspace(page);
  expect(after.source).not.toBe(before.source);
  expect(after.color).not.toEqual(before.color);
  await plane.focus();
  await page.keyboard.press("Control+z");
  await expect
    .poll(() =>
      readWorkspace(page).then((state) => ({
        color: state.color,
        source: state.source,
      })),
    )
    .toEqual({ color: before.color, source: before.source });
  await expect(undo).toBeDisabled();
  await expect(redo).toBeEnabled();
  expect(page.url()).toBe(oldUrl);
  await page.keyboard.press("Control+y");
  await expect
    .poll(() => readWorkspace(page).then((state) => state.color))
    .toEqual(after.color);
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+Shift+z");
  await expect
    .poll(() => readWorkspace(page).then((state) => state.source))
    .toBe(after.source);
  await undo.click();
  await expect
    .poll(() => readWorkspace(page).then((state) => state.source))
    .toBe(before.source);
  await redo.click();
  await expect
    .poll(() => readWorkspace(page).then((state) => state.source))
    .toBe(after.source);
});

test("palette settings, picker changes and saved preset deletion share one undo history", async ({
  page,
}) => {
  await page.goto("/");
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  const redo = page.getByRole("button", { name: "Redo", exact: true });
  await page
    .getByRole("button", { name: "Create palette", exact: true })
    .click();
  const subdivisions = page.getByRole("spinbutton", {
    name: "Palette subdivisions",
    exact: true,
  });
  await subdivisions.fill("8");
  await subdivisions.fill("12");
  await undo.click();
  await expect(subdivisions).toHaveValue("4");
  await undo.click();
  await expect(
    page.getByRole("region", { name: "Palette", exact: true }),
  ).toHaveCount(0);
  await redo.click();
  await expect(subdivisions).toHaveValue("4");
  await page.getByRole("button", { name: "Add picker", exact: true }).click();
  await expect(redo).toBeDisabled();
  await undo.click();
  await expect(page.locator(".color-panel")).toHaveCount(1);
  page.once("dialog", (dialog) => dialog.accept("Undoable preset"));
  await page
    .getByRole("button", { name: "Create preset", exact: true })
    .click();
  const created = await readWorkspace(page);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete preset", exact: true })
    .click();
  await undo.click();
  await expect
    .poll(() =>
      readWorkspace(page).then((state) => ({
        active: state.active,
        saved: state.saved,
        source: state.source,
      })),
    )
    .toEqual({
      active: created.active,
      saved: created.saved,
      source: created.source,
    });
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem("oklch-presets")!)),
    )
    .toEqual(created.saved);
  await page.reload();
  await expect(undo).toBeDisabled();
  await expect(page.getByLabel("Preset", { exact: true })).toHaveValue(
    created.active,
  );
});

test("text keeps native undo and preview buttons forward global shortcuts", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add picker", exact: true }).click();
  const light = page.frameLocator('iframe[data-preview-mode="light"]');
  const input = light.getByLabel("Name", { exact: true });
  await input.focus();
  await input.press("End");
  await input.pressSequentially(" draft");
  await input.press("Control+z");
  await expect(input).toHaveValue("Website refresh");
  await expect(page.locator(".color-panel")).toHaveCount(2);
  const project = light.getByRole("button", {
    name: "Open project",
    exact: true,
  });
  await project.focus();
  await project.press("Control+z");
  await expect(page.locator(".color-panel")).toHaveCount(1);
  await project.press("Control+Shift+z");
  await expect(page.locator(".color-panel")).toHaveCount(2);
  await page.getByRole("tab", { name: "Theme CSS", exact: true }).click();
  const editor = page.getByLabel("shadcn/ui theme stylesheet", { exact: true });
  const before = await editor.inputValue();
  await editor.focus();
  await editor.press("Control+End");
  await editor.pressSequentially(" ");
  await editor.press("Control+z");
  await expect(editor).toHaveValue(before);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".color-panel")).toHaveCount(1);
  await expect(
    page.getByRole("tab", { name: "Theme CSS", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});
