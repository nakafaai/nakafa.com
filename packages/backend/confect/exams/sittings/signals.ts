import type { ExamAttemptsDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Sitting } from "@repo/backend/confect/exams/sittings/access";
import { attemptIn } from "@repo/backend/confect/exams/sittings/attempt";
import type { PaginationOptions } from "convex/server";
import { Array as Arr, Effect, Number as Num, Struct } from "effect";

/** The most signals that one page of an attempt's signals holds. A larger request is clamped to it. */
const SIGNAL_PAGE_SIZE = 100;

/**
 * One page of an attempt's integrity signals, newest first, for a proctor who may view the
 * sitting. The attempt must belong to that sitting. A page asks for at most `SIGNAL_PAGE_SIZE`
 * signals, and a larger request is clamped to that size, so every read is bounded (ADR 0013).
 */
export const signals = Effect.fn("exams.sittings.signals")(function* (args: {
  attemptId: ExamAttemptsDoc["_id"];
  paginationOpts: PaginationOptions;
}) {
  const sitting = yield* Sitting;
  const attempt = yield* attemptIn(sitting, args.attemptId, "sitting.view");
  const page = yield* (yield* DatabaseReader)
    .table("examSignals")
    .index(
      "by_attemptId_and_at",
      (query) => query.eq("attempt", attempt._id),
      "desc"
    )
    .paginate(
      Struct.assign(args.paginationOpts, {
        numItems: Num.clamp(args.paginationOpts.numItems, {
          maximum: SIGNAL_PAGE_SIZE,
          minimum: 1,
        }),
      })
    )
    .pipe(Effect.orDie);
  return Struct.assign(page, {
    page: Arr.map(page.page, (signal) => ({
      at: signal.at,
      kind: signal.kind,
    })),
  });
});
