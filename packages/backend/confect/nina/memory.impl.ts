import { FunctionImpl, GroupImpl } from "@confect/server";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import schema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { setNinaMemoryPaused } from "@repo/backend/confect/learningPreferences/impl";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { syncKeys } from "@repo/backend/confect/nina/memory/keys";
import { limitWrites } from "@repo/backend/confect/nina/memory/quota";
import {
  keepRestore,
  purgeRestore,
  restoreMemory,
} from "@repo/backend/confect/nina/memory/restore/store";
import {
  MEMORY_FIELD,
  TITLE_FIELD,
} from "@repo/backend/confect/nina/memory/seal";
import {
  clearMemories,
  confirmedAfterClear,
  deleteMemory,
  drainMemories,
  expireBatch,
  MEMORY_BATCH,
  readKeptMemory,
  readMemoryState,
  readOwnMemory,
} from "@repo/backend/confect/nina/memory/store";
import { known, lookup, paused } from "@repo/backend/confect/nina/memory/turn";
import { list, state } from "@repo/backend/confect/nina/memory/view";
import { writeMemories } from "@repo/backend/confect/nina/memory/write";
import spec, {
  type NinaMemoryDraft,
  NinaMemoryRejected,
} from "@repo/backend/confect/nina/memory.spec";
import { requestPortrait } from "@repo/backend/confect/nina/portrait/store";
import { ensureLearnerKeys } from "@repo/backend/confect/vault/keys";
import { sealText } from "@repo/backend/confect/vault/text";
import { Clock, Duration, Effect, Layer, String as Str } from "effect";

/** Whether a draft says nothing: it has no title and no words. */
function isEmpty(draft: typeof NinaMemoryDraft.Type) {
  return draft.title === undefined && Str.isEmpty(draft.text);
}

/**
 * Seals what the learner wrote for one memory: its words, and its title when
 * it has one. It returns the learner's keys too, for the index.
 */
const sealDraft = Effect.fn("nina.memory.sealDraft")(function* (
  userId: Docs["users"]["_id"],
  draft: typeof NinaMemoryDraft.Type
) {
  const keys = yield* ensureLearnerKeys(userId);
  return {
    keys,
    text: yield* sealText(keys, MEMORY_FIELD, draft.text),
    title:
      draft.title === undefined
        ? undefined
        : yield* sealText(keys, TITLE_FIELD, draft.title),
  };
}, Effect.orDie);

/**
 * Writes a memory in the learner's own words, with the title they gave it, and
 * indexes it. A learner keeps as many memories as they write. It reads the
 * moment the learner last deleted every memory, as `edit` and the capture
 * write do: the database runs this write again when a "Delete all" commits
 * while it runs, and the memory is confirmed after that moment, so the batches
 * of that deletion never take it. It asks for a build of the learner's
 * portrait, which waits (`requestPortrait`). Like `edit`, it takes one write
 * from the learner's bucket first (`limitWrites`).
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
    yield* limitWrites(appUser._id);
    const { keys, text, title } = yield* sealDraft(appUser._id, draft);
    const { clearedAt, paused } = yield* readMemoryState(appUser._id);
    const confirmedAt = confirmedAfterClear(
      yield* Clock.currentTimeMillis,
      clearedAt
    );
    const id = yield* (yield* DatabaseWriter)
      .table("ninaMemories")
      .insert({
        author: "learner",
        confirmedAt,
        text,
        ...(title === undefined ? {} : { title }),
        userId: appUser._id,
      })
      .pipe(Effect.orDie);
    yield* syncKeys(keys, id, { ...draft, confirmedAt });
    yield* requestPortrait({ paused, reset: false, userId: appUser._id });
    return id;
  })
);

/**
 * Rewrites a memory as the learner's own words and title; a write without a
 * title takes the title off. Its kind, topics and end date stay as they are,
 * and its keys follow its words. A memory that "Delete all" took is missing:
 * rewriting it would confirm it later than the batches that delete it reach.
 * The learner's portrait may hold a sentence from the old words, so it loses its
 * text at once and is built again from scratch (`requestPortrait`). A write
 * takes one place from the learner's bucket of writes by hand
 * (`limitWrites`), which a person who types slowly never empties.
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
    yield* limitWrites(appUser._id);
    const { clearedAt, paused } = yield* readMemoryState(appUser._id);
    const memory = yield* readKeptMemory(appUser._id, id, clearedAt);
    if (!memory) {
      return yield* new NinaMemoryRejected({ reason: "missing" });
    }
    const { keys, text, title } = yield* sealDraft(appUser._id, draft);
    const confirmedAt = confirmedAfterClear(
      yield* Clock.currentTimeMillis,
      clearedAt
    );
    yield* (yield* DatabaseWriter)
      .table("ninaMemories")
      .patch(id, { author: "learner", confirmedAt, text, title })
      .pipe(Effect.orDie);
    yield* syncKeys(keys, id, {
      ...draft,
      confirmedAt,
      topics: memory.topics,
    });
    yield* requestPortrait({ paused, reset: true, userId: appUser._id });
    return null;
  })
);

/**
 * Deletes one memory of the learner, with its keys, and keeps what it deleted
 * for the window in which `restore` can give it back (`keepRestore`). The
 * learner's portrait may hold a
 * sentence that came from it, so the portrait loses its text at once and is
 * built again from scratch (`requestPortrait`).
 */
