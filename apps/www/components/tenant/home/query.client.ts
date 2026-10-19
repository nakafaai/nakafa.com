"use client";

import { useQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { useConvexAuth } from "@/components/providers/convex";
import { useTenant } from "@/components/tenant/context";

/**
 * The viewer's view of the school, which the home reads for its header and its greeting. The read waits
 * for the session, which Convex learns a moment after the page draws.
 */
export function useHomeViewer() {
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  return useQuery(tenancy.viewer.get, isSettled ? { slug } : "skip");
}

/** The exams and rooms the school home lists for the viewer, read in one bounded call. */
export function useHomeExams() {
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  return useQuery(exams.exams.home, isSettled ? { slug } : "skip");
}

/** The read of the exams and rooms the school home lists, which a tile's failure part runs again. */
export function homeExamsRead(slug: TenantSlug) {
  return { args: { slug }, ref: exams.exams.home };
}

/**
 * What the school still lacks, which the setup tile lists for the owner and the admin only. A viewer who
 * does not manage the school never asks, because the server refuses the read to them.
 */
export function useHomeSetup() {
  const { canManage, slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  return useQuery(
    tenancy.home.setup,
    isSettled && canManage ? { slug } : "skip"
  );
}

/** The read of the school's setup, which the setup tile's failure part runs again. */
export function homeSetupRead(slug: TenantSlug) {
  return { args: { slug }, ref: tenancy.home.setup };
}

/** The read of the sittings a student may take part in, which the student's tiles run again. */
export function studentSittingsRead(slug: TenantSlug) {
  return { args: { slug }, ref: exams.sittings.mine };
}

/** The sittings a student may take part in, which the student's tiles list. */
export function useStudentSittings() {
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  return useQuery(exams.sittings.mine, isSettled ? { slug } : "skip");
}
