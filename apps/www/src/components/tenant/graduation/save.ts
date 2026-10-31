import type { Id } from "@repo/backend/confect/_generated/id";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect } from "effect";
import type { GraduationOverview } from "@/components/tenant/graduation/workbook";
import { reportClientException } from "@/lib/analytics/client";

const SOURCE = "components/tenant/graduation/save";

/** The export module, loaded only when the viewer asks for a file, so it stays out of the page's first JavaScript. */
const loadDownload = () =>
  Effect.tryPromise(() => import("@/components/tenant/graduation/download"));

/** Reports a file that could not be saved and tells the viewer, so a failed export never passes in silence. */
const reportFailure = (error: unknown) =>
  reportClientException(error, { source: SOURCE }).pipe(
    Effect.andThen(
      Effect.sync(() => {
        toast.error({ title: "school-graduation-export-failed.title" });
      })
    )
  );

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
