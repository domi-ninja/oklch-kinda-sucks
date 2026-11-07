import { expect, type FrameLocator, type Page } from "@playwright/test";

// Exercise the same contract in the sandboxed HTML preview and downloaded React app.
export async function checkDemoForms(root: Page | FrameLocator) {
  const name = root.getByLabel("Name", { exact: true });
  const heading = root.locator("#project-heading");
  const savedName = await heading.textContent();
  await name.fill("   ");
  await name.press("Enter");
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(name).toHaveAttribute("aria-describedby", "project-name-error");
  await expect(root.getByRole("alert")).toHaveText("Enter a project name.");
  await expect(name).toBeFocused();
  await expect(heading).toHaveText(savedName!);
  await name.fill("Updated project");
  await name.press("Enter");
  await expect(heading).toHaveText("Updated project");
  await expect(name).toHaveAttribute("aria-invalid", "false");
  await expect(root.getByRole("status")).toHaveText("Settings saved");

  const trigger = root.getByRole("button", {
    name: "Edit notification email",
    exact: true,
  });
  await trigger.click();
  const dialog = root.getByRole("dialog", {
    name: "Notification email",
    exact: true,
  });
  const email = dialog.getByRole("textbox", {
    name: "Email address",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(email).toBeFocused();
  await email.press("Shift+Tab");
  await root.locator("body").evaluate((body) => {
    const active = body.ownerDocument.activeElement;
    if (!active?.closest('dialog,[role="dialog"]'))
      throw new Error("Focus escaped the email dialog");
  });
  await email.focus();
  await email.fill("not-an-email");
  await email.press("Tab");
  await expect(dialog.getByRole("alert")).toHaveText(
    "Include an @ sign in the email address.",
  );
  await expect(email).toHaveAttribute(
    "aria-describedby",
    "notification-email-error",
  );
  await dialog.getByRole("button", { name: "Save email", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(email).toBeFocused();
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(dialog.getByRole("alert")).toHaveText(
    "Include an @ sign in the email address.",
  );
  await email.fill("name@");
  await dialog.getByRole("button", { name: "Save email", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Enter a valid email address, such as name@example.com.",
  );
  await email.fill("");
  await dialog.getByRole("button", { name: "Save email", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Enter an email address.");
  await email.fill("jamie+updates@example.com");
  await email.press("Enter");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(root.getByRole("status")).toHaveText("Notification email saved");
  await expect(
    root.getByText("jamie+updates@example.com", { exact: true }),
  ).toBeVisible();
  await trigger.click();
  await expect(email).toHaveValue("jamie+updates@example.com");
  await email.fill("cancelled@example.net");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(email).toHaveValue("jamie+updates@example.com");
  await email.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();

  const remove = root.getByRole("button", {
    name: "Remove member",
    exact: true,
  });
  await remove.click();
  const confirmation = root.getByRole("alertdialog", {
    name: "Remove Alex Chen?",
    exact: true,
  });
  await expect(confirmation).toBeVisible();
  await expect(
    confirmation.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeFocused();
  await confirmation
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(remove).toBeFocused();
  await expect(root.getByText("Alex Chen", { exact: true })).toBeVisible();
  await remove.click();
  await confirmation.press("Escape");
  await expect(confirmation).toHaveCount(0);
  await expect(remove).toBeFocused();
  await remove.click();
  await confirmation
    .getByRole("button", { name: "Remove member", exact: true })
    .click();
  await expect(confirmation).toHaveCount(0);
  await expect(root.getByText("Alex Chen", { exact: true })).not.toBeVisible();
  const restore = root.getByRole("button", {
    name: "Restore member",
    exact: true,
  });
  await expect(restore).toBeFocused();
  await restore.click();
  await expect(root.getByText("Alex Chen", { exact: true })).toBeVisible();
  await expect(root.getByRole("status")).toHaveText("Member restored");
}
