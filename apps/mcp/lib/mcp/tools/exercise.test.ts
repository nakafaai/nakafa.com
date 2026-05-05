import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
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
  vi.doUnmock("@repo/contents/_lib/agent/exercises");
  vi.resetModules();
});

describe("nakafa_get_exercise", () => {
  it("returns structured read-model errors", async () => {
    vi.resetModules();
    vi.doMock("@repo/contents/_lib/agent/exercises", () => ({
      getNakafaAgentExercise: () =>
        Effect.fail(
          new NakafaAgentDataReadError({
            message: "Exercise read failed.",
          })
        ),
    }));

    const { registerNakafaGetExerciseTool } = await import(
      "@/lib/mcp/tools/exercise"
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

    registerNakafaGetExerciseTool(server);
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const result = await client.callTool({
      arguments: {
        content_ref:
          "en/exercises/high-school/snbt/general-reasoning/try-out/2026/set-1",
      },
      name: "nakafa_get_exercise",
    });

    await client.close();
    await server.close();

    expect(
      ToolErrorResultSchema.parse(result).structuredContent.error.message
    ).toBe("Exercise read failed.");
  });
});
