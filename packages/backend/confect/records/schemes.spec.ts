import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { TenantAccess } from "@repo/backend/confect/access/tenant";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import {
  SchemeNotLater,
  SchemeUsed,
} from "@repo/backend/confect/records/errors";
import {
  Band,
  GradeValue,
  SchemeView,
} from "@repo/backend/confect/records/scheme";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The grading scheme versions of a school. An Admin lists them, the newest first,
 * and stores a version that takes effect after the newest one, and each grade keeps
 * the version that judged it. So an Admin corrects or removes a version only while
 * it has judged no grade, and a version of another school is a missing object.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicMutation({
      name: "store",
      args: () => ({
        bands: Schema.Array(Band),
        effectiveFrom: Schema.Finite,
        kktp: GradeValue,
        slug: TenantSlug,
      }),
      returns: () => SchemeView,
      error: () => Schema.Union([AccessDenied, SchemeNotLater]),
    }).middleware(TenantAccess, { action: "scheme.manage" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "amend",
      args: () => ({
        bands: Schema.Array(Band),
        kktp: GradeValue,
        schemeId: Id("gradingSchemes"),
        slug: TenantSlug,
      }),
      returns: () => SchemeView,
      error: () => Schema.Union([AccessDenied, SchemeUsed]),
    }).middleware(TenantAccess, { action: "scheme.manage" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "remove",
      args: () => ({ schemeId: Id("gradingSchemes"), slug: TenantSlug }),
      returns: () => Schema.Null,
      error: () => Schema.Union([AccessDenied, SchemeUsed]),
    }).middleware(TenantAccess, { action: "scheme.manage" })
  )
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "list",
      args: () => ({ slug: TenantSlug }),
      item: () => SchemeView,
      error: () => AccessDenied,
    }).middleware(TenantAccess, { action: "scheme.view" })
  );
