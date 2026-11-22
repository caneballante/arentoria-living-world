/** Small numeric helpers shared by the engine. Pure, no I/O. */

export const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

export const clamp01 = (value: number): number => clamp(value, 0, 1);

/** Clamp to the 0..100 range used by hidden-state variables. */
export const clamp100 = (value: number): number => clamp(value, 0, 100);

export const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);

export const mean = (values: readonly number[]): number => (values.length ? sum(values) / values.length : 0);

/** Round to a fixed number of decimals (used to keep logs and ledgers readable and stable). */
export const round = (value: number, decimals = 0): number => {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
};

/** Linear interpolation. */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Percentile of a numeric sample using linear interpolation (p in 0..1). */
export const percentile = (values: readonly number[], p: number): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = clamp(p, 0, 1) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lerp(sorted[lo]!, sorted[hi]!, idx - lo);
};

export const stdev = (values: readonly number[]): number => {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(sum(values.map((v) => (v - m) ** 2)) / (values.length - 1));
};

/** Format copper pieces as a compact D&D currency string (1 gp = 10 sp = 100 cp). */
export const formatCp = (cp: number): string => {
  const sign = cp < 0 ? "-" : "";
  const abs = Math.round(Math.abs(cp));
  if (abs >= 100) {
    const gp = abs / 100;
    return `${sign}${gp >= 100 ? Math.round(gp) : round(gp, 1)} gp`;
  }
  if (abs >= 10 && abs % 10 === 0) return `${sign}${abs / 10} sp`;
  return `${sign}${abs} cp`;
};
