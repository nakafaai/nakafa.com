import { errors, expect, type Locator, type Page } from "@playwright/test";
import { Duration, Effect, Schedule } from "effect";
import {
  NavigationBrowserReadinessError,
  NavigationReadinessTimeout,
  NavigationRequestError,
  readErrorText,
} from "@/e2e/support/navigation/failure";

const DETACHED_ELEMENT_MESSAGE = "Element is not attached to the DOM";
const VIEWPORT_RETRY_MILLISECONDS = 100;

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
        outcome: "network",
        sourceHref,
        url: sourceHref,
      });
    },
  });
  if (!response) {
    return yield* new NavigationRequestError({
      href: targetHref,
      outcome: "missing-response",
      sourceHref,
      url: sourceHref,
    });
  }
  if (!response.ok()) {
    return yield* new NavigationRequestError({
      href: targetHref,
      outcome: "http",
      sourceHref,
      status: response.status(),
      url: response.url(),
    });
  }
});

/**
 * Waits until the router has hydrated the page. TanStack's history writes its
 * route key into the state of the current entry when the client router starts,
 * so the key marks a page that a reader can navigate.
 */
export const waitForCommittedAppRouter = Effect.fn(
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
        () => window.history.state?.__TSR_key !== undefined,
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
    const viewportTimeout = (error: unknown) =>
      new NavigationReadinessTimeout({
        errorText: readErrorText(error),
        href: targetHref,
        phase: "viewport",
        sourceHref,
        timeoutMilliseconds,
      });

    yield* Effect.gen(function* () {
      yield* Effect.tryPromise({
        // Re-resolve the Locator when React replaces its mounted ElementHandle.
        try: (signal) =>
          link.scrollIntoViewIfNeeded({ signal, timeout: timeoutMilliseconds }),
        catch: (error) =>
          error instanceof errors.TimeoutError
            ? viewportTimeout(error)
            : new NavigationBrowserReadinessError({
                errorText: readErrorText(error),
                href: targetHref,
                phase: "viewport",
                sourceHref,
              }),
      }).pipe(
        Effect.retry({
          schedule: Schedule.spaced(
            Duration.millis(VIEWPORT_RETRY_MILLISECONDS)
          ),
          while: (error) =>
            error._tag === "NavigationBrowserReadinessError" &&
            error.errorText?.includes(DETACHED_ELEMENT_MESSAGE) === true,
        })
      );
      yield* Effect.tryPromise({
        try: () =>
          expect(link).toBeInViewport({ timeout: timeoutMilliseconds }),
        catch: viewportTimeout,
      });
    }).pipe(
      Effect.timeoutOrElse({
        duration: Duration.millis(timeoutMilliseconds),
        orElse: () => viewportTimeout(undefined),
      })
    );
  }
);

/**
 * Loads one source route, waits until its router has hydrated, and returns the
 * target Link in the viewport. The caller shows intent toward the Link and
 * settles the router before it presses.
 */
export const prepareClientNavigation = Effect.fn(
  "NakafaE2E.prepareClientNavigation"
)(function* <E, R>(
  page: Page,
  sourceHref: string,
  targetHref: string,
  timeoutMilliseconds: number,
  findLink: () => Effect.Effect<Locator, E, R>
) {
  yield* loadSourceRoute(page, sourceHref, targetHref, timeoutMilliseconds);
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
});
