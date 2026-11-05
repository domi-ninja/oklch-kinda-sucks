import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";

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

test("share snapshots survive a server restart; invalid writes leave no share", async () => {
  const directory = await mkdtemp(join(tmpdir(), "color-shares-"));
  const database = join(directory, "shares.sqlite");
  let server = await start(database);
  const snapshot = {
    version: 1,
    active: "",
    source: "@theme { --color-primary: oklch(0.6 0.2 30); }",
    color: { l: 0.6, c: 0.2, h: 30, a: 1 },
    selected: null,
    tab: "preview",
    width: "100%",
    pickers: [{ id: "one", mode: "HSL" }],
    preset: null,
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
      body: JSON.stringify(snapshot),
    });
    assert.equal(created.status, 201);
    const { id } = await created.json();
    assert.match(id, /^[\w-]{16}$/);
    await server.stop();
    server = await start(database);
    const restored = await fetch(`${server.url}/api/shares/${id}`);
    assert.equal(restored.status, 200);
    assert.deepEqual(await restored.json(), snapshot);
    assert.equal(
      (await fetch(`${server.url}/api/shares/missing-share-id`)).status,
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
      snapshot,
    );
  } finally {
    await server.stop();
    await rm(directory, { recursive: true, force: true });
  }
});
