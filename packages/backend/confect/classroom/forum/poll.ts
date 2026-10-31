import type { ClassroomMessagesDoc } from "@repo/backend/confect/_generated/docs";
import { Sealed } from "@repo/backend/confect/vault/schema";
import { isSingleLine } from "@repo/utilities/line";
import { Schema } from "effect";

/** The fewest and the most choices one poll offers. */
export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 10;

/** The question of a poll: one trimmed line of 1 to 200 characters. */
export const PollQuestion = Schema.String.check(
  Schema.isTrimmed(),
  isSingleLine,
  Schema.isMinLength(1),
  Schema.isMaxLength(200)
);

/** One choice of a poll: one trimmed line of 1 to 100 characters. */
export const PollOption = Schema.String.check(
  Schema.isTrimmed(),
  isSingleLine,
  Schema.isMinLength(1),
  Schema.isMaxLength(100)
);

/** A poll as its author writes it: the question, its choices, and whether a voter may take several. */
export const PollDraft = Schema.Struct({
  multiple: Schema.Boolean,
  options: Schema.Array(PollOption).check(
    Schema.isMinLength(POLL_MIN_OPTIONS),
    Schema.isMaxLength(POLL_MAX_OPTIONS)
  ),
  question: PollQuestion,
});

/** A poll as a message stores it, its words sealed with the school key (ADR 0030). */
export const pollValidator = Schema.Struct({
  multiple: Schema.Boolean,
  sealedOptions: Schema.Array(Sealed),
  sealedQuestion: Sealed,
});

/** A poll as the forum shows it. Its counts stand with the message's tally. */
export const PollView = Schema.Struct({
  multiple: Schema.Boolean,
  options: Schema.Array(Schema.String),
  question: Schema.String,
});

/** The sealed field of one part of a poll, bound to the message that holds it (ADR 0030). */
export const pollField = (
  row: Pick<ClassroomMessagesDoc, "channelId" | "classId" | "clientKey">,
  part: string
) => ({
  field: `poll:${part}`,
  row: [row.classId, row.channelId, row.clientKey],
  table: "classroomMessages",
});
