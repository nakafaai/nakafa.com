import { expect, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { readAnatomy } from "@/e2e/support/anatomy";
import { openChatPage, runOnPage } from "@/e2e/support/chat";
import { readCumulativeLayoutShift } from "@/e2e/support/layout";

const VIEWPORTS = [
  { name: "a phone", size: { width: 390, height: 844 } },
  { name: "a desktop", size: { width: 1440, height: 900 } },
];

/** The page's one rhythm under its header, `pageRhythmVariants`. */
const RHYTHM = 24;

/** The tabs of the owner's own profile, each by the label the tab shows. */
const TABS = [en.Common.posts, en.Common.comments, en.Common.chat];

for (const viewport of VIEWPORTS) {
  test.describe(`a signed-in profile on ${viewport.name}`, () => {
    test.use({ viewport: viewport.size });

    test("the profile stands in the app's frame, its body one rhythm under the header, moves nothing once it draws, and no tab click moves it", async ({
      baseURL,
      page,
    }) => {
      await runOnPage(page, baseURL, (origin) =>
        Effect.gen(function* () {
          const { learner } = yield* openChatPage(page, origin);
          yield* Effect.promise(() => page.goto(`/en/@${learner.username}`));
          yield* Effect.promise(() => page.waitForLoadState("networkidle"));
          expect(yield* readCumulativeLayoutShift(page)).toBe(0);
          yield* Effect.promise(() =>
            expect
              .poll(async () => {
                const anatomy = await readAnatomy(page);
                return { gap: anatomy.gap, problems: anatomy.problems };
              })
              .toEqual({ gap: RHYTHM, problems: [] })
          );

          for (const label of TABS) {
            yield* Effect.promise(() =>
              page.getByRole("tab", { name: label, exact: true }).click()
            );
            yield* Effect.promise(() => page.waitForLoadState("networkidle"));
            expect(yield* readCumulativeLayoutShift(page)).toBe(0);
          }
        })
      );
    });
  });
}
