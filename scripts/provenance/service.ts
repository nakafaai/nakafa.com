import { Context, type Effect } from "effect";
import type {
  ProvenanceVerificationError,
  PublisherIdentity,
} from "#scripts/provenance/schema";

/** Cryptographically verifies one Sigstore bundle and returns its signed payload. */
export class ProvenanceBundleVerifier extends Context.Service<
  ProvenanceBundleVerifier,
  {
    /** Verifies one untrusted bundle against the exact publisher identity. */
    readonly verify: (
      bundle: unknown,
      identity: PublisherIdentity
    ) => Effect.Effect<string, ProvenanceVerificationError>;
  }
>()("nakafa/scripts/provenance/service/ProvenanceBundleVerifier") {}
