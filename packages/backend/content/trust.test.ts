import { SigningKeyIdSchema } from "@nakafa/aksara-contracts/ids";
import {
  ACTIVE_SIGNING_KEY_ID,
  TRUSTED_CONTENT_KEYS,
} from "@nakafa/aksara-contracts/signature/trusted";
import { contentKeyResolver } from "@repo/backend/content/trust";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

const unknownKeyId = SigningKeyIdSchema.make("unknown-key");
const agentKeyId = SigningKeyIdSchema.make("agent-test-key");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("content trust", () => {
  it("resolves the active reviewed code-owned key", async () => {
    const active = TRUSTED_CONTENT_KEYS.find(
      ({ keyId }) => keyId === ACTIVE_SIGNING_KEY_ID
    );

    await expect(
      Effect.runPromise(contentKeyResolver.resolve(ACTIVE_SIGNING_KEY_ID))
    ).resolves.toBe(active?.publicKeyPem);
  });

  it("rejects identities absent from the retained registry", async () => {
    const missing = await Effect.runPromise(
      contentKeyResolver.resolve(unknownKeyId).pipe(Effect.flip)
    );

    expect(missing._tag).toBe("SigningKeyNotFoundError");
  });

  it("adds one complete Agent Mode key without replacing retained keys", async () => {
    const productionKey = TRUSTED_CONTENT_KEYS.find(
      ({ keyId }) => keyId === ACTIVE_SIGNING_KEY_ID
    );
    expect(productionKey).toBeDefined();
    if (productionKey === undefined) {
      return;
    }
    vi.stubEnv("AKSARA_AGENT_SIGNING_KEY_ID", agentKeyId);
    vi.stubEnv("AKSARA_AGENT_SIGNING_PUBLIC_KEY", productionKey.publicKeyPem);
    vi.resetModules();

    const agentTrust = await import("@repo/backend/content/trust");

    expect(agentTrust.activeContentSigningKeyId).toBe(agentKeyId);
    await expect(
      Effect.runPromise(agentTrust.contentKeyResolver.resolve(agentKeyId))
    ).resolves.toBe(productionKey.publicKeyPem);
    await expect(
      Effect.runPromise(
        agentTrust.contentKeyResolver.resolve(ACTIVE_SIGNING_KEY_ID)
      )
    ).resolves.toBe(productionKey.publicKeyPem);
  });

  it("rejects a partial Agent Mode key pair", async () => {
    vi.stubEnv("AKSARA_AGENT_SIGNING_KEY_ID", agentKeyId);
    vi.stubEnv("AKSARA_AGENT_SIGNING_PUBLIC_KEY", undefined);
    vi.resetModules();

    await expect(import("@repo/backend/content/trust")).rejects.toThrow();
  });
});
