import { getNakafaContentResourceUri } from "@repo/contents/_lib/agent/refs";
import {
  NakafaAgentExerciseResultSchema,
  NakafaAgentMarkdownSchema,
  NakafaAgentQuranReferenceSchema,
  NakafaAgentSearchResultSchema,
} from "@repo/contents/_lib/agent/schemas";
import { describe, expect, it, vi } from "vitest";
import * as z from "zod";

vi.mock("@/env", () => ({
  env: {
    MCP_ALLOWED_ORIGINS: "https://agent.example.com",
    REDIS_URL: "redis://localhost:6379",
  },
}));

const JsonRpcResponseSchema = z.object({
  error: z
    .object({
      message: z.string(),
    })
    .optional(),
  id: z.union([z.number(), z.string(), z.null()]).optional(),
  jsonrpc: z.literal("2.0"),
  result: z.record(z.string(), z.unknown()).optional(),
});

/** Posts one JSON-RPC request to the local MCP route. */
async function postMcp(method: string, params: Record<string, unknown> = {}) {
  const { POST } = await import("@/app/[transport]/route");
  const response = await POST(
    new Request("https://mcp.nakafa.com/mcp", {
      body: JSON.stringify({
        id: method,
        jsonrpc: "2.0",
        method,
        params,
      }),
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
      },
      method: "POST",
    })
  );

  return JsonRpcResponseSchema.parse(
    parseMcpResponseText(await response.text())
  );
}

/** Calls one MCP tool through JSON-RPC. */
function callTool(name: string, args: Record<string, unknown>) {
  return postMcp("tools/call", {
    arguments: args,
    name,
  });
}

/** Parses JSON responses and Streamable HTTP SSE response bodies. */
function parseMcpResponseText(text: string) {
  if (!text.startsWith("event:")) {
    return JSON.parse(text);
  }

  const dataLine = text.split("\n").find((line) => line.startsWith("data: "));

  if (!dataLine) {
    return {};
  }

  return JSON.parse(dataLine.slice("data: ".length));
}

