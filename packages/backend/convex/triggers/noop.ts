import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { GenericMutationCtx } from "convex/server";

/**
 * No-op trigger handler
 *
 * Use this for tables that are modified via wrapped ctx.db but don't need
 * custom trigger logic. This prevents "is not iterable" errors.
 */
export const noopHandler = async (_ctx: GenericMutationCtx<DataModel>) => {
  // No operation needed
};
