import { assert, describe, it } from "@effect/vitest";
import {
  getPassEndingEmailCopy,
  PassEndingEmailInputSchema,
} from "@repo/email/templates/pass/content";
import { Effect, Schema } from "effect";

const links = {
  extendUrl: "https://nakafa.com/en/user/settings/subscriptions",
  privacyPolicyUrl: "https://nakafa.com/en/privacy-policy",
  termsOfServiceUrl: "https://nakafa.com/en/terms-of-service",
};

describe("pass reminder content", () => {
  it("names the day the pass ends in each language", () => {
    const en = getPassEndingEmailCopy("en", "26 November 2026");
    const id = getPassEndingEmailCopy("id", "26 November 2026");
    const de = getPassEndingEmailCopy("de", "26. November 2026");

    assert.strictEqual(en.subject, "Your Pro pass ends on 26 November 2026");
    assert.strictEqual(en.cta, "Extend Pro");
    assert.strictEqual(en.privacyPolicy, "Privacy Policy");
    assert.strictEqual(
      id.subject,
      "Pass Pro kamu berakhir pada 26 November 2026"
    );
    assert.strictEqual(id.cta, "Perpanjang Pro");
    assert.strictEqual(de.subject, "Dein Pro-Pass endet am 26. November 2026");
    assert.ok(de.body.startsWith("Dein Pro-Pass endet am 26. November 2026."));
  });

  it.effect(
    "accepts a day and secure links, and refuses a day with a line break",
    () =>
      Effect.gen(function* () {
        const input = yield* Schema.decodeEffect(PassEndingEmailInputSchema)({
          ...links,
          endsOn: "26 November 2026",
          locale: "en",
        });
        const broken = yield* Schema.decodeEffect(PassEndingEmailInputSchema)({
          ...links,
          endsOn: "26 November\nBcc: lain@example.test",
          locale: "en",
        }).pipe(Effect.flip);

        assert.strictEqual(input.endsOn, "26 November 2026");
        assert.ok(broken.message.includes("endsOn"));
      })
  );
});
