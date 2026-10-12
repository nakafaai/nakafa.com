import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
import { openWith, toNote } from "@repo/backend/confect/nina/memory/seal";
import {
  readMemoryState,
  readNewest,
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
 * Claims the portrait build that is due and reads what it works from, or
 * returns nothing when no build is due. A build is due when the request that
 * scheduled it has had its quiet (`PORTRAIT_DELAY`, counted from the last
 * request), memory is not paused, and the account is not going. Claiming moves
 * the time of the request to now, so a build due at the same moment, or
 * scheduled by an earlier request and running a moment later, finds that its
 * quiet has not come: however many builds are scheduled, one reads and asks the
 * model. When there are memories to hand on, so that the build goes to the
 * model, claiming also stamps `builtAt`, which closes the day for memories that
 * are only added. A build that hands on nothing leaves the day open.
 *
 * The memories are the learner's newest, at most `PORTRAIT_MEMORY_LIMIT`,
 * confirmed after what the portrait has read and after the moment the learner
 * last deleted them all, in one range of one index. A situation has an end date
 * and a portrait keeps what lasts, so a situation is read but never handed on:
 * `reached` counts it, and the next build does not read it again. It reads at
 * most 44 documents: the portrait, the learner's memory state, the account, the
 * memories, and the learner's key, and it writes the portrait row.
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
  const newest = yield* readNewest(
    userId,
    PORTRAIT_MEMORY_LIMIT,
    Math.max(row.through, clearedAt ?? 0)
  );
  const lasting = Arr.filter(newest, (memory) => memory.kind !== "situation");
  const reached = Arr.head(newest).pipe(
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
    return { memories: [], reached, through: row.through };
  }
  const keys = yield* readLearnerKeys(userId).pipe(Effect.orDie);
  return {
    memories: Arr.map(
      yield* openWith(keys, lasting).pipe(Effect.orDie),
      toNote
    ),
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
