import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  AccessDenied,
  GrantRejected,
} from "@repo/backend/confect/access/errors";
import { TenantAccess } from "@repo/backend/confect/access/tenant";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { PersonAccess } from "@repo/backend/confect/tenancy/access";
import {
  PersonKind,
  PersonName,
  PersonStatus,
} from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** One Person as the school's list shows them. The account's identity never leaves the server. */
const PersonView = Schema.Struct({
  account: Schema.Literals(["claimed", "unclaimed"]),
  id: Id("tenantPeople"),
  kind: PersonKind,
  name: PersonName,
  status: PersonStatus,
});

/**
 * The people of one school. Its Admin creates, renames, and removes them. The
 * roles that read the school's people list them one status at a time, and a
 * cohort's readers list the people placed in it.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "list",
      args: () => ({
        cohortId: Schema.optionalKey(Id("tenantCohorts")),
        slug: TenantSlug,
        status: PersonStatus,
      }),
      item: () => PersonView,
      error: () => AccessDenied,
    }).middleware(TenantAccess, { action: "person.view" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "create",
      args: () => ({ name: PersonName, slug: TenantSlug }),
      returns: () => PersonView,
      error: () => AccessDenied,
    }).middleware(TenantAccess, { action: "person.manage" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "rename",
      args: () => ({
        name: PersonName,
        personId: Id("tenantPeople"),
        slug: TenantSlug,
      }),
      returns: () => PersonView,
      error: () => AccessDenied,
    }).middleware(PersonAccess, { action: "person.manage", arg: "personId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "remove",
      args: () => ({ personId: Id("tenantPeople"), slug: TenantSlug }),
      returns: () => PersonView,
      error: () => Schema.Union([AccessDenied, GrantRejected]),
    }).middleware(PersonAccess, { action: "person.manage", arg: "personId" })
  );
