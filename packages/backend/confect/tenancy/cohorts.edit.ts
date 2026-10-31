import { FunctionImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { Cohort } from "@repo/backend/confect/tenancy/access";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { cohortAuthority } from "@repo/backend/confect/tenancy/authority";
import {
  cohortNameKey,
  cohortView,
} from "@repo/backend/confect/tenancy/cohort";
import spec from "@repo/backend/confect/tenancy/cohorts.spec";
import { CohortNameTaken } from "@repo/backend/confect/tenancy/errors";
import { Effect, Option, Struct } from "effect";

/**
 * Sets the name and the school year of one cohort, which its creation chose. The name stays unique within its
 * period, and a name that only differs in case from the cohort's own is not taken by the cohort itself. Each value
 * that changes is recorded on its own, and values already stored write and record nothing.
 */
export const edit = FunctionImpl.make(
  databaseSchema,
  spec,
  "edit",
  Effect.fn("tenancy.cohorts.edit")(function* ({ grade, name }) {
    const { person } = yield* Member;
    const cohort = yield* Cohort;
    if (cohort.grade === grade && cohort.name === name) {
      return cohortView(cohort);
    }
    const nameKey = cohortNameKey(name);
    const sameName = yield* (yield* DatabaseReader)
      .table("tenantCohorts")
      .index("by_periodId_and_nameKey", (query) =>
        query.eq("periodId", cohort.periodId).eq("nameKey", nameKey)
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.exists(sameName, (other) => other._id !== cohort._id)) {
      return yield* new CohortNameTaken();
    }
    const edited = Struct.assign(cohort, { grade, name, nameKey });
    yield* (yield* DatabaseWriter)
      .table("tenantCohorts")
      .replace(cohort._id, Struct.omit(edited, ["_creationTime", "_id"]))
      .pipe(Effect.orDie);
    if (cohort.name !== name) {
      yield* cohortAuthority.record(personActor(person), cohort, {
        type: "cohort.renamed",
      });
    }
    if (cohort.grade !== grade) {
      yield* cohortAuthority.record(personActor(person), cohort, {
        grade,
        type: "cohort.grade.set",
      });
    }
    return cohortView(edited);
  })
);
