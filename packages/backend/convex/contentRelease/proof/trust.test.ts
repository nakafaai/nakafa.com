import { SigningKeyIdSchema } from "@nakafa/aksara-contracts/ids";
import {
  ACTIVE_SIGNING_KEY_ID,
  TRUSTED_CONTENT_KEYS,
} from "@nakafa/aksara-contracts/signature/trusted";
import { trustedKeyResolver } from "@repo/backend/convex/contentRelease/proof/trust";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const unknownKeyId = SigningKeyIdSchema.make("unknown-key");

describe("contentRelease/proof/trust", () => {
  it("resolves the active reviewed code-owned key", async () => {
    const active = TRUSTED_CONTENT_KEYS.find(
      ({ keyId }) => keyId === ACTIVE_SIGNING_KEY_ID
    );

    await expect(
      Effect.runPromise(trustedKeyResolver.resolve(ACTIVE_SIGNING_KEY_ID))
    ).resolves.toBe(active?.publicKeyPem);
  });

  it("rejects identities absent from the reviewed retained registry", async () => {
    const missing = await Effect.runPromise(
      trustedKeyResolver.resolve(unknownKeyId).pipe(Effect.flip)
    );
    expect(missing._tag).toBe("SigningKeyNotFoundError");
  });
});
