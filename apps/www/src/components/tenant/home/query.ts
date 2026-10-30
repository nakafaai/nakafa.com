import { useQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
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

/**
 * What the school still lacks, which the setup section lists for the owner and the admin only. A viewer who does not
 * manage the school never asks, because the server refuses the read to them.
 */
export function useHomeSetup() {
  const { canManage, slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  return useQuery(
    tenancy.home.setup,
    isSettled && canManage ? { slug } : "skip"
  );
}

/** The read of the school's setup, which the setup section's failure part runs again. */
export function homeSetupRead(slug: TenantSlug) {
  return { args: { slug }, ref: tenancy.home.setup };
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
