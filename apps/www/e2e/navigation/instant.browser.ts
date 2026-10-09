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
 * A build without the testing API ignores the lock, so every check inside an
 * `instant()` scope would pass without proving anything. A build with it puts
 * the lock's bootstrap script into each prerendered document.
 *
 * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/exposeTestingApiInProductionBuild
 * @see https://github.com/vercel/next.js/blob/v16.4.0/packages/next/src/server/app-render/instant-test-bootstrap.ts
 */
test("the build carries the instant navigation lock", async ({ request }) => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const response = yield* Effect.promise(() => request.get("/en"));
      const document = yield* Effect.promise(() => response.text());
      expect(
        document.includes("__next_instant_test"),
        "Build with NEXT_EXPOSE_TESTING_API=true and NODE_ENV=production."
      ).toBe(true);
    })
  );
});

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
