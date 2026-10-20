import { expect, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { openChatPage, runOnPage } from "../support/chat";
import { withReader } from "../support/reader";
import { appRoutes } from "../support/route";
import { readinessTimeoutMilliseconds } from "../support/timeout";

/** The name of the synthetic learner, which the account button and the profile show. */
const LEARNER_NAME = "Acceptance Learner";
/** What a crawler reads on a profile, which many minors have. */
const NO_INDEX = /noindex/;
const NO_IMAGE_INDEX = /noimageindex/;
/** Where the bare address of a profile goes: the same address in a language. */
const LOCALIZED_ADDRESS = /\/[a-z]{2}\/@nobody_has_this$/;

test("a learner opens their own profile at the username address, which keeps the tabs and stays out of search", async ({
  baseURL,
  page,
}) => {
  await runOnPage(page, baseURL, (origin) =>
    Effect.gen(function* () {
      const { learner } = yield* openChatPage(page, origin);
      const profile = new RegExp(`/en/@${learner.username}$`);
      const comments = new RegExp(`/en/@${learner.username}/comments$`);
      const chat = new RegExp(`/en/@${learner.username}/chat$`);
      yield* Effect.promise(() => page.goto(appRoutes.settings));

      yield* Effect.promise(async () => {
        await page
          .locator('[data-sidebar="footer"]')
          .getByRole("button", { name: LEARNER_NAME })
          .click();
        await page.getByRole("menuitem", { name: app.Auth.profile }).click();
        await expect(page).toHaveURL(profile, {
          timeout: readinessTimeoutMilliseconds,
        });
        await expect(
          page.locator("main header").getByText(LEARNER_NAME, { exact: true })
        ).toBeVisible();

        // The profile stays out of search results.
        await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
          "content",
          NO_INDEX
        );
        await expect(page.locator('meta[name="googlebot"]')).toHaveAttribute(
          "content",
          NO_IMAGE_INDEX
        );

        // The tabs keep the username address.
        await page.getByRole("tab", { name: app.Common.chat }).click();
        await expect(page).toHaveURL(chat, {
          timeout: readinessTimeoutMilliseconds,
        });
        await page.getByRole("tab", { name: app.Common.comments }).click();
        await expect(page).toHaveURL(comments, {
          timeout: readinessTimeoutMilliseconds,
        });
        // The page is the Comments tab, not a not-found page.
        await expect(
          page.getByRole("tab", { name: app.Common.comments })
        ).toHaveAttribute("aria-selected", "true");
      });
    })
  );
});

test("the retired id address leads its own learner to the username address for good, but not to a Markdown version that does not exist", async ({
  baseURL,
  page,
}) => {
  await runOnPage(page, baseURL, (origin) =>
    Effect.gen(function* () {
      const { learner } = yield* openChatPage(page, origin);

      yield* Effect.promise(async () => {
        const request = page.context().request;
        for (const tab of ["", "/chat"]) {
          const answer = await request.get(
            `${origin}/en/user/${learner.userId}${tab}`,
            { maxRedirects: 0 }
          );
          expect(answer.status(), tab).toBe(308);
          expect(answer.headers().location, tab).toMatch(
            new RegExp(`/en/@${learner.username}${tab}$`)
          );
        }
        // A profile has no Markdown version, so the request is not sent on.
        const markdown = await request.get(
          `${origin}/en/user/${learner.userId}.md`,
          { maxRedirects: 0 }
        );
        expect(markdown.status()).toBe(404);
      });
    })
  );
});

test("a visitor reads the profile of a learner but finds neither its chats nor the retired id address", async ({
  baseURL,
  browser,
  page,
  request,
}) => {
  await runOnPage(page, baseURL, (origin) =>
    Effect.gen(function* () {
      const { learner } = yield* openChatPage(page, origin);

      yield* withReader(browser, origin, (visitor) =>
        Effect.promise(async () => {
          // Anyone may read a profile.
          const answer = await visitor.goto(`/en/@${learner.username}`);
          expect(answer?.status()).toBe(200);
          await expect(
            visitor
              .locator("main header")
              .getByText(LEARNER_NAME, { exact: true })
          ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
          // Its chats are its owner's alone, and the answer is a real 404,
          // decided before the page renders. The Start server draws the
          // framework's own 404 for an address the proxy rewrites, where
          // Vercel draws the app's page, so the status is the contract here.
          const chats = await visitor.goto(`/en/@${learner.username}/chat`);
          expect(chats?.status()).toBe(404);
        })
      );

      yield* Effect.promise(async () => {
        for (const tab of ["", "/chat"]) {
          const answer = await request.get(
            `${origin}/en/user/${learner.userId}${tab}`,
            { maxRedirects: 0 }
          );
          expect(answer.status(), tab).toBe(404);
        }
      });
    })
  );
});

test("an address that names no profile is not a page of the app", async ({
  request,
}) => {
  const notFound = ["/en/@ab", "/en/@1abc", "/en/user/garbage"];
  for (const path of notFound) {
    const answer = await request.get(path);
    expect(answer.status(), path).toBe(404);
  }
});

test("the bare address of a profile opens the same address in a language", async ({
  request,
}) => {
  const bare = await request.get("/@nobody_has_this", { maxRedirects: 0 });
  expect(bare.headers().location).toMatch(LOCALIZED_ADDRESS);
});
