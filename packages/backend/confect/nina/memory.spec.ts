import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import {
  onboardingFocusValidator,
  onboardingRegionValidator,
} from "@repo/backend/confect/onboarding/schema";
import { tryoutRouteKeyValidator } from "@repo/backend/confect/tryouts/route";
import { tryoutScoreStatusValidator } from "@repo/backend/confect/tryouts/score";
import { Sealed } from "@repo/backend/confect/vault/schema";
import { Schema, Struct } from "effect";

/** Memories one learner keeps. Beyond it, the memory Nina wrote and confirmed longest ago leaves. */
export const MEMORY_LIMIT = 100;
/** Characters of one memory: a short statement, never a note. */
export const MEMORY_TEXT_LIMIT = 280;
/** Memories Nina reads in one turn. The Memory page marks them as in use. */
export const MEMORY_PROMPT_LIMIT = 20;
/** Memories one capture call may propose from a single message. */
export const MEMORY_CAPTURE_LIMIT = 3;

/**
 * What a memory is about. `situation` is something with an end, such as an
 * exam date. Nina dates one with `validUntil`; one the learner writes has no
 * date, so it stays until the learner removes it or a later chat dates it.
 */
export const NinaMemoryKind = Schema.Literals([
  "level",
  "goal",
  "style",
  "struggle",
  "situation",
]);

/**
 * Who wrote the words as they stand: Nina from a chat, or the learner on the
 * Memory page. A chat that rewrites the words makes Nina their author.
 */
export const NinaMemoryAuthor = Schema.Literals(["nina", "learner"]);

/** One memory as the learner reads and writes it. */
const NinaMemoryText = Schema.Trim.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(MEMORY_TEXT_LIMIT)
);

/**
 * One stored memory. `text` is sealed for its learner. `confirmedAt` moves
 * when the memory is written, edited, or said again in a chat. `lesson` is the
 * content identity of the lesson the learner had open, the same in every
 * language.
 */
export const NinaMemory = Schema.Struct({
  author: NinaMemoryAuthor,
  confirmedAt: Schema.Finite,
  kind: NinaMemoryKind,
  lesson: Schema.optionalKey(Schema.NonEmptyString),
  text: Sealed,
  userId: Id("users"),
  validUntil: Schema.optionalKey(Schema.Finite),
});

/**
 * A chat in which the learner said a memory. A memory Nina wrote leaves when
 * its last source chat is deleted.
 */
export const NinaMemorySource = Schema.Struct({
  chatId: Id("chats"),
  memoryId: Id("ninaMemories"),
  userId: Id("users"),
});

/** One memory on the Memory page. `sources` counts the chats it came from. */
export const NinaMemoryView = Schema.Struct({
  ...NinaMemory.mapFields(
    Struct.pick(["author", "confirmedAt", "kind", "validUntil"])
  ).fields,
  createdAt: Schema.Finite,
  id: Id("ninaMemories"),
  inUse: Schema.Boolean,
  sources: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  text: NinaMemoryText,
});

/** The Memory page: every memory, newest first, and whether memory is paused. */
export const NinaMemoryList = Schema.Struct({
  memories: Schema.mutable(Schema.Array(NinaMemoryView)),
  paused: Schema.Boolean,
});

/** What the learner writes on the Memory page. */
const NinaMemoryDraft = Schema.Struct({
  kind: NinaMemoryKind,
  text: NinaMemoryText,
});

/**
 * Why a memory could not be written. `limit`: the learner already keeps
 * `MEMORY_LIMIT` memories. `missing`: the memory was deleted meanwhile.
 */
export class NinaMemoryRejected extends Schema.TaggedError<NinaMemoryRejected>()(
  "NinaMemoryRejected",
  { reason: Schema.Literals(["limit", "missing"]) }
) {}

/**
 * One thing a capture call says the learner stated about themself. `quote`
 * holds the learner's exact words; the write is refused unless the message
 * contains them. `known` names a stored memory that this one confirms or
 * rewrites. `until` is the day a situation ends, as `YYYY-MM-DD`.
 */
export const NinaMemoryCandidate = Schema.Struct({
  kind: NinaMemoryKind,
  known: Schema.optionalKey(Schema.String),
  quote: Schema.NonEmptyString,
  text: NinaMemoryText,
  until: Schema.optionalKey(Schema.String),
});

/** What one capture call proposes. Most messages yield none. */
export const NinaMemoryCapture = Schema.Struct({
  memories: Schema.mutable(Schema.Array(NinaMemoryCandidate)).check(
    Schema.isMaxLength(MEMORY_CAPTURE_LIMIT)
  ),
});

/** Correct answers in one section of the latest finished try-out. */
const NinaProfileSection = Schema.Struct({
  correct: Schema.Finite,
  key: tryoutRouteKeyValidator,
  total: Schema.Finite,
});

