import { assert, describe, it } from "@effect/vitest";
import { publisherPolicy } from "#scripts/github/provenance/bundle";
import type { PublisherIdentity } from "#scripts/github/provenance/schema";

const IDENTITY = {
  environment: "npm-production",
  ref: "refs/heads/main",
  repository: "https://github.com/nakafaai/nakafa.com",
  sourceSha: "0123456789abcdef0123456789abcdef01234567",
  workflow: ".github/workflows/cli-publish.yml",
} satisfies PublisherIdentity;

describe("Sigstore publisher identity", () => {
  it("pins every GitHub trusted-publisher certificate field", () => {
    assert.deepStrictEqual(publisherPolicy(IDENTITY), {
      certificateIdentityURI:
        "^https://github\\.com/nakafaai/nakafa\\.com/\\.github/workflows/cli-publish\\.yml@refs/heads/main$",
      certificateIssuer: "https://token.actions.githubusercontent.com",
      certificateOIDs: {
        "1.3.6.1.4.1.57264.1.3": IDENTITY.sourceSha,
        "1.3.6.1.4.1.57264.1.5": "nakafaai/nakafa.com",
        "1.3.6.1.4.1.57264.1.6": IDENTITY.ref,
        "1.3.6.1.4.1.57264.1.11": `${String.fromCharCode(12, 13)}github-hosted`,
        "1.3.6.1.4.1.57264.1.23": `${String.fromCharCode(12, 14)}npm-production`,
      },
    });
  });
});
