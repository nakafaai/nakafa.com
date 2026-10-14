import { expect, type Locator, type Page, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { LESSON_PATH, openChatPage, runOnPage } from "@/e2e/support/chat";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** A picture of the site that loads, and an address that answers with no picture. */
const LOADING_PHOTO = "/logo.png";
const MISSING_PHOTO = "/animal-photo-that-does-not-exist.png";
/** The names an account can hold from its provider: sixty letters with no space, one letter, and another script. */
const SIXTY_LETTERS = "Maria".repeat(12);
const ONE_LETTER = "A";
const OTHER_SCRIPT = "Наталья Петровна Иванова";

/** The avatar of the account button in the sidebar footer, which holds the animal until a photo loads. */
function sidebarAvatar(page: Page) {
  return page.locator('[data-sidebar="footer"] [data-slot="avatar"]');
}

/** The name the sidebar footer shows for the account. */
function sidebarName(page: Page, name: string) {
  return page
    .locator('[data-sidebar="footer"]')
    .getByText(name, { exact: true });
}

/** The animal that an avatar draws in its fallback. */
function animalOf(avatar: Locator) {
  return avatar.locator('[data-slot="avatar-fallback"] svg');
}

/**
 * The animal that an avatar draws, as the markup inside its picture, and the box
 * the avatar takes on the page. The same animal has the same markup wherever it
 * is drawn, so two avatars of one learner must give equal markup.
 */
async function drawnAnimal(avatar: Locator) {
  await expect(animalOf(avatar)).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  return {
    box: await avatar.boundingBox(),
    markup: await animalOf(avatar).innerHTML(),
  };
}

/**
 * Writes the name and the photo address of the signed-in learner through Better
 * Auth's own update-user endpoint. The app's user trigger copies both to the
 * profile that the sidebar and the comments read. Provider accounts can hold a
 * name of any length, so the test writes the names the settings form refuses.
 */
const setProfile = Effect.fn("NakafaE2E.setProfile")(function* (
  page: Page,
  origin: string,
  profile: { readonly image?: string; readonly name?: string }
) {
  yield* Effect.promise(async () => {
    const answer = await page.request.post(`${origin}/api/auth/update-user`, {
      data: profile,
      headers: { origin },
    });
    expect(answer.status()).toBe(200);
  });
});

test("a learner without a photo is drawn as an animal on the account button and on the profile", async ({
  baseURL,
  page,
}) => {
  await runOnPage(page, baseURL, (origin) =>
    Effect.gen(function* () {
      const { learner } = yield* openChatPage(page, origin);

      yield* Effect.promise(async () => {
        const avatar = sidebarAvatar(page);
        const account = await drawnAnimal(avatar);
        await expect(avatar.locator('[data-slot="avatar-image"]')).toHaveCount(
          0
        );

        await page.goto(`/en/@${learner.username}`);
        const header = page
          .locator("main header")
          .locator('[data-slot="avatar"]');
        const profile = await drawnAnimal(header);
        // The profile and the account button draw the animal of the same account.
        expect(profile.markup).toBe(account.markup);
      });
    })
  );
});

test("a photo that loads replaces the animal, and a photo that fails keeps the animal at the same size", async ({
  baseURL,
  page,
}) => {
  await runOnPage(page, baseURL, (origin) =>
    Effect.gen(function* () {
      yield* openChatPage(page, origin);
      const avatar = sidebarAvatar(page);

      const withAnimal = yield* Effect.promise(() => drawnAnimal(avatar));

      yield* setProfile(page, origin, { image: `${origin}${LOADING_PHOTO}` });
      yield* Effect.promise(async () => {
        await expect(avatar.locator('[data-slot="avatar-image"]')).toBeVisible({
          timeout: readinessTimeoutMilliseconds,
        });
        await expect(animalOf(avatar)).toHaveCount(0);
      });

      yield* setProfile(page, origin, { image: `${origin}${MISSING_PHOTO}` });
      const withMissingPhoto = yield* Effect.promise(() => drawnAnimal(avatar));

      yield* Effect.sync(() => {
        expect(withMissingPhoto.box?.width).toBe(withAnimal.box?.width);
        expect(withMissingPhoto.box?.height).toBe(withAnimal.box?.height);
        expect(withMissingPhoto.markup).toBe(withAnimal.markup);
      });
    })
  );
});

test("a comment by a learner without a photo shows the animal of the learner", async ({
  baseURL,
  page,
}) => {
  const text = "Pertanyaan tentang fungsi invers.";
  const placeholder = app.Comments["add-comment-placeholder"];
  await runOnPage(page, baseURL, (origin) =>
    Effect.gen(function* () {
      yield* openChatPage(page, origin);
      // The account button holds the animal of the learner before the lesson opens.
      const account = yield* Effect.promise(() =>
        drawnAnimal(sidebarAvatar(page))
      );

      yield* Effect.promise(async () => {
        await page.goto(LESSON_PATH);
        // The comments feed mounts once its anchor, at the foot of the lesson,
        // comes near the viewport.
        await page.locator("#comments").scrollIntoViewIfNeeded();
        const composer = page
          .locator("form")
          .filter({ has: page.getByRole("textbox", { name: placeholder }) });
        await composer.getByRole("textbox", { name: placeholder }).fill(text);
        await composer
          .getByRole("button", { name: app.Comments.comment, exact: true })
          .click();

        const comment = page
          .locator("div[id]")
          .filter({ has: page.getByText(text, { exact: true }) })
          .last();
        const drawn = await drawnAnimal(comment);
        expect(drawn.markup).toBe(account.markup);
      });
    })
  );
});

const NAME_CASES = [
  { label: "sixty letters with no space", name: SIXTY_LETTERS },
  { label: "one letter", name: ONE_LETTER },
  { label: "a name in another script", name: OTHER_SCRIPT },
];

for (const { label, name } of NAME_CASES) {
  test(`a learner with ${label} keeps the animal and the size of the account button`, async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        yield* openChatPage(page, origin);
        const avatar = sidebarAvatar(page);

        const before = yield* Effect.promise(() => drawnAnimal(avatar));

        yield* setProfile(page, origin, { name });
        yield* Effect.promise(async () => {
          await expect(sidebarName(page, name)).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
          await expect(animalOf(avatar)).toBeVisible();
          const after = await avatar.boundingBox();
          expect(after?.width).toBe(before.box?.width);
          expect(after?.height).toBe(before.box?.height);
          // The animal belongs to the account, so a new name keeps it.
          expect(await animalOf(avatar).innerHTML()).toBe(before.markup);
        });
      })
    );
  });
}
