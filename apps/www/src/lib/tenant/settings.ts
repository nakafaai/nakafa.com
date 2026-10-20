import { Id } from "@repo/backend/confect/_generated/id";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** The rows a settings list asks for on its first page: at least one, and at most one hundred. */
const PageSize = Schema.Int.check(
  Schema.isBetween({ maximum: 100, minimum: 1 })
);

/** The school whose settings a page reads. */
export const SchoolInput = Schema.Struct({ slug: TenantSlug });

/** The school whose settings a page reads, with the first page size of its list. */
export const SettingsListInput = Schema.Struct({
  numItems: PageSize,
  slug: TenantSlug,
});

/** The school and one of its units, whose periods or cohorts a page reads. */
export const UnitScopeInput = Schema.Struct({
  numItems: PageSize,
  slug: TenantSlug,
  unitId: Id("tenantUnits"),
});

/** The school and one of its units, whose active period and cohorts a page reads. */
export const UnitInput = Schema.Struct({
  slug: TenantSlug,
  unitId: Id("tenantUnits"),
});

/** The school and one of its cohorts. */
export const CohortInput = Schema.Struct({
  cohortId: Id("tenantCohorts"),
  numItems: PageSize,
  slug: TenantSlug,
});
