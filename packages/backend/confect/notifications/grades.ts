import type { ClassGradesDoc } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { principalOf } from "@repo/backend/confect/classroom/roster";
import { schedulePush } from "@repo/backend/confect/notifications/schedule";
import { Array as Arr, Clock, Effect } from "effect";

/** The guardians of one student that a grade's notice reaches: a student has few, and a page holds them all. */
const GUARDIAN_LIMIT = 10;

/**
 * Writes the notice of a released grade in the transaction that releases it (ADR 0027): one inbox row with its push for
 * the student, and one for each active guardian with a verified link to the student. A student who is no longer an
 * active member gets none.
 */
export const noticeGradeReleased = Effect.fn("notifications.grades.released")(
  function* (grade: ClassGradesDoc) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const createdAt = yield* Clock.currentTimeMillis;
    const klass = yield* reader.table("classes").get(grade.classId);
    const tenant = yield* reader.table("tenants").get(grade.tenantId);
    const student = yield* reader.table("tenantPeople").get(grade.personId);
    const links = yield* reader
      .table("guardianLinks")
      .index("by_studentPersonId_and_state_status", (query) =>
        query.eq("studentPersonId", student._id).eq("state.status", "verified")
      )
      .take(GUARDIAN_LIMIT);
    const guardians = yield* Effect.forEach(links, (link) =>
      reader.table("tenantPeople").get(link.guardianPersonId)
    );
    yield* Effect.forEach(
      Arr.filter(
        Arr.prepend(guardians, student),
        (person) => person.status === "active"
      ),
      (person) =>
        Effect.gen(function* () {
          const notificationId = yield* writer.table("notifications").insert({
            changeType: "grade.released",
            createdAt,
            gradeId: grade._id,
            recipientPersonId: person._id,
            studentPersonId: student._id,
            subject: { id: grade._id, kind: "grade" },
            tenantId: grade.tenantId,
          });
          const principal = yield* principalOf(person, tenant);
          yield* schedulePush(
            notificationId,
            person,
            principal.grants,
            klass.unitId
          );
        }),
      { discard: true }
    );
  },
  Effect.orDie
);