const remove = FunctionImpl.make(
  schema,
  spec,
  "remove",
  Effect.fn("nina.memory.remove")(function* ({ id }) {
    const { appUser } = yield* requireAuth();
    const memory = yield* readOwnMemory(appUser._id, id);
    if (memory) {
      yield* keepRestore(memory, yield* deleteMemory(memory._id));
      const { paused } = yield* readMemoryState(appUser._id);
      yield* requestPortrait({ paused, reset: true, userId: appUser._id });
    }
    return null;
  })
);

/**
 * Puts back the memory that `remove` deleted, with every field it had
 * (`restoreMemory`). No page calls it now. A web build from before the Undo
 * toast went can still call it until 12 hours after the production deploy that
 * ships this change (deploy day plus 12 hours, the www skew window).
 * Owner: pull request #1099, which takes the Undo toast out of the Memory page.
 * Its cleanup change, which runs once that time has passed, deletes `restore`,
 * `purge`, the `keepRestore` write in `remove`, and the restore store and table
 * with every read of them.
 */
const restore = FunctionImpl.make(
  schema,
  spec,
  "restore",
  Effect.fn("nina.memory.restore")(function* ({ id }) {
    const { appUser } = yield* requireAuth();
    return yield* restoreMemory(appUser._id, id);
  })
);

/**
 * Stops Nina from saving or reading memory, or lets her again. Nothing is
 * deleted. Letting her again asks for a build of the portrait, by the rule of
 * a memory that is added (`requestPortrait`): while memory was paused nothing
 * asked for one, and a build that came due during the pause built nothing, so
 * what the learner wrote before and during the pause would otherwise wait for
 * the next memory.
 */
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
    if (!paused) {
      yield* requestPortrait({ paused, reset: false, userId: appUser._id });
    }
    return null;
  })
);

/**
 * Deletes the memories the learner has now. Every reader drops them from this
 * moment on (`clearMemories`), and the function deletes one batch and goes on
 * with the next by itself (`drain`), so a learner with many memories never
 * meets one huge transaction. A memory written after this moment stays.
 */
const clear = FunctionImpl.make(
  schema,
  spec,
  "clear",
  Effect.fn("nina.memory.clear")(function* () {
    const { appUser } = yield* requireAuth();
    yield* clearMemories(appUser._id, yield* Clock.currentTimeMillis);
    return null;
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

/** Deletes one batch of a learner's memories and goes on while a batch is full. */
const drain = FunctionImpl.make(
  schema,
  spec,
  "drain",
  Effect.fn("nina.memory.drain")(function* ({ through, userId }) {
    return yield* drainMemories(userId, through);
  })
);

/** Deletes one batch of the situations that have ended, and runs again while a batch is full. */
const expire = FunctionImpl.make(
  schema,
  spec,
  "expire",
  Effect.fn("nina.memory.expire")(function* () {
    const deleted = yield* expireBatch(yield* Clock.currentTimeMillis);
    if (deleted === MEMORY_BATCH) {
      yield* (yield* Scheduler).runAfter(
        Duration.zero,
        refs.internal.nina.memory.expire,
        {}
      );
    }
    return deleted;
  })
);

/** Deletes the restore record whose window ended, if it is still there. */
const purge = FunctionImpl.make(
  schema,
  spec,
  "purge",
  Effect.fn("nina.memory.purge")(function* ({ id }) {
    yield* purgeRestore(id);
    return null;
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(list),
  Layer.provide(state),
  Layer.provide(add),
  Layer.provide(edit),
  Layer.provide(remove),
  Layer.provide(restore),
  Layer.provide(pause),
  Layer.provide(clear),
  Layer.provide(lookup),
  Layer.provide(paused),
  Layer.provide(known),
  Layer.provide(capture),
  Layer.provide(drain),
  Layer.provide(expire),
  Layer.provide(purge),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
