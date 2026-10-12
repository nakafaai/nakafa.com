import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { NinaPortraitText } from "@repo/backend/confect/nina/portrait/schema";
import {
  onboardingFocusValidator,
  onboardingRegionValidator,
} from "@repo/backend/confect/onboarding/schema";
import { tryoutRouteKeyValidator } from "@repo/backend/confect/tryouts/route";
import { tryoutScoreStatusValidator } from "@repo/backend/confect/tryouts/score";
import { Sealed } from "@repo/backend/confect/vault/schema";
import { Schema, Struct } from "effect";

/** Characters of one memory's words, their Markdown formatting included. */
export const MEMORY_TEXT_LIMIT = 2000;
/** Characters of the title a learner gives a memory. */
export const MEMORY_TITLE_LIMIT = 80;
/** Characters of one memory Nina writes: one short sentence. */
const MEMORY_SENTENCE_LIMIT = 280;
/** Memories a turn recalls at most: those that fit the learner's message and the open page. */
export const MEMORY_RECALL_LIMIT = 8;
/** Memories a turn recalls at least, when the learner has them: the most recently confirmed fill the list up to it. */
export const MEMORY_RECALL_FLOOR = 3;
/** Memories the memory capability returns in one call: the best matches for Nina's query. */
export const MEMORY_LOOKUP_LIMIT = 6;
/** Memories one capture call may propose from a single message. */
export const MEMORY_CAPTURE_LIMIT = 3;
/** Memories the capture call reads and may name: the best matches for the message. */
export const MEMORY_KNOWN_LIMIT = 12;
/** Topics one memory is linked to, and topics one page has. */
export const MEMORY_TOPIC_LIMIT = 8;
/** Characters of one topic. A longer path is no page of Nakafa and names no topic. */
export const MEMORY_TOPIC_LENGTH = 256;
/** Memories one page of the Memory page holds, however many the browser asks for. */
export const MEMORY_PAGE_LIMIT = 50;

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
const NinaMemoryAuthor = Schema.Literals(["nina", "learner"]);

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
 * A place a memory is said at: the lesson a page shows or a path above that
 * page, tagged by `memory/topics`. The search finds a memory by it.
 */
const NinaMemoryTopic = Schema.NonEmptyString.check(
  Schema.isMaxLength(MEMORY_TOPIC_LENGTH)
);

/** The topics of one page, or the topics one memory is linked to. */
const NinaMemoryTopics = Schema.mutable(Schema.Array(NinaMemoryTopic)).check(
  Schema.isMaxLength(MEMORY_TOPIC_LIMIT)
);

/**
 * One stored memory. `text` and `title` are sealed for its learner. Only the
 * learner gives a memory a title, and a memory holds a title, words, or both.
 * `kind` is what Nina says the memory is about, so a memory the learner wrote
 * has none until a chat says it again. `confirmedAt` moves when the memory is
 * written, edited, or said again in a chat. `topics` are the places it was said
 * at: the lessons and paths of the pages that were open, the same in every
 * language for a lesson. A memory the learner wrote on the Memory page has none
 * until a chat says it again.
 */
export const NinaMemory = Schema.Struct({
  author: NinaMemoryAuthor,
  confirmedAt: Schema.Finite,
  kind: Schema.optionalKey(NinaMemoryKind),
  text: Sealed,
  title: Schema.optionalKey(Sealed),
  topics: Schema.optionalKey(NinaMemoryTopics),
  userId: Id("users"),
  validUntil: Schema.optionalKey(Schema.Finite),
});

/**
 * One key of the memory index: a link between one memory and one topic
 * (`t:<topic>`) or one blinded word of its title or words (`w:<hash>`). The
 * index is these rows. Two memories are linked when they share a key. A row
 * also holds the time its memory was confirmed, so that a lookup meets the
 * memories confirmed last first, whenever they were linked.
 */
