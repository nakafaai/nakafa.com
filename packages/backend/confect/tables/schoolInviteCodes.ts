import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { schoolMemberRoleSchema } from "@repo/backend/confect/schools/schema";
import { Schema } from "effect";

/**
 * School type validator
 */
export default Table.make(() =>
  Schema.Struct({
    schoolId: IdSchema("schools"),
    role: schoolMemberRoleSchema,
    code: Schema.String,
    enabled: Schema.Boolean,
    expiresAt: Schema.optionalKey(Schema.Finite),
    maxUsage: Schema.optionalKey(Schema.Finite),
    currentUsage: Schema.Finite,
    description: Schema.optionalKey(Schema.String),
    createdBy: IdSchema("users"),
    updatedBy: Schema.optionalKey(IdSchema("users")),
    updatedAt: Schema.Finite,
  })
).index("by_code", ["code"]);
