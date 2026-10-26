import { describe, expect, it } from "@effect/vitest";
import {
  GuardianCodeEmailInput,
  guardianCodeEmail,
} from "@repo/email/templates/guardian/content";
import { Schema } from "effect";

describe("guardian code email", () => {
  it("carries the code and the general words of each locale, and nothing else", () => {
    for (const locale of ["de", "en", "id"] as const) {
      const email = guardianCodeEmail({ code: "042917", locale });
      expect(email.text).toContain("042917");
      expect(email.html).toContain("042917");
      expect(email.html).toContain(`lang="${locale}"`);
      expect(email.subject.length).toBeGreaterThan(0);
    }
    expect(guardianCodeEmail({ code: "042917", locale: "id" }).subject).toBe(
      "Kode masuk Nakafa Anda"
    );
  });

  it("accepts six digits only", () => {
    const decode = Schema.decodeUnknownOption(GuardianCodeEmailInput);
    expect(decode({ code: "123456", locale: "en" })._tag).toBe("Some");
    expect(decode({ code: "12345", locale: "en" })._tag).toBe("None");
    expect(decode({ code: "<b>12</b>", locale: "en" })._tag).toBe("None");
  });
});
