import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it } from "vitest";
import { registerNakafaMcpServer } from "@/lib/mcp/server";

describe("registerNakafaMcpServer", () => {
  it("passes SDK output validation for success and structured failure results", async () => {
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
    const quranReference = await client.callTool({
      arguments: {
        from_verse: 1,
        include_tafsir: false,
        locale: "en",
        surah: 1,
        to_verse: 1,
      },
      name: "nakafa_get_quran_reference",
    });
    const missingContent = await client.callTool({
      arguments: {
        content_ref: "en/articles/missing",
      },
      name: "nakafa_get_content",
    });
    const legacyArgument = ["content", "id", "or", "url"].join("_");
    const legacyContent = await client.callTool({
      arguments: {
        [legacyArgument]: "en/articles/missing",
      },
      name: "nakafa_get_content",
    });

    await client.close();
    await server.close();

    expect(tools.tools.every((tool) => Boolean(tool.outputSchema))).toBe(true);
    expect(quranReference.structuredContent).toMatchObject({
      content_id: "en/quran/1",
      verses: [
        expect.objectContaining({
          number: 1,
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
    expect(legacyContent).toMatchObject({
      isError: true,
    });
    expect(JSON.stringify(legacyContent)).toContain("Invalid arguments");
  });
});
