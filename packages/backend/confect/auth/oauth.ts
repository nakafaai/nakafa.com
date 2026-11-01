import { mcp } from "better-auth/plugins";
import { Duration } from "effect";

/** The page a person signs in on before they answer an agent. A bare path takes the visitor's locale. */
const LOGIN_PAGE = "/auth";

/** The page where a person answers whether an agent may act as them. */
const CONSENT_PAGE = "/agent";

/** How long an agent's grant lasts without a new sign-in. Each use of its refresh token renews it. */
const GRANT_LIFETIME = Duration.days(30);

/**
 * Better Auth's OAuth server for an agent that a person signs in (ADR 0029): dynamic client
 * registration, authorization code with PKCE, and refresh tokens, so an MCP client can start
 * it from the server's address alone. Every authorization passes the consent page
 * (`agentGrants`), and only the router swaps the token it issues for a Convex one.
 */
export const agentOAuth = () =>
  mcp({
    loginPage: LOGIN_PAGE,
    oidcConfig: {
      allowDynamicClientRegistration: true,
      consentPage: CONSENT_PAGE,
      loginPage: LOGIN_PAGE,
      refreshTokenExpiresIn: Duration.toSeconds(GRANT_LIFETIME),
      requirePKCE: true,
    },
  });
