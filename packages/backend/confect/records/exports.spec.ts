import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { LedgerRow } from "@repo/backend/confect/records/report";
import { CohortAccess } from "@repo/backend/confect/tenancy/access";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";

/**
 * The Dapodik export of a class group's report data (ADR 0033, S6): each placed student with
 * the NISN on file and the subject lines of their locked report card, which the browser writes
 * into an XLSX file to paste into Dapodik's own template. The principal, the Admin, and Staff
 * export it.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "ledger",
      args: () => ({ cohortId: Id("tenantCohorts"), slug: TenantSlug }),
      item: () => LedgerRow,
      error: () => AccessDenied,
    }).middleware(CohortAccess, { action: "report.export", arg: "cohortId" })
  );
