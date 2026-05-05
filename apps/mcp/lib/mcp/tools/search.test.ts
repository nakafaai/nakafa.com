import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { NakafaAgentInputError } from "@repo/contents/_lib/agent/errors";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as z from "zod";

const ToolErrorResultSchema = z.object({
  isError: z.literal(true),
  structuredContent: z.object({
    error: z.object({
      message: z.string(),
      suggestions: z.array(z.string()).min(1),
    }),
  }),
});

afterEach(() => {
  vi.doUnmock("@repo/contents/_lib/agent/search");
  vi.resetModules();
});

describe("nakafa_search_content", () => {
  it("returns structured read-model input errors", async () => {
    vi.resetModules();
    vi.doMock("@repo/contents/_lib/agent/search", () => ({
      searchNakafaAgentContent: () =>
        Effect.fail(
          new NakafaAgentInputError({
            cause: "Use supported search filters.",
            message: "Search input failed.",
          })
        ),
    }));

    const { registerNakafaSearchContentTool } = await import(
      "@/lib/mcp/tools/search"
    );
    const client = new Client({
      name: "vitest",
      version: "1.0.0",
    });
    const server = new McpServer({
      name: "nakafa-mcp-test",
      version: "1.0.0",
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    registerNakafaSearchContentTool(server);
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const result = await client.callTool({
      arguments: {
        limit: 1,
        locale: "en",
      },
      name: "nakafa_search_content",
    });

    await client.close();
    await server.close();

    expect(
      ToolErrorResultSchema.parse(result).structuredContent.error
    ).toStrictEqual({
      message: "Search input failed.",
      suggestions: ["Use supported search filters."],
    });
  });
});
