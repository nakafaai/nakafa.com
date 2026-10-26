import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import {
  IMPORT_BATCH,
  ImportRow,
  ImportSummary,
  RosterLine,
} from "@repo/backend/confect/roster/schema";
import { PeriodAccess } from "@repo/backend/confect/tenancy/access";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The Dapodik import of one period (ADR 0015, K13): the apply of one batch of rows, and the
 * list of the period's students for the export. The Admin's browser reads the file and shows
 * its preview, and only the read columns arrive here.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicMutation({
      name: "apply",
      args: () => ({
        periodId: Id("tenantPeriods"),
        rows: Schema.Array(ImportRow).check(Schema.isMaxLength(IMPORT_BATCH)),
        slug: TenantSlug,
      }),
      returns: () => ImportSummary,
      error: () => AccessDenied,
    }).middleware(PeriodAccess, { action: "roster.import", arg: "periodId" })
  )
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "list",
      args: () => ({ periodId: Id("tenantPeriods"), slug: TenantSlug }),
      item: () => RosterLine,
      error: () => AccessDenied,
    }).middleware(PeriodAccess, { action: "roster.import", arg: "periodId" })
  );
