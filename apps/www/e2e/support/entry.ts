import { expect, type Page } from "@playwright/test";
import { Effect } from "effect";
import { activate } from "@/e2e/support/input";
import { confirmFinish, waitForRunningSection } from "@/e2e/support/player";
import { appRoutes } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/**
 * A set of one internal-entry section, TKA compulsory mathematics set 1 with 25
 * questions: its attempt runs, ends and is reviewed on the set page itself.
 */
export const entrySetHref = `${appRoutes.tryout}/indonesia/tka/compulsory-mathematics/set-1`;

/**
 * Starts an attempt from the entry set's page with its action and the dialog's
 * `primary` button, and waits for the player.
 */
export const startEntryAttempt = Effect.fn("NakafaE2E.startEntryAttempt")(
  function* (page: Page, action: string, primary: string) {
    const start = page
      .locator("main")
      .getByRole("button", { exact: true, name: action });
    yield* Effect.promise(() =>
      expect(start).toBeEnabled({ timeout: readinessTimeoutMilliseconds })
    );
    yield* Effect.promise(() => waitUntilTakenOver(start));
    yield* activate(start, false);
    yield* activate(
      page
        .getByRole("dialog")
        .getByRole("button", { exact: true, name: primary }),
      false
    );
    yield* waitForRunningSection(page);
  }
);

/**
 * Finishes the running attempt of the entry set. The set has one section, so
 * finishing it ends the attempt, and the player leaves the page.
 */
export const finishEntryAttempt = Effect.fn("NakafaE2E.finishEntryAttempt")(
  function* (page: Page) {
    yield* confirmFinish(page, false);
    yield* Effect.promise(() =>
      expect(
        page.getByRole("button", { exact: true, name: "Finish" })
      ).toBeHidden({ timeout: readinessTimeoutMilliseconds })
    );
  }
);
