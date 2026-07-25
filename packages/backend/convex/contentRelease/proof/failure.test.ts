// @vitest-environment node

import {
  ArtifactPayloadFieldByteLimitError,
  ArtifactRendererComponentMissingError,
  ArtifactRendererVersionUnsupportedError,
  ArtifactVerificationByteLimitError,
  RendererContractVersionMismatchError,
} from "@nakafa/aksara-contracts/artifact/spec";
import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import {
  PublicKeyParseError,
  PublicKeyTypeError,
  SigningKeyNotFoundError,
  SigningKeyResolutionError,
} from "@nakafa/aksara-contracts/signature/spec";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import { TEST_KEY_ID } from "@repo/backend/test/content-proof";
import { describe, expect, it } from "vitest";

describe("contentRelease/proof/failure", () => {
  it("maps unsupported, size, and integrity contract failures", () => {
    const contentKey = ContentKeySchema.make("test:failure");
    const cases = [
      [
        new SigningKeyNotFoundError({ keyId: TEST_KEY_ID }),
        "CONTENT_RELEASE_UNSUPPORTED",
      ],
      [
        new SigningKeyResolutionError({ keyId: TEST_KEY_ID }),
        "CONTENT_RELEASE_UNSUPPORTED",
      ],
      [
        new PublicKeyParseError({ keyId: TEST_KEY_ID, subject: "release" }),
        "CONTENT_RELEASE_UNSUPPORTED",
      ],
      [
        new PublicKeyTypeError({ keyId: TEST_KEY_ID, subject: "artifact" }),
        "CONTENT_RELEASE_UNSUPPORTED",
      ],
      [
        new RendererContractVersionMismatchError({
          actualVersion: "2.0.0",
          expectedVersion: "1.0.0",
        }),
        "CONTENT_RELEASE_UNSUPPORTED",
      ],
      [
        new ArtifactRendererComponentMissingError({
          componentName: "TechnicalComponent",
          contentKey,
        }),
        "CONTENT_RELEASE_UNSUPPORTED",
      ],
      [
        new ArtifactRendererVersionUnsupportedError({
          componentName: "TechnicalComponent",
          contentKey,
          requiredVersion: 2,
        }),
        "CONTENT_RELEASE_UNSUPPORTED",
      ],
      [
        new ArtifactVerificationByteLimitError({
          actualBytes: 2,
          maxBytes: 1,
        }),
        "CONTENT_RELEASE_SIZE",
      ],
      [
        new ArtifactPayloadFieldByteLimitError({
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
