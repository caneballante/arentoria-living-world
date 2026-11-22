/** Client-side formatting helpers (duplicated from the engine so the client bundle never imports engine code). */
export function formatCp(cp: number): string {
  const sign = cp < 0 ? "−" : "";
  const abs = Math.round(Math.abs(cp));
  if (abs >= 100) {
    const gp = abs / 100;
    return `${sign}${gp >= 100 ? Math.round(gp).toLocaleString() : Math.round(gp * 10) / 10} gp`;
  }
  if (abs >= 10 && abs % 10 === 0) return `${sign}${abs / 10} sp`;
  return `${sign}${abs} cp`;
}

export const gp = (cp: number) => Math.round(cp) / 100;
export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const r1 = (x: number) => Math.round(x * 10) / 10;
