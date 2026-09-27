import { HttpClient } from "@confect/js";
import refs from "@repo/backend/confect/_generated/refs";
import { Effect } from "effect";
import { cache } from "react";
import { env } from "@/env";
import { captureServerExceptionSafely } from "@/lib/analytics/server";
import { getToken } from "@/lib/auth/server";

const SCHOOL_SWITCHER_PAGE_SIZE = 20;
type SchoolAuthToken = Awaited<ReturnType<typeof getToken>>;

/** Resolves school admission with this request's authenticated Confect client. */
export const getSchoolRouteSnapshot = cache(async (slug: string) => {
  const token = await getToken();
  if (!token) {
    return null;
  }
  return Effect.runPromise(
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      return yield* client
        .query(refs.public.schools.queries.getSchoolBySlug, { slug })
        .pipe(
          Effect.catchTag("SchoolReadError", (error) =>
            error.code === "SCHOOL_NOT_FOUND" ||
            error.code === "MEMBERSHIP_NOT_FOUND"
              ? Effect.succeed(null)
              : Effect.fail(error)
          )
        );
    }).pipe(
      Effect.provide(
        HttpClient.layer(
          env.NEXT_PUBLIC_CONVEX_URL,
          token ? { auth: token } : {}
        )
      ),
      Effect.tapError((error) =>
        captureServerExceptionSafely(error, { source: "school-route-boundary" })
      )
    )
  );
});

/** Reads the class admission and first-render data through the native client. */
export const getClassRouteSnapshot = cache(async (classId: string) => {
  const token = await getToken();
  return Effect.runPromise(
    Effect.gen(function* () {
      if (!token) {
        return null;
      }
      return yield* Effect.gen(function* () {
        const client = yield* HttpClient.HttpClient;
        return yield* client
          .query(refs.public.classes.queries.getClassRoute, { classId })
          .pipe(
            Effect.catchTag("ClassAccessError", (error) =>
              error.code === "ACCESS_DENIED" ||
              error.code === "CLASS_ARCHIVED" ||
              error.code === "CLASS_NOT_FOUND"
                ? Effect.succeed(null)
                : Effect.fail(error)
            )
          );
      }).pipe(
        Effect.provide(
          HttpClient.layer(env.NEXT_PUBLIC_CONVEX_URL, { auth: token })
        ),
        Effect.tapError((error) =>
          captureServerExceptionSafely(error, {
            source: "school-class-route-boundary",
          })
        )
      );
    })
  );
});

/** Reads the authenticated school shell's initial switcher page. */
export const getSchoolSwitcherPage = Effect.fn(
  "www.school.getSchoolSwitcherPage"
)(function* (token: SchoolAuthToken) {
  if (!token) {
    return { continueCursor: "", isDone: true, page: [] };
  }
  return yield* Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    return yield* client.query(refs.public.schools.queries.getMySchoolsPage, {
      paginationOpts: { cursor: null, numItems: SCHOOL_SWITCHER_PAGE_SIZE },
    });
  }).pipe(
    Effect.provide(
      HttpClient.layer(env.NEXT_PUBLIC_CONVEX_URL, token ? { auth: token } : {})
    ),
    Effect.tapError((error) =>
      captureServerExceptionSafely(error, { source: "school-switcher-page" })
    )
  );
});
