import { createApi } from "@convex-dev/better-auth";
import schema from "@repo/backend/components/betterAuth/schema";
import { createAuthOptions } from "@repo/backend/convex/auth/runtime";

export const {
  create,
  findOne,
  findMany,
  updateOne,
  updateMany,
  deleteOne,
  deleteMany,
} = createApi(schema, createAuthOptions);
