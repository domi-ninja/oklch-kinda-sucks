import { test, expect } from "@playwright/test";
import { pickerModes } from "../src/workspace";

test("percentages accept select-all replacement and preserve intermediate typing in every mode", async ({
  page,
}) => {
  await page.goto("/");
  for (const mode of pickerModes) {
    await page.getByLabel("Picker mode", { exact: true }).selectOption(mode);
    const inputs = page.getByRole("spinbutton", { name: / percentage$/ });
    for (let index = 0; index < (await inputs.count()); index++) {
      const input = inputs.nth(index);
      await input.focus();
      await input.press("ControlOrMeta+A");
      await input.press("Backspace");
      await expect(input).toHaveValue("");
      await input.pressSequentially("100");
      await expect(input).toHaveValue("100");
      await input.press("Tab");
    }
    const alpha = page.getByRole("spinbutton", {
      name: "Alpha percentage",
      exact: true,
    });
    await alpha.fill("0.784");
    await alpha.press("ControlOrMeta+A");
    await alpha.pressSequentially("100");
    await expect(alpha).toHaveValue("100");
    await alpha.press("Enter");
    await expect(
      page.getByRole("spinbutton", { name: "Alpha value", exact: true }),
    ).toHaveValue("1");
    await alpha.fill("150");
    await expect(alpha).toHaveValue("150");
    await alpha.press("Tab");
    await expect(alpha).toHaveValue("100");
  }
});

test("native RGB inputs accept typing and the hex editor accepts pasted colors", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Picker mode", { exact: true }).selectOption("RGB");
  const red = page.getByRole("spinbutton", { name: "Red value", exact: true });
  await red.focus();
  await red.press("ControlOrMeta+A");
  await red.pressSequentially("255");
  await expect(red).toHaveValue("255");
  const hex = page.getByLabel("RGB value", { exact: true });
  await hex.fill("#123456");
  await hex.press("Enter");
  await expect(hex).toHaveValue("#123456");
  await expect(red).toHaveValue("18");
  await expect(
    page.getByRole("spinbutton", { name: "Green value", exact: true }),
  ).toHaveValue("52");
  await expect(
    page.getByRole("spinbutton", { name: "Blue value", exact: true }),
  ).toHaveValue("86");
});

test("swatches explain display gamut on hover and keyboard focus", async ({
  page,
}) => {
  await page.goto("/");
  const display = page.getByRole("button", {
    name: "Display color",
    exact: true,
  });
  const srgb = page.getByRole("button", { name: "sRGB preview", exact: true });
  await display.hover();
  await expect(page.getByRole("tooltip")).toContainText(
    "Macs, iPhones, and iPads",
  );
  await expect(page.getByRole("tooltip")).toContainText(
    "not an HDR brightness boost",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await srgb.focus();
  await expect(page.getByRole("tooltip")).toContainText("8-bit sRGB canvas");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
});
