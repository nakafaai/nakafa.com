import { type BrowserContextOptions, expect, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { openComments, openComposer } from "@/e2e/support/comments";
import { withBrowserContext } from "@/e2e/support/context";
import { withoutRawKeys } from "@/e2e/support/keys";

test("a lesson's comment composer names its toolbar and its emoji chooser in words, never by a message key", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  const origin = baseURL ?? "";
  const options: BrowserContextOptions = {
    baseURL: origin,
    serviceWorkers: "block",
  };

  await Effect.runPromise(
    withBrowserContext(browser, options, (context) =>
      Effect.gen(function* () {
        const page = yield* Effect.promise(() => context.newPage());
        yield* openComments(page, origin);
        yield* withoutRawKeys(
          page,
          "the comment composer and its emoji chooser",
          Effect.promise(async () => {
            await page
              .getByRole("button", {
                name: app.Comments["add-comment-placeholder"],
                exact: true,
              })
              .first()
              .click();
            await expect(openComposer(page)).toBeFocused();
            await page
              .getByRole("button", { name: app.Comments.emoji, exact: true })
              .last()
              .click();
            await expect(page.locator("[data-slot=emoji-panel]")).toBeVisible();
          })
        );
      })
    )
  );
});
