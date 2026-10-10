import { FunctionImpl, GroupImpl } from "@confect/server";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import schema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import {
  getOptionalAppUserForRead,
  requireAuth,
} from "@repo/backend/confect/auth/session";
import { setNinaMemoryPaused } from "@repo/backend/confect/learningPreferences/impl";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { readLearnerProfile } from "@repo/backend/confect/nina/memory/profile";
import {
  MEMORY_FIELD,
  openMemories,
  TITLE_FIELD,
} from "@repo/backend/confect/nina/memory/seal";
import {
  newestFirst,
  selectMemories,
} from "@repo/backend/confect/nina/memory/select";
import {
  deleteMemory,
  EXPIRY_PAGE,
  expireMemories,
  readMemories,
  readOwnMemory,
  readPaused,
} from "@repo/backend/confect/nina/memory/store";
import { writeMemories } from "@repo/backend/confect/nina/memory/write";
import spec, {
  MEMORY_LIMIT,
  NinaMemoryRejected,
} from "@repo/backend/confect/nina/memory.spec";
import { ensureLearnerKeys } from "@repo/backend/confect/vault/keys";
import { sealText } from "@repo/backend/confect/vault/text";
import {
  Array as Arr,
  Clock,
  Duration,
  Effect,
  HashSet,
  Layer,
  String as Str,
} from "effect";

/** Reads a learner's memories with their words and titles opened, the most recently confirmed first. */
const readOpened = Effect.fn("nina.memory.readOpened")(function* (
  userId: Docs["users"]["_id"]
) {
  return Arr.sort(
    yield* openMemories(userId, yield* readMemories(userId)),
    newestFirst
  );
});

/**
 * The Memory page: every memory of the learner, newest first, with its title
 * and words opened and whether Nina reads it. A visitor gets nothing.
 */
const list = FunctionImpl.make(
  schema,
  spec,
  "list",
  Effect.fn("nina.memory.list")(function* () {
    const user = yield* getOptionalAppUserForRead();
    if (!user) {
      return null;
    }
    const userId = user.appUser._id;
    const paused = yield* readPaused(userId);
    const memories = yield* readOpened(userId);
    // While memory is paused, Nina reads none of them.
    const inUse = HashSet.fromIterable(
      Arr.map(
        paused
          ? []
          : selectMemories(memories, { now: yield* Clock.currentTimeMillis }),
        (memory) => memory._id
      )
    );
    return {
      memories: Arr.map(memories, (memory) => ({
        author: memory.author,
        confirmedAt: memory.confirmedAt,
        createdAt: memory._creationTime,
        id: memory._id,
        inUse: HashSet.has(inUse, memory._id),
        text: memory.text,
        ...(memory.title === undefined ? {} : { title: memory.title }),
        ...(memory.validUntil === undefined
          ? {}
          : { validUntil: memory.validUntil }),
      })),
      paused,
    };
  })
);

/** Whether a draft says nothing: it has no title and no words. */
function isEmpty(draft: { readonly text: string; readonly title?: string }) {
  return draft.title === undefined && Str.isEmpty(draft.text);
}

/**
 * Seals what the learner wrote for one memory: its words, and its title when
 * it has one.
 */
const sealDraft = Effect.fn("nina.memory.sealDraft")(function* (
  userId: Docs["users"]["_id"],
  draft: { readonly text: string; readonly title?: string }
) {
  const keys = yield* ensureLearnerKeys(userId);
  return {
    text: yield* sealText(keys, MEMORY_FIELD, draft.text),
    title:
      draft.title === undefined
        ? undefined
        : yield* sealText(keys, TITLE_FIELD, draft.title),
  };
}, Effect.orDie);

/**
 * Writes a memory in the learner's own words, with the title they gave it, up
 * to `MEMORY_LIMIT` memories.
 */
const add = FunctionImpl.make(
  schema,
  spec,
  "add",
  Effect.fn("nina.memory.add")(function* (draft) {
    const { appUser } = yield* requireAuth();
    if (isEmpty(draft)) {
      return yield* new NinaMemoryRejected({ reason: "empty" });
    }
    if (Arr.length(yield* readMemories(appUser._id)) >= MEMORY_LIMIT) {
      return yield* new NinaMemoryRejected({ reason: "limit" });
    }
    const { text, title } = yield* sealDraft(appUser._id, draft);
    return yield* (yield* DatabaseWriter)
      .table("ninaMemories")
      .insert({
        author: "learner",
        confirmedAt: yield* Clock.currentTimeMillis,
        text,
        ...(title === undefined ? {} : { title }),
        userId: appUser._id,
      })
      .pipe(Effect.orDie);
  })
);

/**
 * Rewrites a memory as the learner's own words and title; a write without a
 * title takes the title off. Its kind, lesson and end date stay as they are.
 */
