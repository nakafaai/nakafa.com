import { describe, expect, it } from "@effect/vitest";
import {
  ACTIVE_APP_LOCALE_CODES,
  type ActiveAppLocaleCode,
} from "@nakafa/aksara-contracts/locale";
import refs from "@repo/backend/confect/_generated/refs";
import { tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const render = refs.internal.emails.invite.delivery.render;

/** The input that the read step of the workflow hands to the render step. */
const input = (locale: ActiveAppLocaleCode) => ({
  locale,
  organisation: "Yayasan Harapan Bangsa",
  privacyPolicyUrl: `https://nakafa.com/${locale}/privacy`,
  signInUrl: `https://nakafa.com/${locale}/auth`,
  termsOfServiceUrl: `https://nakafa.com/${locale}/terms`,
});

describe("emails/invite/delivery", () => {
  it.effect.each(ACTIVE_APP_LOCALE_CODES)(
    "renders the invitation in %s with the organisation, the sign-in link, and the legal links",
    (locale) =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const message = yield* fixture.internal.action(render, input(locale));
        expect(message.subject).toContain("Yayasan Harapan Bangsa");
        for (const body of [message.html, message.text]) {
          expect(body).toContain("Yayasan Harapan Bangsa");
          expect(body).toContain(`https://nakafa.com/${locale}/auth`);
          expect(body).toContain(`https://nakafa.com/${locale}/privacy`);
          expect(body).toContain(`https://nakafa.com/${locale}/terms`);
        }
      })
  );
});
