import { describe, expect, it } from "@effect/vitest";
import {
  readAgentChallenge,
  readAuthorizationServer,
  readProtectedResource,
} from "@/lib/agent/discovery";

const SCHOOL = "https://harapan.nakafa.com";
const STAGING = "https://staging.nakafa.com";

/** A request to a host, as the Worker receives it. */
const requestTo = (origin: string, path: string) =>
  new Request(`${origin}${path}`, {
    headers: { host: new URL(origin).host },
  });

describe("agent discovery", () => {
  it("sends a school host's agent to the main site, whose cookie it shares", () => {
    const request = requestTo(SCHOOL, "/mcp");

    expect(readProtectedResource(request)).toMatchObject({
      authorization_servers: ["https://nakafa.com"],
      resource: `${SCHOOL}/mcp`,
    });
    expect(readAuthorizationServer(request)).toMatchObject({
      issuer: "https://nakafa.com",
      token_endpoint: "https://nakafa.com/api/auth/mcp/token",
    });
  });

  it("signs an agent in on the host itself anywhere else", () => {
    const request = requestTo(
      STAGING,
      "/.well-known/oauth-authorization-server"
    );

    expect(readAuthorizationServer(request)).toMatchObject({
      authorization_endpoint: `${STAGING}/api/auth/mcp/authorize`,
      code_challenge_methods_supported: ["S256"],
      issuer: STAGING,
      registration_endpoint: `${STAGING}/api/auth/mcp/register`,
    });
  });

  it("names the resource's metadata in the challenge of a refused request", () => {
    expect(readAgentChallenge(requestTo(SCHOOL, "/mcp"))).toBe(
      `Bearer realm="nakafa-school", resource_metadata="${SCHOOL}/.well-known/oauth-protected-resource/mcp"`
    );
  });
});
