import { expect, type Page } from "@playwright/test";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Effect } from "effect";

/** The theme button and the two policy links of the sign-in sentence, in English. */
const THEME = "Theme";
const TERMS = "Terms of Service";
const PRIVACY = "Privacy Policy";
/** Nina is drawn this many pixels wide beside the title. */
export const NINA = 'svg[width="190"]';

/** Expects one policy link to open its page of the main site in a new tab. */
const expectPolicyLink = Effect.fn("NakafaE2E.expectPolicyLink")(function* (
  page: Page,
  name: string,
  path: string
) {
  const link = page.getByRole("link", { exact: true, name });
  yield* Effect.promise(() => expect(link).toBeVisible());
  yield* Effect.promise(() =>
    expect(link).toHaveAttribute("href", new URL(path, SITE_ORIGIN).href)
  );
  yield* Effect.promise(() => expect(link).toHaveAttribute("target", "_blank"));
});

/**
 * Expects the parts that every sign-in page shows: the theme button and the two
 * policy links of the sentence. The figure above the title differs: Nina on the
 * main site, the school's mark on a school host.
 */
export const expectSignInParts = Effect.fn("NakafaE2E.expectSignInParts")(
  function* (page: Page) {
    yield* Effect.promise(() =>
      expect(
        page.getByRole("button", { exact: true, name: THEME })
      ).toBeVisible()
    );
    yield* expectPolicyLink(page, TERMS, "/en/terms-of-service");
    yield* expectPolicyLink(page, PRIVACY, "/en/privacy-policy");
  }
);
