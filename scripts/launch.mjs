#!/usr/bin/env node
/**
 * One-step launcher: installs dependencies if needed, picks a free port, starts the
 * app and opens it in your browser. Works on Windows, macOS and Linux.
 *
 *   npm run launch            development mode (picks up code changes)
 *   npm run launch -- --prod  production build (faster pages, rebuilds first)
 *   npm run launch -- --no-open --port 4000
 *
 * Or double-click "Launch Arentoria.cmd" (Windows) / "Launch Arentoria.command" (macOS).
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const prod = args.includes("--prod");
const open = !args.includes("--no-open");
const portArg = args.indexOf("--port");
const preferredPort = portArg >= 0 ? Number(args[portArg + 1]) : 3000;
const isWin = process.platform === "win32";
const npm = isWin ? "npm.cmd" : "npm";

function say(msg) {
  console.log(`\x1b[33m[arentoria]\x1b[0m ${msg}`);
}

function fail(msg) {
  console.error(`\x1b[31m[arentoria]\x1b[0m ${msg}`);
  process.exit(1);
}

// 1. Node version
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 12)) fail(`Node.js 22.12 or newer is required (you have ${process.versions.node}). Get it from https://nodejs.org`);

// 2. Dependencies
const marker = join(root, "node_modules", ".package-lock.json");
const lock = join(root, "package-lock.json");
const needsInstall = !existsSync(marker) || (existsSync(lock) && statSync(lock).mtimeMs > statSync(marker).mtimeMs);
if (needsInstall) {
  say("Installing dependencies (first run only; takes a minute)…");
  const r = spawnSync(npm, ["install", "--no-audit", "--no-fund"], { cwd: root, stdio: "inherit", shell: isWin });
  if (r.status !== 0) fail("npm install failed — see the messages above.");
}

const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");

// 3. Production build if requested
if (prod) {
  say("Building the production version…");
  const r = spawnSync(process.execPath, [nextBin, "build"], { cwd: root, stdio: "inherit" });
  if (r.status !== 0) fail("Build failed — see the messages above.");
}

// 4. Free port
function portFree(port) {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port, "0.0.0.0");
  });
}
let port = preferredPort;
while (!(await portFree(port))) {
  if (port - preferredPort > 20) fail(`No free port found between ${preferredPort} and ${port}.`);
  port++;
}
if (port !== preferredPort) say(`Port ${preferredPort} is busy; using ${port}.`);

// 5. Start the server
const url = `http://localhost:${port}`;
say(`Starting ${prod ? "production" : "development"} server…`);
const child = spawn(process.execPath, [nextBin, prod ? "start" : "dev", "-p", String(port)], {
  cwd: root,
  stdio: ["inherit", "pipe", "inherit"],
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
});
child.stdout.on("data", (d) => process.stdout.write(d));
child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));

// 6. Wait until it answers (this also compiles the first page in dev mode), then open the browser
const deadline = Date.now() + 120_000;
while (Date.now() < deadline) {
  try {
    const res = await fetch(url);
    if (res.ok) break;
  } catch {
    /* not up yet */
  }
  await new Promise((r) => setTimeout(r, 500));
}
say(`Ready: ${url}   (press Ctrl+C in this window to stop)`);
if (open) {
  const page = `${url}/campaign`; // the DM's campaign desk; the sandbox is one click away
  const opener = isWin ? ["cmd", ["/c", "start", "", page]] : process.platform === "darwin" ? ["open", [page]] : ["xdg-open", [page]];
  try {
    spawn(opener[0], opener[1], { stdio: "ignore", detached: true }).on("error", () => say(`Open ${url} in your browser.`)).unref();
  } catch {
    say(`Open ${url} in your browser.`);
  }
}
