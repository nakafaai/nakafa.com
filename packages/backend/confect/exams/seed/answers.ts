import type { PaginationOptions } from "@confect/core/PaginationOptions";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { requireAcceptanceSeed } from "@repo/backend/confect/acceptance/seed";
import { Array as Arr, Effect, Number as Num, Struct } from "effect";

/**
 * The most stored answers one page reads: a few megabytes of rows, well inside a query's limits
 * of 16 MiB read and 32,000 documents scanned. The load test's 3,000 students store 120,000.
 */
export const ANSWER_PAGE_MAX = 4000;

/**
 * One page of every stored answer in creation order, for the load test's audit (K26): each
 * row's attempt, question, response and version, which the test checks against what every
 * student was told. The whole table is read in pages, since one query cannot scan it.
 */
export const storedAnswers = Effect.fn("exams.seed.answers")(function* (
  paginationOpts: typeof PaginationOptions.Type
) {
  yield* requireAcceptanceSeed();
  const page = yield* (yield* DatabaseReader)
    .table("examAnswers")
    .index("by_creation_time")
    .paginate(
      Struct.assign(paginationOpts, {
        numItems: Num.min(paginationOpts.numItems, ANSWER_PAGE_MAX),
      })
    )
    .pipe(Effect.orDie);
  return Struct.assign(page, {
    page: Arr.map(
      page.page,
      Struct.pick(["attempt", "question", "response", "version"])
    ),
  });
});
