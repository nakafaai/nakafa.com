import { captureServerException } from "@repo/analytics/posthog/server";
import refs from "@repo/backend/confect/_generated/refs";
import { toConvexReference } from "@repo/backend/confect/modules/shared/convexReferences";
import { cache } from "react";
import { fetchAuthQuery } from "@/lib/auth/server";
import { hasApplicationErrorCode } from "@/lib/errors";

const SCHOOL_SWITCHER_PAGE_SIZE = 20;

/**
 * Load the authenticated school route snapshot.
 *
 * Returns `null` when the slug cannot be resolved for the current viewer so the
 * route can decide whether to render a 404 state.
 */
export const getSchoolRouteSnapshot = cache(
  async function getSchoolRouteSnapshot(slug: string) {
    try {
      return await fetchAuthQuery(
        toConvexReference(refs.public.schools.queries.getSchoolBySlug),
        { slug }
      );
    } catch (error) {
      if (
        hasApplicationErrorCode(error, [
          "SCHOOL_NOT_FOUND",
          "MEMBERSHIP_NOT_FOUND",
        ])
      ) {
        return null;
      }

      await captureServerException(error, undefined, {
        slug,
        source: "school-route-boundary",
      });

      throw error;
    }
  }
);

/**
 * Load the authenticated class route snapshot.
 *
 * Returns `null` when the class cannot be resolved for the current viewer so
 * the route can delegate to Next's native not-found handling.
 */
export async function getClassRouteSnapshot({ classId }: { classId: string }) {
  try {
    return await fetchAuthQuery(
      toConvexReference(refs.public.classes.queries.getClassRoute),
      { classId }
    );
  } catch (error) {
    if (
      hasApplicationErrorCode(error, [
        "ACCESS_DENIED",
        "CLASS_ARCHIVED",
        "CLASS_NOT_FOUND",
      ])
    ) {
      return null;
    }

    await captureServerException(error, undefined, {
      classId,
      source: "school-class-route-boundary",
    });

    throw error;
  }
}

/** Load the first school-switcher page for the authenticated school shell. */
export async function getSchoolSwitcherPage() {
  try {
    return await fetchAuthQuery(
      toConvexReference(refs.public.schools.queries.getMySchoolsPage),
      {
        paginationOpts: {
          cursor: null,
          numItems: SCHOOL_SWITCHER_PAGE_SIZE,
        },
      }
    );
  } catch (error) {
    await captureServerException(error, undefined, {
      source: "school-switcher-page",
    });

    throw error;
  }
}
