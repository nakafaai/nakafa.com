import { FunctionImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import {
  classAuthority,
  placeClass,
} from "@repo/backend/confect/classroom/authority";
import {
  type ClassStatus,
  classSlugOf,
  classView,
} from "@repo/backend/confect/classroom/class";
import {
  addressTakenElsewhere,
  freeAddress,
} from "@repo/backend/confect/classroom/classes/address";
import spec from "@repo/backend/confect/classroom/classes.spec";
import {
  ClassNameTaken,
  ClassSubjectTaken,
} from "@repo/backend/confect/classroom/errors";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { Clock, Effect, Option, Struct } from "effect";

/**
 * Restores an archived class to active, the inverse of archiving it. An archived class refuses every action on its
 * own row, so the school's Admin restores it at the school level. The class must belong to the school, and its
 * cohort, period, and unit must be open, because any of them archived locks the class again. No active class of its
 * cohort may hold its name or its subject. A class of another unit may have taken its address while it was archived;
 * then it takes the first free address, so an address still names one live class. A class that is active changes
 * nothing.
 */
export const restore = FunctionImpl.make(
  databaseSchema,
  spec,
  "restore",
  Effect.fn("classroom.classes.restore")(function* ({ classId }) {
    const { person, tenant } = yield* Member;
    const reader = yield* DatabaseReader;
    const row = yield* reader
      .table("classes")
      .get(classId)
      .pipe(
        Effect.catchTags({
          DocumentDecodeError: Effect.die,
          GetByIdFailure: () =>
            new AccessDenied({ action: "class.manage", reason: "resource" }),
        })
      );
    if (row.tenantId !== tenant._id) {
      return yield* new AccessDenied({
        action: "class.manage",
        reason: "resource",
      });
    }
    if (row.status === "active") {
      return classView(row);
    }
    const status: typeof ClassStatus.Type = "active";
    const { locked } = yield* placeClass(Struct.assign(row, { status }));
    if (locked) {
      return yield* new AccessDenied({
        action: "class.manage",
        reason: "condition",
      });
    }
    const sameName = yield* reader
      .table("classes")
      .index("by_cohortId_and_status_and_nameKey", (query) =>
        query
          .eq("cohortId", row.cohortId)
          .eq("status", "active")
          .eq("nameKey", row.nameKey)
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.isSome(sameName)) {
      return yield* new ClassNameTaken();
    }
    const sameSubject = yield* reader
      .table("classes")
      .index("by_cohortId_and_status_and_subjectKey", (query) =>
        query
          .eq("cohortId", row.cohortId)
          .eq("status", "active")
          .eq("subjectKey", row.subjectKey)
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.isSome(sameSubject)) {
      return yield* new ClassSubjectTaken();
    }
    const slug = (yield* addressTakenElsewhere(row))
      ? yield* freeAddress(row, classSlugOf(row.name))
      : row.slug;
    const restored = Struct.assign(row, {
      slug,
      status,
      updatedAt: yield* Clock.currentTimeMillis,
    });
    yield* (yield* DatabaseWriter)
      .table("classes")
      .replace(row._id, Struct.omit(restored, ["_creationTime", "_id"]))
      .pipe(Effect.orDie);
    yield* classAuthority.record(personActor(person), row, {
      type: "class.restored",
    });
    return classView(restored);
  })
);
