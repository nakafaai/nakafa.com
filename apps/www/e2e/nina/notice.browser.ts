import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import {
  composerOf,
  fileOf,
  NOT_ATTACHED,
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

test.describe("The notice of the files not attached at 390px", () => {
  test.use({ viewport: { height: 900, width: 390 } });
  test.describe.configure({ timeout: 180_000 });

  test("stays past the lifetime of an ordinary notice, until the learner closes it, and a new pick replaces it", async ({
    page,
  }) => {
    await runPage(
      page,
      Effect.gen(function* () {
        // The page runs on a clock the test moves, so the time that a notice
        // would not outlast passes at once.
        yield* Effect.promise(() => page.clock.install());
        const composer = yield* openComposer(page);
        yield* pickFiles(composer, [fileOf("essay.docx", WORD_TYPE, 20)]);
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

        // A new pick replaces the notice in place instead of stacking another.
        yield* pickFiles(composer, [fileOf("memo.docx", WORD_TYPE, 20)]);
        yield* Effect.promise(async () => {
          await expect(notice).toHaveCount(1);
          await expect(notice).toContainText("memo.docx");
          await expect(notice).not.toContainText("essay.docx");
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
