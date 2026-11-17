import { convexAuthProvider } from "@convex-dev/auth/server";
import { AGENT_TOKEN_AUDIENCE } from "@repo/backend/confect/auth/grant/audience";
import type { AuthConfig } from "convex/server";

/**
 * The deployment's own address, which Convex sets in every deployment. Without
 * it no token could be verified, so the configuration refuses to load, as
 * `convexAuthProvider` does.
 */
function readCloudUrl() {
  const cloudUrl = process.env.CONVEX_CLOUD_URL;
  if (cloudUrl === undefined) {
    throw new Error("CONVEX_CLOUD_URL is not set, so no token can be checked.");
  }
  return cloudUrl;
}

/** The deployment's address, read before any provider so a missing one fails with this reason. */
const cloudUrl = readCloudUrl();

/**
 * The tokens this deployment accepts. Both are ES256 tokens that the deployment
 * signs with its own key (`ctx.auth.signJwt`), so no key or secret is
 * configured: Convex Auth's session tokens, whose issuer is the auth component,
 * and the tokens of the agents a person lets in (ADR 0029), whose issuer is the
 * app itself.
 * https://docs.convex.dev/auth/convex-auth/getting-started
 */
export default {
  providers: [
    convexAuthProvider(),
    {
      type: "customJwt",
      applicationID: AGENT_TOKEN_AUDIENCE,
      issuer: cloudUrl,
      jwks: `${cloudUrl}/.well-known/jwks.json`,
      algorithm: "ES256",
    },
  ],
} satisfies AuthConfig;
