import { polarMetadataValidator } from "@repo/backend/convex/lib/contentValidators";
import { nullable } from "@repo/backend/convex/lib/validators";
import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  customers: defineTable({
    id: v.string(),
    externalId: nullable(v.string()),
    userId: v.id("users"),
    metadata: v.optional(polarMetadataValidator),
  })
    .index("userId", ["userId"])
    .index("id", ["id"])
    .index("externalId", ["externalId"]),
};

export default tables;
