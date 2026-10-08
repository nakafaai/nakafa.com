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
                configuredBaseURL,
                target,
                viewport.hasTouch
              );
            })
        )
      );
    });
  }
}
