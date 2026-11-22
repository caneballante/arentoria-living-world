/**
 * Role resolution. Phase 1 has no accounts: it is a DM sandbox. If the environment
 * variable ARENTORIA_DM_TOKEN is set, the DM view requires a matching `x-dm-token`
 * header and everyone else is served the player view — the server, not the client,
 * decides what hidden state leaves the building. Phase 4 replaces this with real
 * authentication (e.g. Supabase Auth) and per-campaign membership roles.
 */
export type Role = "dm" | "player";

export function resolveRole(request: Request, requested: Role): Role {
  const token = process.env.ARENTORIA_DM_TOKEN;
  if (requested === "player") return "player";
  if (!token) return "dm";
  return request.headers.get("x-dm-token") === token ? "dm" : "player";
}
