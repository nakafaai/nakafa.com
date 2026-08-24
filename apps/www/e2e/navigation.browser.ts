import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { withBrowserContext } from "./support/browser-context";
import {
  navigationCases,
  verifyHardAndClientNavigation,
} from "./support/navigation";

const targetViewports = [
  { height: 800, name: "compact", width: 320 },
  { height: 844, hasTouch: true, name: "touch", width: 390 },
  { height: 1024, name: "tablet-portrait", width: 768 },
  { height: 768, name: "tablet-landscape", width: 1024 },
  { height: 900, name: "desktop", width: 1440 },
] as const;

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
            hasTouch: "hasTouch" in viewport ? viewport.hasTouch : false,
            serviceWorkers: "block",
            viewport: { height: viewport.height, width: viewport.width },
          },
          (context) =>
            Effect.gen(function* () {
              const page = yield* Effect.promise(() => context.newPage());
              const target = yield* navigationCase.resolve(page);
              yield* verifyHardAndClientNavigation(
                page,
                configuredBaseURL,
                target
              );
            })
        )
      );
    });
  }
}
