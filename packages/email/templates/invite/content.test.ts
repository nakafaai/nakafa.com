import { assert, describe, it } from "@effect/vitest";
import {
  getInviteEmailCopy,
  InviteEmailInputSchema,
} from "@repo/email/templates/invite/content";
import { Array as Arr, Effect, Schema } from "effect";

const links = {
  privacyPolicyUrl: "https://nakafa.com/en/privacy-policy",
  signInUrl: "https://harapan.nakafa.com/",
  termsOfServiceUrl: "https://nakafa.com/en/terms-of-service",
};

describe("invitation content", () => {
  it("names the organisation in English", () => {
    const copy = getInviteEmailCopy("en", "Harapan");

    assert.strictEqual(copy.subject, "Harapan invited you to Nakafa");
    assert.strictEqual(copy.body, "Sign in with this email address to join.");
    assert.strictEqual(copy.cta, "Sign in");
    assert.strictEqual(
      copy.footerReason,
      "We sent this email because Harapan invited this address to Nakafa."
    );
    assert.strictEqual(copy.privacyPolicy, "Privacy Policy");
    assert.strictEqual(copy.termsOfService, "Terms of Service");
  });

  it("names the organisation in Indonesian", () => {
    const copy = getInviteEmailCopy("id", "Harapan");

    assert.strictEqual(copy.subject, "Harapan mengundang kamu ke Nakafa");
    assert.strictEqual(
      copy.body,
      "Masuk dengan alamat email ini untuk bergabung."
    );
    assert.strictEqual(copy.cta, "Masuk");
    assert.strictEqual(
      copy.footerReason,
      "Kami mengirim email ini karena Harapan mengundang alamat ini ke Nakafa."
    );
    assert.strictEqual(copy.privacyPolicy, "Kebijakan Privasi");
    assert.strictEqual(copy.termsOfService, "Syarat dan Ketentuan");
  });

  it("names the organisation in German", () => {
    const copy = getInviteEmailCopy("de", "Harapan");

    assert.strictEqual(copy.subject, "Harapan hat dich zu Nakafa eingeladen");
    assert.strictEqual(
      copy.body,
      "Melde dich mit dieser E-Mail-Adresse an, um beizutreten."
    );
    assert.strictEqual(copy.cta, "Anmelden");
    assert.strictEqual(
      copy.footerReason,
      "Wir senden dir diese E-Mail, weil Harapan diese Adresse zu Nakafa eingeladen hat."
    );
    assert.strictEqual(copy.privacyPolicy, "Datenschutzerklärung");
    assert.strictEqual(copy.termsOfService, "Nutzungsbedingungen");
  });

  it.effect("accepts an organisation, a locale, and secure links", () =>
    Effect.gen(function* () {
      const input = yield* Schema.decodeEffect(InviteEmailInputSchema)({
        ...links,
        locale: "en",
        organisation: "Harapan",
      });

      assert.strictEqual(input.organisation, "Harapan");
    })
  );

  it.effect(
    "accepts a plain HTTP sign-in link only on a loopback host, a school's local host included",
    () =>
      Effect.gen(function* () {
        const local = yield* Schema.decodeEffect(InviteEmailInputSchema)({
          ...links,
          locale: "en",
          organisation: "Harapan",
          signInUrl: "http://harapan.localhost:3000/",
        });
        const preview = yield* Schema.decodeEffect(InviteEmailInputSchema)({
          ...links,
          locale: "en",
          organisation: "Harapan",
          signInUrl: "http://localhost:3000/en/auth",
        });
        const lookalike = yield* Schema.decodeEffect(InviteEmailInputSchema)({
          ...links,
          locale: "en",
          organisation: "Harapan",
          signInUrl: "http://localhost.example.test/",
        }).pipe(Effect.flip);

        assert.strictEqual(local.signInUrl, "http://harapan.localhost:3000/");
        assert.strictEqual(preview.signInUrl, "http://localhost:3000/en/auth");
        assert.ok(lookalike.message.includes("signInUrl"));
      })
  );

  it.effect("rejects a blank organisation and an insecure sign-in link", () =>
    Effect.gen(function* () {
      const blank = yield* Schema.decodeEffect(InviteEmailInputSchema)({
        ...links,
        locale: "en",
        organisation: "",
      }).pipe(Effect.flip);
      const insecure = yield* Schema.decodeEffect(InviteEmailInputSchema)({
        ...links,
        locale: "en",
        organisation: "Harapan",
        signInUrl: "http://harapan.nakafa.com/",
      }).pipe(Effect.flip);

      assert.ok(blank.message.includes("organisation"));
      assert.ok(insecure.message.includes("signInUrl"));
    })
  );

  it.effect(
    "rejects an organisation with a line break, which would end the subject",
    () =>
      Effect.gen(function* () {
        const refusals = yield* Effect.forEach(
          [
            "Harapan\nBcc: lain@example.test",
            "Harapan\rBangsa",
            "Harapan Bangsa",
          ],
          (organisation) =>
            Schema.decodeEffect(InviteEmailInputSchema)({
              ...links,
              locale: "en",
              organisation,
            }).pipe(Effect.flip)
        );

        assert.deepStrictEqual(
          Arr.map(refusals, ({ message }) => message.includes("organisation")),
          [true, true, true]
        );
      })
  );
});
