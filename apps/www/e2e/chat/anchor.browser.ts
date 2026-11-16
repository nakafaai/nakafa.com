import { expect, type Page, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { pictures } from "@/e2e/support/prose";
import { waitForFrames } from "@/e2e/support/quiet";
import { TRANSCRIPT_ROW } from "@/e2e/support/selector";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { exchange, said, THREAD } from "@/e2e/support/transcript/message";
import { showChat, startTranscript } from "@/e2e/support/transcript/open";

/** The frames between two checks that the chat stays at its end. */
const CHECK_FRAMES = 18;

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

/** The row of the earlier question, and the row of the last answer. */
const EARLIER_ROW = `${TRANSCRIPT_ROW}[data-message-id="${THREAD}-1-0"]`;
const ANSWER_ROW = `${TRANSCRIPT_ROW}[data-message-id="${THREAD}-2-1"]`;

/** Longer than the transcript waits for the view to stay still before it keeps its place. */
const SETTLE_MILLISECONDS = 900;

/** How far the transcript's scroller stands from its end, and how far below its top `row` starts. */
const standing = (page: Page, row: string) =>
  page.locator(row).evaluate((node) => {
    const scroller = node.closest('[data-slot="message-scroller-viewport"]');
    if (scroller === null) {
      return { fromEnd: Number.NaN, top: Number.NaN };
    }
    return {
      fromEnd: Math.round(
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight
      ),
      top: Math.round(
        node.getBoundingClientRect().top - scroller.getBoundingClientRect().top
      ),
    };
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
 * A chat opens at its end, as a chat app opens. An answer draws more once its Markdown, its pictures and its fonts
 * arrive, which is after the chat has chosen where to stand, and a reader at the end stays at the end while it grows.
 */
test("opens a chat at its end and stays there while the last answer grows", async ({
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
          await expect(page.locator(ANSWER_ROW)).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
          await expect
            .poll(async () => (await standing(page, ANSWER_ROW)).fromEnd, {
              timeout: readinessTimeoutMilliseconds,
            })
            .toBeLessThan(9);

          // What arrives late draws under the answer's words.
          await page.locator(ANSWER_ROW).evaluate((row) => {
            const later = document.createElement("div");
            later.style.height = "1200px";
            row.append(later);
          });
        });
        for (let check = 0; check < 4; check += 1) {
          yield* Effect.promise(() => nextFrames(page));
          yield* Effect.promise(() => waitForFrames(page, CHECK_FRAMES));
          const { fromEnd } = yield* Effect.promise(() =>
            standing(page, ANSWER_ROW)
          );
          expect(fromEnd).toBeLessThan(9);
        }
      })
    )
  );
});

/** A chat the reader scrolled back into opens there again, and a chat left at its end opens at its end. */
test("opens a chat again where the reader left it, and at its end once they left it there", async ({
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
        const messages = [...EARLIER, ...LAST];
        yield* showChat(page, shown, "id", messages);
        const left = yield* Effect.promise(async () => {
          await expect(page.locator(ANSWER_ROW)).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
          await page
            .locator(EARLIER_ROW)
            .evaluate((row) => row.scrollIntoView({ block: "start" }));
          await page.waitForTimeout(SETTLE_MILLISECONDS);
          return standing(page, EARLIER_ROW);
        });
        expect(left.fromEnd).toBeGreaterThan(200);

        yield* showChat(page, shown, "id", messages);
        yield* Effect.promise(async () => {
          await expect
            .poll(async () => (await standing(page, EARLIER_ROW)).top, {
              timeout: readinessTimeoutMilliseconds,
            })
            .toBeGreaterThan(left.top - 4);
          const back = await standing(page, EARLIER_ROW);
          expect(Math.abs(back.top - left.top)).toBeLessThan(4);

          await page
            .locator(ANSWER_ROW)
            .evaluate((row) => row.scrollIntoView({ block: "end" }));
          await page.waitForTimeout(SETTLE_MILLISECONDS);
        });

        yield* showChat(page, shown, "id", messages);
        yield* Effect.promise(() =>
          expect
            .poll(async () => (await standing(page, ANSWER_ROW)).fromEnd, {
              timeout: readinessTimeoutMilliseconds,
            })
            .toBeLessThan(9)
        );
      })
    )
  );
});
