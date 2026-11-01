import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  AccessDenied,
  GrantRejected,
} from "@repo/backend/confect/access/errors";
import { TenantAccess } from "@repo/backend/confect/access/tenant";
import { GuardianLinkAccess } from "@repo/backend/confect/guardians/access";
import {
  LinkClosed,
  LinkRefused,
} from "@repo/backend/confect/guardians/errors";
import { FamilyLink, LinkView } from "@repo/backend/confect/guardians/schema";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { PersonAccess } from "@repo/backend/confect/tenancy/access";
import { Email, PersonName } from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The guardian links of one school, as its Admin and Staff (Staf TU) keep them
 * (ADR 0034): start a link with the guardian's address, list the school's links,
 * check one by hand when the roster holds no NISN, correct the address of a
 * pending one, and revoke one. A student starts a link for themself and reads their
 * own links.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicMutation({
      name: "start",
      args: () => ({
        email: Email,
        guardianName: PersonName,
        slug: TenantSlug,
        studentId: Id("tenantPeople"),
      }),
      returns: () => LinkView,
      error: () => Schema.Union([AccessDenied, GrantRejected, LinkRefused]),
    }).middleware(PersonAccess, { action: "guardian.link", arg: "studentId" })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "mine",
      args: () => ({ slug: TenantSlug }),
      returns: () => Schema.Array(FamilyLink),
    })
  )
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "list",
      args: () => ({
        search: Schema.optionalKey(PersonName),
        slug: TenantSlug,
      }),
      item: () => LinkView,
      error: () => AccessDenied,
    }).middleware(TenantAccess, { action: "guardian.list" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "verify",
      args: () => ({ linkId: Id("guardianLinks"), slug: TenantSlug }),
      returns: () => LinkView,
      error: () => Schema.Union([AccessDenied, LinkClosed]),
    }).middleware(GuardianLinkAccess, {
      action: "guardian.verify",
      arg: "linkId",
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "readdress",
      args: () => ({
        email: Email,
        linkId: Id("guardianLinks"),
        slug: TenantSlug,
      }),
      returns: () => LinkView,
      error: () => Schema.Union([AccessDenied, LinkClosed, LinkRefused]),
    }).middleware(GuardianLinkAccess, {
      action: "guardian.readdress",
      arg: "linkId",
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "revoke",
      args: () => ({ linkId: Id("guardianLinks"), slug: TenantSlug }),
      returns: () => LinkView,
      error: () => AccessDenied,
    }).middleware(GuardianLinkAccess, {
      action: "guardian.revoke",
      arg: "linkId",
    })
  );