export const NinaMemoryKey = Schema.Struct({
  confirmedAt: Schema.Finite,
  key: Schema.NonEmptyString,
  memoryId: Id("ninaMemories"),
  userId: Id("users"),
});

/** One memory on the Memory page: its title and its words, never its kind. */
export const NinaMemoryView = Schema.Struct({
  ...NinaMemory.mapFields(Struct.pick(["author", "confirmedAt", "validUntil"]))
    .fields,
  createdAt: Schema.Finite,
  id: Id("ninaMemories"),
  text: NinaMemoryText,
  title: Schema.optionalKey(NinaMemoryTitle),
});

/** What the Memory page knows about the learner besides the memories. */
const NinaMemoryState = Schema.Struct({ paused: Schema.Boolean });

/**
 * What the learner writes on the Memory page: words, a title, or both, with no
 * kind. A write without a title takes the title off the memory.
 */
export const NinaMemoryDraft = Schema.Struct({
  text: NinaMemoryText,
  title: Schema.optionalKey(NinaMemoryTitle),
});

/**
 * Why a memory could not be written. `empty`: it holds neither a title nor
 * words. `missing`: the memory was deleted meanwhile.
 */
export class NinaMemoryRejected extends Schema.TaggedError<NinaMemoryRejected>()(
  "NinaMemoryRejected",
  { reason: Schema.Literals(["empty", "missing"]) }
) {}

/**
 * One thing a capture call says the learner stated about themself. `text` is
 * one short sentence: never empty, and at most `MEMORY_SENTENCE_LIMIT`
 * characters. `quote` holds the learner's exact words; the write is refused
 * unless the message contains them, and unless the sentence has a letter or a
 * digit. `known` is the place, counted from 1, in the list of known memories
 * the call was given (`NinaKnown`) of the memory that this one restates. The
 * model reads the memories and says which one it restates, and no comparison of
 * words decides it: a place that is not on the list names nothing. A stored
 * memory without a kind takes this one's kind, and the words of the stored
 * memory change only when Nina wrote them, so a memory the learner wrote keeps
 * its words. `until` is the day a situation ends, as `YYYY-MM-DD`.
 */
