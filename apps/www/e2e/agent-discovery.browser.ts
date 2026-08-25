import { expect, test } from "@playwright/test";
import { Effect } from "effect";

const CONTENT_PATH =
  "/en/subjects/mathematics/trigonometry/trigonometric-comparison-three-primary";

test("content routes advertise only their own Markdown representation", async ({
  page,
}) => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const response = yield* Effect.promise(() =>
        page.goto(CONTENT_PATH, { waitUntil: "domcontentloaded" })
      );
      yield* Effect.sync(() => expect(response?.ok()).toBe(true));

      const markdownAlternates = page.locator(
        'head link[rel="alternate"][type="text/markdown"]'
      );
      yield* Effect.promise(() => expect(markdownAlternates).toHaveCount(1));
      yield* Effect.promise(() =>
        expect(markdownAlternates).toHaveAttribute(
          "href",
          `https://nakafa.com${CONTENT_PATH}.md`
        )
      );
    })
  );
});
