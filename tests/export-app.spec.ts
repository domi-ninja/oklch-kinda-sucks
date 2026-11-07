import { test, expect } from "@playwright/test";
import { unzipSync } from "fflate";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, join } from "node:path";
import { createServer } from "node:http";
import { once } from "node:events";
import { parseColor } from "../src/color";
import { baseTokens } from "../src/demo";
import { checkDemoForms } from "./demo-form-checks";

// Opt in because this check installs dependencies in a temporary exported project.
test("exported React project installs, builds, and runs every sample in both themes", async ({
  page,
  browserName,
}) => {
  test.skip(
    !process.env.EXPORT_BUILD || browserName !== "chromium",
    "Run with EXPORT_BUILD=1 and --project=chromium",
  );
  test.setTimeout(180_000);
  const directory = await mkdtemp(join(tmpdir(), "react-theme-export-"));
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      const path = join(
        directory,
        "dist",
        url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname),
      );
      const content = await readFile(path);
      const types: Record<string, string> = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
      };
      response.writeHead(200, {
        "Content-Type": types[extname(path)] ?? "application/octet-stream",
      });
      response.end(content);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  try {
    await page.goto("/");
    await page.getByRole("tab", { name: "Theme CSS", exact: true }).click();
    const editor = page.getByLabel("shadcn/ui theme stylesheet", {
      exact: true,
    });
    const source =
      (await editor.inputValue()).replace(
        baseTokens.primary,
        "oklch(0.6 0.2 30)",
      ) + "\n@theme { --color-ring: oklch(0.65 0.1 250); }";
    await editor.fill(source);
    await expect(
      page.getByRole("button", { name: "Export app", exact: true }),
    ).toBeEnabled();
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export app", exact: true }).click();
    const zip = unzipSync(await readFile((await (await downloading).path())!));
    for (const [name, content] of Object.entries(zip)) {
      const path = join(directory, name);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content);
    }
    expect(await readFile(join(directory, "src/theme.css"), "utf8")).toBe(
      source,
    );
    const run = promisify(execFile);
    await run("npm", ["install", "--no-audit", "--no-fund"], {
      cwd: directory,
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    await run("npm", ["run", "build"], {
      cwd: directory,
      timeout: 60_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Expected local HTTP port");
    const origin = `http://127.0.0.1:${address.port}`;
    const remoteRequests: string[] = [];
    page.on("request", (request) => {
      if (!request.url().startsWith(origin)) remoteRequests.push(request.url());
    });
    await page.goto(origin);
    for (const name of [
      "Website refresh",
      "Activity",
      "Project settings",
      "Team members",
    ])
      await expect(
        page.getByRole("heading", { name, exact: true }),
      ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Open project", exact: true }),
    ).toHaveCSS("background-color", "oklch(0.6 0.2 30)");
    await expect(
      page.getByRole("progressbar", { name: "Project progress", exact: true }),
    ).toHaveAttribute("aria-valuenow", "67");
    expect(
      parseColor(
        await page
          .locator("main")
          .evaluate((element) =>
            getComputedStyle(element).getPropertyValue("--color-ring").trim(),
          ),
      ),
    ).toEqual({ l: 0.65, c: 0.1, h: 250, a: 1 });
    await checkDemoForms(page);
    await page
      .getByRole("button", { name: "Open project", exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText("Project opened");
    await page.getByRole("button", { name: "Archive", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Project archived");
    await page.getByLabel("Name", { exact: true }).fill("New project");
    await page
      .getByRole("checkbox", { name: "Email notifications", exact: true })
      .uncheck();
    await page.getByLabel("Name", { exact: true }).press("Enter");
    await expect(page.getByRole("status")).toHaveText("Settings saved");
    await expect(
      page.getByRole("heading", { name: "New project", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: "Email notifications", exact: true }),
    ).not.toBeChecked();
    await page
      .getByRole("button", { name: "Remove member", exact: true })
      .click();
    await page
      .getByRole("alertdialog", { name: "Remove Alex Chen?", exact: true })
      .getByRole("button", { name: "Remove member", exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText("Member removed");
    await page
      .getByRole("button", { name: "Restore member", exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText("Member restored");
    await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    await expect(page.locator("main")).toHaveCSS(
      "background-color",
      "oklch(0.18 0.008 260)",
    );
    await page.reload();
    await expect(page.locator("html")).toHaveClass("dark");
    await page.getByRole("button", { name: "Light mode", exact: true }).click();
    await expect(page.locator("main")).toHaveCSS(
      "background-color",
      "oklch(0.985 0.002 180)",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(remoteRequests).toEqual([]);
  } finally {
    if (server.listening)
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    await rm(directory, { recursive: true, force: true });
  }
});
