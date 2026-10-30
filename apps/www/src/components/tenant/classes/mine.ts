import { useQuery } from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { useConvexAuth } from "@/components/auth/convex";
import { useTenant } from "@/components/tenant/context";

/**
 * Reads the classes that the viewer teaches or attends in the school's active periods, once Convex has settled the
 * session, so the query never runs before the viewer is known. The sidebar and the home read the same query, which
 * Convex serves from one subscription.
 */
export function useMyClasses() {
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  return useQuery(classroom.classes.mine, isSettled ? { slug } : "skip");
}
