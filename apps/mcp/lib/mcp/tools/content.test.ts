import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  NakafaAgentDataReadError,
  NakafaAgentInputError,
} from "@repo/contents/_lib/agent/errors";
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
  vi.doUnmock("@repo/contents/_lib/agent/markdown");
  vi.resetModules();
});

describe("nakafa_get_content", () => {
  it("returns structured read-model errors", async () => {
    vi.resetModules();
    vi.doMock("@repo/contents/_lib/agent/markdown", () => ({
      getNakafaAgentMarkdown: () =>
        Effect.fail(
          new NakafaAgentDataReadError({
            message: "Markdown read failed.",
          })
        ),
    }));

    const { registerNakafaGetContentTool } = await import(
      "@/lib/mcp/tools/content"
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

    registerNakafaGetContentTool(server);
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const result = await client.callTool({
      arguments: {
        content_ref: "en/quran/1",
      },
      name: "nakafa_get_content",
    });

    await client.close();
    await server.close();

    expect(
      ToolErrorResultSchema.parse(result).structuredContent.error.message
    ).toBe("Markdown read failed.");
  });

  it("returns structured read-model input errors", async () => {
    vi.resetModules();
    vi.doMock("@repo/contents/_lib/agent/markdown", () => ({
      getNakafaAgentMarkdown: () =>
        Effect.fail(
          new NakafaAgentInputError({
            cause: "Use a Nakafa content ID or URL.",
            message: "Content input failed.",
          })
        ),
    }));

    const { registerNakafaGetContentTool } = await import(
      "@/lib/mcp/tools/content"
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

    registerNakafaGetContentTool(server);
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const result = await client.callTool({
      arguments: {
        content_ref: "en/quran/1",
      },
      name: "nakafa_get_content",
    });

    await client.close();
    await server.close();

    expect(
      ToolErrorResultSchema.parse(result).structuredContent.error
    ).toStrictEqual({
      message: "Content input failed.",
      suggestions: ["Use a Nakafa content ID or URL."],
    });
  });
});
