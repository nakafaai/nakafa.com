import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied, GrantRejected } from "@repo/backend/confect/access/errors";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import {
  IMPORT_BATCH,
  ImportRow,
  ImportSummary,
  RosterLine,
  SourcedImport,
  SourcedRow,
} from "@repo/backend/confect/roster/schema";
import { PeriodAccess } from "@repo/backend/confect/tenancy/access";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The file imports of one period: the apply of one batch of Dapodik rows (ADR 0015, K13) or
 * of OneRoster rows (ADR 0029), and the list of the period's students for the export. The
 * Admin's browser reads the file and shows its preview, and only the read columns arrive here.
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
      error: () => Schema.Union([GrantRejected, AccessDenied]),
    }).middleware(PeriodAccess, { action: "roster.import", arg: "periodId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "applySourced",
      args: () => ({
        periodId: Id("tenantPeriods"),
        rows: Schema.Array(SourcedRow).check(Schema.isMaxLength(IMPORT_BATCH)),
        slug: TenantSlug,
        source: SourcedImport,
      }),
      returns: () => ImportSummary,
      error: () => Schema.Union([GrantRejected, AccessDenied]),
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
