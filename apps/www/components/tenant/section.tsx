"use client";

import type { Ref } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useConvexAuth } from "@/components/providers/convex";
import { useTenant } from "@/components/tenant/context";
import { canOpenExams, canOpenRooms } from "@/components/tenant/exams/access";
import { isLostAccess } from "@/components/tenant/refusal";
import { TenantRefused } from "@/components/tenant/refused";

/** The viewer's view of the school, as the school layout reads it. */
type Viewer = Ref.Returns<typeof tenancy.viewer.get>;

/** The school sections whose layouts check the viewer's grant on the server. */
export type TenantSectionName = "exams" | "settings";

/** The grant that each section's layout checks, so a change made while the page is open answers the same way. */
const SECTION_GRANTS: Readonly<
  Record<TenantSectionName, (viewer: Viewer) => boolean>
> = {
  exams: (viewer) => canOpenExams(viewer) || canOpenRooms(viewer),
  settings: (viewer) => Arr.contains(viewer.can, "tenant.manage"),
};

/**
 * Keeps a school section on the refused page once a live read of the viewer no longer grants it. The
 * section's layout refuses a viewer without the grant when the page is requested; this gate answers a
 * change made while the page is open, such as a removed role or a removed membership. Until the viewer
 * answers, the section shows, so the first draw never waits for the viewer.
 */
export function TenantSection({
  children,
  section,
}: {
  children: ReactNode;
  section: TenantSectionName;
}) {
  const tenant = useTenant();
  // The viewer is read once the session settles, so the first draw never asks for it signed out.
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const viewer = useQuery(
    tenancy.viewer.get,
    isSettled ? { slug: tenant.slug } : "skip"
  );

  if (QueryResult.isFailure(viewer) && isLostAccess(viewer.error)) {
    return <TenantRefused />;
  }
  if (QueryResult.isSuccess(viewer) && !SECTION_GRANTS[section](viewer.value)) {
    return <TenantRefused />;
  }
  return children;
}
