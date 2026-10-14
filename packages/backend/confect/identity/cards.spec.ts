import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import {
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
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The login cards of one school's Persons. An Admin issues a student's first
 * card with a login name and reissues the card later. A student redeems a card
 * on the school's host, which is the one public function here.
 */
export default GroupSpec.make()
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
      error: () => Schema.Union([AccessDenied, LoginMissing, PersonClaimed]),
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
