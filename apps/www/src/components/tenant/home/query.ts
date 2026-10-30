import { useQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { useConvexAuth } from "@/components/auth/convex";
import { useTenant } from "@/components/tenant/context";

/** The rooms the school home lists for the viewer, read in one bounded call. */
export function useHomeExams() {
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  return useQuery(exams.exams.home, isSettled ? { slug } : "skip");
}

/** The read of the rooms the school home lists, which the staff home's failure part runs again. */
export function homeExamsRead(slug: TenantSlug) {
  return { args: { slug }, ref: exams.exams.home };
}

/** The read of the sittings a student may take part in, which the student's home runs again. */
export function studentSittingsRead(slug: TenantSlug) {
  return { args: { slug }, ref: exams.sittings.mine };
}

/** The sittings a student may take part in, which the student's exams section lists. */
export function useStudentSittings() {
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  return useQuery(exams.sittings.mine, isSettled ? { slug } : "skip");
}
