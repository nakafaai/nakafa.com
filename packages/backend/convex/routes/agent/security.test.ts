// @vitest-environment node
import { Effect, Result } from "effect";
import { afterEach, describe, expect, it } from "vitest";
import {
  API_EDGE_SECRET_HEADER,
  hasTrustedMcpOrigin,
  hasValidEdgeSecret,
  readTrustedMcpOrigins,
} from "./security";

const API_SECRET_NAME = "NAKAFA_API_EDGE_SECRET";
const MCP_ORIGINS_NAME = "NAKAFA_MCP_ALLOWED_ORIGINS";

afterEach(() => {
  delete process.env[API_SECRET_NAME];
  delete process.env[MCP_ORIGINS_NAME];
});

function requestWithSecret(secret?: string) {
  const headers = new Headers();
  if (secret) {
    headers.set(API_EDGE_SECRET_HEADER, secret);
  }
  return new Request("https://api.nakafa.com/v1/health", { headers });
}

describe("agent edge security", () => {
  it("accepts current and previous keys during a two-key rotation", async () => {
    process.env[API_SECRET_NAME] = "new-secret,old-secret";

    await expect(
      Effect.runPromise(
        hasValidEdgeSecret(
          requestWithSecret("new-secret"),
          API_SECRET_NAME,
          API_EDGE_SECRET_HEADER
        )
      )
    ).resolves.toBe(true);
    await expect(
      Effect.runPromise(
        hasValidEdgeSecret(
          requestWithSecret("old-secret"),
          API_SECRET_NAME,
          API_EDGE_SECRET_HEADER
        )
      )
    ).resolves.toBe(true);
  });

  it("rejects missing and incorrect request keys", async () => {
    process.env[API_SECRET_NAME] = "current-secret";

    await expect(
      Effect.runPromise(
        hasValidEdgeSecret(
          requestWithSecret(),
          API_SECRET_NAME,
          API_EDGE_SECRET_HEADER
        )
      )
    ).resolves.toBe(false);
    await expect(
      Effect.runPromise(
        hasValidEdgeSecret(
          requestWithSecret("incorrect-secret"),
          API_SECRET_NAME,
          API_EDGE_SECRET_HEADER
        )
      )
    ).resolves.toBe(false);
  });

  it("fails closed for missing or malformed deployment keys", async () => {
    const missing = await Effect.runPromise(
      hasValidEdgeSecret(
        requestWithSecret("supplied"),
        API_SECRET_NAME,
        API_EDGE_SECRET_HEADER
      ).pipe(Effect.result)
    );
    process.env[API_SECRET_NAME] = "one,two,three";
    const tooMany = await Effect.runPromise(
      hasValidEdgeSecret(
        requestWithSecret("one"),
        API_SECRET_NAME,
        API_EDGE_SECRET_HEADER
      ).pipe(Effect.result)
    );
    process.env[API_SECRET_NAME] = "one,";
    const empty = await Effect.runPromise(
      hasValidEdgeSecret(
        requestWithSecret("one"),
        API_SECRET_NAME,
        API_EDGE_SECRET_HEADER
      ).pipe(Effect.result)
    );

    expect(Result.isFailure(missing)).toBe(true);
    expect(Result.isFailure(tooMany)).toBe(true);
    expect(Result.isFailure(empty)).toBe(true);
  });

  it("allows absent server Origins and exact configured HTTPS Origins", async () => {
    process.env[MCP_ORIGINS_NAME] =
      "https://agent.example.com, http://unsafe.example.com, invalid";
    const configured = await Effect.runPromise(readTrustedMcpOrigins());
    delete process.env[MCP_ORIGINS_NAME];
    const defaults = await Effect.runPromise(readTrustedMcpOrigins());

    expect(configured).toEqual(["https://agent.example.com"]);
    expect(defaults).toEqual(["https://nakafa.com", "https://www.nakafa.com"]);
    expect(
      hasTrustedMcpOrigin(new Request("https://mcp.nakafa.com/mcp"), configured)
    ).toBe(true);
    expect(
      hasTrustedMcpOrigin(
        new Request("https://mcp.nakafa.com/mcp", {
          headers: { Origin: "https://agent.example.com" },
        }),
        configured
      )
    ).toBe(true);
    expect(
      hasTrustedMcpOrigin(
        new Request("https://mcp.nakafa.com/mcp", {
          headers: { Origin: "https://evil.example.com" },
        }),
        configured
      )
    ).toBe(false);
  });
});
