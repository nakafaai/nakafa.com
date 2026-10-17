import { FunctionImpl, GroupImpl } from "@confect/server";
import type { TenantCohortMembersDoc } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { Cohort } from "@repo/backend/confect/tenancy/access";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import {
  cohortAccess,
  cohortAuthority,
  personAuthority,
  placementOf,
  studentOf,
} from "@repo/backend/confect/tenancy/authority";
import {
  PersonAlreadyPlaced,
  PersonGraduated,
  PersonNotPlaced,
  PersonNotStudent,
  PersonPlacementLimit,
} from "@repo/backend/confect/tenancy/errors";
import { graduationOf } from "@repo/backend/confect/tenancy/graduate";
import { PERSON_PLACEMENT_LIMIT } from "@repo/backend/confect/tenancy/placement";
import spec from "@repo/backend/confect/tenancy/placements.spec";
import { Effect, Layer, Option, Struct } from "effect";

/** One placement as the wire shows it. */
const view = (
  placement: Pick<TenantCohortMembersDoc, "cohortId" | "periodId" | "personId">
) => Struct.pick(placement, ["cohortId", "periodId", "personId"]);

/**
 * Places an active student in a cohort. A Person holds one cohort per period and
 * at most PERSON_PLACEMENT_LIMIT placements in all.
 */
const place = FunctionImpl.make(
  databaseSchema,
  spec,
  "place",
  Effect.fn("tenancy.placements.place")(function* ({ personId }) {
    const { person: actor } = yield* Member;
    const cohort = yield* Cohort;
    const person = yield* personAuthority.authorize("person.manage", personId);
    if (!(yield* studentOf(person._id, cohort.unitId))) {
      return yield* new PersonNotStudent();
    }
    if (Option.isSome(yield* graduationOf(cohort.unitId, person._id))) {
      return yield* new PersonGraduated();
    }
    const reader = yield* DatabaseReader;
    if (Option.isSome(yield* placementOf(cohort.periodId, person._id))) {
      return yield* new PersonAlreadyPlaced();
    }
    const held = yield* reader
      .table("tenantCohortMembers")
      .index("by_personId", (query) => query.eq("personId", person._id))
      .take(PERSON_PLACEMENT_LIMIT)
      .pipe(Effect.orDie);
    if (held.length >= PERSON_PLACEMENT_LIMIT) {
      return yield* new PersonPlacementLimit();
    }
    const placement = {
      cohortId: cohort._id,
      periodId: cohort.periodId,
      personId: person._id,
      tenantId: cohort.tenantId,
    };
    yield* (yield* DatabaseWriter)
      .table("tenantCohortMembers")
      .insert(placement)
      .pipe(Effect.orDie);
    yield* personAuthority.record(personActor(actor), person, {
      cohort: cohort._id,
      type: "person.placed",
    });
    return view(placement);
  })
);

/**
 * Moves a placed Person to another cohort of the same period. The target cohort
 * is checked by its access middleware, and the cohort the Person leaves is
 * checked here, because the move rewrites that placement. An archived cohort at
 * either end refuses the move. A Person already in the target stays put.
 */
const move = FunctionImpl.make(
  databaseSchema,
  spec,
  "move",
  Effect.fn("tenancy.placements.move")(function* ({ personId }) {
    const { person: actor } = yield* Member;
    const cohort = yield* Cohort;
    const person = yield* personAuthority.authorize("person.manage", personId);
    const placement = yield* placementOf(cohort.periodId, person._id);
    if (Option.isNone(placement)) {
      return yield* new PersonNotPlaced();
    }
    if (!(yield* studentOf(person._id, cohort.unitId))) {
      return yield* new PersonNotStudent();
    }
    const from = placement.value.cohortId;
    if (from === cohort._id) {
      return view(placement.value);
    }
    yield* cohortAuthority.authorize("cohort.manage", from);
    yield* (yield* DatabaseWriter)
      .table("tenantCohortMembers")
      .replace(
        placement.value._id,
        Struct.assign(Struct.omit(placement.value, ["_creationTime", "_id"]), {
          cohortId: cohort._id,
        })
      )
      .pipe(Effect.orDie);
    yield* personAuthority.record(personActor(actor), person, {
      from,
      to: cohort._id,
      type: "person.moved",
    });
    return view(Struct.assign(placement.value, { cohortId: cohort._id }));
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(place),
  Layer.provide(move),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(cohortAccess),
  GroupImpl.finalize
);
