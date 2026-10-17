import { expect, type Locator, type Page } from "@playwright/test";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The avatar of the account button in the sidebar footer, which holds the animal until a photo loads. */
export function sidebarAvatar(page: Page) {
  return page.locator('[data-sidebar="footer"] [data-slot="avatar"]');
}

/** The Select of the profile picture card that chooses the animal or the Google photo. */
export function pictureChoice(page: Page) {
  return page.locator("#user-settings-picture");
}

/** The animal that an avatar draws in its fallback. */
export function animalOf(avatar: Locator) {
  return avatar.locator('[data-slot="avatar-fallback"] svg');
}

/**
 * The animal that an avatar draws, as the markup inside its picture, and the box
 * the avatar takes on the page. The same animal has the same markup wherever it
 * is drawn, so two avatars of one learner must give equal markup.
 */
export async function drawnAnimal(avatar: Locator) {
  await expect(animalOf(avatar)).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  return {
    box: await avatar.boundingBox(),
    markup: await animalOf(avatar).innerHTML(),
  };
}
