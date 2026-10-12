import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
import { openWith, toNote } from "@repo/backend/confect/nina/memory/seal";
import {
  readMemoryState,
  readOldest,
} from "@repo/backend/confect/nina/memory/store";
import { PORTRAIT_MEMORY_LIMIT } from "@repo/backend/confect/nina/portrait/schema";
import {
  PORTRAIT_DELAY,
  PORTRAIT_FIELD,
  readPortraitRow,
} from "@repo/backend/confect/nina/portrait/store";
import { readLearnerKeys } from "@repo/backend/confect/vault/keys";
import { openText } from "@repo/backend/confect/vault/text";
import { Array as Arr, Clock, Duration, Effect, Option } from "effect";

/**
 * Cuts the page of memories one build reads out of the oldest ones the portrait
 * has not read, which `readOldest` gave one more than a page long, and tells
 * whether more remain after the page. Memories confirmed at the same moment
 * stay together: a capture writes up to three at once, and the next build reads
 * on from the moment this one reached, so a page that ended between two of them
 * would never hand the rest on. A page therefore ends before a group that it
 * would cut. A group longer than the whole page cannot be kept together, so the
 * page is its first memories; nothing writes forty memories in one moment.
 */
function cutPage(memories: readonly Docs["ninaMemories"][]) {
  const [page, rest] = Arr.splitAt(memories, PORTRAIT_MEMORY_LIMIT);
  const next = Arr.head(rest);
  if (Option.isNone(next)) {
    return { more: false, page };
  }
  const whole = Arr.takeWhile(
    page,
    (memory) => memory.confirmedAt < next.value.confirmedAt
  );
  return {
    more: true,
    page: Arr.isReadonlyArrayNonEmpty(whole) ? whole : page,
  };
}

/**
 * Claims the portrait build that is due and reads what it works from, or
 * returns nothing when no build is due. A build is due when the request that
 * scheduled it has had its quiet (`PORTRAIT_DELAY`, counted from the last
 * request), memory is not paused, and the account is not going. A later request
 * moves the time of the request, so a build that an earlier request scheduled
 * finds that its quiet has not come, and claiming moves it to now, so a build
 * due at the same moment finds the same: however many builds are scheduled, one
 * reads and asks the model. When there are memories to hand on, so that the
 * build goes to the model, claiming also stamps `builtAt`, which closes the day
 * for memories that are only added. A build that hands on nothing leaves the
 * day open.
 *
 * The memories are the oldest that the portrait has not read, at most
 * `PORTRAIT_MEMORY_LIMIT`, confirmed after what the portrait has read and after
 * the moment the learner last deleted them all, in one range of one index. They
 * come oldest first, so a newer memory that contradicts a sentence is read
 * after it, and `reached` is the confirmation time of the newest of them: the
 * next build reads on from there, so no memory is skipped. A situation has an
 * end date and a portrait keeps what lasts, so a situation is read but never
 * handed on: `reached` counts it, and the next build does not read it again.
 *
 * `more` tells that the page was full and memories remain after it. Such a
 * build asks for the next one once it has stored its page, without waiting for
 * the day (`savePortrait`), so a learner with many memories gets a portrait of
 * all of them, a page at a time. A build from scratch has the same bound: it
 * reads the learner's oldest memories first and goes on until none is left.
 *
 * It reads at most 45 documents: the portrait, the learner's memory state, the
 * account, the page and the one memory that shows more remain, and the
 * learner's key, and it writes the portrait row.
 */
export const claimPortrait = Effect.fn("nina.portrait.claim")(function* (
  userId: Docs["users"]["_id"]
) {
  const row = yield* readPortraitRow(userId);
  const now = yield* Clock.currentTimeMillis;
  if (
    row === null ||
    now < row.scheduledAt + Duration.toMillis(PORTRAIT_DELAY)
  ) {
    return null;
  }
  const { clearedAt, paused } = yield* readMemoryState(userId);
  const user = yield* (yield* DatabaseReader)
    .table("users")
    .get(userId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (paused || !user || isAccountDeletionPending(user)) {
    return null;
  }
  const { more, page } = cutPage(
    yield* readOldest(
      userId,
      PORTRAIT_MEMORY_LIMIT + 1,
      Math.max(row.through, clearedAt ?? 0)
    )
  );
  const lasting = Arr.filter(page, (memory) => memory.kind !== "situation");
  const reached = Arr.last(page).pipe(
    Option.map((memory) => memory.confirmedAt),
    Option.getOrElse(() => row.through)
  );
  yield* (yield* DatabaseWriter)
    .table("ninaMemoryPortraits")
    .patch(row._id, {
      scheduledAt: now,
      ...(Arr.isReadonlyArrayEmpty(lasting) ? {} : { builtAt: now }),
    })
    .pipe(Effect.orDie);
  if (Arr.isReadonlyArrayEmpty(lasting) && row.text === undefined) {
    return { memories: [], more, reached, through: row.through };
  }
  const keys = yield* readLearnerKeys(userId).pipe(Effect.orDie);
  return {
    memories: Arr.map(
      yield* openWith(keys, lasting).pipe(Effect.orDie),
      toNote
    ),
    more,
    ...(row.text === undefined
      ? {}
      : {
          portrait: yield* openText(keys, PORTRAIT_FIELD, row.text).pipe(
            Effect.orDie
          ),
        }),
    reached,
    through: row.through,
  };
});