const edit = FunctionImpl.make(
  schema,
  spec,
  "edit",
  Effect.fn("nina.memory.edit")(function* ({ id, ...draft }) {
    const { appUser } = yield* requireAuth();
    if (isEmpty(draft)) {
      return yield* new NinaMemoryRejected({ reason: "empty" });
    }
    const memory = yield* readOwnMemory(appUser._id, id);
    if (!memory) {
      return yield* new NinaMemoryRejected({ reason: "missing" });
    }
    const { text, title } = yield* sealDraft(appUser._id, draft);
    yield* (yield* DatabaseWriter)
      .table("ninaMemories")
      .patch(id, {
        author: "learner",
        confirmedAt: yield* Clock.currentTimeMillis,
        text,
        title,
      })
      .pipe(Effect.orDie);
    return null;
  })
);

const remove = FunctionImpl.make(
  schema,
  spec,
  "remove",
  Effect.fn("nina.memory.remove")(function* ({ id }) {
    const { appUser } = yield* requireAuth();
    const memory = yield* readOwnMemory(appUser._id, id);
    if (memory) {
      yield* deleteMemory(memory._id);
    }
    return null;
  })
);

/** Stops Nina from saving or reading memory, or lets her again. Nothing is deleted. */
const pause = FunctionImpl.make(
  schema,
  spec,
  "pause",
  Effect.fn("nina.memory.pause")(function* ({ paused }) {
    const { appUser } = yield* requireAuth();
    yield* setNinaMemoryPaused({
      now: yield* Clock.currentTimeMillis,
      paused,
      userId: appUser._id,
    });
    return null;
  })
);

const clear = FunctionImpl.make(
  schema,
  spec,
  "clear",
  Effect.fn("nina.memory.clear")(function* () {
    const { appUser } = yield* requireAuth();
    for (const memory of yield* readMemories(appUser._id)) {
      yield* deleteMemory(memory._id);
    }
    return null;
  })
);

// The four functions below answer browser tabs opened before October 2026.
// They change nothing and report memory as off, and they leave with the
// retired model key.
const get = FunctionImpl.make(
  schema,
  spec,
  "get",
  Effect.fn("nina.memory.get")(() => Effect.succeed(null))
);

const enable = FunctionImpl.make(
  schema,
  spec,
  "enable",
  Effect.fn("nina.memory.enable")(function* () {
    yield* requireAuth();
    return { facts: [] };
  })
);

const disable = FunctionImpl.make(
  schema,
  spec,
  "disable",
  Effect.fn("nina.memory.disable")(function* () {
    yield* requireAuth();
    return null;
  })
);

const forget = FunctionImpl.make(
  schema,
  spec,
  "forget",
  Effect.fn("nina.memory.forget")(function* () {
    yield* requireAuth();
    return null;
  })
);

/**
 * What a turn knows about the learner: the account profile, the memories Nina
 * reads (chosen for the open lesson), and every memory the capture call can
 * name. While memory is paused, no memory is read.
 */
const read = FunctionImpl.make(
  schema,
  spec,
  "read",
  Effect.fn("nina.memory.read")(function* ({ lesson, userId }) {
    const profile = yield* readLearnerProfile(userId);
    if (yield* readPaused(userId)) {
      return { known: [], paused: true, profile, prompt: [] };
    }
    const memories = yield* readOpened(userId);
    const note = (memory: (typeof memories)[number]) => ({
      confirmedAt: memory.confirmedAt,
      id: memory._id,
      ...(memory.kind === undefined ? {} : { kind: memory.kind }),
      text: memory.text,
      ...(memory.title === undefined ? {} : { title: memory.title }),
    });
    return {
      known: Arr.map(memories, note),
      paused: false,
      profile,
      prompt: Arr.map(
        selectMemories(memories, {
          lesson,
          now: yield* Clock.currentTimeMillis,
        }),
        note
      ),
    };
  })
);

/** Writes the memories a capture call found and returns how many it wrote or confirmed. */
const capture = FunctionImpl.make(
  schema,
  spec,
  "capture",
  Effect.fn("nina.memory.capture")(function* (args) {
    return yield* writeMemories(args);
  })
);

/** Deletes one page of the situations that have ended, and runs again while a page is full. */
const expire = FunctionImpl.make(
  schema,
  spec,
  "expire",
  Effect.fn("nina.memory.expire")(function* () {
    const deleted = yield* expireMemories(yield* Clock.currentTimeMillis);
    if (deleted === EXPIRY_PAGE) {
      yield* (yield* Scheduler).runAfter(
        Duration.zero,
        refs.internal.nina.memory.expire,
        {}
      );
    }
    return deleted;
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(list),
  Layer.provide(add),
  Layer.provide(edit),
  Layer.provide(remove),
  Layer.provide(pause),
  Layer.provide(clear),
  Layer.provide(get),
  Layer.provide(enable),
  Layer.provide(disable),
  Layer.provide(forget),
  Layer.provide(read),
  Layer.provide(capture),
  Layer.provide(expire),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
