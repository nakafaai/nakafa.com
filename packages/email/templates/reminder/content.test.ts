import { assert, describe, it } from "@effect/vitest";
import {
  getReminderEmailCopy,
  ReminderEmailInputSchema,
} from "@repo/email/templates/reminder/content";
import { Effect, Schema } from "effect";

const input = {
  continueUrl:
    "https://nakafa.com/id/try-out/indonesia/tka/compulsory-mathematics/set-1",
  hoursLeft: 6,
  locale: "id",
  privacyPolicyUrl: "https://nakafa.com/id/privacy-policy",
  setTitle: "Matematika Wajib Set 1",
  termsOfServiceUrl: "https://nakafa.com/id/terms-of-service",
  unsubscribeUrl: "https://nakafa.com/id/unsubscribe?token=signed",
  variant: "a",
} as const;

describe("try-out reminder content", () => {
  it("names the set and the hours left in each language and wording, counting one hour apart", () => {
    const words = { hoursLeft: 6, setTitle: "Set 1", variant: "a" } as const;
    assert.strictEqual(
      getReminderEmailCopy("id", words).subject,
      "6 jam lagi untuk Set 1"
    );
    assert.strictEqual(
      getReminderEmailCopy("en", words).subject,
      "6 hours left for Set 1"
    );
    assert.strictEqual(
      getReminderEmailCopy("de", words).subject,
      "Noch 6 Stunden für Set 1"
    );
    const one = { ...words, hoursLeft: 1 };
    assert.ok(getReminderEmailCopy("en", one).body.includes("for 1 hour."));
    assert.ok(getReminderEmailCopy("de", one).body.includes("noch 1 Stunde."));
    const nina = { ...words, variant: "b" } as const;
    assert.strictEqual(
      getReminderEmailCopy("id", nina).subject,
      "Tempatmu di Set 1 menunggu"
    );
    assert.ok(getReminderEmailCopy("en", nina).body.startsWith("Nina"));
    assert.ok(getReminderEmailCopy("de", nina).body.startsWith("Nina"));
    assert.strictEqual(
      getReminderEmailCopy("de", nina).unsubscribe,
      "Abmelden"
    );
  });

  it.effect(
    "accepts whole hours from 1 to 24, and a one-line set title only",
    () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknownEffect(ReminderEmailInputSchema);
        assert.deepStrictEqual(yield* decode(input), input);
        for (const wrong of [
          { ...input, hoursLeft: 0 },
          { ...input, hoursLeft: 25 },
          { ...input, setTitle: "Set\n1" },
          { ...input, variant: "c" },
        ]) {
          assert.strictEqual(
            (yield* Effect.exit(decode(wrong)))._tag,
            "Failure"
          );
        }
      })
  );
});
