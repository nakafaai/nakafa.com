/**
 * Central validator utilities for Convex backend.
 *
 * Re-exports convex-helpers utilities for easy access across the codebase.
 * Use these instead of manually constructing validators.
 *
 * @example
 * ```ts
 * import { doc, literals, nullable, vv } from "@repo/backend/convex/lib/validators";
 *
 * // Derive document validator from schema
 * const userDoc = doc(schema, "users");
 *
 * // Create union of literals (instead of v.union(v.literal("a"), v.literal("b")))
 * const status = literals("active", "inactive", "pending");
 *
 * // Create nullable validator (instead of v.union(v.null(), v.string()))
 * const optionalName = nullable(v.string());
 *
 * // Typed validators from main schema
 * const userId = vv.id("users");
 * ```
 */
export { omit, pick } from "convex-helpers";
export {
  doc,
  literals,
  nullable,
  partial,
  typedV,
} from "convex-helpers/validators";

import schema from "@repo/backend/convex/schema";
import { typedV } from "convex-helpers/validators";

/**
 * Typed validators bound to the main app schema.
 * Provides type-safe access to table IDs and document validators.
 *
 * @example
 * ```ts
 * // Type-safe ID validator
 * args: { userId: vv.id("users") }
 *
 * // Type-safe document validator
 * returns: vv.doc("users")
 * ```
 */
export const vv = typedV(schema);