describe("Nakafa MCP route", () => {
  it("initializes with the public server name and exposes only nakafa tools", async () => {
    const initialized = await postMcp("initialize", {
      capabilities: {},
      clientInfo: {
        name: "vitest",
        version: "1.0.0",
      },
      protocolVersion: "2025-06-18",
    });
    const listedTools = await postMcp("tools/list");
    const result = z
      .object({
        tools: z.array(
          z.object({
            annotations: z.object({
              destructiveHint: z.literal(false),
              idempotentHint: z.literal(true),
              readOnlyHint: z.literal(true),
            }),
            inputSchema: z.object({}).passthrough(),
            name: z.string(),
            outputSchema: z.object({}).passthrough(),
          })
        ),
      })
      .parse(listedTools.result);

    expect(initialized.result?.serverInfo).toStrictEqual({
      name: "nakafa-mcp-server",
      version: "0.2.0",
    });
    expect(result.tools.map((tool) => tool.name)).toStrictEqual([
      "nakafa_search_content",
      "nakafa_get_content",
      "nakafa_get_taxonomy",
      "nakafa_get_exercise",
      "nakafa_get_quran_reference",
    ]);
    expect(result.tools.every((tool) => tool.name.startsWith("nakafa_"))).toBe(
      true
    );
    const toolsByName = new Map(result.tools.map((tool) => [tool.name, tool]));

    expect(
      Object.keys(
        toolsByName.get("nakafa_get_content")?.inputSchema.properties ?? {}
      )
    ).toStrictEqual(["content_ref"]);
    expect(
      Object.keys(
        toolsByName.get("nakafa_get_exercise")?.inputSchema.properties ?? {}
      )
    ).toStrictEqual(["content_ref", "exercise_number"]);
    expect(
      Object.keys(
        toolsByName.get("nakafa_get_content")?.outputSchema.properties ?? {}
      )
    ).toContain("content_id");
  }, 15_000);

  it("uses search content IDs immediately with content, resource, and exercise retrieval", async () => {
    const searchResponse = await callTool("nakafa_search_content", {
      limit: 1,
      locale: "en",
      section: "exercises",
    });
    const search = NakafaAgentSearchResultSchema.parse(
      searchResponse.result?.structuredContent
    );
    const contentId = search.items[0].content_id;
    const contentResponse = await callTool("nakafa_get_content", {
      content_ref: contentId,
    });
    const exerciseResponse = await callTool("nakafa_get_exercise", {
      content_ref: contentId,
    });
    const resourceResponse = await postMcp("resources/read", {
      uri: getNakafaContentResourceUri(contentId),
    });
    const content = NakafaAgentMarkdownSchema.parse(
      contentResponse.result?.structuredContent
    );
    const exercise = NakafaAgentExerciseResultSchema.parse(
      exerciseResponse.result?.structuredContent
    );
    const resource = z
      .object({
        contents: z.array(
          z.object({
            text: z.string(),
          })
        ),
      })
      .parse(resourceResponse.result);

    expect(content.content_id).toBe(contentId);
    expect(content.text).toContain("### Question");
    expect(exercise.content_id).toBe(contentId);
    expect(resource.contents[0].text).toContain("### Answer & Explanation");
  });

  it("returns structured tool errors for missing content and exercise requests", async () => {
    const missingContent = await callTool("nakafa_get_content", {
      content_ref: "en/articles/missing",
    });
    const missingExercise = await callTool("nakafa_get_exercise", {
      content_ref: "en/quran/1",
    });
    const errorSchema = z.object({
      isError: z.literal(true),
      structuredContent: z.object({
        error: z.object({
          message: z.string(),
          suggestions: z.array(z.string()).min(1),
        }),
      }),
    });

    expect(
      errorSchema.parse(missingContent.result).structuredContent.error.message
    ).toContain("not found");
    expect(
      errorSchema.parse(missingExercise.result).structuredContent.error.message
    ).toContain("exercise");
  });

  it("rejects the removed legacy content reference argument", async () => {
    const legacyArgument = ["content", "id", "or", "url"].join("_");
    const legacyContent = await callTool("nakafa_get_content", {
      [legacyArgument]: "en/quran/1",
    });
    const legacyExercise = await callTool("nakafa_get_exercise", {
      [legacyArgument]:
        "en/exercises/high-school/snbt/general-reasoning/try-out/2026/set-1",
    });
    const mixedLegacyContent = await callTool("nakafa_get_content", {
      content_ref: "en/quran/1",
      [legacyArgument]: "en/quran/2",
    });

    expect(legacyContent.result?.isError).toBe(true);
    expect(legacyExercise.result?.isError).toBe(true);
    expect(mixedLegacyContent.result?.isError).toBe(true);
    expect(JSON.stringify(legacyContent.result)).toContain("Invalid arguments");
    expect(JSON.stringify(legacyExercise.result)).toContain(
      "Invalid arguments"
    );
    expect(JSON.stringify(mixedLegacyContent.result)).toContain(
      "Invalid arguments"
    );
  });

  it("returns taxonomy and bounded Quran references with actionable range errors", async () => {
    const taxonomyResponse = await callTool("nakafa_get_taxonomy", {
      locale: "en",
    });
    const quranResponse = await callTool("nakafa_get_quran_reference", {
      from_verse: 1,
      include_tafsir: true,
      locale: "en",
      surah: 1,
      to_verse: 2,
    });
    const reversedResponse = await callTool("nakafa_get_quran_reference", {
      from_verse: 3,
      locale: "en",
      surah: 1,
      to_verse: 2,
    });
    const largeResponse = await callTool("nakafa_get_quran_reference", {
      from_verse: 1,
      locale: "en",
      surah: 2,
      to_verse: 30,
    });
    const missingResponse = await callTool("nakafa_get_quran_reference", {
      from_verse: 999,
      locale: "en",
      surah: 1,
    });
    const taxonomy = z
      .object({
        tools: z.array(z.string()),
      })
      .passthrough()
      .parse(taxonomyResponse.result?.structuredContent);
    const quran = NakafaAgentQuranReferenceSchema.parse(
      quranResponse.result?.structuredContent
    );

    expect(taxonomy.tools).toContain("nakafa_get_quran_reference");
    expect(quran.verses).toHaveLength(2);
    expect(quran.verses[0].tafsir).toBeTruthy();
    expect(reversedResponse.result?.isError).toBe(true);
    expect(largeResponse.result?.isError).toBe(true);
    expect(missingResponse.result?.isError).toBe(true);
  });

  it("lists and reads resources plus reusable prompts", async () => {
    const resources = await postMcp("resources/list");
    const templates = await postMcp("resources/templates/list");
    const usage = await postMcp("resources/read", {
      uri: "nakafa://usage",
    });
    const taxonomy = await postMcp("resources/read", {
      uri: "nakafa://taxonomy",
    });
    const missingContent = await postMcp("resources/read", {
      uri: "nakafa://content/en%2Farticles%2Fmissing",
    });
    const prompts = await postMcp("prompts/list");
    const listedPrompts = z
      .object({
        prompts: z.array(z.object({ name: z.string() }).passthrough()),
      })
      .parse(prompts.result).prompts;
    const promptNames = listedPrompts.map((prompt) => prompt.name);

    for (const promptName of promptNames) {
      const prompt = await postMcp("prompts/get", {
        arguments: getPromptArguments(promptName),
        name: promptName,
      });

      expect(
        z
          .object({ messages: z.array(z.object({ role: z.literal("user") })) })
          .parse(prompt.result).messages
      ).toHaveLength(1);
    }

    const exercisePrompt = await postMcp("prompts/get", {
      arguments: {
        content_ref:
          "en/exercises/high-school/snbt/general-reasoning/try-out/2026/set-1",
      },
      name: "nakafa_explain_exercise",
    });
    const quranPrompt = await postMcp("prompts/get", {
      arguments: {
        from_verse: "1",
        locale: "en",
        surah: "1",
      },
      name: "nakafa_quran_reference",
    });

    expect(
      z
        .object({ resources: z.array(z.object({ uri: z.string() })) })
        .parse(resources.result).resources
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ uri: "nakafa://usage" }),
        expect.objectContaining({ uri: "nakafa://taxonomy" }),
      ])
    );
    expect(
      z
        .object({
          resourceTemplates: z.array(z.object({ uriTemplate: z.string() })),
        })
        .parse(templates.result).resourceTemplates[0].uriTemplate
    ).toBe("nakafa://content/{contentId}");
    expect(JSON.stringify(usage.result)).toContain("nakafa_search_content");
    expect(JSON.stringify(taxonomy.result)).toContain("nakafa_get_taxonomy");
    expect(missingContent.error?.message).toContain("not found");
    expect(JSON.stringify(listedPrompts)).toContain("content_ref");
    expect(JSON.stringify(exercisePrompt.result)).toContain(
      "use the question in the content ID"
    );
    expect(JSON.stringify(quranPrompt.result)).toContain(
      "Summarize the returned reference briefly."
    );
  });

  it("guards browser origins while allowing desktop clients without Origin", async () => {
    const { GET, OPTIONS, POST } = await import("@/app/[transport]/route");
    const noOrigin = await GET(new Request("https://mcp.nakafa.com/mcp"));
    const allowedOptions = await OPTIONS(
      new Request("https://mcp.nakafa.com/mcp", {
        headers: {
          origin: "https://agent.example.com",
        },
        method: "OPTIONS",
      })
    );
    const ownedAppOptions = await OPTIONS(
      new Request("https://mcp.nakafa.com/mcp", {
        headers: {
          origin: "https://api.nakafa.com",
        },
        method: "OPTIONS",
      })
    );
    const forbidden = await POST(
      new Request("https://mcp.nakafa.com/mcp", {
        body: "{}",
        headers: {
          origin: "https://evil.example.com",
        },
        method: "POST",
      })
    );
    const invalid = await POST(
      new Request("https://mcp.nakafa.com/mcp", {
        body: "{}",
        headers: {
          origin: "not a url",
        },
        method: "POST",
      })
    );

    expect(noOrigin.status).toBe(405);
    expect(allowedOptions.status).toBe(204);
    expect(allowedOptions.headers.get("access-control-allow-origin")).toBe(
      "https://agent.example.com"
    );
    expect(ownedAppOptions.status).toBe(204);
    expect(ownedAppOptions.headers.get("access-control-allow-origin")).toBe(
      "https://api.nakafa.com"
    );
    expect(forbidden.status).toBe(403);
    expect(invalid.status).toBe(403);
  });
});

/** Returns valid prompt arguments for one registered prompt. */
function getPromptArguments(promptName: string) {
  if (promptName === "nakafa_find_lesson") {
    return {
      locale: "en",
      query: "green chemistry",
    };
  }

  if (promptName === "nakafa_answer_from_content") {
    return {
      content_ref: "en/quran/1",
      question: "What is this Surah?",
    };
  }

  if (promptName === "nakafa_explain_exercise") {
    return {
      content_ref:
        "en/exercises/high-school/snbt/general-reasoning/try-out/2026/set-1",
      exercise_number: "1",
    };
  }

  return {
    from_verse: "1",
    locale: "en",
    question: "Reference this verse.",
    surah: "1",
    to_verse: "2",
  };
}
