import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  DocumentIds,
} from "@repo/backend/confect/_generated/services";
import { classAuthority } from "@repo/backend/confect/classroom/authority";
import {
  clientRead,
  FORBIDDEN,
  lists,
  periodFor,
} from "@repo/backend/confect/integrations/reads";
import spec from "@repo/backend/confect/integrations/writes.spec";
import { draftGrade } from "@repo/backend/confect/records/grades/enter";
import { schoolKeys } from "@repo/backend/confect/roster/entry";
import { applyRow, importSummary } from "@repo/backend/confect/roster/import";
import { clientActor } from "@repo/backend/confect/tenancy/actor";
import { periodAuthority } from "@repo/backend/confect/tenancy/authority";
import { Clock, Duration, Effect, Layer, Option } from "effect";

/** How long a request's record stays: the target of ADR 0029. */
const REQUEST_TERM = Duration.hours(24);

/** Records one sweep deletes; a backlog takes more runs. */
const SWEEP_LIMIT = 200;

/**
 * Applies one batch of a client's roster import, as the school's own import does, with the
 * client as the journal's actor. A repeat of a key answers its first result, and the same key
 * with another request is refused. The client's list and scope are decided before any row.
 */
const importRoster = FunctionImpl.make(
  databaseSchema,
  spec,
  "importRoster",
  Effect.fn("integrations.writes.importRoster")(function* ({
    clientId,
    digest,
    key,
    period,
    rows,
  }) {
    const read = yield* clientRead(clientId);
    const repeat = yield* (yield* DatabaseReader)
      .table("integrationRequests")
      .index("by_clientId_and_key", (query) =>
        query.eq("clientId", clientId).eq("key", key)
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.isSome(repeat)) {
      return repeat.value.digest === digest
        ? { outcome: "applied" as const, summary: repeat.value.summary }
        : { outcome: "conflict" as const };
    }
    const found = yield* periodFor(read, period);
    if (Option.isNone(found) || !lists(read, "roster.import")) {
      return FORBIDDEN;
    }
    const allowed = yield* periodAuthority.allowsClient(
      "roster.import",
      found.value,
      read
    );
    if (!allowed) {
      return FORBIDDEN;
    }
    const actor = clientActor(read.client);
    const keys = yield* schoolKeys(read.tenant._id);
    // A refused row ends the transaction, so the batch writes nothing.
    const outcomes = yield* Effect.forEach(rows, (row) =>
      applyRow(actor, found.value, keys, row)
    ).pipe(Effect.catchTag("GrantRejected", Effect.die));
    const summary = importSummary(outcomes);
    yield* periodAuthority.record(actor, found.value, {
      ...summary,
      source: "dapodik",
      type: "roster.imported",
    });
    const now = yield* Clock.currentTimeMillis;
    yield* (yield* DatabaseWriter)
      .table("integrationRequests")
      .insert({
        clientId,
        digest,
        expiresAt: now + Duration.toMillis(REQUEST_TERM),
        key,
        summary,
      })
      .pipe(Effect.orDie);
    return { outcome: "applied" as const, summary };
  })
);

/** Deletes the records past their term. */
const sweep = FunctionImpl.make(
  databaseSchema,
  spec,
  "sweep",
  Effect.fn("integrations.writes.sweep")(function* () {
    const now = yield* Clock.currentTimeMillis;
    const expired = yield* (yield* DatabaseReader)
      .table("integrationRequests")
      .index("by_expiresAt", (query) => query.lte("expiresAt", now))
      .take(SWEEP_LIMIT)
      .pipe(Effect.orDie);
    const writer = yield* DatabaseWriter;
    yield* Effect.forEach(
      expired,
      (row) =>
        writer.table("integrationRequests").delete(row._id).pipe(Effect.orDie),
      { discard: true }
    );
    return null;
  })
);

/**
 * Writes a client's draft of one student's grade, as a teacher's entry does, so a teacher still
 * reads and releases it. Writing the same value twice leaves one draft, so a retry needs no key.
 * A class the client's list or scope does not open answers forbidden, whether or not it exists.
 */
const enterGrade = FunctionImpl.make(
  databaseSchema,
  spec,
  "enterGrade",
  Effect.fn("integrations.writes.enterGrade")(function* ({
    classId,
    clientId,
    personId,
    value,
  }) {
    const read = yield* clientRead(clientId);
    const ids = yield* DocumentIds;
    const klass = yield* ids.parse("classes", classId);
    const person = yield* ids.parse("tenantPeople", personId);
    if (
      Option.isNone(klass) ||
      Option.isNone(person) ||
      !lists(read, "grade.import")
    ) {
      return FORBIDDEN;
    }
    const row = yield* (yield* DatabaseReader)
      .table("classes")
      .get(klass.value)
      .pipe(Effect.option);
    if (
      Option.isNone(row) ||
      !(yield* classAuthority.allowsClient("grade.import", row.value, read))
    ) {
      return FORBIDDEN;
    }
    return yield* draftGrade(row.value, person.value, value).pipe(
      Effect.map((grade) => ({
        grade: { id: grade.id, value: grade.value },
        outcome: "entered" as const,
      })),
      Effect.catchTags({
        GradeNotPlaced: () => Effect.succeed({ outcome: "notPlaced" as const }),
        GradeReleased: () => Effect.succeed({ outcome: "released" as const }),
      })
    );
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(enterGrade),
  Layer.provide(importRoster),
  Layer.provide(sweep),
  GroupImpl.finalize
);
