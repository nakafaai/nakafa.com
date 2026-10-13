import { expect, test } from "@playwright/test";
import { NINA_FILE_COUNT } from "@repo/backend/client/nina/uploads";
import { Array as Arr, Effect } from "effect";
import {
  composerOf,
  fileOf,
  NOT_ATTACHED,
  NOTICE_LIST,
  noticeWith,
  openComposer,
  pickFiles,
  runPage,
  WORD_TYPE,
  write,
} from "@/e2e/support/attachment";
import { openChatPage, runOnPage, START } from "@/e2e/support/chat";
import { UNCONFIRMED } from "@/e2e/support/sheet";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** How long Sonner keeps a notice that sets no lifetime of its own. */
const DEFAULT_LIFETIME_MILLISECONDS = 4000;

const photo = (name: string) => fileOf(name, "image/png", 1);

/** Scrolls the list of a notice to its end, in the page. */
const scrollToEnd = (notice: HTMLElement, scroller: string) => {
  const list = notice.querySelector(scroller);
  if (list) {
    list.scrollTop = list.scrollHeight;
  }
};

/** How far the list of a notice is scrolled, in the page. */
const readScroll = (notice: HTMLElement, scroller: string) =>
  notice.querySelector(scroller)?.scrollTop ?? null;

test.describe("The notice of the files not attached at 390px", () => {
  test.use({ viewport: { height: 900, width: 390 } });
  test.describe.configure({ timeout: 180_000 });

  test("stays past the lifetime of an ordinary notice, until the learner closes it, and a new pick replaces it with a list at its top", async ({
    page,
  }) => {
    await runPage(
      page,
      Effect.gen(function* () {
        // The page runs on a clock the test moves, so the time that a notice
        // would not outlast passes at once.
        yield* Effect.promise(() => page.clock.install());
        const composer = yield* openComposer(page);
        // A file of a type Nina does not read and far more files than the
        // composer holds: the notice has a list that scrolls.
        yield* pickFiles(composer, [
          fileOf("essay.docx", WORD_TYPE, 20),
          ...Arr.makeBy(NINA_FILE_COUNT, (index) =>
            photo(`photo-${index + 1}.png`)
          ),
          ...Arr.makeBy(25, (index) => photo(`extra-${index + 1}.png`)),
        ]);
        const notice = noticeWith(page, NOT_ATTACHED);
        yield* Effect.promise(() => expect(notice).toBeVisible());

        // A list of names takes longer to read than an ordinary notice stays,
        // and a list that scrolls cannot be used in a notice that is leaving.
        // The page takes a notice off a moment after its time is up, so the
        // wait is the moment, and the notice is read after it.
        yield* Effect.promise(async () => {
          await page.clock.fastForward(DEFAULT_LIFETIME_MILLISECONDS * 3);
          await page.waitForTimeout(500);
          await expect(notice).toBeVisible();
        });

        // The learner reads down the list. The composer is full, so a new pick
        // drops every file for the count: it replaces the notice in place with
        // a new list, which starts at its top, not where the old one was left.
        yield* Effect.promise(async () => {
          await notice.evaluate(scrollToEnd, NOTICE_LIST);
          await expect
            .poll(() => notice.evaluate(readScroll, NOTICE_LIST))
            .toBeGreaterThan(0);
        });
        yield* pickFiles(
          composer,
          Arr.makeBy(25, (index) => photo(`late-${index + 1}.png`))
        );
        yield* Effect.promise(async () => {
          await expect(notice).toHaveCount(1);
          await expect(notice).toContainText("late-1.png");
          await expect(notice).not.toContainText("extra-1.png");
          await expect
            .poll(() => notice.evaluate(readScroll, NOTICE_LIST))
            .toBe(0);
        });

        // The learner closes it with the button of the notice.
        yield* Effect.promise(async () => {
          await notice.getByRole("button", { name: "Close toast" }).click();
          await page.clock.fastForward(1000);
          await expect(notice).toHaveCount(0);
        });
      })
    );
  });

  test("stays when the message is refused and goes when it is sent", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        const { changes } = yield* openChatPage(page, origin);
        const composer = page.locator("main main");
        yield* pickFiles(composer, [fileOf("essay.docx", WORD_TYPE, 20)]);
        const notice = noticeWith(page, NOT_ATTACHED);
        yield* Effect.promise(() => expect(notice).toBeVisible());
        yield* write(composer, "Explain this essay");

        // The server refuses the message, so nothing was sent: the notice stays
        // beside the one that says the message did not go.
        changes.failNext(START);
        yield* Effect.promise(async () => {
          await composerOf(composer).press("Enter");
          await expect(noticeWith(page, UNCONFIRMED)).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
          await expect(notice).toBeVisible();
        });

        // The same message goes through, and the notice goes with it.
        yield* Effect.promise(async () => {
          await composerOf(composer).press("Enter");
          await expect(notice).toHaveCount(0, {
            timeout: readinessTimeoutMilliseconds,
          });
        });
      })
    );
  });
});
