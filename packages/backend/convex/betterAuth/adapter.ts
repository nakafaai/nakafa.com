import { createApi } from "@convex-dev/better-auth";
import { createAuthOptions } from "@repo/backend/convex/auth";
import schema from "@repo/backend/convex/betterAuth/schema";

export const {
  create,
  findOne,
  findMany,
  updateOne,
  updateMany,
  deleteOne,
  deleteMany,
} = createApi(schema, createAuthOptions);
