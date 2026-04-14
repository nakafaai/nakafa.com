import { captureServerException } from "@repo/analytics/posthog/server";
import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { fetchQuery } from "convex/nextjs";
import { cache } from "react";
import { getToken } from "@/lib/auth/server";

/** Load school metadata by slug without throwing into route components. */
export const getSchoolInfoBySlug = cache(async (slug: string) => {
  try {
    return await fetchQuery(api.schools.queries.getSchoolInfoBySlug, { slug });
  } catch (error) {
    await captureServerException(error, undefined, {
      slug,
      source: "school-layout-metadata",
    });

    return null;
  }
});

/**
 * Load the authenticated school route snapshot.
 *
 * Returns `null` when the slug cannot be resolved for the current viewer so the
 * route can decide whether to render a 404 state.
 */
export async function getSchoolRouteSnapshot({ slug }: { slug: string }) {
  const token = await getToken();

  if (!token) {
    return null;
  }

  try {
    return await fetchQuery(
      api.schools.queries.getSchoolBySlug,
      { slug },
      { token }
    );
  } catch (error) {
    await captureServerException(error, undefined, {
      slug,
      source: "school-route-boundary",
    });

    return null;
  }
}

/**
 * Load the authenticated class route snapshot.
 *
 * Returns `null` when the class cannot be resolved for the current viewer so
 * the route can delegate to Next's native not-found handling.
 */
export async function getClassRouteSnapshot({
  classId,
}: {
  classId: Id<"schoolClasses">;
}) {
  const token = await getToken();

  if (!token) {
    return null;
  }

  try {
    return await fetchQuery(
      api.classes.queries.getClassRoute,
      { classId },
      { token }
    );
  } catch (error) {
    await captureServerException(error, undefined, {
      classId,
      source: "school-class-route-boundary",
    });

    return null;
  }
}
