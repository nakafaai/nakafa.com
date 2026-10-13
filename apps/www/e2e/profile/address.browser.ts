import { expect, type Page, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/standalone/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { openChatPage, runOnPage } from "@/e2e/support/chat";
import { withReader } from "@/e2e/support/reader";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The name of the synthetic learner, which the account button and the profile show. */
const LEARNER_NAME = "Acceptance Learner";
/** What a crawler reads on a profile, which many minors have. */
const NO_INDEX = /noindex/;
const NO_IMAGE_INDEX = /noimageindex/;
/** Where the bare address of a profile goes: the same address in a language. */
const LOCALIZED_ADDRESS = /\/[a-z]{2}\/@nobody_has_this$/;
/** The address of a root with no profile: the app's own page that tells it is not there. */
const notFoundOn = (page: Page) =>
  expect(
    page.getByRole("heading", { level: 1, name: en.NotFound.title })
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });

test("a learner opens their own profile at the username address, which keeps the tabs and stays out of search", async ({
  baseURL,
  page,
}) => {
  await runOnPage(page, baseURL, (origin) =>
    Effect.gen(function* () {
      const { learner } = yield* openChatPage(page, origin);
      const profile = new RegExp(`/en/@${learner.username}$`);
      const chat = new RegExp(`/en/@${learner.username}/chat$`);
      yield* Effect.promise(() => page.goto("/en/user/settings"));

      yield* Effect.promise(async () => {
        await page
          .locator('[data-sidebar="footer"]')
          .getByRole("button", { name: LEARNER_NAME })
          .click();
        await page.getByRole("menuitem", { name: "Profile" }).click();
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
        await page.getByRole("tab", { name: "Chat" }).click();
        await expect(page).toHaveURL(chat, {
          timeout: readinessTimeoutMilliseconds,
        });
        await page.getByRole("tab", { name: "Comments" }).click();
        await expect(page).toHaveURL(profile, {
          timeout: readinessTimeoutMilliseconds,
        });
      });
    })
  );
});

test("the retired id address leads its own learner to the username address for good", async ({
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
      });
    })
  );
});

test("a visitor finds neither the profile of a learner nor the retired id address", async ({
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
          // Nothing tells the visitor whether the username exists.
          await visitor.goto(`/en/@${learner.username}`);
          await notFoundOn(visitor);
          await expect(
            visitor.getByText(LEARNER_NAME, { exact: true })
          ).toHaveCount(0);
          await visitor.goto(`/en/@${learner.username}/chat`);
          await notFoundOn(visitor);
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
