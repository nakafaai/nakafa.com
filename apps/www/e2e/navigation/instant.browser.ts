import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { withBrowserContext } from "@/e2e/support/context";
import {
  navigationCases,
  verifyHardAndClientNavigation,
} from "@/e2e/support/navigation/cases";
import { targetViewports } from "@/e2e/support/viewport";

test.describe.configure({ mode: "parallel" });

/**
 * Every destination is reached two ways: by a hard navigation, and by a client
 * navigation from a link that the reader showed intent toward. The client
 * navigation must show the destination without a blank frame, without a data
 * request for the press, and with its click-to-content time on the report.
 */
for (const viewport of targetViewports) {
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
