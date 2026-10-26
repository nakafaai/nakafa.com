import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { GuardianLinkAccess } from "@repo/backend/confect/guardians/access";
import {
  ChildGrade,
  ChildView,
  ConfirmOutcome,
} from "@repo/backend/confect/guardians/schema";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The guardian's side of the links (ADR 0034): the children whose links name the
 * guardian, the NISN check that verifies one, the withdrawal that ends one, and
 * the released grades that a verified link opens.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicQuery({
      name: "children",
      args: () => ({ slug: TenantSlug }),
      returns: () => Schema.Array(ChildView),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "confirm",
      args: () => ({
        linkId: Id("guardianLinks"),
        nisn: Schema.String,
        slug: TenantSlug,
      }),
      returns: () => ConfirmOutcome,
      error: () => AccessDenied,
    }).middleware(GuardianLinkAccess, {
      action: "guardian.confirm",
      arg: "linkId",
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "withdraw",
      args: () => ({ linkId: Id("guardianLinks"), slug: TenantSlug }),
      returns: () => ChildView,
      error: () => AccessDenied,
    }).middleware(GuardianLinkAccess, {
      action: "guardian.withdraw",
      arg: "linkId",
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "grades",
      args: () => ({ linkId: Id("guardianLinks"), slug: TenantSlug }),
      returns: () => Schema.Array(ChildGrade),
      error: () => AccessDenied,
    }).middleware(GuardianLinkAccess, {
      action: "guardian.child",
      arg: "linkId",
    })
  );
