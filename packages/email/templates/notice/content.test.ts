import { assert, describe, it } from "@effect/vitest";
import {
  getNoticeEmailCopy,
  NoticeEmailInputSchema,
} from "@repo/email/templates/notice/content";
import { Schema } from "effect";

describe("notice content", () => {
  it("says a class holds a new announcement in each language, naming no one", () => {
    assert.strictEqual(
      getNoticeEmailCopy("en").subject,
      "New announcement in your class"
    );
    assert.strictEqual(getNoticeEmailCopy("id").cta, "Buka kelas");
    assert.strictEqual(
      getNoticeEmailCopy("de").subject,
      "Neue Ankündigung in deiner Klasse"
    );
    assert.strictEqual(getNoticeEmailCopy("en").privacyPolicy, "Privacy Policy");
  });

  it("takes a class address and the legal links, and refuses another address", () => {
    const input = {
      classUrl: "https://harapan.nakafa.com/classes/fisika-x-1",
      locale: "id",
      privacyPolicyUrl: "https://nakafa.com/id/privacy-policy",
      termsOfServiceUrl: "https://nakafa.com/id/terms-of-service",
    };
    assert.isTrue(Schema.is(NoticeEmailInputSchema)(input));
    assert.isFalse(
      Schema.is(NoticeEmailInputSchema)({ ...input, classUrl: "javascript:x" })
    );
  });
});
