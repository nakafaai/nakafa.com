import { createApi } from "@convex-dev/better-auth";
import schema from "@repo/backend/components/betterAuth/schema";
import { createAuthOptions } from "@repo/backend/confect/auth/runtime";

export const {
  create,
  findOne,
  findMany,
  updateOne,
  updateMany,
  deleteOne,
  deleteMany,
} = createApi(schema, createAuthOptions);

/**
 * Keeps this module's context between calls (ADR 0040). It builds every Better Auth option as it
 * evaluates, and `createApi` holds only the tables those options name, so no caller's value stays.
 */
export const experimental_reuseContext = true;
