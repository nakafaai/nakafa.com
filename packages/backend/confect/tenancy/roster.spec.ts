import { FunctionSpec, GroupSpec } from "@confect/core";
import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  AccessDenied,
  GrantRejected,
} from "@repo/backend/confect/access/errors";
import { BuiltinRole } from "@repo/backend/confect/access/schema";
import { TenantAccess } from "@repo/backend/confect/access/tenant";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import {
  AddressInvited,
  InviteDomainRefused,
} from "@repo/backend/confect/tenancy/errors";
import { MemberStatus } from "@repo/backend/confect/tenancy/roster";
import {
  Email,
  InvitedRole,
  PersonName,
} from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** One active member of the school as the members list shows it: who they are, their roles, and how far they have joined. */
const MemberView = Schema.Struct({
  id: Id("tenantPeople"),
  name: PersonName,
  roles: Schema.Array(BuiltinRole),
  status: MemberStatus,
});

/** The Person and the invite that one invite writes. */
const InvitedPerson = Schema.Struct({
  invite: Id("tenantInvites"),
  person: Id("tenantPeople"),
});

/**
 * The members of one school and the invites that add them. Its Admin lists the
 * members with their roles and status, and adds a teacher or an Admin in one step.
 * The people module keeps the Persons themselves; this capability owns how they join.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "members",
      args: () => ({ slug: TenantSlug }),
      item: () => MemberView,
      error: () => AccessDenied,
    }).middleware(TenantAccess, { action: "person.view" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "invite",
      args: () => ({
        email: Email,
        locale: ActiveAppLocaleCodeSchema,
        name: PersonName,
        role: InvitedRole,
        slug: TenantSlug,
      }),
      returns: () => InvitedPerson,
      error: () =>
        Schema.Union([
          AccessDenied,
          AddressInvited,
          GrantRejected,
          InviteDomainRefused,
        ]),
    }).middleware(TenantAccess, { action: "person.manage" })
  );
