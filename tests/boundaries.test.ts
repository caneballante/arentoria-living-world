/**
 * Architecture guard rails (pattern adapted from puget-sound-evidence-explorer's
 * separation test): the engine must stay independent of UI, persistence and world content.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []));
}
function imports(file: string): string[] {
  return [...readFileSync(file, "utf8").matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]!);
}
const root = resolve(__dirname, "..");

describe("module boundaries", () => {
  it("engine imports nothing but itself and zod", () => {
    for (const f of files(join(root, "src/engine"))) {
      for (const i of imports(f)) expect(i.startsWith("./") || i === "zod", `${f} imports ${i}`).toBe(true);
    }
  });

  it("world content depends only on the engine (no UI, no framework, no I/O)", () => {
    for (const f of files(join(root, "src/world"))) {
      for (const i of imports(f)) expect(i.startsWith(".") && !/react|next|views|app|narrative/.test(i), `${f} imports ${i}`).toBe(true);
    }
  });

  it("narrative, analysis and views never import React or Next", () => {
    for (const dir of ["src/narrative", "src/analysis", "src/views"]) {
      for (const f of files(join(root, dir))) for (const i of imports(f)) expect(/^(react|next)/.test(i), `${f} imports ${i}`).toBe(false);
    }
  });

  it("client components never import the engine, world or views directly", () => {
    for (const f of files(join(root, "src/app")).concat(files(join(root, "src/ui")))) {
      const code = readFileSync(f, "utf8");
      if (!code.startsWith('"use client"')) continue;
      for (const i of imports(f)) expect(/(^|\/)(engine|world|views|narrative|analysis)(\/|$)/.test(i) && !i.includes("/types"), `${f} imports ${i}`).toBe(false);
    }
  });
});
