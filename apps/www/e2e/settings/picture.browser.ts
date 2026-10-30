import { expect, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { openChatPage, runOnPage } from "@/e2e/support/chat";
import { appRoutes } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The query that answers who the learner is, with the picture that shows. */
const CURRENT_USER = "auth/queries:getCurrentUser";
/** A one-pixel image that stands in for the account's Google photo. */
const PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=";

/** The learner's account as the server answers it, with a Google photo chosen as the picture. */
function withPhoto(value: unknown) {
  const user = Object(value);
  return {
    ...user,
    appUser: {
      ...Object(Reflect.get(user, "appUser")),
      image: PHOTO,
      picture: "photo",
    },
  };
}

/**
 * The page first draws the account it loaded, and the live answer then says the
 * Google photo shows. The picture card's footer keeps its sentence and its
 * Shuffle, which waits while the photo shows.
 */
test("the picture card keeps its sentence and its Shuffle when the account's Google photo shows", async ({
  baseURL,
  page,
}) => {
  await runOnPage(page, baseURL, (origin) =>
    Effect.gen(function* () {
      const { changes } = yield* openChatPage(page, origin);
      const hint = page.getByText(app.Auth["picture-footer-animal"], {
        exact: true,
      });
      const shuffle = page.getByRole("button", {
        name: app.Auth["animal-shuffle"],
      });

      yield* Effect.promise(async () => {
        await page.goto(appRoutes.settings);
        await expect(shuffle).toBeEnabled({
          timeout: readinessTimeoutMilliseconds,
        });
        await expect(hint).toBeVisible();

        changes.rewrite(CURRENT_USER, withPhoto);
        await page.reload();
        await expect(
          page.getByRole("combobox", { name: app.Auth.picture })
        ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
        await expect(hint).toBeVisible();
        await expect(shuffle).toBeDisabled();
      });
    })
  );
});
