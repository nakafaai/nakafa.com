import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { readLearnerKeys } from "@repo/backend/confect/vault/keys";
import type { VaultField } from "@repo/backend/confect/vault/schema";
import { openText } from "@repo/backend/confect/vault/text";
import { Clock, Duration, Effect } from "effect";

type UserId = Docs["users"]["_id"];

/**
 * How long a requested build waits before it runs. A memory the learner edits
 * is saved again every few seconds while they write, so the build waits for the
 * quiet after the last request, and a build that finds a later request waiting
 * leaves the work to it. A judgment, not a measurement.
 */
export const PORTRAIT_DELAY = Duration.seconds(30);

/**
 * How long one build that went to the model keeps the next from being asked for
 * when memories are only added. A memory the learner deletes or rewrites asks
 * for a build at once.
 */
const PORTRAIT_WINDOW = Duration.hours(24);

/** The stored field every portrait's sealed text belongs to. */
export const PORTRAIT_FIELD = {
  field: "text",
  table: "ninaMemoryPortraits",
} satisfies typeof VaultField.Type;

/** Reads the portrait row of a learner, when they have one. */
export const readPortraitRow = Effect.fn("nina.portrait.row")(function* (
  userId: UserId
) {
  return yield* (yield* DatabaseReader)
    .table("ninaMemoryPortraits")
    .get("by_userId", userId)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
});

/**
 * The portrait of a learner as the prompt reads it, or nothing when they have
 * none. A learner with a portrait has a key, and a portrait without its key is
 * a defect.
 */
export const readPortrait = Effect.fn("nina.portrait.read")(function* (
  userId: UserId
) {
  const row = yield* readPortraitRow(userId);
  if (row?.text === undefined) {
    return;
  }
  return yield* openText(
    yield* readLearnerKeys(userId),
    PORTRAIT_FIELD,
    row.text
  );
}, Effect.orDie);

/**
 * Asks for a build of the learner's portrait, in the transaction of the change
 * that asks. A memory the learner wrote or Nina saved asks unless a build went
 * to the model in the last day (`builtAt`). The day is counted from that build
 * and not from the last request, so a request that no build answered, such as
 * one whose build found memory paused, does not close it. A memory the learner
 * deleted or rewrote on the Memory page (`reset`) takes what the portrait says
 * out first, in the same transaction, because a sentence that came from it must
 * not stay, and then asks for a build from scratch whatever the last build was.
 * A reset takes the day of the last build with the text: a portrait with no
 * text has no build to count a day from, so the request after it asks, also
 * when the build that the reset scheduled found memory paused.
 * While memory is paused nothing is asked, so a learner who paused is never
 * built for, but a reset still takes the text out and lets the next request
 * ask. The learner who lets Nina use memory again asks too (`memory.pause`).
 *
 * The request writes its time into the portrait row, creating the row for a
 * learner who has none, and schedules the build after `PORTRAIT_DELAY`. Every
 * request that comes before a build has gone to the model does this, and only
 * the last of the builds scheduled finds its quiet over, so a burst of saves, or
 * of memories added within the quiet, makes one model call.
 */
export const requestPortrait = Effect.fn("nina.portrait.request")(function* ({
  paused,
  reset,
  userId,
}: {
  readonly paused: boolean;
  readonly reset: boolean;
  readonly userId: UserId;
}) {
  const writer = yield* DatabaseWriter;
  const row = yield* readPortraitRow(userId);
  const now = yield* Clock.currentTimeMillis;
  const cleared = reset
    ? { builtAt: undefined, text: undefined, through: 0 }
    : {};
  if (paused) {
    if (row !== null && reset) {
      yield* writer
        .table("ninaMemoryPortraits")
        .patch(row._id, cleared)
        .pipe(Effect.orDie);
    }
    return;
  }
  if (
    !reset &&
    row?.builtAt !== undefined &&
    now - row.builtAt < Duration.toMillis(PORTRAIT_WINDOW)
  ) {
    return;
  }
  if (row === null) {
    yield* writer
      .table("ninaMemoryPortraits")
      .insert({ scheduledAt: now, through: 0, userId })
      .pipe(Effect.orDie);
  } else {
    yield* writer
      .table("ninaMemoryPortraits")
      .patch(row._id, { ...cleared, scheduledAt: now })
      .pipe(Effect.orDie);
  }
  yield* (yield* Scheduler).runAfter(
    PORTRAIT_DELAY,
    refs.internal.nina.portrait.build.run,
    { userId }
  );
});

/**
 * Deletes the portrait of a learner with the memories it came from, and tells
 * whether there was one. A build still running finds no row and writes nothing.
 */
export const dropPortrait = Effect.fn("nina.portrait.drop")(function* (
  userId: UserId
) {
  const row = yield* readPortraitRow(userId);
  if (row === null) {
    return false;
  }
  yield* (yield* DatabaseWriter)
    .table("ninaMemoryPortraits")
    .delete(row._id)
    .pipe(Effect.orDie);
  return true;
});
