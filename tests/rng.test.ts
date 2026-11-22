import { describe, expect, it } from "vitest";
import { mean, stdev } from "../src/engine/math";
import { rngFor, uniformFor } from "../src/engine/rng";

describe("seeded random streams", () => {
  it("reproduces identical sequences for identical seed and keys", () => {
    const a = rngFor("seed", "weather", 12);
    const b = rngFor("seed", "weather", 12);
    const xs = Array.from({ length: 50 }, () => a.next());
    const ys = Array.from({ length: 50 }, () => b.next());
    expect(xs).toEqual(ys);
  });

  it("produces different streams for different seeds or keys", () => {
    expect(uniformFor("seed-a", "x", 1)).not.toBe(uniformFor("seed-b", "x", 1));
    expect(uniformFor("seed", "x", 1)).not.toBe(uniformFor("seed", "x", 2));
    expect(uniformFor("seed", "event", "theft", 5)).not.toBe(uniformFor("seed", "event", "absence", 5));
  });

  it("is roughly uniform and normal where expected", () => {
    const u = Array.from({ length: 4000 }, (_, i) => uniformFor("dist", i));
    expect(mean(u)).toBeGreaterThan(0.47);
    expect(mean(u)).toBeLessThan(0.53);
    expect(Math.min(...u)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...u)).toBeLessThan(1);
    const r = rngFor("normal");
    const z = Array.from({ length: 4000 }, () => r.normal());
    expect(Math.abs(mean(z))).toBeLessThan(0.08);
    expect(stdev(z)).toBeGreaterThan(0.92);
    expect(stdev(z)).toBeLessThan(1.08);
  });

  it("supports bounded integer and weighted draws", () => {
    const r = rngFor("ints");
    for (let i = 0; i < 500; i++) {
      const v = r.int(1, 3);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(3);
    }
    const counts = [0, 0, 0];
    for (let i = 0; i < 3000; i++) counts[r.weightedIndex([1, 0, 3])]!++;
    expect(counts[1]).toBe(0);
    expect(counts[2]! / counts[0]!).toBeGreaterThan(2.4);
  });
});
