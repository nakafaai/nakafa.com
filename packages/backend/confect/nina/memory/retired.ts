import { FunctionImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import {
  getOptionalAppUserForRead,
  requireAuth,
} from "@repo/backend/confect/auth/session";
import { setNinaMemoryPaused } from "@repo/backend/confect/learningPreferences/impl";
import {
  clearMemories,
  readMemoryState,
} from "@repo/backend/confect/nina/memory/store";
import spec from "@repo/backend/confect/nina/memory.spec";
import { Clock, Effect } from "effect";

// The four functions below answer browser tabs opened before October 2026,
// which still show the old settings card. That card knows memory as on or
// off and lists facts, which no longer exist. So the card shows memory as it
// is, on with no fact or off, and its two buttons do what they say. They
// leave with the retired model key, and with them this module.

/** Memory as the old card shows it: on with no fact to list, or off. */
export const get = FunctionImpl.make(
  schema,
  spec,
  "get",
  Effect.fn("nina.memory.get")(function* () {
    const user = yield* getOptionalAppUserForRead();
    if (!user || (yield* readMemoryState(user.appUser._id)).paused) {
      return null;
    }
    return { facts: [] };
  })
);

/** Turns memory on. */
export const enable = FunctionImpl.make(
  schema,
  spec,
  "enable",
  Effect.fn("nina.memory.enable")(function* () {
    const { appUser } = yield* requireAuth();
    yield* setNinaMemoryPaused({
      now: yield* Clock.currentTimeMillis,
      paused: false,
      userId: appUser._id,
    });
    return { facts: [] };
  })
);

/**
 * Turns memory off and deletes every memory: the old card names its button
 * "Turn off and forget" and says that everything Nina remembered goes. The
 * memories go as `clear` deletes them: every reader drops them at once, and
 * the batches delete them after that.
 */
export const disable = FunctionImpl.make(
  schema,
  spec,
  "disable",
  Effect.fn("nina.memory.disable")(function* () {
    const { appUser } = yield* requireAuth();
    const now = yield* Clock.currentTimeMillis;
    yield* setNinaMemoryPaused({ now, paused: true, userId: appUser._id });
    yield* clearMemories(appUser._id, now);
    return null;
  })
);

/** Changes nothing: the old card has no fact to forget. */
export const forget = FunctionImpl.make(
  schema,
  spec,
  "forget",
  Effect.fn("nina.memory.forget")(function* () {
    yield* requireAuth();
    return null;
  })
);
