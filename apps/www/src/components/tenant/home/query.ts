import { useMutation } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Option } from "effect";
import { use } from "react";
import { useConvexAuth } from "@/components/auth/convex";
import { useTenant } from "@/components/tenant/context";
import { HomePreloadContext } from "@/components/tenant/home/data";
import { usePreloadedQueryResult } from "@/lib/data/preloaded";

/** The exams and rooms the school home lists for the viewer, read in one bounded call. */
export function useHomeExams() {
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const { home } = use(HomePreloadContext);
  return usePreloadedQueryResult(
    exams.exams.home,
    isSettled ? { slug } : "skip",
    home
  );
}

/** The read of the exams and rooms the school home lists, which a cell's failure part runs again. */
export function homeExamsRead(slug: TenantSlug) {
  return { args: { slug }, ref: exams.exams.home };
}

/**
 * Releases a closed sitting's results from the school home at once. The row shows the release before the server
 * answers, and a refused release rolls the guess back, because the local store drops an optimistic update when its
 * call fails.
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
            closed: Arr.map(current.value.closed, (row) =>
              row.id === args.sittingId
                ? { ...row, canRelease: false, resultsReleased: true }
                : row
            ),
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
  const { home } = use(HomePreloadContext);
  return usePreloadedQueryResult(
    tenancy.home.setup,
    isSettled && canManage ? { slug } : "skip",
    home?.setup
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
  const { sittings } = use(HomePreloadContext);
  return usePreloadedQueryResult(
    exams.sittings.mine,
    isSettled ? { slug } : "skip",
    sittings
  );
}
