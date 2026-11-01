import type { ClassGradesDoc } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { principalOf } from "@repo/backend/confect/classroom/roster";
import { guardiansOf } from "@repo/backend/confect/notifications/guardians";
import { queueMail } from "@repo/backend/confect/notifications/mail";
import { schedulePush } from "@repo/backend/confect/notifications/schedule";
import { Array as Arr, Clock, Effect, Option } from "effect";

/**
 * Writes the notice of a released grade in the transaction that releases it (ADR 0027): one inbox row with its push for
 * the student, and one for each active guardian with a verified link to the student, who also gets a mail. A student who
 * is no longer an active member gets none.
 */
export const noticeGradeReleased = Effect.fn("notifications.grades.released")(
  function* (grade: ClassGradesDoc) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const createdAt = yield* Clock.currentTimeMillis;
    const klass = yield* reader.table("classes").get(grade.classId);
    const tenant = yield* reader.table("tenants").get(grade.tenantId);
    const student = yield* reader.table("tenantPeople").get(grade.personId);
    const guardians = yield* guardiansOf(student._id);
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
            "gradeReleased",
            notificationId,
            person,
            principal.grants,
            klass.unitId
          );
          yield* queueMail(
            "gradeReleased",
            person._id === student._id ? "student" : "guardian",
            person,
            klass.unitId,
            Option.none()
          );
        }),
      { discard: true }
    );
  },
  Effect.orDie
);
