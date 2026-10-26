import { expect, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { runOnPage } from "@/e2e/support/chat";
import { withReader } from "@/e2e/support/reader";
import { createSchool, inviteLearner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

test("a school member's profile opens for the member alone, without Share profile, and is not found for a visitor (K15)", async ({
  baseURL,
  browser,
  page,
}) => {
  await runOnPage(page, baseURL, (origin) =>
    Effect.gen(function* () {
      const school = yield* createSchool();
      yield* inviteLearner({
        address: `member-${school.slug}@acceptance.example.test`,
        baseURL: origin,
        context: page.context(),
        slug: school.slug,
      });

      const username = yield* Effect.promise(async () => {
        await page.goto("/en/user/settings");
        const field = page.getByRole("textbox", { name: app.Auth.username });
        await expect(field).not.toHaveValue("", {
          timeout: readinessTimeoutMilliseconds,
        });
        return field.inputValue();
      });

      yield* Effect.promise(async () => {
        const own = await page.goto(`/en/@${username}`);
        expect(own?.status()).toBe(200);
        await expect(
          page.getByRole("link", { name: app.Auth["edit-profile"] })
        ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
        await expect(
          page.getByRole("button", { name: app.Auth["share-profile"] })
        ).toHaveCount(0);
      });

      // Anyone else gets the answer of a username nobody holds, decided before the page renders.
      yield* withReader(browser, origin, (visitor) =>
        Effect.promise(async () => {
          const answer = await visitor.goto(`/en/@${username}`);
          expect(answer?.status()).toBe(404);
        })
      );
    })
  );
});
