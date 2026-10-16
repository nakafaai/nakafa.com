import { expect, type Page, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import { runOnPage } from "@/e2e/support/chat";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { exchange, said } from "@/e2e/support/transcript/message";
import { showChat, startTranscript } from "@/e2e/support/transcript/open";
import {
  commitCount,
  commitsAfter,
  watchRenders,
} from "@/e2e/support/transcript/renders";

/** Ten settled turns, twenty messages: the rows that a streamed answer must leave alone. */
const SETTLED = Arr.flatten(
  Arr.makeBy(10, (index) =>
    exchange({
      order: index + 1,
      parts: [said(`Answer ${index + 1}`)],
      question: `Question ${index + 1}`,
    })
  )
);

/** The chat with an eleventh answer that is still streaming `words`. */
const streaming = (words: string) =>
  Arr.appendAll(
    SETTLED,
    exchange({
      order: 11,
      parts: [{ state: "streaming", text: words, type: "text" }],
      question: "Explain the ratio",
      running: true,
    })
  );

/** The pieces that the answer streams in, one update each. */
const PIECES = ["Ratio", "Ratio of", "Ratio of two"];

/**
 * An answer that streams keeps the settled turns where they are. The first
 * update adds the question and the answer, and the settled answer before them
 * stops being the newest, so three rows render. Each later update renders the
 * answer's own row alone: the rest keep the props their memo compared.
 */
const keepsSettledRows = Effect.fn("NakafaE2E.streamKeepsSettledRows")(
  function* (page: Page, baseURL: string) {
    const { shown, stream } = yield* startTranscript(page, baseURL);
    yield* Effect.promise(() => watchRenders(page));
    yield* showChat(page, shown, "en", SETTLED);

    yield* Effect.forEach(PIECES, (words, index) =>
      Effect.gen(function* () {
        const before = yield* Effect.promise(() => commitCount(page));
        yield* stream(streaming(words));

        yield* Effect.promise(async () => {
          await expect(page.getByText(words, { exact: true })).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
          await expect
            .poll(async () => (await commitsAfter(page, before)).length)
            .toBeGreaterThan(0);
        });

        const commits = yield* Effect.promise(() => commitsAfter(page, before));
        const rows = Arr.reduce(commits, 0, (sum, commit) => sum + commit.rows);
        // The first update adds two rows and re-renders the settled answer before them.
        const most = index === 0 ? 3 : 1;

        expect(rows).toBeGreaterThan(0);
        expect(rows).toBeLessThanOrEqual(most);
      })
    );
  }
);

test.describe("Chat answer that streams at 1440px", () => {
  test.use({ viewport: { height: 900, width: 1440 } });
  test.describe.configure({ timeout: 180_000 });

  test("keeps the settled turns where they are while the newest answer streams", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) => keepsSettledRows(page, origin));
  });
});
