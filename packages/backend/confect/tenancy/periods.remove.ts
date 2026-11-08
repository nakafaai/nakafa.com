import { FunctionImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { periodAuthority } from "@repo/backend/confect/tenancy/authority";
import { PeriodInUse } from "@repo/backend/confect/tenancy/errors";
import spec from "@repo/backend/confect/tenancy/periods.spec";
import { periodHold } from "@repo/backend/confect/tenancy/write/holds";
import { Effect, Option } from "effect";

/**
 * Deletes one period that nothing uses, planned or archived, such as one made with the wrong dates. The school's Admin
 * deletes it at the school level, as a restore does, because an archived period refuses every action on its own row.
 * The active period, and a period that a cohort, a class, a grade, a graduation or a promotion still points at, is
 * refused with what holds it (`PeriodInUse`), so no record loses its period: such a period is archived instead. The
 * journal keeps the deletion.
 */
export const remove = FunctionImpl.make(
  databaseSchema,
  spec,
  "remove",
  Effect.fn("tenancy.periods.remove")(function* ({ periodId }) {
    const { person } = yield* Member;
    const period = yield* periodAuthority.lifecycle("period.manage", periodId);
    const hold = yield* periodHold(period);
    if (Option.isSome(hold)) {
      return yield* new PeriodInUse({ holds: hold.value });
    }
    yield* periodAuthority.record(personActor(person), period, {
      type: "period.removed",
    });
    yield* (yield* DatabaseWriter)
      .table("tenantPeriods")
      .delete(period._id)
      .pipe(Effect.orDie);
    return null;
  })
);
