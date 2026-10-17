import { FunctionImpl, GroupImpl } from "@confect/server";
import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import schema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/nina/fingerprints.spec";
import { Array as Arr, Duration, Effect, Layer, Schema, Struct } from "effect";

/** A settled turn, as the table stores it. */
type SettledTurn = Extract<NinaTurnsDoc, { phase: "settled" }>;

/**
 * How many turns one call reads. It has the size of the seal drain's candidate page
 * (`sealed/drain.ts`), the bound that the seal already reads turns by.
 */
const TURN_PAGE = 10;

/**
 * The unkeyed request fingerprint that `turns.start` stored before the keyed one: the
 * lower-case hexadecimal SHA-256 digest of the request, 64 characters (`utilities/digest.ts`).
 * The keyed fingerprint is 22 URL-safe characters (`vault/text.ts`), so the length tells
 * the two forms apart.
 */
const UnkeyedFingerprint = Schema.String.check(
  Schema.isPattern(/^[0-9a-f]{64}$/u)
);
const isUnkeyed = Schema.is(UnkeyedFingerprint);

/**
 * Clears the unkeyed fingerprint of each settled turn on one page of the table, and
 * schedules the next page while the table has more (`fingerprints.spec.ts`). An active
 * turn is counted and never written. A dry run counts the same and writes nothing.
 */
const clear = FunctionImpl.make(
  schema,
  spec,
  "clear",
  Effect.fn("nina.fingerprints.clear")(function* ({ cursor, dryRun }) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const page = yield* reader
      .table("ninaTurns")
      .index("by_creation_time")
      .paginate({ cursor: cursor ?? null, numItems: TURN_PAGE })
      .pipe(Effect.orDie);
    const unkeyed = Arr.filter(page.page, (turn) =>
      isUnkeyed(turn.fingerprint)
    );
    const active = Arr.filter(unkeyed, (turn) => turn.phase === "active");
    const settled = Arr.filter(
      unkeyed,
      (turn): turn is SettledTurn => turn.phase === "settled"
    );
    // The active turns are counted above and never written: their contract requires a
    // fingerprint, so only a settled turn loses its unkeyed one.
    if (!dryRun) {
      yield* Effect.forEach(
        settled,
        (turn) =>
          writer
            .table("ninaTurns")
            .replace(turn._id, Struct.omit(turn, ["fingerprint"]))
            .pipe(Effect.orDie),
        { discard: true }
      );
    }
    const result = {
      activeOld: active.length,
      cleared: settled.length,
      done: page.isDone,
      scanned: page.page.length,
    };
    if (!page.isDone) {
      yield* (yield* Scheduler).runAfter(
        Duration.zero,
        refs.internal.nina.fingerprints.clear,
        { cursor: page.continueCursor, dryRun }
      );
    }
    yield* Effect.logInfo("Nina fingerprints page", { ...result, dryRun });
    return result;
  })
);

/** Implements the one-off group of `fingerprints.spec.ts`. */
export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(clear),
  GroupImpl.finalize
);
