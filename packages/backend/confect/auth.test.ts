import { afterEach, describe, expect, it } from "@effect/vitest";

const CLOUD_URL = "https://technical-auth.convex.cloud";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

/** Loads the auth configuration fresh, as Convex does when it pushes the deployment. */
async function loadConfig() {
  vi.resetModules();
  return await import("@repo/backend/confect/auth");
}

describe("auth configuration", () => {
  it("accepts Convex Auth's session tokens and the agent tokens the deployment signs", async () => {
    vi.stubEnv("CONVEX_CLOUD_URL", CLOUD_URL);
    const { AGENT_TOKEN_AUDIENCE, default: config } = await loadConfig();
    expect(config.providers).toEqual([
      {
        type: "customJwt",
        applicationID: "convex-auth",
        issuer: `${CLOUD_URL}/components/auth`,
        jwks: `${CLOUD_URL}/.well-known/jwks.json`,
        algorithm: "ES256",
      },
      {
        type: "customJwt",
        applicationID: AGENT_TOKEN_AUDIENCE,
        issuer: CLOUD_URL,
        jwks: `${CLOUD_URL}/.well-known/jwks.json`,
        algorithm: "ES256",
      },
    ]);
    // An agent's token never passes for a session token: their audiences differ.
    expect(AGENT_TOKEN_AUDIENCE).not.toBe("convex-auth");
  });

  it("refuses to load without the deployment's address, so no token goes unchecked", async () => {
    vi.stubEnv("CONVEX_CLOUD_URL", undefined);
    await expect(loadConfig()).rejects.toThrow("CONVEX_CLOUD_URL");
  });
});
