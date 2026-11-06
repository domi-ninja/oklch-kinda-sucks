import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { createReadStream, mkdirSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { presetShareSchema } from "./src/workspaceSchema.ts";

const databasePath = process.env.SHARE_DB_PATH ?? ".data/shares.sqlite";
if (databasePath !== ":memory:")
  mkdirSync(dirname(databasePath), { recursive: true });
const database = new DatabaseSync(databasePath);
database.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS shares (
    id TEXT PRIMARY KEY,
    snapshot TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) STRICT;
`);
const insertShare = database.prepare(
  "INSERT INTO shares (id, snapshot) VALUES (?, ?)",
);
const selectShare = database.prepare(
  "SELECT snapshot FROM shares WHERE id = ?",
);
const deleteShare = database.prepare("DELETE FROM shares WHERE id = ?");
function storedPreset(snapshot: string) {
  try {
    return presetShareSchema.parse(JSON.parse(snapshot));
  } catch {
    return null;
  }
}
for (const row of database.prepare("SELECT id, snapshot FROM shares").all()) {
  if (typeof row.snapshot !== "string" || !storedPreset(row.snapshot))
    deleteShare.run(row.id);
}
const staticRoot = resolve(process.env.STATIC_ROOT ?? "dist");
const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

async function readPresetShare(request: IncomingMessage) {
  if (!request.headers["content-type"]?.startsWith("application/json"))
    throw new HttpError(415, "Expected application/json");
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const bytes = Buffer.from(chunk);
    length += bytes.length;
    if (length > 1_048_576)
      throw new HttpError(413, "Preset is too large to share");
    chunks.push(bytes);
  }
  let data: unknown;
  try {
    data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
  const preset = presetShareSchema.safeParse(data);
  if (!preset.success) throw new HttpError(400, "Invalid preset");
  return preset.data;
}

async function handle(request: IncomingMessage, response: ServerResponse) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  const path = new URL(request.url ?? "/", "http://localhost").pathname;
  if (path === "/api/version" && request.method === "GET") {
    const html = await readFile(resolve(staticRoot, "index.html"), "utf8");
    const entry = html.match(/<script\b[^>]*\bsrc="([^"]+)"/)?.[1];
    if (!entry) throw new HttpError(503, "App is not built yet");
    json(response, 200, { entry });
    return;
  }
  if (path === "/api/health" && request.method === "GET") {
    database.prepare("SELECT 1").get();
    json(response, 200, { ok: true });
    return;
  }
  if (path === "/api/shares" && request.method === "POST") {
    const preset = await readPresetShare(request);
    const id = randomBytes(12).toString("base64url");
    insertShare.run(id, JSON.stringify(preset));
    json(response, 201, { id });
    return;
  }
  const share = path.match(/^\/api\/shares\/([\w-]{16})$/);
  if (share && request.method === "GET") {
    const row = selectShare.get(share[1]);
    if (!row || typeof row.snapshot !== "string")
      throw new HttpError(404, "Share link not found");
    const preset = storedPreset(row.snapshot);
    if (!preset) {
      deleteShare.run(share[1]);
      throw new HttpError(404, "Share link not found");
    }
    json(response, 200, preset);
    return;
  }
  if (path.startsWith("/api/")) throw new HttpError(404, "Not found");
  if (request.method !== "GET" && request.method !== "HEAD")
    throw new HttpError(405, "Method not allowed");
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    throw new HttpError(400, "Invalid path");
  }
  const file =
    path === "/" || /^\/share\/[\w-]{16}$/.test(path)
      ? resolve(staticRoot, "index.html")
      : resolve(staticRoot, `.${decoded}`);
  if (!file.startsWith(staticRoot + sep)) throw new HttpError(404, "Not found");
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) throw new HttpError(404, "Not found");
  response.writeHead(200, {
    "Content-Type": contentTypes[extname(file)] ?? "application/octet-stream",
    "Content-Length": info.size,
    "Cache-Control": path.startsWith("/assets/")
      ? "public, max-age=31536000, immutable"
      : extname(file) === ".html"
        ? "no-store"
        : "no-cache",
  });
  if (request.method === "HEAD") response.end();
  else
    createReadStream(file)
      .on("error", () => response.destroy())
      .pipe(response);
}

const server = createServer((request, response) => {
  void handle(request, response).catch((error) => {
    if (response.headersSent) {
      response.destroy();
      return;
    }
    if (!(error instanceof HttpError)) console.error(error);
    json(response, error instanceof HttpError ? error.status : 500, {
      error: error instanceof HttpError ? error.message : "Server error",
    });
  });
});
server.listen(
  Number(process.env.PORT ?? 3000),
  process.env.HOST ?? "0.0.0.0",
  () => {
    const address = server.address();
    console.log(
      `Color editor listening on port ${typeof address === "object" && address ? address.port : (process.env.PORT ?? 3000)}`,
    );
  },
);
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () =>
    server.close(() => {
      database.close();
      process.exit(0);
    }),
  );
}
