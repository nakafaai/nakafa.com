import { Array as Arr, Record as Rec } from "effect";

/** The edge Workers read these server values through their own Config, so the GitHub stack always writes them. */
const EDGE_SECRET_NAMES = [
  "NAKAFA_CONVEX_SITE_URL",
  "NAKAFA_API_EDGE_SECRET",
  "NAKAFA_MCP_EDGE_SECRET",
] as const;

/**
 * The server values that the GitHub stack writes as Actions secrets: every bound
 * value that the environment sets, plus the edge values. A `VITE_` name is public,
 * and the client bundle inlines it, so it is never a secret.
 */
export const serverSecretNames = (
  environment: Readonly<Record<string, string | undefined>>
) =>
  Arr.filter(
    Arr.dedupe([
      ...Rec.keys(Rec.filter(environment, (value) => value !== undefined)),
      ...EDGE_SECRET_NAMES,
    ]),
    (name) => !name.startsWith("VITE_")
  );
