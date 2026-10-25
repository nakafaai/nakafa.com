import type {
  ExamSittingsDoc,
  TenantUnitsDoc,
} from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { HOME_RESULT_LIMIT } from "@repo/backend/confect/exams/home/bounds";
import { resultAuthority } from "@repo/backend/confect/exams/results/authority";
import { sittingViews } from "@repo/backend/confect/exams/sittings/view";
import { Array as Arr, Effect, Order } from "effect";

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
    .take(HOME_RESULT_LIMIT)
    .pipe(Effect.orDie);
});

/**
 * The closed sittings in the units that the viewer watches, whose results the viewer may view, newest opening
 * first, at most `HOME_RESULT_LIMIT`. Each one carries whether its results are released, and whether the viewer may
 * still release them: the results authority allows the release, and no release has been journaled yet. A second
 * release changes nothing, so a released sitting offers none.
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
    HOME_RESULT_LIMIT
  );
  const views = yield* sittingViews(Arr.map(viewable, ({ row }) => row));
  return Arr.zipWith(viewable, views, ({ actions, row }, view) => {
    const released = row.resultsReleasedAt !== undefined;
    return {
      ...view,
      canRelease: !released && Arr.contains(actions, "result.release"),
      resultsReleased: released,
    };
  });
});
