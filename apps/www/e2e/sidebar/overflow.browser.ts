import { test } from "@playwright/test";
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { expectNoSidewaysSidebar } from "@/e2e/support/sidebar";

/**
 * Nakafa's sidebar never scrolls sideways: not in its sheet on a phone or a tablet, not open beside the page, and
 * not folded into its rail, where its group labels fold away under the icons.
 */
test("the sidebar keeps every part inside its own width at 320, 390, 768, 1024 and 1440 px, open and folded", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.andThen(
        seedAnalyticsConsent(page, "denied"),
        expectNoSidewaysSidebar(page, "/en/try-out")
      )
    )
  );
});
