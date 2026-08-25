// @vitest-environment node
import {
  NAKAFA_API_EDGE_CONTRACT,
  NAKAFA_DEFAULT_MCP_BROWSER_ORIGINS,
  NAKAFA_MCP_ALLOWED_ORIGINS_ENVIRONMENT,
} from "@repo/backend/agent/edge";
import { Effect, Result } from "effect";
import { afterEach, describe, expect, it } from "vitest";
import {
  hasTrustedMcpOrigin,
  hasValidEdgeSecret,
  readTrustedMcpOrigins,
} from "./security";

afterEach(() => {
  delete process.env[NAKAFA_API_EDGE_CONTRACT.secretEnvironment];
  delete process.env[NAKAFA_MCP_ALLOWED_ORIGINS_ENVIRONMENT];
});

function requestWithSecret(secret?: string) {
  const headers = new Headers();
  if (secret) {
    headers.set(NAKAFA_API_EDGE_CONTRACT.secretHeader, secret);
  }
  return new Request("https://api.nakafa.com/v1/health", { headers });
}

describe("agent edge security", () => {
  it("accepts current and previous keys during a two-key rotation", async () => {
    process.env[NAKAFA_API_EDGE_CONTRACT.secretEnvironment] =
      "new-secret,old-secret";

    await expect(
      Effect.runPromise(
        hasValidEdgeSecret(
          requestWithSecret("new-secret"),
          NAKAFA_API_EDGE_CONTRACT
        )
      )
    ).resolves.toBe(true);
    await expect(
      Effect.runPromise(
        hasValidEdgeSecret(
          requestWithSecret("old-secret"),
          NAKAFA_API_EDGE_CONTRACT
        )
      )
    ).resolves.toBe(true);
  });

  it("rejects missing and incorrect request keys", async () => {
    process.env[NAKAFA_API_EDGE_CONTRACT.secretEnvironment] = "current-secret";

    await expect(
      Effect.runPromise(
        hasValidEdgeSecret(requestWithSecret(), NAKAFA_API_EDGE_CONTRACT)
      )
    ).resolves.toBe(false);
    await expect(
      Effect.runPromise(
        hasValidEdgeSecret(
          requestWithSecret("incorrect-secret"),
          NAKAFA_API_EDGE_CONTRACT
        )
      )
    ).resolves.toBe(false);
  });

  it("fails closed for missing or malformed deployment keys", async () => {
    const missing = await Effect.runPromise(
      hasValidEdgeSecret(
        requestWithSecret("supplied"),
        NAKAFA_API_EDGE_CONTRACT
      ).pipe(Effect.result)
    );
    process.env[NAKAFA_API_EDGE_CONTRACT.secretEnvironment] = "one,two,three";
    const tooMany = await Effect.runPromise(
      hasValidEdgeSecret(
        requestWithSecret("one"),
        NAKAFA_API_EDGE_CONTRACT
      ).pipe(Effect.result)
    );
    process.env[NAKAFA_API_EDGE_CONTRACT.secretEnvironment] = "one,";
    const empty = await Effect.runPromise(
      hasValidEdgeSecret(
        requestWithSecret("one"),
        NAKAFA_API_EDGE_CONTRACT
      ).pipe(Effect.result)
    );

    expect(Result.isFailure(missing)).toBe(true);
    expect(Result.isFailure(tooMany)).toBe(true);
    expect(Result.isFailure(empty)).toBe(true);
  });

  it("normalizes and deduplicates exact HTTPS and loopback HTTP origins", async () => {
    process.env[NAKAFA_MCP_ALLOWED_ORIGINS_ENVIRONMENT] =
      " HTTPS://Agent.Example.COM:443/ ,https://agent.example.com,http://LOCALHOST:3001/,http://localhost:3001";
    const configured = await Effect.runPromise(readTrustedMcpOrigins());
    delete process.env[NAKAFA_MCP_ALLOWED_ORIGINS_ENVIRONMENT];
    const defaults = await Effect.runPromise(readTrustedMcpOrigins());

    expect(configured).toEqual([
      "https://agent.example.com",
      "http://localhost:3001",
    ]);
    expect(defaults).toEqual(NAKAFA_DEFAULT_MCP_BROWSER_ORIGINS);
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
          headers: { Origin: "http://localhost:3001" },
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

  it.each([
    "https://agent.example.com,",
    "https://agent.example.com/path",
    "https://agent.example.com,invalid",
    "https://agent.example.com,http://unsafe.example.com",
    "",
  ])(
    "rejects the complete configured origin list when one row is invalid",
    async (source) => {
      process.env[NAKAFA_MCP_ALLOWED_ORIGINS_ENVIRONMENT] = source;

      const result = await Effect.runPromise(
        readTrustedMcpOrigins().pipe(Effect.result)
      );

      expect(Result.isFailure(result)).toBe(true);
    }
  );
});
