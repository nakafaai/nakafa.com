import { expect, type Page, test } from "@playwright/test";
import { BIO_MAX_LENGTH } from "@repo/backend/confect/users/bio";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { MAIN_DOMAIN } from "@repo/next-config/domains";
import { Array as Arr, Effect } from "effect";
import { animalOf, drawnAnimal, sidebarAvatar } from "@/e2e/support/avatar";
import { openChatPage, runOnPage } from "@/e2e/support/chat";
import { appRoutes } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The username field, which the form labels with the word Username. */
function usernameField(page: Page) {
  return page.getByRole("textbox", { name: app.Auth.username });
}

/** The bio field, which the form labels with the word Bio. */
function bioField(page: Page) {
  return page.getByRole("textbox", { name: app.Auth.bio });
}

/** The footer sentence that says why a bio over the limit cannot be saved. */
function bioTooLongAlert(page: Page) {
  return page
    .getByRole("alert")
    .getByText(app.Auth["bio-too-long"], { exact: true });
}

test("a learner shuffles the animal in settings, and the account button and the profile draw it", async ({
  baseURL,
  page,
}) => {
  await runOnPage(page, baseURL, (origin) =>
    Effect.gen(function* () {
      const { learner } = yield* openChatPage(page, origin);
      const shuffle = page.getByRole("button", {
        name: app.Auth["animal-shuffle"],
      });

      yield* Effect.promise(async () => {
        await page.goto(appRoutes.settings);
        await expect(shuffle).toBeVisible({
          timeout: readinessTimeoutMilliseconds,
        });
        const before = await animalOf(sidebarAvatar(page)).innerHTML();
        await shuffle.click();

        // A shuffle shows another animal at once, and never the one that showed.
        await expect
          .poll(() => animalOf(sidebarAvatar(page)).innerHTML(), {
            timeout: readinessTimeoutMilliseconds,
          })
          .not.toBe(before);
        const shuffled = await animalOf(sidebarAvatar(page)).innerHTML();

        // The shuffle is stored, which a second tab shows once it loads the page. This
        // tab stays where it is: a navigation here would cut the shuffle short on its
        // way to the server, and the reloads would never store it.
        const stored = await page.context().newPage();
        await expect(async () => {
          await stored.goto(appRoutes.settings);
          expect(await animalOf(sidebarAvatar(stored)).innerHTML()).toBe(
            shuffled
          );
        }).toPass({ timeout: readinessTimeoutMilliseconds });

        // The profile draws the same animal.
        await stored.goto(`/en/@${learner.username}`);
        const header = stored
          .locator("main header")
          .locator('[data-slot="avatar"]');
        expect((await drawnAnimal(header)).markup).toBe(shuffled);
        await stored.close();
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
        await page.goto(appRoutes.settings);
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

        await page.goto(appRoutes.settings);
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
        await page.goto(appRoutes.settings);
        // A bio over the limit says why in an alert in the footer, and cannot
        // be saved.
        await bioField(page).fill("a".repeat(BIO_MAX_LENGTH + 1));
        await expect(bioTooLongAlert(page)).toBeVisible({
          timeout: readinessTimeoutMilliseconds,
        });
        await expect(save).toBeDisabled();

        // A bio that fits shows the footer sentence that says what Save does.
        await bioField(page).fill(bio);
        await expect(bioTooLongAlert(page)).toHaveCount(0);
        await expect(
          page.getByText(app.Auth["bio-footer"], { exact: true })
        ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
        await expect(save).toBeEnabled({
          timeout: readinessTimeoutMilliseconds,
        });
        await save.click();

        await expect(async () => {
          const answer = await page.request.get(`${origin}${profile}`);
          expect(await answer.text()).toContain(bio);
        }).toPass({ timeout: readinessTimeoutMilliseconds });
        await page.goto(profile);
        await expect(page.getByText(bio, { exact: true })).toBeVisible({
          timeout: readinessTimeoutMilliseconds,
        });

        await page.goto(appRoutes.settings);
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

test("a bio of many lines shows every line on the profile", async ({
  baseURL,
  page,
}) => {
  // Ten lines, which a bio of at most 160 characters can hold.
  const bio = Arr.join(
    Arr.makeBy(10, (index) => `Line ${index + 1}`),
    "\n"
  );
  await runOnPage(page, baseURL, (origin) =>
    Effect.gen(function* () {
      const { learner } = yield* openChatPage(page, origin);
      const profile = `/en/@${learner.username}`;
      const save = page
        .locator("#user-settings-bio-form")
        .getByRole("button", { name: app.Auth.save });

      yield* Effect.promise(async () => {
        await page.goto(appRoutes.settings);
        await bioField(page).fill(bio);
        await expect(save).toBeEnabled({
          timeout: readinessTimeoutMilliseconds,
        });
        await save.click();

        await expect(async () => {
          const answer = await page.request.get(`${origin}${profile}`);
          expect(await answer.text()).toContain("Line 10");
        }).toPass({ timeout: readinessTimeoutMilliseconds });
        await page.goto(profile);

        // The profile shows the whole bio under its header, one line for each line written.
        const shown = page.locator("main section > p", { hasText: "Line 1" });
        await expect(shown).toBeVisible({
          timeout: readinessTimeoutMilliseconds,
        });
        const box = await shown.evaluate((node) => ({
          clipped: node.scrollHeight > node.clientHeight,
          height: node.getBoundingClientRect().height,
          line: Number.parseFloat(getComputedStyle(node).lineHeight),
        }));
        expect(box.clipped).toBe(false);
        expect(box.height).toBeGreaterThanOrEqual(box.line * 10 - 1);
      });
    })
  );
});
