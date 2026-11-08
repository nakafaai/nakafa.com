import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { withBrowserContext } from "@/e2e/support/context";
import {
  navigationCases,
  verifyHardAndClientNavigation,
} from "@/e2e/support/navigation/cases";
import {
  desktopViewport,
  tabletPortraitViewport,
  touchViewport,
} from "@/e2e/support/viewport";

test.describe.configure({ mode: "parallel" });

/**
 * The three ways a reader reaches a link: a tap with the sidebar in a sheet, a mouse with the sheet (every width
 * below the large breakpoint, 320 included), and a mouse with the sidebar beside the page (1024 included). Whether a
 * page fits 320 and 1024 is the layout suites' concern (`layout/overflow`, `layout/header`).
 */
const NAVIGATION_VIEWPORTS = [
  touchViewport,
  tabletPortraitViewport,
  desktopViewport,
];

/**
 * Every destination is reached two ways: by a hard navigation, and by a client
 * navigation from a link that the reader showed intent toward. The client
 * navigation must show the destination without a blank frame, without a data
 * request for the press, and with its click-to-content time on the report.
 */
for (const viewport of NAVIGATION_VIEWPORTS) {
  for (const navigationCase of navigationCases) {
    test(`${navigationCase.name} is instant at ${viewport.name}`, async ({
      baseURL,
      browser,
    }) => {
      expect(baseURL).toBeTruthy();
      const configuredBaseURL = baseURL ?? "";
      await Effect.runPromise(
        withBrowserContext(
          browser,
          {
            baseURL: configuredBaseURL,
            hasTouch: viewport.hasTouch,
            serviceWorkers: "block",
            viewport: { height: viewport.height, width: viewport.width },
          },
          (context) =>
            Effect.gen(function* () {
              const page = yield* Effect.promise(() => context.newPage());
              yield* seedAnalyticsConsent(page, "denied");
              const target = yield* navigationCase.resolve(page);
              yield* verifyHardAndClientNavigation(
                page,
                target,
                viewport.hasTouch
              );
            })
        )
      );
    });
  }
}
