import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** A lesson whose lab sets a vector's length with the shared slider. */
const VECTOR_LESSON = "/en/subjects/physics/vector/concept";

/**
 * The shared slider draws its track as every field does: a hairline border of the input colour
 * around the page's background, so a lab's slider reads as a control beside its fields.
 */
test("the shared slider's track keeps its border and the page's background", async ({
  page,
}) => {
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        yield* seedAnalyticsConsent(page, "denied");
        const response = yield* Effect.promise(() =>
          page.goto(VECTOR_LESSON, { waitUntil: "domcontentloaded" })
        );
        yield* Effect.sync(() => expect(response?.ok()).toBe(true));
        const track = page.locator('[data-slot="slider-track"]').first();
        yield* Effect.promise(async () => {
          await track.scrollIntoViewIfNeeded();
          await expect(track).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
          const drawn = await track.evaluate((element) => {
            const style = getComputedStyle(element);
            return {
              background: style.backgroundColor,
              border: style.borderTopWidth,
              page: getComputedStyle(document.body).backgroundColor,
            };
          });
          expect(drawn.border).toBe("1px");
          expect(drawn.background).toBe(drawn.page);
        });
      })
    )
  );
});
