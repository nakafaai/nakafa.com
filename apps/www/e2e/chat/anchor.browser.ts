import { expect, type Locator, type Page, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { pictures } from "@/e2e/support/prose";
import { TRANSCRIPT_ROW } from "@/e2e/support/selector";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { exchange, said, THREAD } from "@/e2e/support/transcript/message";
import { showChat, startTranscript } from "@/e2e/support/transcript/open";

/** An earlier answer, longer than the screen, so the chat scrolls above its last question. */
const EARLIER = exchange({
  order: 1,
  parts: [
    said(
      Arr.join(
        Arr.makeBy(
          12,
          (index) =>
            `Bagian ${index + 1}: limit fungsi menjelaskan nilai yang didekati fungsi saat masukannya mendekati suatu titik.`
        ),
        "\n\n"
      )
    ),
  ],
  question: "Apa itu limit?",
});

/** The last turn: a question that attaches a picture, and an answer short enough to fit under it. */
const LAST = Arr.map(
  exchange({
    order: 2,
    parts: [said("Gambar itu menunjukkan angka satu.")],
    question: "Apa arti gambar ini?",
  }),
  (message) =>
    message.role === "user"
      ? { ...message, parts: [...message.parts, ...pictures(1)] }
      : message
);

/** The row of the last question, and the row of its answer. */
const QUESTION_ROW = `${TRANSCRIPT_ROW}[data-message-id="${THREAD}-2-0"]`;
const ANSWER_ROW = `${TRANSCRIPT_ROW}[data-message-id="${THREAD}-2-1"]`;

/** Whether `row` lies whole inside the viewport of the transcript's scroller. */
const wholeInView = (row: Locator) =>
  row.evaluate((node) => {
    const scroller = node.closest('[data-slot="message-scroller-viewport"]');
    if (scroller === null) {
      return false;
    }
    const view = scroller.getBoundingClientRect();
    const box = node.getBoundingClientRect();
    return box.top >= view.top - 1 && box.bottom <= view.bottom + 1;
  });

/** Waits until the page has drawn the two frames that follow a change. */
const nextFrames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })
  );

/**
 * A chat opens on its last question whole, with the picture it attaches. An
 * answer draws more once its Markdown, its pictures and its fonts arrive, which
 * is after the chat has chosen where to stand. The question stays where it is
 * while the answer grows under it, instead of being pushed above the screen.
 */
test("opens a chat on its whole last question, picture included, while the answer grows under it", async ({
  baseURL,
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ height: 700, width: 390 });
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        const origin = yield* Effect.fromNullishOr(baseURL);
        const { shown } = yield* startTranscript(page, origin);
        yield* showChat(page, shown, "id", [...EARLIER, ...LAST]);
        yield* Effect.promise(async () => {
          const question = page.locator(QUESTION_ROW);
          await expect(question.locator("img")).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
          await expect
            .poll(() => wholeInView(question), {
              timeout: readinessTimeoutMilliseconds,
            })
            .toBe(true);

          // What arrives late draws under the answer's words.
          await page.locator(ANSWER_ROW).evaluate((row) => {
            const later = document.createElement("div");
            later.style.height = "1200px";
            row.append(later);
          });
        });
        for (let check = 0; check < 4; check += 1) {
          yield* Effect.promise(() => nextFrames(page));
          yield* Effect.sleep("300 millis");
          const whole = yield* Effect.promise(() =>
            wholeInView(page.locator(QUESTION_ROW))
          );
          expect(whole).toBe(true);
        }
      })
    )
  );
});
