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
 * The animal an avatar draws, as its shapes with each shape's attributes in name
 * order. React redraws a shuffled animal on the shapes of the one before, and an
 * attribute that a reused shape gains is written last, so the same animal can list
 * its attributes in another order than a fresh page draws them. The drawing is the
 * same, so the comparison sets the order aside. The function runs in the page.
 */
export function animalMarkup(avatar: Locator) {
  return animalOf(avatar).evaluate((svg) => {
    const canonical = (node: Element): string => {
      const attributes = Array.from(
        node.attributes,
        (attribute) => `${attribute.name}="${attribute.value}"`
      )
        .sort()
        .join(" ");
      const children = Array.from(node.children, canonical).join("");
      return `<${node.tagName} ${attributes}>${children}</${node.tagName}>`;
    };
    return Array.from(svg.children, canonical).join("");
  });
}

/**
 * The animal that an avatar draws, as its markup (animalMarkup), and the box the
 * avatar takes on the page. The same animal has the same markup wherever it is
 * drawn, so two avatars of one learner must give equal markup.
 */
export async function drawnAnimal(avatar: Locator) {
  await expect(animalOf(avatar)).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  return {
    box: await avatar.boundingBox(),
    markup: await animalMarkup(avatar),
  };
}
