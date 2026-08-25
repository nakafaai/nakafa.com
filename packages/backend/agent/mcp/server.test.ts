// @vitest-environment node
import { createMcpHandler } from "@modelcontextprotocol/server";
import {
  NAKAFA_MCP_SERVER_NAME,
  NAKAFA_MCP_SERVER_VERSION,
} from "@repo/backend/agent/mcp/identity";
import { createNakafaMcpServer } from "@repo/backend/agent/mcp/server";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { NAKAFA_MCP_PROTOCOL_VERSION } from "@repo/contents/_lib/agent/constants";
import { describe, expect, it } from "@repo/testing/effect";

const MODERN_META = {
  "io.modelcontextprotocol/clientCapabilities": {},
  "io.modelcontextprotocol/clientInfo": {
    name: "nakafa-test-client",
    version: "1.0.0",
  },
  "io.modelcontextprotocol/protocolVersion": NAKAFA_MCP_PROTOCOL_VERSION,
};
const UNUSED_ACTION_CONTEXT = {} as ActionCtx;

/** Calls one registered server capability without the Convex HTTP guard. */
function postModern(
  id: number,
  method: string,
  params: Readonly<Record<string, unknown>> = {},
  name?: string
) {
  const headers = new Headers({
    accept: "application/json, text/event-stream",
    "content-type": "application/json",
    "mcp-method": method,
    "mcp-protocol-version": NAKAFA_MCP_PROTOCOL_VERSION,
  });
  if (name) {
    headers.set("mcp-name", name);
  }
  const handler = createMcpHandler(
    () => createNakafaMcpServer(UNUSED_ACTION_CONTEXT),
    { legacy: "reject" }
  );
  return handler.fetch(
    new Request("https://mcp.nakafa.com/mcp", {
      body: JSON.stringify({
        id,
        jsonrpc: "2.0",
        method,
        params: { ...params, _meta: MODERN_META },
      }),
      headers,
      method: "POST",
    })
  );
}

describe("Nakafa MCP server composition", () => {
  it("preserves the established server identity", async () => {
    const response = await postModern(0, "server/discover");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      result: {
        _meta: {
          "io.modelcontextprotocol/serverInfo": {
            name: NAKAFA_MCP_SERVER_NAME,
            version: NAKAFA_MCP_SERVER_VERSION,
          },
        },
      },
    });
  });

  it("preserves the established resources and prompts", async () => {
    const usageUri = "nakafa://usage";
    const [
      resources,
      templates,
      usage,
      prompts,
      findLesson,
      answerFromContent,
      quranReference,
    ] = await Promise.all([
      postModern(1, "resources/list"),
      postModern(2, "resources/templates/list"),
      postModern(3, "resources/read", { uri: usageUri }, usageUri),
      postModern(4, "prompts/list"),
      postModern(
        5,
        "prompts/get",
        {
          arguments: { topic: "linear equations" },
          name: "nakafa_find_lesson",
        },
        "nakafa_find_lesson"
      ),
      postModern(
        6,
        "prompts/get",
        {
          arguments: {
            content_ref: "nakafa://content/asset:en:catalog:article:example",
            question: "What should I learn?",
          },
          name: "nakafa_answer_from_content",
        },
        "nakafa_answer_from_content"
      ),
      postModern(
        7,
        "prompts/get",
        {
          arguments: { surah: "1" },
          name: "nakafa_quran_reference",
        },
        "nakafa_quran_reference"
      ),
    ]);
    const responses = [
      resources,
      templates,
      usage,
      prompts,
      findLesson,
      answerFromContent,
      quranReference,
    ];
    const [
      resourcesBody,
      templatesBody,
      usageBody,
      promptsBody,
      findLessonBody,
      answerFromContentBody,
      quranReferenceBody,
    ] = await Promise.all(responses.map((response) => response.json()));

    expect(responses.map(({ status }) => status)).toEqual([
      200, 200, 200, 200, 200, 200, 200,
    ]);
    expect(
      resourcesBody.result.resources.map(
        (resource: { readonly uri: string }) => resource.uri
      )
    ).toEqual(["nakafa://usage", "nakafa://taxonomy"]);
    expect(templatesBody.result.resourceTemplates).toEqual([
      expect.objectContaining({ uriTemplate: "nakafa://content/{contentId}" }),
    ]);
    expect(usageBody.result.contents).toEqual([
      expect.objectContaining({
        mimeType: "text/markdown",
        text: expect.stringContaining("# Nakafa MCP Usage"),
        uri: usageUri,
      }),
    ]);
    expect(
      promptsBody.result.prompts.map(
        (definition: { readonly name: string }) => definition.name
      )
    ).toEqual([
      "nakafa_find_lesson",
      "nakafa_answer_from_content",
      "nakafa_quran_reference",
    ]);
    for (const [body, expectedText] of [
      [findLessonBody, "linear equations"],
      [answerFromContentBody, "What should I learn?"],
      [quranReferenceBody, "Surah 1, verses 1"],
    ] as const) {
      expect(body.result.messages).toEqual([
        expect.objectContaining({
          content: expect.objectContaining({
            text: expect.stringContaining(expectedText),
            type: "text",
          }),
          role: "user",
        }),
      ]);
    }
  });

  it("returns Invalid Params for malformed prompt arguments", async () => {
    const response = await postModern(
      8,
      "prompts/get",
      {
        arguments: { topic: "   " },
        name: "nakafa_find_lesson",
      },
      "nakafa_find_lesson"
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: -32_602 },
      id: 8,
      jsonrpc: "2.0",
    });
  });
});
