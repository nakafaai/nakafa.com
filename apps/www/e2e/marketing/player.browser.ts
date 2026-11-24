import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { loadMarketingPage } from "@/e2e/support/marketing";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { pressInPopup, waitForPopupsGone } from "@/e2e/support/popup";
import { stepTo } from "@/e2e/support/scroll";
import { desktopViewport, touchViewport } from "@/e2e/support/viewport";

/** The right answer for question 1 (momentum of a 2 kg ball at 3 m/s). */
const MOMENTUM = /6/u;

/**
 * Verifies that the School landing's embedded exam player matches the live player's layout:
 * - On desktop (`lg+`): full-height right pane (`PlayerSidebar`) with `PlayerNavigatorHeader`,
 *   `PlayerTimerCard` (hiding the header timer), `PlayerGrid`, and `PlayerTools` (`PaneFooter`)
 *   aligned flush with the paper column's header and footer, plus local view switching without
 *   leaving the page.
 * - On mobile (`< lg`): desktop pane hidden, header timer visible, and navigator sheet opener
 *   opening `PlayerSheet` with the grid and tools footer.
 */
const verifyLandingPlayer = Effect.fn("NakafaE2E.verifyLandingPlayer")(
  function* (page: Page, wide: boolean) {
    yield* Effect.promise(() => page.emulateMedia({ reducedMotion: "reduce" }));
    yield* loadMarketingPage(page, "/en/school");
    const section = page.locator("section#player");
    const paperDemo = section.locator('[data-slot="paper-demo"]');
    // Step to the compact selector above the frame so stepTo lands cleanly on short phone viewports.
    yield* stepTo(
      page,
      section.getByRole("combobox", { name: "Question types" })
    );
    yield* Effect.promise(() => expect(paperDemo).toBeVisible());

    const sidebar = paperDemo.locator("[data-player-sidebar]");
    const answer = paperDemo.getByRole("radio", { name: MOMENTUM });
    yield* Effect.promise(() => answer.click());
    yield* Effect.promise(() => expect(answer).toBeChecked());

    if (wide) {
      yield* Effect.promise(() => expect(sidebar).toBeVisible());
      yield* Effect.promise(() =>
        expect(sidebar.getByText("1 of 10 answered")).toBeVisible()
      );
      yield* Effect.promise(() =>
        expect(sidebar.locator("[data-player-time]")).toBeVisible()
      );
      yield* Effect.promise(() =>
        expect(paperDemo.locator('header [role="timer"]')).toBeHidden()
      );

      const [paperHeaderBox, paneHeaderBox, paperFooterBox, paneFooterBox] =
        yield* Effect.promise(() =>
          Promise.all([
            paperDemo.locator("> div > header").boundingBox(),
            sidebar.locator("[data-pane-header]").boundingBox(),
            paperDemo.locator("> div > footer").boundingBox(),
            sidebar.locator("footer").boundingBox(),
          ])
        );
      expect(Math.round(paperHeaderBox?.height ?? 0)).toBe(
        Math.round(paneHeaderBox?.height ?? -1)
      );
      expect(Math.round(paperFooterBox?.height ?? 0)).toBe(
        Math.round(paneFooterBox?.height ?? -1)
      );
      expect(Math.round(paperHeaderBox?.y ?? 0)).toBe(
        Math.round(paneHeaderBox?.y ?? -1)
      );
      expect(Math.round(paperFooterBox?.y ?? 0)).toBe(
        Math.round(paneFooterBox?.y ?? -1)
      );

      // Accessibility legend lives behind the info control in PlayerTools, not inline in the pane body.
      yield* Effect.promise(() =>
        sidebar.getByRole("button", { name: "Accessibility" }).click()
      );
      yield* Effect.promise(() =>
        expect(page.getByText("Answered", { exact: true })).toBeVisible()
      );
      yield* Effect.promise(() => page.keyboard.press("Escape"));
      yield* Effect.promise(() => waitForPopupsGone(page));

      // View switching stays local inside the demo without server requests or errors.
      yield* Effect.promise(() =>
        sidebar.getByRole("button", { name: "One question" }).click()
      );
      yield* Effect.promise(() =>
        pressInPopup(page.getByRole("menuitemradio", { name: "List" }))
      );
      yield* Effect.promise(() => waitForPopupsGone(page));
      yield* Effect.promise(() =>
        expect(
          paperDemo.getByText("Momentum is measured in joules.")
        ).toBeVisible()
      );
      yield* Effect.promise(() =>
        sidebar.getByRole("button", { name: "List" }).click()
      );
      yield* Effect.promise(() =>
        pressInPopup(page.getByRole("menuitemradio", { name: "One question" }))
      );
      yield* Effect.promise(() => waitForPopupsGone(page));
      return;
    }

    yield* Effect.promise(() => expect(sidebar).toBeHidden());
    yield* Effect.promise(() =>
      expect(paperDemo.locator('header [role="timer"]')).toBeVisible()
    );
    yield* Effect.promise(() =>
      paperDemo
        .getByRole("button", {
          name: "Open the question navigator, question 1",
        })
        .click()
    );
    const sheet = page.getByRole("dialog", { name: "Questions" });
    yield* Effect.promise(() => expect(sheet).toBeVisible());
    yield* Effect.promise(() =>
      expect(sheet.getByRole("button", { name: "One question" })).toBeVisible()
    );
  }
);

for (const viewport of [desktopViewport, touchViewport]) {
  test.describe(`School landing player at ${viewport.name}`, () => {
    test.use({
      hasTouch: viewport.hasTouch,
      viewport: { height: viewport.height, width: viewport.width },
    });

    test("the framed exam player matches the live player's pane layout", async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(
          page,
          verifyLandingPlayer(page, viewport.width >= 1024)
        )
      );
    });
  });
}
