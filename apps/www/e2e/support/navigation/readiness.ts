import { errors, expect, type Locator, type Page } from "@playwright/test";
import { Effect } from "effect";
import {
  NavigationBrowserReadinessError,
  NavigationReadinessTimeout,
  NavigationRequestError,
  readErrorText,
} from "./failure";
import { withTargetPrefetch } from "./prefetch";

const loadSourceRoute = Effect.fn("NakafaE2E.loadNavigationSource")(function* (
  page: Page,
  sourceHref: string,
  targetHref: string,
  timeoutMilliseconds: number
) {
  const response = yield* Effect.tryPromise({
    try: () =>
      page.goto(sourceHref, {
        timeout: timeoutMilliseconds,
        waitUntil: "domcontentloaded",
      }),
    catch: (error) => {
      if (error instanceof errors.TimeoutError) {
        return new NavigationReadinessTimeout({
          errorText: readErrorText(error),
          href: targetHref,
          phase: "source",
          sourceHref,
          timeoutMilliseconds,
        });
      }
      return new NavigationRequestError({
        errorText: readErrorText(error),
        href: targetHref,
        kind: "network",
        sourceHref,
        url: sourceHref,
      });
    },
  });
  if (!response) {
    return yield* new NavigationRequestError({
      href: targetHref,
      kind: "missing-response",
      sourceHref,
      url: sourceHref,
    });
  }
  if (!response.ok()) {
    return yield* new NavigationRequestError({
      href: targetHref,
      kind: "http",
      sourceHref,
      status: response.status(),
      url: response.url(),
    });
  }
});

const waitForCommittedAppRouter = Effect.fn(
  "NakafaE2E.waitForCommittedAppRouter"
)(function* (
  page: Page,
  sourceHref: string,
  targetHref: string,
  timeoutMilliseconds: number
) {
  const committedState = yield* Effect.tryPromise({
    try: () =>
      page.waitForFunction(
        () =>
          window.history.state?.__NA === true &&
          window.history.state?.__PRIVATE_NEXTJS_INTERNALS_TREE !== undefined,
        undefined,
        { timeout: timeoutMilliseconds }
      ),
    catch: (error) => {
      if (error instanceof errors.TimeoutError) {
        return new NavigationReadinessTimeout({
          errorText: readErrorText(error),
          href: targetHref,
          phase: "hydration",
          sourceHref,
          timeoutMilliseconds,
        });
      }
      return new NavigationBrowserReadinessError({
        errorText: readErrorText(error),
        href: targetHref,
        phase: "hydration",
        sourceHref,
      });
    },
  });
  yield* Effect.tryPromise({
    try: () => committedState.dispose(),
    catch: (error) =>
      new NavigationBrowserReadinessError({
        errorText: readErrorText(error),
        href: targetHref,
        phase: "hydration",
        sourceHref,
      }),
  });
});

const ensureLinkInViewport = Effect.fn("NakafaE2E.ensureLinkInViewport")(
  function* (
    link: Locator,
    sourceHref: string,
    targetHref: string,
    timeoutMilliseconds: number
  ) {
    const mapViewportError = (error: unknown) =>
      new NavigationReadinessTimeout({
        errorText: readErrorText(error),
        href: targetHref,
        phase: "viewport",
        sourceHref,
        timeoutMilliseconds,
      });

    yield* Effect.tryPromise({
      try: () => link.scrollIntoViewIfNeeded({ timeout: timeoutMilliseconds }),
      catch: mapViewportError,
    });
    yield* Effect.tryPromise({
      try: () => expect(link).toBeInViewport({ timeout: timeoutMilliseconds }),
      catch: mapViewportError,
    });
  }
);

/** Loads one source route and returns its hydrated, prefetched target Link. */
export const prepareClientNavigation = Effect.fn(
  "NakafaE2E.prepareClientNavigation"
)(function* <E, R>(
  page: Page,
  baseURL: string,
  sourceHref: string,
  targetHref: string,
  timeoutMilliseconds: number,
  findLink: () => Effect.Effect<Locator, E, R>
) {
  const applicationOrigin = new URL(baseURL).origin;

  return yield* withTargetPrefetch(
    page,
    applicationOrigin,
    sourceHref,
    targetHref,
    timeoutMilliseconds,
    () =>
      Effect.gen(function* () {
        yield* loadSourceRoute(
          page,
          sourceHref,
          targetHref,
          timeoutMilliseconds
        );

        /**
         * Next.js commits `__NA` and its internal tree in HistoryUpdater's
         * useInsertionEffect. Link callback refs are mounted in that commit, and
         * visible Links then schedule requests carrying `next-router-prefetch`.
         *
         * @see https://github.com/vercel/next.js/blob/v16.3.2/packages/next/src/client/components/app-router.tsx
         * @see https://github.com/vercel/next.js/blob/v16.3.2/packages/next/src/client/app-dir/link.tsx
         * @see https://github.com/vercel/next.js/blob/v16.3.2/packages/next/src/client/components/links.ts
         */
        yield* waitForCommittedAppRouter(
          page,
          sourceHref,
          targetHref,
          timeoutMilliseconds
        );
        const link = yield* findLink();
        yield* ensureLinkInViewport(
          link,
          sourceHref,
          targetHref,
          timeoutMilliseconds
        );
        return link;
      })
  );
});
