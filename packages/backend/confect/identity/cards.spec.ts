import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { TenantAccess } from "@repo/backend/confect/access/tenant";
import {
  CardMissing,
  CardRoleRefused,
  LoginExists,
  LoginMissing,
  LoginNameRefused,
  LoginNameTaken,
} from "@repo/backend/confect/identity/errors";
import {
  IssuedCard,
  RedeemOutcome,
  RedeemRequest,
} from "@repo/backend/confect/identity/schema";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { PersonAccess } from "@repo/backend/confect/tenancy/access";
import { PersonClaimed } from "@repo/backend/confect/tenancy/errors";
import { PersonName } from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The login cards of one school's Persons. An Admin adds a student with a login
 * name and the first card in one step, reissues the card later, and records each
 * print of it. A student redeems a card on the school's host, the one function here
 * that no Admin calls.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "enroll",
      args: () => ({
        loginName: Schema.String,
        name: PersonName,
        slug: TenantSlug,
      }),
      returns: () => IssuedCard,
      error: () =>
        Schema.Union([
          AccessDenied,
          LoginExists,
          LoginNameRefused,
          LoginNameTaken,
        ]),
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(TenantAccess, { action: "person.manage" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "issue",
      args: () => ({
        loginName: Schema.String,
        personId: Id("tenantPeople"),
        slug: TenantSlug,
      }),
      returns: () => IssuedCard,
      error: () =>
        Schema.Union([
          AccessDenied,
          CardRoleRefused,
          LoginExists,
          LoginNameRefused,
          LoginNameTaken,
          PersonClaimed,
        ]),
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(PersonAccess, { action: "card.issue", arg: "personId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "reissue",
      args: () => ({ personId: Id("tenantPeople"), slug: TenantSlug }),
      returns: () => IssuedCard,
      error: () =>
        Schema.Union([
          AccessDenied,
          CardRoleRefused,
          LoginMissing,
          PersonClaimed,
        ]),
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(PersonAccess, { action: "card.issue", arg: "personId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "print",
      args: () => ({ personId: Id("tenantPeople"), slug: TenantSlug }),
      returns: () => Schema.Null,
      error: () => Schema.Union([AccessDenied, CardMissing]),
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(PersonAccess, { action: "card.issue", arg: "personId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "redeem",
      args: () => RedeemRequest.fields,
      returns: () => RedeemOutcome,
    })
  );
