// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  ArtifactPayloadFieldByteLimitError,
  ArtifactRendererComponentMissingError,
  ArtifactVerificationByteLimitError,
} from "@nakafa/aksara-contracts/artifact/spec";
import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import {
  PublicKeyParseError,
  PublicKeyTypeError,
  SigningKeyNotFoundError,
  SigningKeyResolutionError,
} from "@nakafa/aksara-contracts/signature/spec";
import { contractFailure } from "@repo/backend/confect/contentRelease/proof/failure";
import { TEST_KEY_ID } from "@repo/backend/test/content/proof";

describe("contentRelease/proof/failure", () => {
  it("maps unsupported, size, and integrity contract failures", () => {
    const contentKey = ContentKeySchema.make("test:failure");
    const cases = [
      [
        SigningKeyNotFoundError.make({ keyId: TEST_KEY_ID }),
        "CONTENT_RELEASE_UNSUPPORTED",
      ],
      [
        SigningKeyResolutionError.make({ keyId: TEST_KEY_ID }),
        "CONTENT_RELEASE_UNSUPPORTED",
      ],
      [
        PublicKeyParseError.make({ keyId: TEST_KEY_ID, subject: "release" }),
        "CONTENT_RELEASE_UNSUPPORTED",
      ],
      [
        PublicKeyTypeError.make({ keyId: TEST_KEY_ID, subject: "artifact" }),
        "CONTENT_RELEASE_UNSUPPORTED",
      ],
      [
        ArtifactRendererComponentMissingError.make({
          componentName: "TechnicalComponent",
          contentKey,
        }),
        "CONTENT_RELEASE_UNSUPPORTED",
      ],
      [
        ArtifactVerificationByteLimitError.make({
          actualBytes: 2,
          maxBytes: 1,
        }),
        "CONTENT_RELEASE_SIZE",
      ],
      [
        ArtifactPayloadFieldByteLimitError.make({
          actualBytes: 2,
          contentKey,
          field: "compiledCode",
          maxBytes: 1,
        }),
        "CONTENT_RELEASE_SIZE",
      ],
      [{ _tag: "DigestMismatchError" }, "CONTENT_RELEASE_INTEGRITY"],
      [{ _tag: 1 }, "CONTENT_RELEASE_INTEGRITY"],
      [{}, "CONTENT_RELEASE_INTEGRITY"],
      [null, "CONTENT_RELEASE_INTEGRITY"],
      ["failure", "CONTENT_RELEASE_INTEGRITY"],
    ] as const;

    for (const [failure, code] of cases) {
      expect(contractFailure(failure)).toMatchObject({ code });
    }
  });
});
