import type {
  ExamSittingsDoc,
  TenantUnitsDoc,
} from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { resultAuthority } from "@repo/backend/confect/exams/results/authority";
import { sittingViews } from "@repo/backend/confect/exams/sittings/view";
import { Array as Arr, Effect, Order } from "effect";

/**
 * The most closed sittings that the school home lists for results. Each unit is read for at most this many,
 * and the newest of all the units are kept, so the bound never hides a sitting that the list would show.
 */
const RESULT_ROWS = 5;

/** The sittings with the newest opening first, which the results list shows. */
const byNewestOpening = Order.flip(
  Order.mapInput(
    Order.Number,
    (sitting: Pick<ExamSittingsDoc, "opensAt">) => sitting.opensAt
  )
);

/** The newest closed sittings of one unit, read by its index in one bounded call. */
const closedRows = Effect.fn("exams.home.results.rows")(function* (
  unitId: ExamSittingsDoc["unitId"]
) {
  return yield* (yield* DatabaseReader)
    .table("examSittings")
    .index(
      "by_unitId_and_state_and_opensAt",
      (query) => query.eq("unitId", unitId).eq("state", "closed"),
      "desc"
    )
    .take(RESULT_ROWS)
    .pipe(Effect.orDie);
});

/**
 * The closed sittings in the units that the viewer watches, whose results the viewer may view, newest opening
 * first, at most `RESULT_ROWS`. Each one carries whether its results are released and whether the viewer may
 * release them, both read from the results authority, so the list never claims an action the viewer does not hold.
 */
export const closedResults = Effect.fn("exams.home.results")(function* (
  units: readonly TenantUnitsDoc[]
) {
  const rows = Arr.flatten(
    yield* Effect.forEach(units, (unit) => closedRows(unit._id))
  );
  const decided = yield* Effect.forEach(
    Arr.sort(rows, byNewestOpening),
    (row) =>
      resultAuthority
        .allowed(row)
        .pipe(Effect.map((actions) => ({ actions, row })))
  );
  const viewable = Arr.take(
    Arr.filter(decided, ({ actions }) => Arr.contains(actions, "result.view")),
    RESULT_ROWS
  );
  const views = yield* sittingViews(Arr.map(viewable, ({ row }) => row));
  return Arr.zipWith(viewable, views, ({ actions, row }, view) => ({
    ...view,
    canRelease: Arr.contains(actions, "result.release"),
    resultsReleased: row.resultsReleasedAt !== undefined,
  }));
});
