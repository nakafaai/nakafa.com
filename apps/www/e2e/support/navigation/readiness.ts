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
 * Waits until the client router has started on the page. TanStack's history
 * writes its route key into the state of the current entry when the router is
 * created, which can happen before hydration finishes, so the key does not
 * prove hydration. `waitForHydratedLink` checks the Link itself.
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

/**
 * Waits until React has attached its props to the Link. React writes them when
 * it hydrates an element, and a Link without them has no event handlers yet,
 * so a press before then is not handled by the router.
 */
const waitForHydratedLink = Effect.fn("NakafaE2E.waitForHydratedLink")(
  function* (
    link: Locator,
    sourceHref: string,
    targetHref: string,
    timeoutMilliseconds: number
  ) {
    yield* Effect.tryPromise({
      try: () =>
        expect
          .poll(
            () =>
              link.evaluate((node) =>
                Object.keys(node).some((key) => key.startsWith("__reactProps$"))
              ),
            { timeout: timeoutMilliseconds }
          )
          .toBe(true),
      catch: (error) =>
        new NavigationReadinessTimeout({
          errorText: readErrorText(error),
          href: targetHref,
          phase: "hydration",
          sourceHref,
          timeoutMilliseconds,
        }),
    });
  }
);

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
 * Loads one source route, waits until its router has started and the target
 * Link has been hydrated, and returns the Link in the viewport. The caller
 * shows intent toward the Link and settles the router before it presses.
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
  yield* waitForHydratedLink(link, sourceHref, targetHref, timeoutMilliseconds);
  yield* ensureLinkInViewport(
    link,
    sourceHref,
    targetHref,
    timeoutMilliseconds
  );
  return link;
});
