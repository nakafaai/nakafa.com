import { afterEach, describe, expect, it } from "@effect/vitest";
import { SigningKeyIdSchema } from "@nakafa/aksara-contracts/ids";
import {
  ACTIVE_SIGNING_KEY_ID,
  TRUSTED_CONTENT_KEYS,
} from "@nakafa/aksara-contracts/signature/trusted";
import { contentKeyResolver } from "@repo/backend/content/trust";
import { Effect } from "effect";
import { vi } from "vitest";

const unknownKeyId = SigningKeyIdSchema.make("unknown-key");
const agentKeyId = SigningKeyIdSchema.make("agent-test-key");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("content trust", () => {
  it.effect("resolves the active reviewed code-owned key", () =>
    Effect.gen(function* () {
      const active = TRUSTED_CONTENT_KEYS.find(
        ({ keyId }) => keyId === ACTIVE_SIGNING_KEY_ID
      );

      expect(yield* contentKeyResolver.resolve(ACTIVE_SIGNING_KEY_ID)).toBe(
        active?.publicKeyPem
      );
    })
  );

  it.effect("rejects identities absent from the retained registry", () =>
    Effect.gen(function* () {
      const missing = yield* contentKeyResolver
        .resolve(unknownKeyId)
        .pipe(Effect.flip);

      expect(missing._tag).toBe("SigningKeyNotFoundError");
    })
  );

  it.effect(
    "adds one complete Agent Mode key without replacing retained keys",
    () =>
      Effect.gen(function* () {
        const productionKey = TRUSTED_CONTENT_KEYS.find(
          ({ keyId }) => keyId === ACTIVE_SIGNING_KEY_ID
        );
        expect(productionKey).toBeDefined();
        if (productionKey === undefined) {
          return;
        }
        vi.stubEnv("AKSARA_AGENT_SIGNING_KEY_ID", agentKeyId);
        vi.stubEnv(
          "AKSARA_AGENT_SIGNING_PUBLIC_KEY",
          productionKey.publicKeyPem
        );
        vi.resetModules();

        const agentTrust = yield* Effect.promise(
          () => import("@repo/backend/content/trust")
        );

        expect(agentTrust.activeContentSigningKeyId).toBe(agentKeyId);
        expect(yield* agentTrust.contentKeyResolver.resolve(agentKeyId)).toBe(
          productionKey.publicKeyPem
        );
        expect(
          yield* agentTrust.contentKeyResolver.resolve(ACTIVE_SIGNING_KEY_ID)
        ).toBe(productionKey.publicKeyPem);
      })
  );

  it.effect("rejects a partial Agent Mode key pair", () => {
    vi.stubEnv("AKSARA_AGENT_SIGNING_KEY_ID", agentKeyId);
    vi.stubEnv("AKSARA_AGENT_SIGNING_PUBLIC_KEY", undefined);
    vi.resetModules();

    return Effect.promise(() =>
      expect(import("@repo/backend/content/trust")).rejects.toThrow()
    );
  });
});
