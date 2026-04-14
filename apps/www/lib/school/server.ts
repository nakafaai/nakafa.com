import { captureServerException } from "@repo/analytics/posthog/server";
import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { ConvexError } from "convex/values";
import { cache } from "react";
import { fetchAuthQuery } from "@/lib/auth/server";

const SCHOOL_SWITCHER_PAGE_SIZE = 20;

/** Return whether an unknown error is one expected Convex application error. */
function hasConvexErrorCode(error: unknown, allowedCodes: readonly string[]) {
  if (!(error instanceof ConvexError)) {
    return false;
  }

  const data = error.data;

  if (typeof data !== "object" || data === null || !("code" in data)) {
    return false;
  }

  return typeof data.code === "string" && allowedCodes.includes(data.code);
}

/**
 * Load the authenticated school route snapshot.
 *
 * Returns `null` when the slug cannot be resolved for the current viewer so the
 * route can decide whether to render a 404 state.
 */
export const getSchoolRouteSnapshot = cache(
  async function getSchoolRouteSnapshot(slug: string) {
    try {
      return await fetchAuthQuery(api.schools.queries.getSchoolBySlug, {
        slug,
      });
    } catch (error) {
      if (
        hasConvexErrorCode(error, ["SCHOOL_NOT_FOUND", "MEMBERSHIP_NOT_FOUND"])
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
export async function getClassRouteSnapshot({
  classId,
}: {
  classId: Id<"schoolClasses">;
}) {
  try {
    return await fetchAuthQuery(api.classes.queries.getClassRoute, { classId });
  } catch (error) {
    if (
      hasConvexErrorCode(error, [
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
    return await fetchAuthQuery(api.schools.queries.getMySchoolsPage, {
      paginationOpts: {
        cursor: null,
        numItems: SCHOOL_SWITCHER_PAGE_SIZE,
      },
    });
  } catch (error) {
    await captureServerException(error, undefined, {
      source: "school-switcher-page",
    });

    throw error;
  }
}
