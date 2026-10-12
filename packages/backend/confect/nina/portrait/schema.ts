import { Id } from "@repo/backend/confect/_generated/id";
import { NinaUpkeepTotal } from "@repo/backend/confect/nina/contract/usage";
import { Sealed } from "@repo/backend/confect/vault/schema";
import { Schema } from "effect";

/** Characters of a portrait: a short text about the learner that stays true for months. */
export const PORTRAIT_LIMIT = 1200;
/** Memories one build reads: the newest ones that the portrait has not read. */
export const PORTRAIT_MEMORY_LIMIT = 40;

/** The text of a portrait as the build writes it and the prompt reads it. */
export const NinaPortraitText = Schema.Trim.check(
  Schema.isMaxLength(PORTRAIT_LIMIT)
);

/** What one portrait build writes: the whole new portrait, or an empty one when nothing is worth keeping. */
export const NinaPortraitDraft = Schema.Struct({ portrait: NinaPortraitText });

/**
 * The portrait of one learner: a text written from their memories by a
 * background model call, sealed for the learner. It is derived data, so
 * deleting it loses nothing. `text` is absent until a build has written one,
 * and after a memory was deleted or rewritten on the Memory page, until the
 * rebuild has written it again. `through` is the newest confirmation time of
 * the memories the text was built from, so a build reads only the memories
 * confirmed after it; zero means none was read. `scheduledAt` is when a build
 * was last requested, and a build waits for the quiet after it. `builtAt` is
 * when a build last went to the model, absent for none: a request within a day
 * of it asks for no build. The two are apart because a request that no build
 * has answered yet must not close the day. A build belongs to no turn, so its
 * provider tokens accumulate in `usage` instead of in a turn's usage ledger, as
 * a summary's do; the field is absent until a build has called the model.
 */
export const NinaMemoryPortrait = Schema.Struct({
  builtAt: Schema.optionalKey(Schema.Finite),
  scheduledAt: Schema.Finite,
  text: Schema.optionalKey(Sealed),
  through: Schema.Finite,
  usage: Schema.optionalKey(NinaUpkeepTotal),
  userId: Id("users"),
});
