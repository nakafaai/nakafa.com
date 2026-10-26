import refs from "@repo/backend/confect/_generated/refs";
import { timed } from "@repo/backend/scripts/load/recorder";
import type { Seating } from "@repo/backend/scripts/load/student";
import { type Wire, watch } from "@repo/backend/scripts/load/wire";
import {
  Array as Arr,
  Deferred,
  Effect,
  MutableHashSet,
  Queue,
  type Scope,
} from "effect";

const sittings = refs.public.exams.sittings;

/** The seats that one page of a room's dashboard holds, the most the dashboard serves. */
const PAGE_SIZE = 100;

/**
 * One proctor of a run: the room it watches, `open`, which opens its browser's connection for
 * as long as its scope lasts, and `done`, which completes once every student has finished.
 */
export interface ProctorInput {
  readonly done: Deferred.Deferred<void>;
  readonly open: Effect.Effect<Wire, never, Scope.Scope>;
  readonly seating: Omit<typeof Seating.Type, "token">;
}

/**
 * Watches one room as a proctor's dashboard does until the run is done (K25): the first page of
 * the room's seats, and each seat's latest answer, which the dashboard reads per seat so an
 * answer runs only that seat's query again. A seat is watched from the first page that shows
 * it, and each first read is recorded with its timing.
 */
export const runProctor = Effect.fn("load.proctor")(function* (
  input: ProctorInput
) {
  const { sittingId, slug } = input.seating;
  const wire = yield* input.open;
  const seats = yield* Queue.unbounded<string>();
  const seen = MutableHashSet.empty<string>();
  const page = yield* watch(
    wire,
    sittings.dashboard,
    { paginationOpts: { cursor: null, numItems: PAGE_SIZE }, sittingId, slug },
    (dashboard) => {
      for (const attempt of dashboard.attempts.page) {
        if (!MutableHashSet.has(seen, attempt.id)) {
          MutableHashSet.add(seen, attempt.id);
          Queue.offerUnsafe(seats, attempt.id);
        }
      }
    }
  );
  yield* timed("query:dashboard", Deferred.await(page)).pipe(Effect.result);
  // Each seat that a page shows is watched until the run is done.
  yield* Effect.raceFirst(
    Deferred.await(input.done),
    Effect.forever(
      Effect.flatMap(Queue.take(seats), (attemptId) =>
        Effect.flatMap(
          watch(
            wire,
            sittings.lastAnswer,
            { attemptId, sittingId, slug },
            () => undefined
          ),
          (answered) =>
            timed("query:lastAnswer", Deferred.await(answered)).pipe(
              Effect.result
            )
        )
      )
    )
  );
  return Arr.fromIterable(seen).length;
}, Effect.scoped);
