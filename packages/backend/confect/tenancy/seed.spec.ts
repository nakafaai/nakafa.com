import { FunctionSpec, GroupSpec } from "@confect/core";
import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { Id } from "@repo/backend/confect/_generated/id";
import { SeedRefused } from "@repo/backend/confect/acceptance/seed";
import { TenantNotFound } from "@repo/backend/confect/tenancy/errors";
import { Email, PersonName } from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * Seeds the people of an open school for an acceptance run: a Teacher with an invite, and
 * the student grant of a learner who already holds the school's address. Both are internal,
 * so no browser can call them, and the acceptance commands run them.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "teacher",
      args: () => ({
        email: Email,
        locale: ActiveAppLocaleCodeSchema,
        name: PersonName,
        slug: TenantSlug,
      }),
      returns: () =>
        Schema.Struct({
          invite: Id("tenantInvites"),
          person: Id("tenantPeople"),
        }),
      error: () => Schema.Union([SeedRefused, TenantNotFound]),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "student",
      args: () => ({ email: Email, slug: TenantSlug }),
      returns: () => Schema.Null,
      error: () => Schema.Union([SeedRefused, TenantNotFound]),
    })
  );
