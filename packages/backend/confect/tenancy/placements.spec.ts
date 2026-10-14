import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { CohortAccess } from "@repo/backend/confect/tenancy/access";
import {
  PersonAlreadyPlaced,
  PersonNotPlaced,
  PersonPlacementLimit,
} from "@repo/backend/confect/tenancy/errors";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** One placement as the wire shows it: a Person in a cohort of a period. */
const PlacementView = Schema.Struct({
  cohortId: Id("tenantCohorts"),
  periodId: Id("tenantPeriods"),
  personId: Id("tenantPeople"),
});

/**
 * Places a Person in a cohort, or moves them to another cohort of the same
 * period. Both need the Admin's `cohort.manage` on the target cohort, and the
 * Person must be active.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicMutation({
      name: "place",
      args: () => ({
        cohortId: Id("tenantCohorts"),
        personId: Id("tenantPeople"),
        slug: TenantSlug,
      }),
      returns: () => PlacementView,
      error: () =>
        Schema.Union([AccessDenied, PersonAlreadyPlaced, PersonPlacementLimit]),
    }).middleware(CohortAccess, { action: "cohort.manage", arg: "cohortId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "move",
      args: () => ({
        cohortId: Id("tenantCohorts"),
        personId: Id("tenantPeople"),
        slug: TenantSlug,
      }),
      returns: () => PlacementView,
      error: () => Schema.Union([AccessDenied, PersonNotPlaced]),
    }).middleware(CohortAccess, { action: "cohort.manage", arg: "cohortId" })
  );
