/**
 * Seeded, splittable pseudo-random numbers.
 *
 * Design: there is no shared mutable RNG. Every random draw is taken from a stream
 * derived by hashing (seed, ...context keys), e.g. ("weather", day) or
 * ("event", eventId, day). Consequences:
 *
 *  - Reproducible: same seed + same state + same inputs => same outcome.
 *  - Order-independent: adding a new random draw in one subsystem never shifts the
 *    numbers seen by another subsystem.
 *  - Common random numbers: two business plans run with the same seed see the same
 *    weather and the same "dice" for each event check, so differences in outcome are
 *    caused by the plans, not by luck. This makes strategy comparison far more
 *    meaningful with fewer runs.
 *  - Snapshots need no RNG state: resuming from a saved day reproduces the same draws.
 *
 * Hash: cyrb128 (public domain). Generator: sfc32 (public domain, PractRand-tested).
 */

export type RngKey = string | number;

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform float in [min, max). */
  range(min: number, max: number): number;
  /** Uniform integer in [min, max] (inclusive). */
  int(min: number, max: number): number;
  /** True with probability p. */
  chance(p: number): boolean;
  /** Standard normal draw (Box–Muller). */
  normal(mean?: number, sd?: number): number;
  /** Pick one element uniformly. */
  pick<T>(items: readonly T[]): T;
  /** Pick by non-negative weights. Returns index. */
  weightedIndex(weights: readonly number[]): number;
}

function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703,
    h2 = 3144134277,
    h3 = 1013904242,
    h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a |= 0;
    b |= 0;
    c |= 0;
    d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

function makeRng(raw: () => number): Rng {
  // Warm up: discard a few outputs so similar seeds diverge immediately.
  for (let i = 0; i < 12; i++) raw();
  const rng: Rng = {
    next: raw,
    range: (min, max) => min + (max - min) * raw(),
    int: (min, max) => Math.floor(min + (max - min + 1) * raw()),
    chance: (p) => raw() < p,
    normal: (mu = 0, sd = 1) => {
      let u = 0;
      while (u === 0) u = raw();
      const v = raw();
      return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    pick: (items) => {
      if (!items.length) throw new Error("rng.pick on empty list");
      return items[Math.floor(raw() * items.length)]!;
    },
    weightedIndex: (weights) => {
      const total = weights.reduce((a, b) => a + Math.max(0, b), 0);
      if (total <= 0) return 0;
      let r = raw() * total;
      for (let i = 0; i < weights.length; i++) {
        r -= Math.max(0, weights[i]!);
        if (r < 0) return i;
      }
      return weights.length - 1;
    },
  };
  return rng;
}

/** Derive an independent, deterministic random stream for a given context. */
export function rngFor(seed: string, ...keys: RngKey[]): Rng {
  const [a, b, c, d] = cyrb128([seed, ...keys].join("␟"));
  return makeRng(sfc32(a, b, c, d));
}

/** Convenience: a single uniform draw for a context. */
export function uniformFor(seed: string, ...keys: RngKey[]): number {
  return rngFor(seed, ...keys).next();
}
