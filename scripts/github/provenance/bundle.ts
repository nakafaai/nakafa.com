import { bundleFromJSON, bundleToJSON } from "@sigstore/bundle";
import { Context, Effect, Layer } from "effect";
import { type VerifyOptions, verify as verifySigstore } from "sigstore";
import {
  ProvenanceVerificationError,
  type PublisherIdentity,
} from "#scripts/github/provenance/schema";

const GITHUB_ISSUER = "https://token.actions.githubusercontent.com";
const GITHUB_REPOSITORY_PREFIX = "https://github.com/";

/** Cryptographically verifies one Sigstore bundle and returns its signed payload. */
export class ProvenanceBundleVerifier extends Context.Service<
  ProvenanceBundleVerifier,
  {
    readonly verify: (
      bundle: unknown,
      identity: PublisherIdentity
    ) => Effect.Effect<string, ProvenanceVerificationError>;
  }
>()("RepositoryProvenance/BundleVerifier") {}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function derUtf8(value: string) {
  return `${String.fromCharCode(12, Buffer.byteLength(value))}${value}`;
}

/** Pins a Sigstore certificate to one exact GitHub trusted-publisher identity. */
export function publisherPolicy(identity: PublisherIdentity): VerifyOptions {
  const repositorySlug = identity.repository.slice(
    GITHUB_REPOSITORY_PREFIX.length
  );
  const certificateIdentity = `${identity.repository}/${identity.workflow}@${identity.ref}`;

  return {
    certificateIdentityURI: `^${escapeRegex(certificateIdentity)}$`,
    certificateIssuer: GITHUB_ISSUER,
    certificateOIDs: {
      "1.3.6.1.4.1.57264.1.3": identity.sourceSha,
      "1.3.6.1.4.1.57264.1.5": repositorySlug,
      "1.3.6.1.4.1.57264.1.6": identity.ref,
      "1.3.6.1.4.1.57264.1.11": derUtf8("github-hosted"),
      "1.3.6.1.4.1.57264.1.23": derUtf8(identity.environment),
    },
  };
}

const normalizeBundle = Effect.fn("GithubProvenance.normalizeBundle")(
  function* (bundle: unknown) {
    return yield* Effect.try({
      try: () => bundleToJSON(bundleFromJSON(bundle)),
      catch: (cause) =>
        new ProvenanceVerificationError({
          cause,
          message: "The npm audit returned an invalid Sigstore bundle.",
        }),
    });
  }
);

const verifySigstoreBundle = Effect.fn("GithubProvenance.verifyBundle")(
  function* (bundle: unknown, identity: PublisherIdentity) {
    const serialized = yield* normalizeBundle(bundle);
    if (!("dsseEnvelope" in serialized && serialized.dsseEnvelope)) {
      return yield* new ProvenanceVerificationError({
        message: "The npm provenance bundle has no signed DSSE payload.",
      });
    }
    yield* Effect.tryPromise({
      try: () => verifySigstore(serialized, publisherPolicy(identity)),
      catch: (cause) =>
        new ProvenanceVerificationError({
          cause,
          message:
            "The npm provenance signer does not match the trusted publisher.",
        }),
    });
    return Buffer.from(serialized.dsseEnvelope.payload, "base64").toString(
      "utf8"
    );
  }
);

/** Live Sigstore implementation for the bundle-verification seam. */
export const SigstoreProvenanceBundleVerifierLive = Layer.succeed(
  ProvenanceBundleVerifier,
  { verify: verifySigstoreBundle }
);
