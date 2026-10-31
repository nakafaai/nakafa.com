import type { ExamSittingsDoc } from "@repo/backend/confect/_generated/docs";
import notificationsInternal from "@repo/backend/confect/_generated/refs/notifications.server";
import {
  DatabaseReader,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import {
  deliveriesOf,
  deliveryInstant,
} from "@repo/backend/confect/notifications/delivery";
import type { Relation } from "@repo/backend/confect/notifications/rules";
import type { SittingNotice } from "@repo/backend/confect/notifications/sittings.spec";
import { Array as Arr, DateTime, Effect, Result } from "effect";

/** Who each notice of a sitting reaches, as the rules name the relation. */
const RELATION_OF = {
  examGuardianReminder: "guardian",
  examStart: "student",
} as const satisfies Record<typeof SittingNotice.Type, typeof Relation.Type>;

/**
 * Schedules the runs that write a coming sitting's notices: for each notice, one run at each time the rules give its
 * inbox send, counted from the sitting's opening on the clock of its unit (ADR 0027). A time already past runs at
 * once. Answers the scheduled jobs, which the sitting keeps, so cancelling or closing it cancels the runs that wait.
 */
export const scheduleSittingNotices = Effect.fn(
  "notifications.sittings.schedule"
)(function* (sitting: Pick<ExamSittingsDoc, "_id" | "opensAt" | "unitId">) {
  const unit = yield* (yield* DatabaseReader)
    .table("tenantUnits")
    .get(sitting.unitId)
    .pipe(Effect.orDie);
  // A unit's time zone is checked as an IANA zone where it is written, so one that does not read is a defect.
  const zone = yield* DateTime.zoneMakeNamedEffect(unit.timeZone).pipe(
    Effect.orDie
  );
  const scheduler = yield* Scheduler;
  const anchor = DateTime.makeUnsafe(sitting.opensAt);
  const runs = Arr.flatMap(
    ["examStart", "examGuardianReminder"] as const,
    (notice) =>
      Arr.filterMap(
        deliveriesOf(notice, RELATION_OF[notice], false),
        (delivery) =>
          delivery.channel === "inbox"
            ? Result.succeed({
                at: deliveryInstant(anchor, delivery.timing, zone),
                notice,
              })
            : Result.failVoid
      )
  );
  return yield* Effect.forEach(runs, ({ at, notice }) =>
    scheduler.runAt(at, notificationsInternal.sittings.run, {
      cursor: null,
      notice,
      sittingId: sitting._id,
    })
  );
});
