import { expect, type Locator, type Page, test } from "@playwright/test";
import { BIO_MAX_LENGTH } from "@repo/backend/confect/users/bio";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { MAIN_DOMAIN } from "@repo/next-config/domains";
import { Array as Arr, Effect, String as Str } from "effect";
import { animalOf, drawnAnimal, sidebarAvatar } from "@/e2e/support/avatar";
import { openChatPage, runOnPage } from "@/e2e/support/chat";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The settings page, where the Profile cards are. */
const SETTINGS = "/en/user/settings";

/**
 * The buttons that pick an animal: one for each animal the card offers, each
 * named by its animal, so they share the words of the label before the name.
 */
function animalPicks(page: Page) {
  const before = Arr.headNonEmpty(
    Str.split(app.Auth["animal-pick"], "{animal}")
  );
  return page.getByRole("button", { name: new RegExp(`^${before}`) });
}

/** The markup of the animal that each button draws, in the order the card shows them. */
function offeredMarkup(picks: Locator) {
  return picks.evaluateAll((buttons) =>
    buttons.map((button) => button.querySelector("svg")?.innerHTML ?? null)
  );
}

/** The username field, which the form labels with the word Username. */
function usernameField(page: Page) {
  return page.getByRole("textbox", { name: app.Auth.username });
}

/** The bio field, which the form labels with the word Bio. */
function bioField(page: Page) {
  return page.getByRole("textbox", { name: app.Auth.bio });
}

test("a learner picks another animal in settings, and the account button and the profile draw it", async ({
  baseURL,
  page,
}) => {
  await runOnPage(page, baseURL, (origin) =>
    Effect.gen(function* () {
      const { learner } = yield* openChatPage(page, origin);

      yield* Effect.promise(async () => {
        await page.goto(SETTINGS);
        const picks = animalPicks(page);
        await expect(picks).toHaveCount(4, {
          timeout: readinessTimeoutMilliseconds,
        });
        const pick = picks.first();
        const pickedMarkup = await animalOf(pick).innerHTML();
        await pick.click();

        await expect
          .poll(() => animalOf(sidebarAvatar(page)).innerHTML(), {
            timeout: readinessTimeoutMilliseconds,
          })
          .toBe(pickedMarkup);

        // The pick is stored, which a second tab shows once it loads the page. This
        // tab stays where it is: a navigation here would cut the pick short on its
        // way to the server, and the reloads would never store it.
        const stored = await page.context().newPage();
        await expect(async () => {
          await stored.goto(SETTINGS);
          expect(await animalOf(sidebarAvatar(stored)).innerHTML()).toBe(
            pickedMarkup
          );
        }).toPass({ timeout: readinessTimeoutMilliseconds });

        // The profile draws the same animal.
        await stored.goto(`/en/@${learner.username}`);
        const header = stored
          .locator("main header")
          .locator('[data-slot="avatar"]');
        expect((await drawnAnimal(header)).markup).toBe(pickedMarkup);
        await stored.close();

        // Drawing again offers four other animals.
        await expect(animalPicks(page)).toHaveCount(4, {
          timeout: readinessTimeoutMilliseconds,
        });
        const offered = await offeredMarkup(animalPicks(page));
        await page
          .getByRole("button", { name: app.Auth["animal-shuffle"] })
          .click();
        await expect
          .poll(() => offeredMarkup(animalPicks(page)))
          .not.toEqual(offered);
        await expect(animalPicks(page)).toHaveCount(4);
      });
    })
  );
});

test("a learner takes a new username in settings: a taken or invalid name says why, the new address opens the profile, and the old one is not found", async ({
  baseURL,
  page,
}) => {
  await runOnPage(page, baseURL, (origin) =>
    Effect.gen(function* () {
      const { learner } = yield* openChatPage(page, origin);
      // The account's id is a unique string of letters and digits, so the name
      // is unique too, and it starts with a letter.
      const renamed = `pelajar${learner.userId.slice(-12)}`;
      const form = page.locator("#user-settings-username-form");
      const save = form.getByRole("button", { name: app.Auth.save });

      yield* Effect.promise(async () => {
        await page.goto(SETTINGS);
        await usernameField(page).fill("1abc");
        await expect(
          page.getByText(app.Auth["username-letter-first"], { exact: true })
        ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
        await expect(save).toBeDisabled();

        await usernameField(page).fill(renamed);
        await expect(
          page.getByText(app.Auth["username-available"], { exact: true })
        ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
        await expect(
          page.getByText(app.Auth["username-footer"], { exact: true })
        ).toBeVisible();
        await expect(save).toBeEnabled();
        await save.click();

        // The new address answers once the change is stored.
        await expect(async () => {
          const answer = await page.request.get(`${origin}/en/@${renamed}`);
          expect(answer.status()).toBe(200);
        }).toPass({ timeout: readinessTimeoutMilliseconds });
        const profile = await page.goto(`/en/@${renamed}`);
        expect(profile?.status()).toBe(200);
        await expect(
          page.getByText(`@${renamed}`, { exact: true })
        ).toBeVisible();

        // The old address stops working at once.
        const old = await page.request.get(`${origin}/en/@${learner.username}`);
        expect(old.status()).toBe(404);

        await page.goto(SETTINGS);
        const address = `${MAIN_DOMAIN}/@${renamed}`;
        await expect(
          page.getByText(
            app.Auth["username-description"].replace("{address}", address),
            { exact: true }
          )
        ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
      });
    })
  );
});

test("a learner writes a bio in settings, the profile shows it, and clearing it removes it", async ({
  baseURL,
  page,
}) => {
  const bio = "Belajar sambil ngopi.";
  await runOnPage(page, baseURL, (origin) =>
    Effect.gen(function* () {
      const { learner } = yield* openChatPage(page, origin);
      const profile = `/en/@${learner.username}`;
      const form = page.locator("#user-settings-bio-form");
      const save = form.getByRole("button", { name: app.Auth.save });

      yield* Effect.promise(async () => {
        await page.goto(SETTINGS);
        await bioField(page).fill(bio);
        await expect(
          page.getByText(`${bio.length} of ${BIO_MAX_LENGTH} characters`, {
            exact: true,
          })
        ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
        await save.click();

        await expect(async () => {
          const answer = await page.request.get(`${origin}${profile}`);
          expect(await answer.text()).toContain(bio);
        }).toPass({ timeout: readinessTimeoutMilliseconds });
        await page.goto(profile);
        await expect(page.getByText(bio, { exact: true })).toBeVisible({
          timeout: readinessTimeoutMilliseconds,
        });

        await page.goto(SETTINGS);
        await bioField(page).fill("");
        await save.click();

        await expect(async () => {
          const answer = await page.request.get(`${origin}${profile}`);
          expect(await answer.text()).not.toContain(bio);
        }).toPass({ timeout: readinessTimeoutMilliseconds });
        await page.goto(profile);
        await expect(page.getByText(bio, { exact: true })).toHaveCount(0);
      });
    })
  );
});
