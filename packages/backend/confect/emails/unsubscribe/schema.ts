import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/**
 * Who an email reaches, as its unsubscribe link names them: an account, for its own mail and the notices of no
 * school; a Person of a school, for that school's notices; or an address that holds neither, for an invitation or a
 * guardian's code.
 */
export const Recipient = Schema.Union([
  Schema.TaggedStruct("Account", { userId: Id("users") }),
  Schema.TaggedStruct("Person", {
    personId: Id("tenantPeople"),
    tenantId: Id("tenants"),
  }),
  Schema.TaggedStruct("Address", { address: Schema.String }),
]);

/** An address that asked Nakafa to send it nothing more on its own, as addresses are matched: trimmed, in lower case. */
export const emailSuppressionValidator = Schema.Struct({
  address: Schema.String,
  createdAt: Schema.Finite,
});
