/**
 * Typed validators bound to the main app schema.
 *
 * Provides type-safe access to table IDs and document validators.
 * Use `vv` instead of raw `v.id("tableName")` for compile-time table name validation.
 *
 * @see https://stack.convex.dev/argument-validation-without-repetition
 * @see https://github.com/get-convex/convex-helpers#validator-utilities
 *
 * @example
 * ```ts
 * import { vv } from "@repo/backend/convex/lib/validators";
 *
 * export const getUser = query({
 *   args: { userId: vv.id("users") },
 *   returns: vv.doc("users"),
 *   handler: async (ctx, args) => {
 *     return await ctx.db.get(args.userId);
 *   }
 * });
 * ```
 */
import schema from "@repo/backend/convex/schema";
import { typedV } from "convex-helpers/validators";

export const vv = typedV(schema);
