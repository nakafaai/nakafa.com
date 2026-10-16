import type { GenericId } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Effect, Schema } from "effect";

/**
 * A Person who graduated from one unit through a promotion. A graduate keeps the
 * Person and its history, and gets no new placement in that unit. The marker
 * lives here, not on the Person, which stays identity only.
 */
export const tenantGraduateValidator = Schema.Struct({
  personId: Id("tenantPeople"),
  promotionId: Id("tenantPromotions"),
  tenantId: Id("tenants"),
  unitId: Id("tenantUnits"),
});

/** The graduation of one Person from one unit, if they graduated from it. */
export const graduationOf = Effect.fn("tenancy.graduate.of")(function* (
  unitId: GenericId.GenericId<"tenantUnits">,
  personId: GenericId.GenericId<"tenantPeople">
) {
  return yield* (yield* DatabaseReader)
    .table("tenantGraduates")
    .get("by_unitId_and_personId", unitId, personId)
    .pipe(
      Effect.asSome,
      Effect.catchTag("GetByIndexFailure", () => Effect.succeedNone),
      Effect.orDie
    );
});
