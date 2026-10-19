import { FunctionSpec, GroupSpec } from "@confect/core";
import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  SeedRefused,
  SeedUnitMissing,
} from "@repo/backend/confect/acceptance/seed";
import { ClassSubject } from "@repo/backend/confect/classroom/class";
import { TenantNotFound } from "@repo/backend/confect/tenancy/errors";
import { Email, PersonName } from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * Seeds a Teacher who teaches one class in an open school for an acceptance run.
 * The school's first active unit gets an active period when it has none, a cohort,
 * and the class in that cohort. The Teacher is an unclaimed Person with an invite to
 * the address and a teacher grant over the school, as `tenancy/seed` seeds one, and
 * the class's own teaching row names the Teacher. It is internal, so no browser can
 * call it, and the acceptance command runs it once per school.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "teacher",
    args: () => ({
      email: Email,
      locale: ActiveAppLocaleCodeSchema,
      name: PersonName,
      slug: TenantSlug,
      subject: ClassSubject,
    }),
    returns: () =>
      Schema.Struct({
        classId: Id("classes"),
        invite: Id("tenantInvites"),
        periodId: Id("tenantPeriods"),
        person: Id("tenantPeople"),
      }),
    error: () => Schema.Union([SeedRefused, SeedUnitMissing, TenantNotFound]),
  })
);
