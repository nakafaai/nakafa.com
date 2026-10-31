import { FunctionImpl, GroupImpl } from "@confect/server";
import recordsInternal from "@repo/backend/confect/_generated/refs/records.server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import {
  firstActiveUnit,
  required,
  tenantOf,
} from "@repo/backend/confect/acceptance/lookup";
import { requireAcceptanceSeed } from "@repo/backend/confect/acceptance/seed";
import { activeOwners, assignRole } from "@repo/backend/confect/access/grant";
import { contentHash } from "@repo/backend/confect/records/card";
import type { ReportSubject } from "@repo/backend/confect/records/report";
import spec from "@repo/backend/confect/records/seed.spec";
import {
  schoolKeys,
  writeRosterEntry,
} from "@repo/backend/confect/roster/entry";
import { Nisn } from "@repo/backend/confect/roster/schema";
import { systemActor } from "@repo/backend/confect/tenancy/actor";
import { cohortNameKey } from "@repo/backend/confect/tenancy/cohort";
import { lastGradeOf } from "@repo/backend/confect/tenancy/promotion/destination";
import { Npsn } from "@repo/backend/confect/tenancy/schema";
import {
  Array as Arr,
  Clock,
  Duration,
  Effect,
  Layer,
  Schema,
  Struct,
} from "effect";

/** The NPSN a seeded unit takes when it has none, and the NISN of the seeded learner. */
const SEED_NPSN = Schema.decodeSync(Npsn)("20212345");
const SEED_NISN = Schema.decodeSync(Nisn)("0012345678");

/** The grades the seeded learner's locked report card copies. */
const seedSubjects = (cohort: string): (typeof ReportSubject.Type)[] => [
  {
    className: `Bahasa Indonesia ${cohort}`,
    kktp: "reached",
    subject: "Bahasa Indonesia",
    value: 91,
  },
  {
    className: `Matematika ${cohort}`,
    kktp: "reached",
    subject: "Matematika",
    value: 86,
  },
];

/**
 * Seeds a graduation in the running local acceptance backend: a class group of the last grade of
 * the school's first active unit in its active period, with the learner of the address placed in
 * it with a NISN on file, the unit's NPSN, and the learner's report card approved by the Owner,
 * whose PDF is drawn next, which locks it. A browser test then records the decision and issues
 * the SKL through the pages.
 */
const graduation = FunctionImpl.make(
  databaseSchema,
  spec,
  "graduation",
  Effect.fn("records.seed.graduation")(function* ({ email, slug }) {
    yield* requireAcceptanceSeed();
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const tenant = yield* tenantOf(slug);
    const unit = yield* firstActiveUnit(tenant._id);
    const period = yield* required(
      yield* reader
        .table("tenantPeriods")
        .index("by_unitId_and_status", (query) =>
          query.eq("unitId", unit._id).eq("status", "active")
        )
        .first()
        .pipe(Effect.orDie),
      "The unit has no active period."
    );
    const grade = yield* required(
      lastGradeOf(unit.level),
      "The unit has no last grade."
    );
    const user = yield* required(
      yield* reader
        .table("users")
        .index("by_email", (query) => query.eq("email", email))
        .first()
        .pipe(Effect.orDie),
      "No account holds this address."
    );
    const learner = yield* required(
      yield* reader
        .table("tenantPeople")
        .index("by_tenantId_and_account_userId", (query) =>
          query.eq("tenantId", tenant._id).eq("account.userId", user._id)
        )
        .first()
        .pipe(Effect.orDie),
      "This address is not a member of the school."
    );
    const owner = yield* required(
      Arr.head(yield* activeOwners(tenant._id)),
      "The school has no Owner."
    );
    yield* assignRole(systemActor, learner, "student", {
      kind: "unit",
      unitId: unit._id,
    }).pipe(Effect.orDie);
    if (unit.npsn === undefined) {
      yield* writer
        .table("tenantUnits")
        .replace(unit._id, {
          ...Struct.omit(unit, ["_creationTime", "_id"]),
          npsn: SEED_NPSN,
        })
        .pipe(Effect.orDie);
    }
    yield* writeRosterEntry(yield* schoolKeys(tenant._id), learner, SEED_NISN);
    const name = `${grade}-Lulus`;
    const cohortId = yield* writer
      .table("tenantCohorts")
      .insert({
        grade,
        name,
        nameKey: cohortNameKey(name),
        periodId: period._id,
        status: "active",
        tenantId: tenant._id,
        unitId: unit._id,
      })
      .pipe(Effect.orDie);
    yield* writer
      .table("tenantCohortMembers")
      .insert({
        cohortId,
        periodId: period._id,
        personId: learner._id,
        tenantId: tenant._id,
      })
      .pipe(Effect.orDie);
    const now = yield* Clock.currentTimeMillis;
    const subjects = seedSubjects(name);
    const reportId = yield* writer
      .table("reportCards")
      .insert({
        cohortId,
        createdAt: now,
        note: "",
        periodId: period._id,
        personId: learner._id,
        state: "draft",
        tenantId: tenant._id,
        updatedAt: now,
      })
      .pipe(Effect.orDie);
    const hash = yield* contentHash({
      approvedAt: now,
      id: reportId,
      note: "",
      personId: learner._id,
      subjects,
    });
    yield* writer
      .table("reportCards")
      .replace(reportId, {
        approvedAt: now,
        approvedBy: owner.personId,
        cohortId,
        completedAt: now,
        createdAt: now,
        hash,
        note: "",
        periodId: period._id,
        personId: learner._id,
        state: "approved",
        subjects,
        tenantId: tenant._id,
        updatedAt: now,
      })
      .pipe(Effect.orDie);
    yield* (yield* Scheduler)
      .runAfter(Duration.zero, recordsInternal.draw.report, { reportId })
      .pipe(Effect.orDie);
    return { cohort: name, cohortId };
  })
);

/** Implements the acceptance seed of `seed.spec.ts`. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(graduation),
  GroupImpl.finalize
);
