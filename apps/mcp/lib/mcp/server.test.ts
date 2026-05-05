import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it } from "vitest";
import { registerNakafaMcpServer } from "@/lib/mcp/server";

describe("registerNakafaMcpServer", () => {
  it("passes SDK output validation for success and structured error results", async () => {
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

    registerNakafaMcpServer(server);
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const tools = await client.listTools();
    const search = await client.callTool({
      arguments: {
        limit: 1,
        locale: "en",
        section: "exercises",
      },
      name: "nakafa_search_content",
    });
    const missingContent = await client.callTool({
      arguments: {
        content_id_or_url: "en/articles/missing",
      },
      name: "nakafa_get_content",
    });

    await client.close();
    await server.close();

    expect(tools.tools.every((tool) => Boolean(tool.outputSchema))).toBe(true);
    expect(search.structuredContent).toMatchObject({
      count: 1,
      items: [
        expect.objectContaining({
          content_id: expect.any(String),
        }),
      ],
    });
    expect(missingContent).toMatchObject({
      isError: true,
      structuredContent: {
        error: {
          message: "Nakafa content was not found.",
          suggestions: expect.arrayContaining([
            expect.stringContaining("nakafa_search_content"),
          ]),
        },
      },
    });
  });
});