/** Account facts Nina reads for a turn; derived on read, never stored. */
export const NinaLearnerProfile = Schema.Struct({
  focus: Schema.optionalKey(onboardingFocusValidator),
  region: Schema.optionalKey(onboardingRegionValidator),
  tryout: Schema.optionalKey(
    Schema.Struct({
      correct: Schema.Finite,
      exam: tryoutRouteKeyValidator,
      finishedAt: Schema.Finite,
      score: Schema.Finite,
      sections: Schema.mutable(Schema.Array(NinaProfileSection)),
      set: tryoutRouteKeyValidator,
      status: tryoutScoreStatusValidator,
      total: Schema.Finite,
    })
  ),
  tryoutCountry: Schema.optionalKey(tryoutRouteKeyValidator),
});

/** One memory as Nina and the capture call read it. */
const NinaMemoryNote = Schema.Struct({
  confirmedAt: Schema.Finite,
  id: Id("ninaMemories"),
  kind: NinaMemoryKind,
  text: NinaMemoryText,
});

/**
 * A memory as the capture call read it, before the model read the message.
 * The write compares it with the stored memory to tell what changed meanwhile.
 */
export const NinaMemorySeen = NinaMemoryNote.mapFields(
  Struct.pick(["confirmedAt", "id"])
);

/**
 * What a turn knows about one learner. `prompt` holds the memories Nina reads
 * this turn, at most `MEMORY_PROMPT_LIMIT`; `known` holds every memory, for
 * the capture call. Both are empty while memory is paused.
 */
export const NinaLearner = Schema.Struct({
  known: Schema.mutable(Schema.Array(NinaMemoryNote)),
  paused: Schema.Boolean,
  profile: NinaLearnerProfile,
  prompt: Schema.mutable(Schema.Array(NinaMemoryNote)),
});

/** The settings card of browser tabs opened before October 2026. */
const RetiredMemoryView = Schema.Struct({
  facts: Schema.mutable(
    Schema.Array(
      Schema.Struct({
        key: Schema.Int,
        savedAt: Schema.Finite,
        text: Schema.String,
      })
    )
  ),
});

export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "list",
      returns: () => Schema.NullOr(NinaMemoryList),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "add",
      args: () => NinaMemoryDraft.fields,
      returns: () => Id("ninaMemories"),
      error: () => Schema.Union([AuthFailure, NinaMemoryRejected]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "edit",
      args: () => ({ ...NinaMemoryDraft.fields, id: Id("ninaMemories") }),
      returns: () => Schema.Null,
      error: () => Schema.Union([AuthFailure, NinaMemoryRejected]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "remove",
      args: () => ({ id: Id("ninaMemories") }),
      returns: () => Schema.Null,
      error: () => AuthFailure,
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "pause",
      args: () => ({ paused: Schema.Boolean }),
      returns: () => Schema.Null,
      error: () => AuthFailure,
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "clear",
      returns: () => Schema.Null,
      error: () => AuthFailure,
    }).middleware(Session)
  )
  // The four functions below are what browser tabs opened before October 2026
  // still call from the old settings card. They change nothing and report
  // memory as off. They are deleted with the retired model key, after three
  // days without a call.
  .addFunction(
    FunctionSpec.publicQuery({
      name: "get",
      returns: () => Schema.NullOr(RetiredMemoryView),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "enable",
      returns: () => RetiredMemoryView,
      error: () => AuthFailure,
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "disable",
      returns: () => Schema.Null,
      error: () => AuthFailure,
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "forget",
      args: () => ({ key: Schema.Int }),
      returns: () => Schema.NullOr(RetiredMemoryView),
      error: () => AuthFailure,
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "read",
      args: () => ({
        lesson: Schema.optionalKey(Schema.NonEmptyString),
        userId: Id("users"),
      }),
      returns: () => NinaLearner,
    })
  )
  // Writes what a capture call found. `seen` is what the call read before the
  // model read the message: the write changes nothing when the learner removed
  // one of those memories meanwhile, and leaves the words of one that changed.
  .addFunction(
    FunctionSpec.internalMutation({
      name: "capture",
      args: () => ({
        candidates: NinaMemoryCapture.fields.memories,
        chatId: Id("chats"),
        lesson: Schema.optionalKey(Schema.NonEmptyString),
        seen: Schema.mutable(Schema.Array(NinaMemorySeen)).check(
          Schema.isMaxLength(MEMORY_LIMIT)
        ),
        turnId: Id("ninaTurns"),
        userId: Id("users"),
      }),
      returns: () => Schema.Int,
    })
  )
  // Deletes one page of the situations whose end date has passed, with their
  // source rows, and returns how many it deleted. The daily cron runs it.
  .addFunction(
    FunctionSpec.internalMutation({
      name: "expire",
      returns: () => Schema.Int,
    })
  );
