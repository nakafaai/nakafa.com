import { expect, type Page, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Array as Arr, Effect } from "effect";
import { saved } from "@/e2e/support/changes";
import { openChatPage, runOnPage } from "@/e2e/support/chat";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** A post with each kind of Markdown a learner writes, one kind to a block. */
const MARKDOWN = Arr.join(
  [
    "Kata **tebal** di baris ini.",
    "",
    "- Satu",
    "- Dua",
    "",
    "Satu baris saja.",
    "",
    "Baris pertama",
    "Baris kedua",
    "",
    String.raw`Paragraf kedua dengan rumus \(x^2 + 1\).`,
    "",
    "Hitung 2*3 + 4*5 di List<String>.",
    "",
    "![Foto kelas](https://example.com/foto.png)",
  ],
  "\n"
);

/** The composer of the owner's own Posts tab. */
const composerOf = (page: Page) =>
  page.getByRole("textbox", { name: app.Posts.placeholder });

/** The rows of the list, newest first. */
const rowsOf = (page: Page) => page.locator('[data-slot="feed-row"]');

test("a learner's post draws its Markdown as Nina's answers do", async ({
  baseURL,
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await runOnPage(page, baseURL, (origin) =>
    Effect.gen(function* () {
      const { changes, learner } = yield* openChatPage(page, origin);
      yield* Effect.promise(() => page.goto(`/en/@${learner.username}`));

      yield* Effect.promise(async () => {
        // The composer is enabled once the live list holds its first page.
        await expect(composerOf(page)).toBeEnabled({
          timeout: readinessTimeoutMilliseconds,
        });

        const writing = changes.sent;
        await composerOf(page).fill(MARKDOWN);
        await page.getByRole("button", { name: app.Posts.post }).click();
        const post = rowsOf(page).first();
        await expect(post).toContainText("Satu baris saja.");
        await saved(changes, writing);

        // Bold text and a list of two items.
        await expect(post.locator("strong")).toHaveText("tebal");
        await expect(post.locator("li")).toHaveCount(2);

        // A line break inside a paragraph stays a line break, so that paragraph
        // is two lines tall. The one pixel allows for subpixel rounding.
        const oneLine = await post
          .locator("p")
          .filter({ hasText: "Satu baris saja." })
          .boundingBox();
        const twoLines = await post
          .locator("p")
          .filter({ hasText: "Baris pertama" })
          .boundingBox();
        expect(twoLines?.height ?? 0).toBeGreaterThanOrEqual(
          2 * (oneLine?.height ?? Number.POSITIVE_INFINITY) - 1
        );

        // A paragraph after a blank line holds an inline formula.
        await expect(
          post.locator("p").filter({ hasText: "Paragraf kedua" })
        ).toHaveCount(1);
        await expect(post.locator(".katex")).toHaveCount(1);

        // Asterisks inside a product and text that reads as HTML stay as written.
        await expect(
          post
            .locator("p")
            .filter({ hasText: "Hitung 2*3 + 4*5 di List<String>." })
        ).toHaveCount(1);
        await expect(post.locator("em")).toHaveCount(0);

        // An image line is a link to its address, and no image loads.
        const photo = post.locator("a", { hasText: "Foto kelas" });
        await expect(photo).toHaveAttribute(
          "href",
          "https://example.com/foto.png"
        );
        await expect(photo).toHaveAttribute("target", "_blank");
        await expect(post.locator("p").filter({ has: photo })).toHaveCount(1);
        await expect(
          post.locator("p").filter({ has: photo }).locator("img")
        ).toHaveCount(0);
      });
    })
  );
});
