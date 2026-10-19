import { Table } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { StartDraft } from "@repo/backend/confect/tenancy/start";
import { Schema } from "effect";

/** One account's unfinished school questionnaire, removed when the school opens. */
export default Table.make(() =>
  Schema.Struct({ ...StartDraft.fields, userId: Id("users") })
).index("by_userId", ["userId"]);
