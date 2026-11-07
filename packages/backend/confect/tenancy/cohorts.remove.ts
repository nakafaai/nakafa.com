import { FunctionImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { cohortAuthority } from "@repo/backend/confect/tenancy/authority";
import spec from "@repo/backend/confect/tenancy/cohorts.spec";
import { CohortInUse } from "@repo/backend/confect/tenancy/errors";
import { clearRemovedHomeroom } from "@repo/backend/confect/tenancy/write/assignment";
import { cohortHold } from "@repo/backend/confect/tenancy/write/holds";
import { Effect, Option } from "effect";

/**
 * Deletes one cohort that nothing uses, active or archived, such as one made by mistake. The school's Admin deletes it
 * at the school level, as a restore does, because an archived cohort refuses every action on its own row. A cohort that
 * a person, a homeroom teacher, a class, a sitting, a report card or a letter still points at is refused with what holds
 * it (`CohortInUse`), so no record loses its cohort: such a cohort is archived instead. A removed teacher's row goes
 * with the cohort, and the journal keeps the deletion.
 */
export const remove = FunctionImpl.make(
  databaseSchema,
  spec,
  "remove",
  Effect.fn("tenancy.cohorts.remove")(function* ({ cohortId }) {
    const { person, tenant } = yield* Member;
    const cohort = yield* (yield* DatabaseReader)
      .table("tenantCohorts")
      .get(cohortId)
      .pipe(
        Effect.catchTags({
          DocumentDecodeError: Effect.die,
          GetByIdFailure: () =>
            new AccessDenied({ action: "cohort.manage", reason: "resource" }),
        })
      );
    if (cohort.tenantId !== tenant._id) {
      return yield* new AccessDenied({
        action: "cohort.manage",
        reason: "resource",
      });
    }
    const hold = yield* cohortHold(cohort._id);
    if (Option.isSome(hold)) {
      return yield* new CohortInUse({ holds: hold.value });
    }
    const actor = personActor(person);
    yield* cohortAuthority.record(actor, cohort, { type: "cohort.removed" });
    yield* clearRemovedHomeroom(actor, cohort);
    yield* (yield* DatabaseWriter)
      .table("tenantCohorts")
      .delete(cohort._id)
      .pipe(Effect.orDie);
    return null;
  })
);
