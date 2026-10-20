import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { expect, type Page, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { encodeJsonText } from "@repo/utilities/json";
import { Effect, FileSystem } from "effect";
import { runAcceptanceCommand } from "@/e2e/support/acceptance";
import {
  animalMarkup,
  animalOf,
  drawnAnimal,
  pictureChoice,
  sidebarAvatar,
} from "@/e2e/support/avatar";
import { LESSON_PATH, openChatPage, runOnPage } from "@/e2e/support/chat";
import { appRoutes } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** A picture of the site that loads, and an address that holds no picture. */
const LOADING_PHOTO = "/logo.png";
/**
 * An address that holds no picture. The site answers any `.png` address with
 * its social image (`apps/www/src/lib/og/route.ts`), so the photo test answers this
 * one with a 404 itself, as a real missing image answers.
 */
const MISSING_PHOTO = "/animal-photo-that-does-not-exist.png";
/** The names an account can hold from its provider: sixty letters with no space, one letter, and another script. */
const SIXTY_LETTERS = "Maria".repeat(12);
const ONE_LETTER = "A";
const OTHER_SCRIPT = "Наталья Петровна Иванова";
/**
 * The avatar of one comment's author, which sits in the row that is the only
 * child of the comment's container. The thread and its composer sit beside the
 * row, not in it, so the row holds one avatar.
 */
const AUTHOR_AVATAR = ':scope > [data-slot="feed-row"] > [data-slot="avatar"]';

/** The name the sidebar footer shows for the account. */
function sidebarName(page: Page, name: string) {
  return page
    .locator('[data-sidebar="footer"]')
    .getByText(name, { exact: true });
}

/**
 * Writes the name and the photo address of a learner through the acceptance
 * command, which updates the account in Better Auth and runs the app's update
 * trigger, which copies both to the profile that the sidebar and the comments
 * read. Provider accounts can hold a name of any length, so the test writes the
 * names the settings form refuses.
 */
const setProfile = Effect.fn("NakafaE2E.setProfile")(
  function* (
    authId: string,
    profile: { readonly image?: string; readonly name?: string }
  ) {
    const fs = yield* FileSystem.FileSystem;
    const directory = yield* fs.makeTempDirectoryScoped({
      prefix: "nakafa-profile-",
    });
    const file = `${directory}/profile.json`;
    yield* fs.writeFileString(file, encodeJsonText(profile));
    yield* runAcceptanceCommand("profile", authId, file);
  },
  Effect.scoped,
  Effect.provide(nodeServicesLayer)
);

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

test("a photo shows once the learner chooses it, and a photo that fails keeps the animal at the same size", async ({
  baseURL,
  page,
}) => {
  await runOnPage(page, baseURL, (origin) =>
    Effect.gen(function* () {
      const { learner } = yield* openChatPage(page, origin);
      const avatar = sidebarAvatar(page);

      const withAnimal = yield* Effect.promise(() => drawnAnimal(avatar));

      yield* setProfile(learner.authId, {
        image: `${origin}${LOADING_PHOTO}`,
      });
      yield* Effect.promise(async () => {
        await page.goto(appRoutes.settings);
        await expect(pictureChoice(page)).toBeVisible({
          timeout: readinessTimeoutMilliseconds,
        });
        // The Google photo waits until the learner chooses it.
        await expect(avatar.locator('[data-slot="avatar-image"]')).toHaveCount(
          0
        );

        await pictureChoice(page).click();
        await page
          .getByRole("option", { name: app.Auth["picture-photo"] })
          .click();
        await expect(avatar.locator('[data-slot="avatar-image"]')).toBeVisible({
          timeout: readinessTimeoutMilliseconds,
        });
        await expect(animalOf(avatar)).toHaveCount(0);
      });

      yield* Effect.promise(() =>
        page.route(`**${MISSING_PHOTO}`, (route) =>
          route.fulfill({ status: 404 })
        )
      );
      yield* setProfile(learner.authId, {
        image: `${origin}${MISSING_PHOTO}`,
      });
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
  const placeholder = app.Comments["add-comment-placeholder"];
  await runOnPage(page, baseURL, (origin) =>
    Effect.gen(function* () {
      const { learner } = yield* openChatPage(page, origin);
      // The text names the learner, so no comment of another learner on the same lesson has it.
      const text = `Pertanyaan tentang fungsi invers dari ${learner.username}.`;
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
          .getByRole("button", { name: app.Posts.post, exact: true })
          .click();

        const comment = page
          .locator("div[id]")
          .filter({ has: page.getByText(text, { exact: true }) });
        const drawn = await drawnAnimal(comment.locator(AUTHOR_AVATAR));
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
        const { learner } = yield* openChatPage(page, origin);
        const avatar = sidebarAvatar(page);

        const before = yield* Effect.promise(() => drawnAnimal(avatar));

        yield* setProfile(learner.authId, { name });
        yield* Effect.promise(async () => {
          await expect(sidebarName(page, name)).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
          await expect(animalOf(avatar)).toBeVisible();
          const after = await avatar.boundingBox();
          expect(after?.width).toBe(before.box?.width);
          expect(after?.height).toBe(before.box?.height);
          // The animal belongs to the account, so a new name keeps it.
          expect(await animalMarkup(avatar)).toBe(before.markup);
        });
      })
    );
  });
}
