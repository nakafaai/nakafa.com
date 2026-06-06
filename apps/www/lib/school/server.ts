import { captureServerException } from "@repo/analytics/posthog/server";
import { api } from "@repo/backend/convex/_generated/api";
import { ConvexError } from "convex/values";
import { Effect } from "effect";
import { cache } from "react";
import { fetchAuthQuery, getToken } from "@/lib/auth/server";

const SCHOOL_SWITCHER_PAGE_SIZE = 20;

const emptySchoolSwitcherPage = {
  continueCursor: "",
  isDone: true,
  page: [],
};

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

/** Captures an unexpected school route error and preserves the original failure. */
function captureSchoolRouteError(
  error: unknown,
  context: Record<string | number, unknown>
) {
  return Effect.gen(function* () {
    yield* Effect.tryPromise({
      try: () => captureServerException(error, undefined, context),
      catch: (cause) => cause,
    }).pipe(Effect.ignore);

    return yield* Effect.fail(error);
  });
}

/**
 * Load the authenticated school route snapshot.
 *
 * Returns `null` when the slug cannot be resolved for the current viewer so the
 * route can decide whether to render a 404 state.
 */
export const getSchoolRouteSnapshot = cache(
  async function getSchoolRouteSnapshot(slug: string) {
    const token = await getToken();

    if (!token) {
      return null;
    }

    return Effect.runPromise(
      Effect.tryPromise({
        try: () =>
          fetchAuthQuery(api.schools.queries.getSchoolBySlug, {
            slug,
          }),
        catch: (error) => error,
      }).pipe(
        Effect.catchIf(
          (error) =>
            hasConvexErrorCode(error, [
              "SCHOOL_NOT_FOUND",
              "MEMBERSHIP_NOT_FOUND",
            ]),
          () => Effect.succeed(null)
        ),
        Effect.catchAll((error) =>
          captureSchoolRouteError(error, {
            slug,
            source: "school-route-boundary",
          })
        )
      )
    );
  }
);

/**
 * Load the authenticated class route snapshot.
 *
 * Returns `null` when the class cannot be resolved for the current viewer so
 * the route can delegate to Next's native not-found handling.
 */
export async function getClassRouteSnapshot({ classId }: { classId: string }) {
  const token = await getToken();

  if (!token) {
    return null;
  }

  return Effect.runPromise(
    Effect.tryPromise({
      try: () => fetchAuthQuery(api.classes.queries.getClassRoute, { classId }),
      catch: (error) => error,
    }).pipe(
      Effect.catchIf(
        (error) =>
          hasConvexErrorCode(error, [
            "ACCESS_DENIED",
            "CLASS_ARCHIVED",
            "CLASS_NOT_FOUND",
          ]),
        () => Effect.succeed(null)
      ),
      Effect.catchAll((error) =>
        captureSchoolRouteError(error, {
          classId,
          source: "school-class-route-boundary",
        })
      )
    )
  );
}

/** Load the first school-switcher page for the authenticated school shell. */
export async function getSchoolSwitcherPage() {
  const token = await getToken();

  if (!token) {
    return emptySchoolSwitcherPage;
  }

  return Effect.runPromise(
    Effect.tryPromise({
      try: () =>
        fetchAuthQuery(api.schools.queries.getMySchoolsPage, {
          paginationOpts: {
            cursor: null,
            numItems: SCHOOL_SWITCHER_PAGE_SIZE,
          },
        }),
      catch: (error) => error,
    }).pipe(
      Effect.catchAll((error) =>
        captureSchoolRouteError(error, {
          source: "school-switcher-page",
        })
      )
    )
  );
}
