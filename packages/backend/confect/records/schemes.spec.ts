import { FunctionSpec, GroupSpec } from "@confect/core";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { TenantAccess } from "@repo/backend/confect/access/tenant";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { SchemeNotLater } from "@repo/backend/confect/records/errors";
import {
  Band,
  GradeValue,
  SchemeView,
} from "@repo/backend/confect/records/scheme";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The grading scheme versions of a school. An Admin stores a version that takes
 * effect after the newest one, and each grade keeps the version that judged it.
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
  );
