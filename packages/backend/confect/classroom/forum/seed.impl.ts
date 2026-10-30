import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { requireAcceptanceSeed } from "@repo/backend/confect/acceptance/seed";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { assignRole } from "@repo/backend/confect/access/grant";
import { holdersOf } from "@repo/backend/confect/classroom/classes/address";
import { moveMark } from "@repo/backend/confect/classroom/forum/mark";
import { messageField } from "@repo/backend/confect/classroom/forum/message";
import spec from "@repo/backend/confect/classroom/forum/seed.spec";
import { schoolKeys } from "@repo/backend/confect/classroom/forum/views";
import { systemActor } from "@repo/backend/confect/tenancy/actor";
import { TenantNotFound } from "@repo/backend/confect/tenancy/errors";
import { sealText } from "@repo/backend/confect/vault/text";
import { Array as Arr, Clock, Effect, Layer, Option } from "effect";

/** The gap between two seeded messages. */
const SEED_GAP_MILLISECONDS = 60_000;

/** The most subject teachers whose read mark a seed moves; an acceptance class has one. */
const SEED_TEACHER_LIMIT = 16;

/**
 * Writes the history of the general channel of the school's class at `classSlug`:
 * a classmate Person, a student placed in the class's cohort, writes `count`
 * sealed messages, numbered from 1, the newest now, and each subject teacher of
 * the class has read the first `read` of them.
 */
const history = FunctionImpl.make(
  databaseSchema,
  spec,
  "history",
  Effect.fn("classroom.forum.seed.history")(function* ({
    classSlug,
    count,
    read,
    slug,
  }) {
    yield* requireAcceptanceSeed();
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const tenant = yield* reader
      .table("tenants")
      .index("by_slug", (query) => query.eq("slug", slug))
      .first()
      .pipe(Effect.orDie);
    if (Option.isNone(tenant)) {
      return yield* new TenantNotFound();
    }
    const klass = Arr.head(
      yield* holdersOf(tenant.value._id, classSlug).pipe(Effect.orDie)
    );
    if (Option.isNone(klass)) {
      return yield* new AccessDenied({
        action: "forum.read",
        reason: "resource",
      });
    }
    const row = klass.value;
    const general = yield* reader
      .table("classroomChannels")
      .index("by_classId_and_position", (query) =>
        query.eq("classId", row._id).eq("position", 0)
      )
      .first()
      .pipe(Effect.orDie, Effect.flatMap(Effect.fromOption), Effect.orDie);
    const authorId = yield* writer
      .table("tenantPeople")
      .insert({
        account: { state: "unclaimed" },
        kind: "member",
        name: "Raka Pratama",
        status: "active",
        tenantId: row.tenantId,
      })
      .pipe(Effect.orDie);
    // The classmate is a student placed in the class's cohort, so it writes in the class and a
    // writer may mention it.
    yield* writer
      .table("tenantCohortMembers")
      .insert({
        cohortId: row.cohortId,
        periodId: row.periodId,
        personId: authorId,
        tenantId: row.tenantId,
      })
      .pipe(Effect.orDie);
    yield* assignRole(
      systemActor,
      yield* reader.table("tenantPeople").get(authorId).pipe(Effect.orDie),
      "student",
      { kind: "unit", unitId: row.unitId }
    ).pipe(Effect.orDie);
    const keys = yield* schoolKeys(row.tenantId);
    const now = yield* Clock.currentTimeMillis;
    const written = yield* Effect.forEach(Arr.range(1, count), (index) =>
      Effect.gen(function* () {
        const fields = {
          channelId: general._id,
          classId: row._id,
          // Each seed writes as its own classmate, so a second seed's keys never meet the first's.
          clientKey: `seed-${authorId}-${index}`,
        };
        const createdAt = now - (count - index) * SEED_GAP_MILLISECONDS;
        const messageId = yield* writer.table("classroomMessages").insert({
          ...fields,
          authorId,
          createdAt,
          sealedText: yield* sealText(
            keys,
            messageField(fields),
            `Pesan ${index}`
          ),
          tenantId: row.tenantId,
        });
        return { createdAt, messageId };
      }).pipe(Effect.orDie)
    );
    const teachers = yield* reader
      .table("classTeachers")
      .index("by_classId_and_personId", (query) => query.eq("classId", row._id))
      .take(SEED_TEACHER_LIMIT)
      .pipe(Effect.orDie);
    yield* Option.match(Arr.get(written, read - 1), {
      onNone: () => Effect.void,
      onSome: (last) =>
        Effect.forEach(
          teachers,
          (teacher) =>
            moveMark(
              teacher.personId,
              row,
              { channelId: general._id, threadId: undefined },
              last.createdAt
            ),
          { discard: true }
        ),
    });
    return {
      channelId: general._id,
      classId: row._id,
      messages: Arr.map(written, (message) => message.messageId),
    };
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(history),
  GroupImpl.finalize
);
