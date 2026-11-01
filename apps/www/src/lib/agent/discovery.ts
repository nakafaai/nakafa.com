import { SCHOOL_HOST_MCP_PATH } from "@repo/backend/confect/integrations/api";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Option } from "effect";
import { readRequestHostname, readSchoolSlug } from "@/lib/routing/school/host";

/** The path of a resource's metadata (RFC 9728), which a client reads before it has a token. */
const RESOURCE_METADATA_PATH = `/.well-known/oauth-protected-resource${SCHOOL_HOST_MCP_PATH}`;

/** The scope of every grant: the sign-in, and the refresh token that outlives a Convex token. */
const SCOPES = ["openid", "offline_access"];

/** The origin of a request as the browser sent it, so staging and a school host name themselves. */
function readOrigin(request: Request) {
  return new URL(request.url).origin;
}

/**
 * The origin where a person signs an agent in. A school host signs in on the main site, whose
 * cookie every school host shares (ADR 0026), and any other host signs in on itself.
 */
function readSignInOrigin(request: Request) {
  return Option.match(
    Option.flatMap(readRequestHostname(request.headers), readSchoolSlug),
    { onNone: () => readOrigin(request), onSome: () => SITE_ORIGIN }
  );
}

/** The authorization server's metadata (RFC 8414), over Better Auth's OAuth routes. */
export function readAuthorizationServer(request: Request) {
  const origin = readSignInOrigin(request);
  return {
    authorization_endpoint: `${origin}/api/auth/mcp/authorize`,
    code_challenge_methods_supported: ["S256"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    issuer: origin,
    registration_endpoint: `${origin}/api/auth/mcp/register`,
    response_types_supported: ["code"],
    scopes_supported: SCOPES,
    token_endpoint: `${origin}/api/auth/mcp/token`,
    token_endpoint_auth_methods_supported: ["none"],
  };
}

/** The MCP server's own metadata (RFC 9728), which names where its tokens come from. */
export function readProtectedResource(request: Request) {
  return {
    authorization_servers: [readSignInOrigin(request)],
    bearer_methods_supported: ["header"],
    resource: `${readOrigin(request)}${SCHOOL_HOST_MCP_PATH}`,
    scopes_supported: SCOPES,
  };
}

/** The challenge of a refused MCP request, which tells a client where to start signing in. */
export function readAgentChallenge(request: Request) {
  const metadata = `${readOrigin(request)}${RESOURCE_METADATA_PATH}`;
  return `Bearer realm="nakafa-school", resource_metadata="${metadata}"`;
}
