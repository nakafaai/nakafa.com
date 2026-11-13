import { describe, expect, it } from "@effect/vitest";
import { EMAIL_LOGO_URL, EMAIL_SENDER } from "@repo/email/brand";
import {
  GuardianCodeEmailInput,
  guardianCodeEmail,
} from "@repo/email/templates/guardian/content";
import { Schema } from "effect";

/** The page an address's unsubscribe link opens. */
const UNSUBSCRIBE_URL = "https://nakafa.com/de/unsubscribe?token=signed";

describe("guardian code email", () => {
  it("carries the code and the general words of each locale, and nothing else", () => {
    for (const locale of ["de", "en", "id"] as const) {
      const email = guardianCodeEmail({
        code: "042917",
        locale,
        unsubscribeUrl: UNSUBSCRIBE_URL,
      });
      expect(email.text).toContain("042917");
      expect(email.html).toContain("042917");
      expect(email.html).toContain(`lang="${locale}"`);
      expect(email.subject.length).toBeGreaterThan(0);
    }
    expect(
      guardianCodeEmail({
        code: "042917",
        locale: "id",
        unsubscribeUrl: UNSUBSCRIBE_URL,
      }).subject
    ).toBe("Kode masuk Nakafa kamu");
  });

  it("follows the one layout: the mark, the reason, the sender, the contact address, the legal links, and the unsubscribe, light and dark", () => {
    const email = guardianCodeEmail({
      code: "042917",
      locale: "de",
      unsubscribeUrl: UNSUBSCRIBE_URL,
    });
    expect(email.html).toContain(EMAIL_LOGO_URL);
    expect(email.html).toContain("prefers-color-scheme:dark");
    expect(email.html).toContain(`mailto:${EMAIL_SENDER.contact}`);
    expect(email.html).toContain("https://nakafa.com/de/privacy-policy");
    expect(email.html).toContain("https://nakafa.com/de/terms-of-service");
    expect(email.text).toContain(EMAIL_SENDER.address);
    expect(email.text).toContain(EMAIL_SENDER.contact);
    expect(email.text).toContain("Anmeldecode für Eltern angefordert");
    expect(email.html).toContain(`href="${UNSUBSCRIBE_URL}"`);
    expect(email.html).toContain(">Abmelden</a>");
    expect(email.text).toContain(`Abmelden: ${UNSUBSCRIBE_URL}`);
  });

  it("accepts six digits only", () => {
    const decode = Schema.decodeUnknownOption(GuardianCodeEmailInput);
    expect(
      decode({ code: "123456", locale: "en", unsubscribeUrl: UNSUBSCRIBE_URL })
        ._tag
    ).toBe("Some");
    expect(
      decode({ code: "12345", locale: "en", unsubscribeUrl: UNSUBSCRIBE_URL })
        ._tag
    ).toBe("None");
    expect(
      decode({
        code: "<b>12</b>",
        locale: "en",
        unsubscribeUrl: UNSUBSCRIBE_URL,
      })._tag
    ).toBe("None");
  });
});
