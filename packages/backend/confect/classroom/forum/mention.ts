import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/** The most mentions one message holds (ADR 0025). */
export const MENTION_LIMIT = 20;

/** One mention of a message: a Person who writes in the class, or everyone in it, which only a subject teacher may use. */
export const Mention = Schema.Union([
  Schema.TaggedStruct("person", { id: Id("tenantPeople") }),
  Schema.TaggedStruct("everyone", {}),
]);

/** The mentions of one message, at most MENTION_LIMIT. */
export const Mentions = Schema.Array(Mention).check(
  Schema.isMaxLength(MENTION_LIMIT)
);

/** One mention as a message shows it: a Person by name, or everyone. */
export const MentionView = Schema.Union([
  Schema.TaggedStruct("person", { id: Id("tenantPeople"), name: Schema.String }),
  Schema.TaggedStruct("everyone", {}),
]);

/** One Person a member may mention in a class, as the mention list shows it. */
export const MentionablePerson = Schema.Struct({
  id: Id("tenantPeople"),
  name: Schema.String,
});
