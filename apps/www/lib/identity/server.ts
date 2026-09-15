import "server-only";

import { api } from "@repo/backend/convex/_generated/api";
import { preloadAuthQuery } from "@/lib/auth/server";

/**
 * Preloads the account the request credential belongs to.
 *
 * The preloaded value seeds the client so a protected route's first paint
 * carries the real identity. `preloadAuthQuery` reads the request token itself,
 * so callers pass no credential and cannot pick the wrong one.
 */
export function preloadViewer() {
  return preloadAuthQuery(api.auth.queries.getCurrentUser, {});
}
