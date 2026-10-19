"use client";

import { QueryResult, useQuery } from "@confect/react";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { BuiltinRole } from "@repo/backend/confect/access/schema";
import type { TenantProfile } from "@repo/backend/confect/tenancy/schema";
import { createContext, use } from "react";
import { liveTenant } from "@/components/tenant/live";

/**
 * The school the shell shows, its address, its name and its mark, the viewer's
 * first role in it, or none when the viewer holds no grant, and what the viewer
 * may open: the school's settings and its exams. A type only: the browser bundle
 * never evaluates the schemas it is derived from.
 */
export type TenantValue = Pick<
  typeof TenantProfile.Type,
  "mascot" | "name" | "slug"
> &
  Record<"logo", string | undefined> &
  Record<"role", BuiltinRole | null> &
  Record<"canManage" | "canOpenExams", boolean>;

/**
 * The school of the shell. Its value is fixed for one render of the school
 * layout, so it never changes after hydration and streamed content keeps its
 * context. A school's name and logo change in its settings, so `useTenant` reads
 * them from the viewer's live query.
 */
export const TenantContext = createContext<TenantValue | null>(null);

/**
 * Reads the school of the shell, with the name and the logo that its settings
 * change at once (`liveTenant`). It throws outside the shell, which always
 * provides it.
 */
export function useTenant(): TenantValue {
  const tenant = use(TenantContext);
  const viewer = useQuery(
    tenancy.viewer.get,
    tenant === null ? "skip" : { slug: tenant.slug }
  );
  if (tenant === null) {
    throw new Error("useTenant must be used within TenantShell");
  }
  return liveTenant(
    tenant,
    QueryResult.isSuccess(viewer) ? viewer.value.tenant : undefined
  );
}
