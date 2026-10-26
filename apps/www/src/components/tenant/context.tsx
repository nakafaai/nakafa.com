import { QueryResult } from "@confect/react";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { BuiltinRole } from "@repo/backend/confect/access/schema";
import type { TenantProfile } from "@repo/backend/confect/tenancy/schema";
import type { Option } from "effect";
import { createContext, use } from "react";
import { useConvexAuth } from "@/components/auth/convex";
import type { HomeAccess } from "@/components/tenant/home/access";
import type { Greeting } from "@/components/tenant/home/greeting";
import { liveTenant } from "@/components/tenant/live";
import { usePreloadedQueryResult } from "@/lib/data/preloaded";
import type { SchoolViewer } from "@/lib/tenant/frame";

/**
 * The school the shell shows, its address, its name and its mark, the viewer's
 * first role in it, or none when the viewer holds no grant, what the viewer may
 * open: the school's settings and its exams, the viewer's exam access that the
 * home and the exam list draw from, and the greeting of the home. A type only: the
 * browser bundle never evaluates the schemas it is derived from.
 */
export type TenantValue = Pick<
  typeof TenantProfile.Type,
  "mascot" | "name" | "slug"
> &
  Record<"logo", string | undefined> &
  Record<"role", Option.Option<BuiltinRole>> &
  Record<"canManage" | "canOpenExams" | "canOpenReports", boolean> &
  Record<"greeting", Greeting> &
  Record<"home", HomeAccess>;

/**
 * The school of the shell. Its value is fixed for one render of the school
 * layout, so it never changes after hydration and streamed content keeps its
 * context. The layout computes the viewer's access and greeting on the server, so
 * a card, a row or the greeting that depends on them is in the first HTML and never
 * inserts after hydration. A school's name and logo change in its settings, so
 * `useTenant` reads them from the viewer's live query.
 */
export const TenantContext = createContext<TenantValue | null>(null);

/**
 * Reads the school of the shell, with the name and the logo that its settings
 * change at once (`liveTenant`). It throws outside the shell, which always
 * provides it.
 */
export function useTenant(): TenantValue {
  const tenant = use(TenantContext);
  const viewer = useViewerQuery();
  if (tenant === null) {
    throw new Error("useTenant must be used within TenantShell");
  }
  return liveTenant(
    tenant,
    QueryResult.isSuccess(viewer) ? viewer.value.tenant : undefined
  );
}

/**
 * The viewer's view of the school that the layout read on the server, which the shell provides. The live
 * read replaces it once the session settles, so the first draw never asks for the viewer signed out.
 */
export const ViewerPreloadContext = createContext<SchoolViewer | undefined>(
  undefined
);

/** The viewer's live view of the school, which shows the layout's view until the live read answers. */
export function useViewerQuery() {
  const tenant = use(TenantContext);
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const preload = use(ViewerPreloadContext);
  return usePreloadedQueryResult(
    tenancy.viewer.get,
    tenant === null || !isSettled ? "skip" : { slug: tenant.slug },
    preload
  );
}
