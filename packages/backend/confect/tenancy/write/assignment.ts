import type { GenericId } from "@confect/core";
import type {
  TenantAssignmentsDoc,
  TenantCohortsDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import {
  cohortAuthority,
  holdsSlot,
  homeroomOf,
  homeroomOfPerson,
  teacherOf,
} from "@repo/backend/confect/tenancy/authority";
import {
  CohortHasHomeroom,
  PersonNotTeacher,
  TeacherHasHomeroom,
} from "@repo/backend/confect/tenancy/errors";
import { Effect, Option } from "effect";

/**
 * Checks that a Person may lead a cohort as its homeroom teacher. Returns the row of a
 * removed teacher that the new assignment replaces, if the cohort has one. It reads
 * only, so a step that writes several assignments checks them all before its first
 * write.
 */
export const checkHomeroom = Effect.fn("tenancy.write.assignment.check")(
  function* (cohort: TenantCohortsDoc, person: TenantPeopleDoc) {
    if (
      person.status !== "active" ||
      !(yield* teacherOf(person._id, cohort.unitId))
    ) {
      return yield* new PersonNotTeacher();
    }
    const holder = yield* homeroomOf(cohort._id);
    if (Option.isSome(holder)) {
      const teacher = yield* (yield* DatabaseReader)
        .table("tenantPeople")
        .get(holder.value.personId)
        .pipe(Effect.orDie);
      if (holdsSlot(teacher)) {
        return yield* new CohortHasHomeroom();
      }
    }
    if (Option.isSome(yield* homeroomOfPerson(cohort.periodId, person._id))) {
      return yield* new TeacherHasHomeroom();
    }
    return holder;
  }
);

/** Deletes one homeroom assignment, and journals its removal on the cohort it leaves. */
export const removeHomeroom = Effect.fn("tenancy.write.assignment.remove")(
  function* (
    actor: typeof TenantActor.Type,
    cohort: TenantCohortsDoc,
    assignment: TenantAssignmentsDoc
  ) {
    yield* (yield* DatabaseWriter)
      .table("tenantAssignments")
      .delete(assignment._id)
      .pipe(Effect.orDie);
    yield* cohortAuthority.record(actor, cohort, {
      assignment: "homeroom",
      person: assignment.personId,
      type: "assignment.removed",
    });
  }
);

/**
 * Inserts a homeroom assignment for a Person that `checkHomeroom` accepted. The
 * removed teacher's row it replaces is removed first, and each write is journaled.
 * Returns the new assignment's ID.
 */
export const insertHomeroom = Effect.fn("tenancy.write.assignment.insert")(
  function* (
    actor: typeof TenantActor.Type,
    cohort: TenantCohortsDoc,
    personId: GenericId.GenericId<"tenantPeople">,
    replacing: Option.Option<TenantAssignmentsDoc>
  ) {
    if (Option.isSome(replacing)) {
      yield* removeHomeroom(actor, cohort, replacing.value);
    }
    const assignmentId = yield* (yield* DatabaseWriter)
      .table("tenantAssignments")
      .insert({
        cohortId: cohort._id,
        kind: "homeroom",
        periodId: cohort.periodId,
        personId,
        tenantId: cohort.tenantId,
      })
      .pipe(Effect.orDie);
    yield* cohortAuthority.record(actor, cohort, {
      assignment: "homeroom",
      person: personId,
      type: "assignment.created",
    });
    return assignmentId;
  }
);

/**
 * Removes the row of a removed teacher that still names a cohort, so the cohort can
 * be deleted. An active teacher's row stays where it is.
 */
export const clearRemovedHomeroom = Effect.fn("tenancy.write.assignment.clear")(
  function* (actor: typeof TenantActor.Type, cohort: TenantCohortsDoc) {
    const holder = yield* homeroomOf(cohort._id);
    if (Option.isNone(holder)) {
      return;
    }
    const teacher = yield* (yield* DatabaseReader)
      .table("tenantPeople")
      .get(holder.value.personId)
      .pipe(Effect.orDie);
    if (!holdsSlot(teacher)) {
      yield* removeHomeroom(actor, cohort, holder.value);
    }
  }
);
