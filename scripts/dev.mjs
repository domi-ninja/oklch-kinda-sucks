import { spawn } from "node:child_process";

const children = [
  spawn(process.execPath, ["--watch", "server.ts"], {
    stdio: "inherit",
    env: { ...process.env, PORT: "5174", HOST: "127.0.0.1" },
  }),
  spawn(
    "pnpm",
    ["exec", "vite", "--host", "::", "--port", "5173", "--strictPort"],
    { stdio: "inherit" },
  ),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  process.exitCode = code;
}
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => stop());
for (const child of children) child.once("exit", (code) => stop(code ?? 1));
