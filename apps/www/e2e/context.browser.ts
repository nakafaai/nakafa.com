import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import {
  withBrowserContext,
  withObservedPageErrors,
} from "@/e2e/support/browser-context";
import { seedDeniedAnalyticsConsent } from "@/e2e/support/consent";

const MATERIAL_PATH =
  "/en/subjects/mathematics/function-composition-inverse-function/function-concept";
const MATERIAL_CONTEXT =
  "merdeka~class-11-mathematics-function-composition-inverse-function";
const CONTEXTUAL_MATERIAL_HREF = `${MATERIAL_PATH}?ctx=${MATERIAL_CONTEXT}`;
const MATERIAL_TITLE_PATTERN = /^Function Concept\b/;

/** Proves the rendered sidebar keeps verified placement without polluting SEO. */
test("material sidebar preserves verified curriculum context", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      {
        baseURL: baseURL ?? "",
        serviceWorkers: "block",
        viewport: { height: 900, width: 1440 },
      },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          yield* withObservedPageErrors(
            page,
            Effect.gen(function* () {
              yield* seedDeniedAnalyticsConsent(page);
              const response = yield* Effect.promise(() =>
                page.goto(CONTEXTUAL_MATERIAL_HREF, {
                  waitUntil: "domcontentloaded",
                })
              );
              yield* Effect.sync(() => expect(response?.status()).toBe(200));

              const canonical = page.locator('link[rel="canonical"]');
              yield* Effect.promise(() => expect(canonical).toHaveCount(1));
              yield* Effect.promise(() =>
                expect(canonical).toHaveAttribute(
                  "href",
                  `https://nakafa.com${MATERIAL_PATH}`
                )
              );

              const header = page
                .locator("aside")
                .getByRole("link", { name: MATERIAL_TITLE_PATTERN });
              yield* Effect.promise(() => expect(header).toHaveCount(1));
              yield* Effect.promise(() =>
                expect(header).toHaveAttribute("href", CONTEXTUAL_MATERIAL_HREF)
              );
            })
          );
        })
    )
  );
});
