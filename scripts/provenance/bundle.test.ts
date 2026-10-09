import { afterEach, assert, describe, it } from "@effect/vitest";
import { bundleFromJSON, bundleToJSON } from "@sigstore/bundle";
import { Array as Arr, Effect } from "effect";
import {
  publisherPolicy,
  SigstoreProvenanceBundleVerifierLive,
} from "#scripts/provenance/bundle";
import type { PublisherIdentity } from "#scripts/provenance/schema";
import { ProvenanceBundleVerifier } from "#scripts/provenance/service";

const sigstore = vi.hoisted(() => ({
  verify: vi.fn<(bundle: unknown, options: unknown) => Promise<unknown>>(),
}));
vi.mock("sigstore", () => ({ verify: sigstore.verify }));

const IDENTITY = {
  environment: "npm-production",
  ref: "refs/heads/main",
  repository: "https://github.com/nakafaai/nakafa.com",
  sourceSha: "0123456789abcdef0123456789abcdef01234567",
  workflow: ".github/workflows/cli-publish.yml",
} satisfies PublisherIdentity;

const PAYLOAD = '{"_type":"https://in-toto.io/Statement/v1"}';
const VERIFICATION_MATERIAL = {
  certificate: { rawBytes: Buffer.from("certificate").toString("base64") },
  tlogEntries: [],
};
const DSSE_BUNDLE = {
  dsseEnvelope: {
    payload: Buffer.from(PAYLOAD).toString("base64"),
    payloadType: "application/vnd.in-toto+json",
    signatures: [
      { keyid: "", sig: Buffer.from("signature").toString("base64") },
    ],
  },
  mediaType: "application/vnd.dev.sigstore.bundle.v0.3+json",
  verificationMaterial: VERIFICATION_MATERIAL,
};

/** Verifies one bundle through the live Sigstore adapter. */
const verifyBundle = Effect.fn("ProvenanceBundleTest.verifyBundle")(function* (
  bundle: unknown
) {
  const verifier = yield* ProvenanceBundleVerifier;
  return yield* verifier.verify(bundle, IDENTITY);
}, Effect.provide(SigstoreProvenanceBundleVerifierLive));

afterEach(() => {
  sigstore.verify.mockReset();
});

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

describe("live Sigstore bundle verification", () => {
  it.effect("returns the signed payload after pinning the publisher", () =>
    Effect.gen(function* () {
      sigstore.verify.mockResolvedValueOnce({});

      assert.strictEqual(yield* verifyBundle(DSSE_BUNDLE), PAYLOAD);
      assert.deepStrictEqual(sigstore.verify.mock.calls, [
        [bundleToJSON(bundleFromJSON(DSSE_BUNDLE)), publisherPolicy(IDENTITY)],
      ]);
    })
  );

  it.effect("rejects a signer outside the trusted publisher", () =>
    Effect.gen(function* () {
      const cause = new Error("certificate identity mismatch");
      sigstore.verify.mockRejectedValueOnce(cause);

      const failure = yield* verifyBundle(DSSE_BUNDLE).pipe(Effect.flip);
      assert.strictEqual(failure._tag, "ProvenanceVerificationError");
      assert.strictEqual(failure.cause, cause);
      assert.strictEqual(
        failure.message,
        "The npm provenance signer does not match the trusted publisher."
      );
    })
  );

  it.effect("rejects bundles without a signed DSSE payload", () =>
    Effect.gen(function* () {
      const invalid = yield* verifyBundle({}).pipe(Effect.flip);
      const unsigned = yield* verifyBundle({
        mediaType: DSSE_BUNDLE.mediaType,
        messageSignature: {
          messageDigest: {
            algorithm: "SHA2_256",
            digest: Buffer.from("digest").toString("base64"),
          },
          signature: Buffer.from("signature").toString("base64"),
        },
        verificationMaterial: VERIFICATION_MATERIAL,
      }).pipe(Effect.flip);

      assert.deepStrictEqual(
        Arr.map([invalid, unsigned], (failure) => [
          failure._tag,
          failure.message,
        ]),
        [
          [
            "ProvenanceVerificationError",
            "The npm audit returned an invalid Sigstore bundle.",
          ],
          [
            "ProvenanceVerificationError",
            "The npm provenance bundle has no signed DSSE payload.",
          ],
        ]
      );
      assert.strictEqual(sigstore.verify.mock.calls.length, 0);
    })
  );
});
