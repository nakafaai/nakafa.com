"use client";

import { useQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { useConvexAuth } from "@/components/providers/convex";
import { useTenant } from "@/components/tenant/context";

/**
 * The viewer's view of the school, which the home reads for its header and its welcome. The read waits
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

/** The sittings a student may take part in, which the student's tile lists. */
export function useStudentSittings() {
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  return useQuery(exams.sittings.mine, isSettled ? { slug } : "skip");
}
