import { assert, describe, it } from "@effect/vitest";
import {
  DigestEmailInputSchema,
  getDigestEmailCopy,
} from "@repo/email/templates/digest/content";
import { Schema } from "effect";

describe("digest content", () => {
  it("makes the one thing a mail tells its subject", () => {
    const copy = getDigestEmailCopy({
      counts: [{ change: "exam.starting", count: 1 }],
      locale: "en",
    });
    assert.strictEqual(copy.subject, "Your exam starts soon.");
    assert.strictEqual(copy.body, "Your exam starts soon.");
    assert.strictEqual(copy.privacyPolicy, "Privacy Policy");
  });

  it("counts several notices of each kind in each language, naming no one", () => {
    const counts = [
      { change: "grade.released", count: 2 },
      { change: "forum.mentioned", count: 3 },
    ] as const;
    assert.strictEqual(
      getDigestEmailCopy({ counts, locale: "id" }).body,
      "Ada 2 nilai baru yang dirilis. Kamu disebut 3 kali di kelasmu."
    );
    assert.strictEqual(
      getDigestEmailCopy({ counts, locale: "de" }).subject,
      "Neues aus deiner Schule"
    );
    assert.strictEqual(
      getDigestEmailCopy({
        counts: [{ change: "assignment.published", count: 4 }],
        locale: "en",
      }).subject,
      "There are 4 new tasks in your classes."
    );
  });

  it("keeps its subject for a mail with nothing to tell, which the input refuses", () => {
    assert.strictEqual(
      getDigestEmailCopy({ counts: [], locale: "en" }).subject,
      "What is new at your school"
    );
    const input = {
      counts: [],
      inboxUrl: "https://harapan.nakafa.com/notifications",
      locale: "id",
      privacyPolicyUrl: "https://nakafa.com/id/privacy-policy",
      termsOfServiceUrl: "https://nakafa.com/id/terms-of-service",
    };
    assert.isFalse(Schema.is(DigestEmailInputSchema)(input));
    assert.isTrue(
      Schema.is(DigestEmailInputSchema)({
        ...input,
        counts: [{ change: "grade.released", count: 1 }],
      })
    );
  });

  it("names the comment as the reason of a mail of replies, and the school as any other's", () => {
    const replies = getDigestEmailCopy({
      counts: [{ change: "comment.replied", count: 2 }],
      locale: "en",
    });
    assert.strictEqual(
      replies.subject,
      "There are 2 replies to your comments."
    );
    assert.strictEqual(
      replies.footerReason,
      "We sent this email because you commented on Nakafa."
    );
    assert.strictEqual(
      getDigestEmailCopy({
        counts: [{ change: "grade.released", count: 1 }],
        locale: "en",
      }).footerReason,
      "We sent this email because you belong to a school on Nakafa."
    );
  });
});
