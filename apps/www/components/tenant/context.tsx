"use client";

import type { BuiltinRole } from "@repo/backend/confect/access/schema";
import type { TenantProfile } from "@repo/backend/confect/tenancy/schema";
import { createContext, use } from "react";
import type { HomeAccess } from "@/components/tenant/home/access";

/**
 * The school the shell shows, its address, the viewer's first role in it, or none
 * when the viewer holds no grant, what the viewer may open: the school's settings
 * and its exams, and the viewer's exam access that the home and the exam list draw
 * from. A type only: the browser bundle never evaluates the schemas it is derived from.
 */
export type TenantValue = Pick<typeof TenantProfile.Type, "name" | "slug"> &
  Record<"role", BuiltinRole | null> &
  Record<"canManage" | "canOpenExams", boolean> &
  Record<"home", HomeAccess>;

/**
 * The school of the shell. Its value is fixed for one render of the school
 * layout, so it never changes after hydration and streamed content keeps its
 * context. The layout computes the viewer's access on the server, so a card or a
 * row that depends on it is in the first HTML and never inserts after hydration.
 */
export const TenantContext = createContext<TenantValue | null>(null);

/** Reads the school of the shell. It throws outside the shell, which always provides it. */
export function useTenant() {
  const tenant = use(TenantContext);
  if (tenant === null) {
    throw new Error("useTenant must be used within TenantShell");
  }
  return tenant;
}
