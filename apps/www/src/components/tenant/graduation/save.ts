import type { Id } from "@repo/backend/confect/_generated/id";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect } from "effect";
import type { GraduationOverview } from "@/components/tenant/graduation/workbook";
import { failSchoolAction } from "@/components/tenant/write";

/** The export module, loaded only when the viewer asks for a file, so it stays out of the page's first JavaScript. */
const loadDownload = () =>
  Effect.tryPromise(() => import("@/components/tenant/graduation/download"));

/** Tells the viewer a file could not be saved and reports it, so a failed export never passes in silence. */
const reportFailure = (error: unknown) =>
  failSchoolAction(error, { title: "school-graduation-export-failed.title" });

/** Saves the e-Ijazah readiness workbook of a graduating class group, or says it could not. */
export const saveReadiness = (slug: TenantSlug, overview: GraduationOverview) =>
  loadDownload().pipe(
    Effect.flatMap((download) => download.downloadReadiness(slug, overview)),
    Effect.catch(reportFailure)
  );

/** Saves the Dapodik workbook of a class group's report data, or says it could not. */
export const saveLedger = (
  slug: TenantSlug,
  cohort: { readonly id: Id<"tenantCohorts">; readonly name: string }
) =>
  loadDownload().pipe(
    Effect.flatMap((download) => download.downloadLedger(slug, cohort)),
    Effect.catch(reportFailure)
  );
