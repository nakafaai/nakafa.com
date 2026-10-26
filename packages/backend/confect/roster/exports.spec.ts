import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { RosterLine } from "@repo/backend/confect/roster/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The Dapodik export of one period (ADR 0015, K13): every student placed in the period with
 * the NISN on file and the class group, which the Admin's browser writes into an XLSX file.
 * It reads `roster/imports:list` a page at a time, so each page checks the caller's access.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.publicAction({
    name: "lines",
    args: () => ({ periodId: Id("tenantPeriods"), slug: TenantSlug }),
    returns: () => Schema.Array(RosterLine),
    error: () => Schema.Union([AuthFailure, AccessDenied]),
  }).middleware(Session)
);
