import type { TenantPromotionsDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import {
  activeHomeroomOf,
  promotionAuthority,
} from "@repo/backend/confect/tenancy/authority";
import { CohortHasHomeroom } from "@repo/backend/confect/tenancy/errors";
import {
  createdCohort,
  targetNameOf,
} from "@repo/backend/confect/tenancy/promotion/destination";
import { finished } from "@repo/backend/confect/tenancy/promotion/progress";
import { update } from "@repo/backend/confect/tenancy/promotion/row";
import type { PromotionSource } from "@repo/backend/confect/tenancy/promotion/schema";
import {
  checkHomeroom,
  insertHomeroom,
  removeHomeroom,
} from "@repo/backend/confect/tenancy/write/assignment";
import { Array as Arr, Effect, Option } from "effect";

/**
 * Plans the copy of one source cohort's homeroom teacher to the cohort their students
 * join. A source cohort without an active homeroom teacher plans nothing, so a teacher
 * removed during the run is not copied. The copy is checked the way an assignment is,
 * so a teacher who is no longer an active teacher of the unit stops the step.
 */
const planCopy = Effect.fn("tenancy.promotion.homeroom.planCopy")(function* (
  promotion: TenantPromotionsDoc,
  entry: typeof PromotionSource.Type
) {
  const assignment = yield* activeHomeroomOf(entry.cohortId);
  if (Option.isNone(assignment)) {
    return [];
  }
  const reader = yield* DatabaseReader;
  const source = yield* reader
    .table("tenantCohorts")
    .get(entry.cohortId)
    .pipe(Effect.orDie);
  const teacher = yield* reader
    .table("tenantPeople")
    .get(assignment.value.personId)
    .pipe(Effect.orDie);
  // The plan check named a cohort for every homeroom copy, and the cohorts step
  // created each named cohort, so the target is always there.
  const name = yield* Effect.fromOption(
    targetNameOf(entry.to, source.name)
  ).pipe(Effect.orDie);
  const cohortId = yield* Effect.fromOption(
    createdCohort(promotion.created, name)
  ).pipe(Effect.orDie);
  const cohort = yield* reader
    .table("tenantCohorts")
    .get(cohortId)
    .pipe(Effect.orDie);
  const replacing = yield* checkHomeroom(cohort, teacher);
  return [{ cohort, personId: teacher._id, replacing }];
});

/**
 * Copies each homeroom teacher the plan names to the cohort its students join, in
 * the target period. Every copy is checked against the rows and against the other
 * copies of the plan before the first write, so a refusal writes nothing.
 */
export const homeroomApply = Effect.fn("tenancy.promotion.homeroom.apply")(
  function* (
    promotion: TenantPromotionsDoc,
    actor: typeof TenantActor.Type,
    _cursor: string | null
  ) {
    const planned = yield* Effect.forEach(
      Arr.filter(promotion.sources, (entry) => entry.homeroom),
      (entry) => planCopy(promotion, entry)
    );
    const copies = Arr.flatten(planned);
    const cohortIds = Arr.map(copies, (copy) => copy.cohort._id);
    if (Arr.dedupe(cohortIds).length !== cohortIds.length) {
      return yield* new CohortHasHomeroom();
    }
    const copied = yield* Effect.forEach(copies, (copy) =>
      insertHomeroom(actor, copy.cohort, copy.personId, copy.replacing)
    );
    yield* update(promotion, { copies: copied });
    return finished;
  }
);

/** Deletes the homeroom copies that apply made, and that still exist. */
export const homeroomUndo = Effect.fn("tenancy.promotion.homeroom.undo")(
  function* (
    promotion: TenantPromotionsDoc,
    actor: typeof TenantActor.Type,
    _cursor: string | null
  ) {
    const reader = yield* DatabaseReader;
    yield* Effect.forEach(
      promotion.copies,
      (assignmentId) =>
        Effect.gen(function* () {
          const copy = yield* reader
            .table("tenantAssignments")
            .get(assignmentId)
            .pipe(
              Effect.asSome,
              Effect.catchTag("GetByIdFailure", () => Effect.succeedNone),
              Effect.orDie
            );
          if (Option.isNone(copy)) {
            return;
          }
          const cohort = yield* reader
            .table("tenantCohorts")
            .get(copy.value.cohortId)
            .pipe(Effect.orDie);
          yield* removeHomeroom(actor, cohort, copy.value);
          yield* promotionAuthority.record(actor, promotion, {
            step: "homeroom",
            type: "promotion.undone",
          });
        }),
      { discard: true }
    );
    yield* update(promotion, { copies: [] });
    return finished;
  }
);
