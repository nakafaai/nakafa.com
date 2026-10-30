import { useMutation, useQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Option } from "effect";
import { useConvexAuth } from "@/components/auth/convex";
import { useTenant } from "@/components/tenant/context";
import { releaseInRows } from "@/components/tenant/home/release";

/** The exams and rooms the school home lists for the viewer, read in one bounded call. */
export function useHomeExams() {
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  return useQuery(exams.exams.home, isSettled ? { slug } : "skip");
}

/** The read of the exams and rooms the school home lists, which a cell's failure part runs again. */
export function homeExamsRead(slug: TenantSlug) {
  return { args: { slug }, ref: exams.exams.home };
}

/**
 * Releases a closed sitting's results from the school home at once. The row shows the release as soon as the server
 * is asked, through the releases in flight, and once the live home is held, the local copy of the home shows it too.
 * A refused release gives the row back its release, because the local store drops an optimistic update when its call
 * fails.
 */
export function useReleaseHomeResult() {
  return useMutation(exams.results.results.release).withOptimisticUpdate(
    (localStore, args) => {
      const key = { slug: args.slug };
      const current = localStore.getQuery(exams.exams.home, key);
      if (Option.isSome(current)) {
        localStore.setQuery(
          exams.exams.home,
          key,
          Option.some({
            ...current.value,
            closed: releaseInRows(current.value.closed, args.sittingId),
          })
        );
      }
    }
  );
}

/**
 * What the school still lacks, which the setup cell lists for the owner and the admin only. A viewer who does not
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

/** The read of the school's setup, which the setup cell's failure part runs again. */
export function homeSetupRead(slug: TenantSlug) {
  return { args: { slug }, ref: tenancy.home.setup };
}

/** The read of the sittings a student may take part in, which the student's cells run again. */
export function studentSittingsRead(slug: TenantSlug) {
  return { args: { slug }, ref: exams.sittings.mine };
}

/** The sittings a student may take part in, which the student's cells list. */
export function useStudentSittings() {
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  return useQuery(exams.sittings.mine, isSettled ? { slug } : "skip");
}
