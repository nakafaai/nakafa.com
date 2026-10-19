import { FunctionSpec, GroupSpec } from "@confect/core";
import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { BuiltinRole } from "@repo/backend/confect/access/schema";
import { TenantAccess } from "@repo/backend/confect/access/tenant";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { PersonAccess } from "@repo/backend/confect/tenancy/access";
import {
  InviteDomainRefused,
  InviteExpired,
  InviteNotPending,
  InvitePending,
  InviteRateLimited,
  PersonClaimed,
} from "@repo/backend/confect/tenancy/errors";
import { Email, PersonName } from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * One invite as the school's list and each invite mutation show it: the Person it invites,
 * the roles that Person holds, and whether the invite is still pending or has expired.
 */
const InviteView = Schema.Struct({
  email: Email,
  expiresAt: Schema.Finite,
  id: Id("tenantInvites"),
  name: PersonName,
  personId: Id("tenantPeople"),
  roles: Schema.Array(BuiltinRole),
  status: Schema.Literals(["expired", "pending"]),
});

/**
 * The invites of one school. Its Admin invites a Person, revokes or sends again
 * an invite, and lists the pending ones. Invites end by claim, revoke, or expiry.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "list",
      args: () => ({ slug: TenantSlug }),
      item: () => InviteView,
      error: () => AccessDenied,
    }).middleware(TenantAccess, { action: "invite.view" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "invite",
      args: () => ({
        email: Email,
        locale: ActiveAppLocaleCodeSchema,
        personId: Id("tenantPeople"),
        slug: TenantSlug,
      }),
      returns: () => InviteView,
      error: () =>
        Schema.Union([
          AccessDenied,
          InviteDomainRefused,
          InvitePending,
          PersonClaimed,
        ]),
    }).middleware(PersonAccess, { action: "person.invite", arg: "personId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "revoke",
      args: () => ({ inviteId: Id("tenantInvites"), slug: TenantSlug }),
      returns: () => Schema.Null,
      error: () => AccessDenied,
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "resend",
      args: () => ({
        inviteId: Id("tenantInvites"),
        locale: ActiveAppLocaleCodeSchema,
        slug: TenantSlug,
      }),
      returns: () => InviteView,
      error: () =>
        Schema.Union([
          AccessDenied,
          InviteExpired,
          InviteNotPending,
          InviteRateLimited,
        ]),
    })
  );