export const NinaMemoryCandidate = Schema.Struct({
  kind: NinaMemoryKind,
  known: Schema.optionalKey(Schema.Int),
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
export const NinaMemoryNote = Schema.Struct({
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
 * What a turn knows about one learner: the account `profile`, the `portrait`
 * when the learner has one, and the memories the learner's message and the open
 * page call up (`recalled`), at most `MEMORY_RECALL_LIMIT`. While memory is
 * paused it holds neither the portrait nor a memory.
 */
export const NinaLearner = Schema.Struct({
  paused: Schema.Boolean,
  portrait: Schema.optionalKey(NinaPortraitText),
  profile: NinaLearnerProfile,
  recalled: Schema.mutable(Schema.Array(NinaMemoryNote)).check(
    Schema.isMaxLength(MEMORY_RECALL_LIMIT)
  ),
});

/**
 * What the memory capability finds for Nina's query: the memories that match it
 * best, at most `MEMORY_LOOKUP_LIMIT`. It tells that memory is paused, because
 * then it finds none and the capability refuses.
 */
const NinaLookup = Schema.Struct({
  memories: Schema.mutable(Schema.Array(NinaMemoryNote)).check(
    Schema.isMaxLength(MEMORY_LOOKUP_LIMIT)
  ),
  paused: Schema.Boolean,
});

/**
 * What the capture call knows about one learner: `known` holds the memories
 * that match the message best, at most `MEMORY_KNOWN_LIMIT`, the best first.
 * The call lists them in this order and names one by its place in the list. It
 * is empty while memory is paused.
 */
export const NinaKnown = Schema.Struct({
  known: Schema.mutable(Schema.Array(NinaMemoryNote)).check(
    Schema.isMaxLength(MEMORY_KNOWN_LIMIT)
  ),
  profile: NinaLearnerProfile,
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
  // One page of the learner's memories, the most recently confirmed first, with
  // their titles and words opened. A memory that "Delete all" took is not
  // listed, though a batch may still hold it. A visitor gets an empty page.
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "list",
      item: () => NinaMemoryView,
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "state",
      returns: () => Schema.NullOr(NinaMemoryState),
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
  // Deletes the memories the learner has now. Every reader drops them from this
  // moment on, and a batch is deleted at once and the rest by `drain`, so a
  // learner with many memories never meets one huge transaction.
  .addFunction(
    FunctionSpec.publicMutation({
      name: "clear",
      returns: () => Schema.Null,
      error: () => AuthFailure,
    }).middleware(Session)
  )
  // The four functions below are what browser tabs opened before October 2026
  // still call from the old settings card. The card shows memory as on with no
  // fact or as off, turns it on, and turns it off with every memory deleted.
  // They are deleted with the retired model key, after three days without a
  // call.
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
  // What a turn knows about the learner: the account facts, the portrait, and
  // the memories that the learner's words (`said`) and the pages they have open
  // call up. `now` is the caller's time, which leaves out the situations that
  // ended: a query never reads the clock, because it is not run again when time
  // passes.
  .addFunction(
    FunctionSpec.internalQuery({
      name: "read",
      args: () => ({
        now: Schema.Finite,
        said: Schema.String,
        topics: NinaMemoryTopics,
        userId: Id("users"),
      }),
      returns: () => NinaLearner,
    })
  )
  // What the memory capability finds for Nina's query, as the memories are at
  // the caller's time `now`. It reads the learner's words only, not the page.
  .addFunction(
    FunctionSpec.internalQuery({
      name: "lookup",
      args: () => ({
        now: Schema.Finite,
        query: Schema.String,
        userId: Id("users"),
      }),
      returns: () => NinaLookup,
    })
  )
  // Whether the learner paused memory. The capture asks once, before it sends
  // the learner's message to any model and before it reads a single memory.
  .addFunction(
    FunctionSpec.internalQuery({
      name: "paused",
      args: () => ({ userId: Id("users") }),
      returns: () => Schema.Boolean,
    })
  )
  // What the capture call reads: the account facts and the memories that match
  // the learner's message and the open pages, as they are at the caller's time
  // `now`.
  .addFunction(
    FunctionSpec.internalQuery({
      name: "known",
      args: () => ({
        message: Schema.String,
        now: Schema.Finite,
        topics: NinaMemoryTopics,
        userId: Id("users"),
      }),
      returns: () => NinaKnown,
    })
  )
  // Writes what a capture call found. `seen` is the list of memories the call
  // gave the model before it read the message, in the order of the list: a
  // candidate names a memory by its place there. The write changes nothing when
  // the learner removed one of those memories meanwhile, and leaves the words,
  // the kind and the end date of one that changed.
  .addFunction(
    FunctionSpec.internalMutation({
      name: "capture",
      args: () => ({
        candidates: NinaMemoryCapture.fields.memories,
        seen: Schema.mutable(Schema.Array(NinaMemorySeen)).check(
          Schema.isMaxLength(MEMORY_KNOWN_LIMIT)
        ),
        topics: NinaMemoryTopics,
        turnId: Id("ninaTurns"),
        userId: Id("users"),
      }),
      returns: () => Schema.Int,
    })
  )
  // Deletes one batch of the memories a learner had confirmed up to `through`,
  // the moment they asked to delete them all, and returns how many it deleted.
  // It runs again by itself while a batch is full. `clear` starts it.
  .addFunction(
    FunctionSpec.internalMutation({
      name: "drain",
      args: () => ({ through: Schema.Finite, userId: Id("users") }),
      returns: () => Schema.Int,
    })
  )
  // Deletes one batch of the situations whose end date has passed and returns
  // how many it deleted. The daily cron runs it.
  .addFunction(
    FunctionSpec.internalMutation({
      name: "expire",
      returns: () => Schema.Int,
    })
  );
