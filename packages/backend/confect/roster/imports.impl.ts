import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import {
  openNisn,
  rosterEntryOf,
  schoolKeys,
} from "@repo/backend/confect/roster/entry";
import {
  applyRow,
  applySourcedRow,
  importSummary,
} from "@repo/backend/confect/roster/import";
import spec from "@repo/backend/confect/roster/imports.spec";
import type { RosterLine } from "@repo/backend/confect/roster/schema";
import { Period } from "@repo/backend/confect/tenancy/access";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import {
  periodAccess,
  periodAuthority,
} from "@repo/backend/confect/tenancy/authority";
import { Effect, Layer, Option, Struct } from "effect";

/** Journals one batch on the period as `roster.imported` with its counts, and answers them. */
const journalBatch = Effect.fn("roster.imports.journal")(function* (
  source: "classroom" | "dapodik" | "oneroster",
  outcomes: Parameters<typeof importSummary>[0]
) {
  const { person: actor } = yield* Member;
  const period = yield* Period;
  const summary = importSummary(outcomes);
  yield* periodAuthority.record(personActor(actor), period, {
    ...summary,
    source,
    type: "roster.imported",
  });
  return summary;
});

/**
 * Applies one batch of Dapodik rows in one transaction: a batch that fails writes nothing, and
 * a retry of the same file adds no duplicate, because each NISN names its student.
 */
const apply = FunctionImpl.make(
  databaseSchema,
  spec,
  "apply",
  Effect.fn("roster.imports.apply")(function* ({ rows }) {
    const { person: actor } = yield* Member;
    const period = yield* Period;
    const keys = yield* schoolKeys(period.tenantId);
    const outcomes = yield* Effect.forEach(rows, (row) =>
      applyRow(personActor(actor), period, keys, row)
    );
    return yield* journalBatch("dapodik", outcomes);
  })
);

/**
 * Applies one batch of OneRoster or Classroom rows in one transaction: a retry adds no
 * duplicate, because each source identity names its student.
 */
const applySourced = FunctionImpl.make(
  databaseSchema,
  spec,
  "applySourced",
  Effect.fn("roster.imports.applySourced")(function* ({ rows, source }) {
    const { person: actor } = yield* Member;
    const period = yield* Period;
    const keys = yield* schoolKeys(period.tenantId);
    const outcomes = yield* Effect.forEach(rows, (row) =>
      applySourcedRow(personActor(actor), period, keys, row)
    );
    return yield* journalBatch(source, outcomes);
  })
);

/**
 * The students placed in the period, a page at a time, with the NISN on file and the class
 * group, for the export that the school compares with Dapodik. The NISN is opened under
 * the school key, read once for the page, so only the school's Admin and Staff read it.
 */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("roster.imports.list")(function* ({ paginationOpts }) {
    const period = yield* Period;
    const reader = yield* DatabaseReader;
    const keys = yield* schoolKeys(period.tenantId);
    const page = yield* reader
      .table("tenantCohortMembers")
      .index("by_periodId_and_personId", (query) =>
        query.eq("periodId", period._id)
      )
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    const lines = yield* Effect.forEach(page.page, (placement) =>
      Effect.gen(function* () {
        const [person, cohort, entry] = yield* Effect.all([
          reader
            .table("tenantPeople")
            .get(placement.personId)
            .pipe(Effect.orDie),
          reader
            .table("tenantCohorts")
            .get(placement.cohortId)
            .pipe(Effect.orDie),
          rosterEntryOf(placement.personId),
        ]);
        const nisn = yield* Option.match(entry, {
          onNone: () => Effect.succeedNone,
          onSome: (found) => openNisn(keys, found),
        });
        const line: typeof RosterLine.Type = {
          cohortName: cohort.name,
          name: person.name,
          nisn: Option.getOrNull(nisn),
        };
        return line;
      })
    );
    return Struct.assign(page, { page: lines });
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  Layer.provide(apply),
  Layer.provide(applySourced),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(periodAccess),
  GroupImpl.finalize
);
