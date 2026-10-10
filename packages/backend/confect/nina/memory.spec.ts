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
/** Characters of one memory's words, their Markdown formatting included. */
export const MEMORY_TEXT_LIMIT = 2000;
/** Characters of the title a learner gives a memory. */
export const MEMORY_TITLE_LIMIT = 80;
/** Characters of one memory Nina writes: one short sentence. */
const MEMORY_SENTENCE_LIMIT = 280;
/** Memories Nina reads in one turn. The Memory page marks them as in use. */
export const MEMORY_PROMPT_LIMIT = 20;
/** Memories one capture call may propose from a single message. */
export const MEMORY_CAPTURE_LIMIT = 3;

/**
 * What a memory Nina wrote is about. `situation` is something with an end,
 * such as an exam date, and Nina dates every one with `validUntil`. The learner
 * writes pure text on the Memory page, so a memory the learner wrote has no
 * kind until a later chat says it again.
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
 * Memory page. A chat rewrites only words that Nina wrote. Words the learner
 * wrote stay theirs, and a memory the learner edits becomes theirs.
 */
export const NinaMemoryAuthor = Schema.Literals(["nina", "learner"]);

/**
 * The words of a memory as the learner reads and writes them. They may hold
 * Markdown, and they are empty when the memory is only a title.
 */
const NinaMemoryText = Schema.Trim.check(Schema.isMaxLength(MEMORY_TEXT_LIMIT));

/** The title a learner gives a memory. */
const NinaMemoryTitle = Schema.Trim.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(MEMORY_TITLE_LIMIT)
);

/** One memory as Nina writes it: one short sentence. */
const NinaMemorySentence = Schema.Trim.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(MEMORY_SENTENCE_LIMIT)
);

/**
 * One stored memory. `text` and `title` are sealed for its learner. Only the
 * learner gives a memory a title, and a memory holds a title, words, or both.
 * `kind` is what Nina says the memory is about, so a memory the learner wrote
 * has none until a chat says it again. `confirmedAt` moves when the memory is
 * written, edited, or said again in a chat. `lesson` is the content identity
 * of the lesson the learner had open, the same in every language.
 */
export const NinaMemory = Schema.Struct({
  author: NinaMemoryAuthor,
  confirmedAt: Schema.Finite,
  kind: Schema.optionalKey(NinaMemoryKind),
  lesson: Schema.optionalKey(Schema.NonEmptyString),
  text: Sealed,
  title: Schema.optionalKey(Sealed),
  userId: Id("users"),
  validUntil: Schema.optionalKey(Schema.Finite),
});

/** One memory on the Memory page: its title and its words, never its kind. */
export const NinaMemoryView = Schema.Struct({
  ...NinaMemory.mapFields(Struct.pick(["author", "confirmedAt", "validUntil"]))
    .fields,
  createdAt: Schema.Finite,
  id: Id("ninaMemories"),
  inUse: Schema.Boolean,
  text: NinaMemoryText,
  title: Schema.optionalKey(NinaMemoryTitle),
});

/** The Memory page: every memory, newest first, and whether memory is paused. */
export const NinaMemoryList = Schema.Struct({
  memories: Schema.mutable(Schema.Array(NinaMemoryView)),
  paused: Schema.Boolean,
});

/**
 * What the learner writes on the Memory page: words, a title, or both, with no
 * kind. A write without a title takes the title off the memory.
 */
const NinaMemoryDraft = Schema.Struct({
  text: NinaMemoryText,
  title: Schema.optionalKey(NinaMemoryTitle),
});

/**
 * Why a memory could not be written. `empty`: it holds neither a title nor
 * words. `limit`: the learner already keeps `MEMORY_LIMIT` memories.
 * `missing`: the memory was deleted meanwhile.
 */
export class NinaMemoryRejected extends Schema.TaggedError<NinaMemoryRejected>()(
  "NinaMemoryRejected",
  { reason: Schema.Literals(["empty", "limit", "missing"]) }
) {}

/**
 * One thing a capture call says the learner stated about themself. `text` is
 * one short sentence: never empty, and at most `MEMORY_SENTENCE_LIMIT`
 * characters. `quote` holds the learner's exact words; the write is refused
 * unless the message contains them. `known` names a stored memory that this
 * one confirms, and a stored memory without a kind takes this one's kind. The
 * words of the stored memory change only when Nina wrote them: when the
 * learner wrote them and this one says something else, this one becomes a new
 * memory and the learner's stays as it is. `until` is the day a situation
 * ends, as `YYYY-MM-DD`.
 */
export const NinaMemoryCandidate = Schema.Struct({
  kind: NinaMemoryKind,
  known: Schema.optionalKey(Schema.String),
  quote: Schema.NonEmptyString,
  text: NinaMemorySentence,
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

/**
 * One memory as Nina and the capture call read it, with a kind and a title
 * only when it has one.
 */
const NinaMemoryNote = Schema.Struct({
  confirmedAt: Schema.Finite,
  id: Id("ninaMemories"),
  kind: Schema.optionalKey(NinaMemoryKind),
  text: NinaMemoryText,
  title: Schema.optionalKey(NinaMemoryTitle),
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
  // one of those memories meanwhile, and leaves the words, the kind and the end
  // date of one that changed since or that the call did not read at all.
  .addFunction(
    FunctionSpec.internalMutation({
      name: "capture",
      args: () => ({
        candidates: NinaMemoryCapture.fields.memories,
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
  // Deletes one page of the situations whose end date has passed and returns
  // how many it deleted. The daily cron runs it.
  .addFunction(
    FunctionSpec.internalMutation({
      name: "expire",
      returns: () => Schema.Int,
    })
  );
