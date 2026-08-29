import { captureServerException } from "@repo/analytics/posthog/server";
import { api } from "@repo/backend/convex/_generated/api";
import { preloadedQueryResult } from "convex/nextjs";
import { ConvexError } from "convex/values";
import { Effect, Schema } from "effect";
import { cache } from "react";
import { fetchAuthQuery, getToken, preloadAuthQuery } from "@/lib/auth/server";

const SCHOOL_SWITCHER_PAGE_SIZE = 20;
type SchoolAuthToken = Awaited<ReturnType<typeof getToken>>;

/** Expected failure while reading one authenticated school surface. */
class SchoolDataReadError extends Schema.TaggedError<SchoolDataReadError>()(
  "SchoolDataReadError",
  {
    cause: Schema.Unknown,
    source: Schema.Literals([
      "school-class-route-boundary",
      "school-route-boundary",
      "school-switcher-page",
    ]),
  }
) {}

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
function captureSchoolRouteError(failure: SchoolDataReadError) {
  return Effect.gen(function* () {
    yield* captureServerException(failure.cause, {
      source: failure.source,
    }).pipe(Effect.ignore);

    return yield* failure;
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
        catch: (cause) =>
          new SchoolDataReadError({
            cause,
            source: "school-route-boundary",
          }),
      }).pipe(
        Effect.catchIf(
          (failure) =>
            hasConvexErrorCode(failure.cause, [
              "SCHOOL_NOT_FOUND",
              "MEMBERSHIP_NOT_FOUND",
            ]),
          () => Effect.succeed(null)
        ),
        Effect.catch(captureSchoolRouteError)
      )
    );
  }
);

/**
 * Preload the authenticated class route for server rendering and hydration.
 *
 * Returns `null` when the class cannot be resolved for the current viewer so
 * the route can delegate to Next's native not-found handling.
 */
export const preloadClassRoute = Effect.fn("www.school.preloadClassRoute")(
  function* ({
    classId,
    token,
  }: {
    readonly classId: string;
    readonly token: SchoolAuthToken;
  }) {
    if (!token) {
      return null;
    }

    return yield* Effect.tryPromise({
      try: () =>
        preloadAuthQuery(api.classes.queries.getClassRoute, { classId }),
      catch: (cause) =>
        new SchoolDataReadError({
          cause,
          source: "school-class-route-boundary",
        }),
    }).pipe(
      Effect.map((preloaded) => ({
        preloaded,
        value: preloadedQueryResult(preloaded),
      })),
      Effect.catchIf(
        (failure) =>
          hasConvexErrorCode(failure.cause, [
            "ACCESS_DENIED",
            "CLASS_ARCHIVED",
            "CLASS_NOT_FOUND",
          ]),
        () => Effect.succeed(null)
      ),
      Effect.catch(captureSchoolRouteError)
    );
  }
);

/** Load the first school-switcher page for the authenticated school shell. */
export const getSchoolSwitcherPage = Effect.fn(
  "www.school.getSchoolSwitcherPage"
)(function* (token: SchoolAuthToken) {
  if (!token) {
    return emptySchoolSwitcherPage;
  }

  return yield* Effect.tryPromise({
    try: () =>
      fetchAuthQuery(api.schools.queries.getMySchoolsPage, {
        paginationOpts: {
          cursor: null,
          numItems: SCHOOL_SWITCHER_PAGE_SIZE,
        },
      }),
    catch: (cause) =>
      new SchoolDataReadError({
        cause,
        source: "school-switcher-page",
      }),
  }).pipe(Effect.catch(captureSchoolRouteError));
});
