import { assert, describe, it } from "@effect/vitest";
import {
  AccountReadyEmailInputSchema,
  getAccountReadyEmailCopy,
  getPublicEmailUrl,
} from "@repo/email/templates/ready/content";
import { Effect, Schema } from "effect";

const localizedCases = [
  {
    body: "Your account is set up. Explore a subject or start a Tryout whenever you're ready.",
    locale: "en",
    subject: "Your Nakafa account is ready",
  },
  {
    body: "Akunmu sudah siap. Pilih mata pelajaran atau mulai try out kapan pun kamu siap.",
    locale: "id",
    subject: "Akun Nakafa kamu sudah siap",
  },
  {
    body: "Dein Konto ist eingerichtet. Wähle ein Fach oder starte einen Probetest, wenn du bereit bist.",
    locale: "de",
    subject: "Dein Nakafa-Konto ist bereit",
  },
] as const;

describe("account-ready content", () => {
  for (const localized of localizedCases) {
    it(`keeps ${localized.locale} copy aligned with the current product`, () => {
      const copy = getAccountReadyEmailCopy(localized.locale);

      assert.strictEqual(copy.body, localized.body);
      assert.strictEqual(copy.subject, localized.subject);
      assert.ok(copy.cta.length > 0);
      assert.ok(copy.footerReason.length > 0);
      assert.ok(copy.privacyPolicy.length > 0);
      assert.ok(copy.termsOfService.length > 0);
    });
  }

  it("derives canonical public URLs from the company identity", () => {
    assert.strictEqual(
      getPublicEmailUrl("/logo.png"),
      "https://nakafa.com/logo.png"
    );
  });

  it.effect("accepts HTTPS and local preview URLs", () =>
    Effect.gen(function* () {
      for (const continueUrl of [
        "https://nakafa.com/en/home",
        "http://localhost:3000/en/home",
        "http://127.0.0.1:3000/en/home",
        "http://[::1]:3000/en/home",
      ]) {
        const input = yield* Schema.decodeEffect(AccountReadyEmailInputSchema)({
          continueUrl,
          locale: "en",
          privacyPolicyUrl: "https://nakafa.com/en/privacy-policy",
          termsOfServiceUrl: "https://nakafa.com/en/terms-of-service",
        });

        assert.strictEqual(input.continueUrl, continueUrl);
      }
    })
  );

  it.effect("rejects malformed and insecure public URLs", () =>
    Effect.gen(function* () {
      for (const continueUrl of [
        "not-a-url",
        "http://nakafa.com/en/home",
        "ftp://nakafa.com/en/home",
      ]) {
        const failure = yield* Schema.decodeEffect(
          AccountReadyEmailInputSchema
        )({
          continueUrl,
          locale: "en",
          privacyPolicyUrl: "https://nakafa.com/en/privacy-policy",
          termsOfServiceUrl: "https://nakafa.com/en/terms-of-service",
        }).pipe(Effect.flip);

        assert.ok(failure.message.includes("continueUrl"));
      }
    })
  );
});
