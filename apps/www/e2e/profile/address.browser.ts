import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The username of a synthetic learner: the plain name, numbered once another learner took it. */
const PROFILE_ADDRESS = /\/en\/@acceptancelearner\d*$/;
const CHAT_ADDRESS = /\/en\/@acceptancelearner\d*\/chat$/;
/** The retired address of a profile, which carries the id of the account. */
const RETIRED_ADDRESS = /\/en\/user\/[a-z0-9]{32}(?:\?|$)/;
/** The account button of the sidebar, which names the learner. */
const ACCOUNT_NAME = /Acceptance Learner/;
/** Where the bare address of a profile goes: the same address in a language. */
const LOCALIZED_ADDRESS = /\/[a-z]{2}\/@nobody_has_this$/;
/** What a crawler reads on a profile, which many minors have. */
const NO_INDEX = /noindex/;
const NO_IMAGE_INDEX = /noimageindex/;

test("the profile link of a signed-in learner opens the username address and keeps it", async ({
  baseURL,
  page,
}) => {
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        const origin = yield* Effect.fromNullishOr(baseURL);
        yield* seedAnalyticsConsent(page, "denied");
        yield* signInLearner(page.context(), origin);
        yield* Effect.promise(() => page.goto("/en/user/settings"));

        yield* Effect.promise(async () => {
          // The product still links a profile by the id of the account.
          const retired = page.waitForRequest((request) =>
            RETIRED_ADDRESS.test(request.url())
          );
          await page
            .getByRole("button", { name: ACCOUNT_NAME })
            .first()
            .click();
          await page.getByRole("menuitem", { name: "Profile" }).click();
          const retiredUrl = (await retired).url();

          await expect(page).toHaveURL(PROFILE_ADDRESS, {
            timeout: readinessTimeoutMilliseconds,
          });
          await expect(
            page.getByText("Acceptance Learner", { exact: true }).first()
          ).toBeVisible();

          // The profile stays reachable by link and out of search results.
          await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
            "content",
            NO_INDEX
          );
          await expect(page.locator('meta[name="googlebot"]')).toHaveAttribute(
            "content",
            NO_IMAGE_INDEX
          );

          // The retired address answers with a temporary redirect, because a
          // rename moves the username and a browser keeps a permanent one.
          const answer = await page
            .context()
            .request.get(retiredUrl, { maxRedirects: 0 });
          expect(answer.status()).toBe(307);
          expect(answer.headers().location).toMatch(PROFILE_ADDRESS);

          // The tabs keep the username address.
          await page.getByRole("tab", { name: "Chat" }).click();
          await expect(page).toHaveURL(CHAT_ADDRESS, {
            timeout: readinessTimeoutMilliseconds,
          });
          await page.getByRole("tab", { name: "Comments" }).click();
          await expect(page).toHaveURL(PROFILE_ADDRESS, {
            timeout: readinessTimeoutMilliseconds,
          });
        });
      })
    )
  );
});

test("an address that names no profile is not a page of the app", async ({
  request,
}) => {
  const notFound = [
    "/en/@ab",
    "/en/@1abc",
    "/en/user/garbage",
    "/en/user/x/chat",
  ];
  for (const path of notFound) {
    const answer = await request.get(path);
    expect(answer.status(), path).toBe(404);
  }
  const bare = await request.get("/@nobody_has_this", { maxRedirects: 0 });
  expect(bare.headers().location).toMatch(LOCALIZED_ADDRESS);
});
