import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { chromium, expect } from "@playwright/test";

async function start(database) {
  const child = spawn(process.execPath, ["server.ts"], {
    env: {
      ...process.env,
      PORT: "0",
      HOST: "127.0.0.1",
      SHARE_DB_PATH: database,
    },
    stdio: ["ignore", "pipe", "inherit"],
  });
  const port = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) =>
      reject(new Error(`Server exited with ${code}`)),
    );
    child.stdout.on("data", (data) => {
      const match = data.toString().match(/listening on port (\d+)/);
      if (match) resolve(match[1]);
    });
  });
  return {
    url: `http://127.0.0.1:${port}`,
    async stop() {
      const exited = once(child, "exit");
      child.kill("SIGTERM");
      await exited;
    },
  };
}

test("preset links persist across restarts and unsupported records are purged", async () => {
  const directory = await mkdtemp(join(tmpdir(), "color-shares-"));
  const database = join(directory, "shares.sqlite");
  let server = await start(database);
  const preset = {
    version: 2,
    preset: {
      name: "Shared theme",
      source: "@theme { --color-primary: oklch(0.6 0.2 30); }",
    },
  };
  try {
    const invalid = await fetch(`${server.url}/api/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(invalid.status, 400);
    const created = await fetch(`${server.url}/api/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...preset,
        color: { l: 0.6, c: 0.2, h: 30, a: 1 },
        pickers: [],
      }),
    });
    assert.equal(created.status, 201);
    const { id } = await created.json();
    assert.match(id, /^[\w-]{16}$/);
    await server.stop();
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(database);
    try {
      assert.deepEqual(
        JSON.parse(
          db.prepare("SELECT snapshot FROM shares WHERE id = ?").get(id)
            .snapshot,
        ),
        preset,
      );
      db.prepare("INSERT INTO shares (id,snapshot) VALUES (?,?)").run(
        "obsoleteShare001",
        JSON.stringify({ version: 0 }),
      );
    } finally {
      db.close();
    }
    server = await start(database);
    const restored = await fetch(`${server.url}/api/shares/${id}`);
    assert.equal(restored.status, 200);
    assert.deepEqual(await restored.json(), preset);
    assert.equal(
      (await fetch(`${server.url}/api/shares/obsoleteShare001`)).status,
      404,
    );
    assert.equal(
      (
        await fetch(`${server.url}/api/shares/${id}`, {
          method: "PUT",
          body: "{}",
        })
      ).status,
      404,
    );
    assert.deepEqual(
      await (await fetch(`${server.url}/api/shares/${id}`)).json(),
      preset,
    );
  } finally {
    await server.stop();
    await rm(directory, { recursive: true, force: true });
  }
});

test("normal reloads fetch HTML and open tabs detect a new deployment", async () => {
  const directory = await mkdtemp(join(tmpdir(), "color-update-"));
  const server = await start(join(directory, "shares.sqlite"));
  const browser = await chromium.launch();
  try {
    const html = await fetch(server.url);
    assert.equal(html.headers.get("cache-control"), "no-store");
    const response = await fetch(`${server.url}/api/version`);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const { entry } = await response.json();
    assert.match(entry, /^\/assets\/index-[\w-]+\.js$/);
    assert.match(
      (await fetch(`${server.url}${entry}`)).headers.get("cache-control"),
      /immutable/,
    );
    const page = await browser.newPage();
    const initialCheck = page.waitForResponse((response) =>
      response.url().endsWith("/api/version"),
    );
    await page.goto(server.url);
    await initialCheck;
    await page
      .getByLabel("OKLCH value", { exact: true })
      .fill("oklch(0.6 0.2 30 / 50%)");
    await page
      .getByRole("button", { name: "Apply color", exact: true })
      .click();
    await page.route("**/api/version", (route) =>
      route.fulfill({ json: { entry: "/assets/index-next-release.js" } }),
    );
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      page.getByRole("button", { name: "Reload", exact: true }),
    ).toBeVisible();
    await page.unroute("**/api/version");
    await page.getByRole("button", { name: "Reload", exact: true }).click();
    await expect(page.getByLabel("OKLCH value", { exact: true })).toHaveValue(
      "oklch(0.6 0.2 30 / 50%)",
    );
    await expect(
      page.getByRole("button", { name: "Reload", exact: true }),
    ).toHaveCount(0);
  } finally {
    await browser.close();
    await server.stop();
    await rm(directory, { recursive: true, force: true });
  }
});
