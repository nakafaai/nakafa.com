import { afterEach, describe, expect, it } from "@effect/vitest";
import { createAuthOptions } from "@repo/backend/confect/auth/runtime";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { generateSigningPublicKey } from "@repo/backend/test/auth";
import { encodeJsonText, JsonTextSchema } from "@repo/utilities/json";
import { Array as Arr, Schema } from "effect";

const NOW = Date.UTC(2026, 8, 4, 12, 0, 0);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("auth", () => {
  it("publishes only public key material from configured Better Auth signing keys", async () => {
    const publicKey = await generateSigningPublicKey();
    vi.stubEnv("CONVEX_SITE_URL", "https://technical-auth.convex.site");
    vi.stubEnv(
      "JWKS",
      encodeJsonText([
        {
          id: "technical-signing-key",
          alg: "RS256",
          publicKey: encodeJsonText(publicKey),
          privateKey: "private-material-must-not-be-published",
          createdAt: NOW,
        },
      ])
    );
    vi.resetModules();
    const { default: config } = await import("@repo/backend/confect/auth");
    const provider = config.providers[0];
    expect(provider).toMatchObject({
      applicationID: "convex",
      issuer: "https://technical-auth.convex.site",
      algorithm: "RS256",
    });
    const keys = Schema.decodeSync(JsonTextSchema)(
      atob(provider.jwks.slice(provider.jwks.indexOf(",") + 1))
    );
    expect(keys).toEqual({
      keys: [
        {
          ...publicKey,
          alg: "RS256",
          kid: "technical-signing-key",
        },
      ],
    });
    expect(encodeJsonText(keys)).not.toContain("private-material");
    const t = createConvexTestWithBetterAuth();
    const ids = await t.action(async (ctx) =>
      Arr.map(createAuthOptions(ctx).plugins, (plugin) => plugin.id)
    );
    expect(ids).toContain("convex");
  });
});
