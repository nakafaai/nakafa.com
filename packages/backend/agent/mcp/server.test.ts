// @vitest-environment node

import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  CLIENT_CAPABILITIES_META_KEY,
  CLIENT_INFO_META_KEY,
  createMcpHandler,
  PROTOCOL_VERSION_META_KEY,
} from "@modelcontextprotocol/server";
import { getNakafaContent } from "@repo/backend/agent/content";
import { createNakafaMcpServer } from "@repo/backend/agent/mcp/server";
import { OPENAPI_RESPONSE_EXAMPLES } from "@repo/backend/agent/openapi/examples";
import { getNakafaTaxonomy } from "@repo/backend/agent/taxonomy";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { NAKAFA_MCP_PROTOCOL_VERSION } from "@repo/contents/agent/constants";
import { NakafaAgentMarkdownSchema } from "@repo/contents/agent/schema/read";
import { NakafaAgentTaxonomySchema } from "@repo/contents/agent/schema/taxonomy";
import { Effect, Schema } from "effect";

vi.mock("@repo/backend/agent/content", () => ({ getNakafaContent: vi.fn() }));
vi.mock("@repo/backend/agent/taxonomy", () => ({ getNakafaTaxonomy: vi.fn() }));
afterEach(() => vi.resetAllMocks());

function request(method: string, params: Readonly<Record<string, unknown>>) {
  return new Request("https://mcp.nakafa.com/", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-method": method,
      "mcp-name": String(params.uri ?? params.name),
      "mcp-protocol-version": NAKAFA_MCP_PROTOCOL_VERSION,
    },
    body: JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method,
      params: {
        ...params,
        _meta: {
          [CLIENT_CAPABILITIES_META_KEY]: {},
          [CLIENT_INFO_META_KEY]: { name: "nakafa-test", version: "1.0.0" },
          [PROTOCOL_VERSION_META_KEY]: NAKAFA_MCP_PROTOCOL_VERSION,
        },
      },
    }),
  });
}

function fetchProtocol(input: Request) {
  const test = createConvexTestWithBetterAuth();
  return Effect.promise(() =>
    test.action(async (ctx) => {
      const handler = createMcpHandler(
        () => createNakafaMcpServer(ctx, "protocol-test"),
        { legacy: "reject" }
      );
      const response = await handler.fetch(input);
      expect(response.status).toBe(200);
      return response.json();
    })
  );
}

describe("Nakafa MCP resource and prompt protocol", () => {
  it.effect(
    "preserves signed content Markdown and its requested resource URI",
    () =>
      Effect.gen(function* () {
        const content = yield* Schema.decodeUnknownEffect(
          NakafaAgentMarkdownSchema
        )(OPENAPI_RESPONSE_EXAMPLES.Content);
        vi.mocked(getNakafaContent).mockReturnValue(
          Effect.succeedSome(content)
        );
        const uri = `nakafa://content/${content.content_id}`;
        expect(
          yield* fetchProtocol(request("resources/read", { uri }))
        ).toMatchObject({
          result: {
            contents: [{ mimeType: "text/markdown", text: content.text, uri }],
          },
        });
        expect(getNakafaContent).toHaveBeenCalledWith(expect.anything(), uri);
      })
  );

  it.effect(
    "serves taxonomy as JSON instead of coercing the resource to prose",
    () =>
      Effect.gen(function* () {
        const taxonomy = yield* Schema.decodeUnknownEffect(
          NakafaAgentTaxonomySchema
        )(OPENAPI_RESPONSE_EXAMPLES.Taxonomy);
        vi.mocked(getNakafaTaxonomy).mockReturnValue(Effect.succeed(taxonomy));
        const uri = "nakafa://taxonomy";
        expect(
          yield* fetchProtocol(request("resources/read", { uri }))
        ).toMatchObject({
          result: {
            contents: [
              {
                mimeType: "application/json",
                text: JSON.stringify(taxonomy, null, 2),
                uri,
              },
            ],
          },
        });
      })
  );

  it.effect(
    "defaults an abbreviated Quran prompt without invented verse ranges",
    () =>
      Effect.gen(function* () {
        expect(
          yield* fetchProtocol(
            request("prompts/get", {
              name: "nakafa_quran_reference",
              arguments: { surah: "1" },
            })
          )
        ).toMatchObject({
          result: {
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text: "Retrieve Quran reference Surah 1, verses 1.\nLocale: en\nSummarize the returned reference briefly.\nUse `nakafa_get_quran_reference` and cite the canonical Nakafa URL.",
                },
              },
            ],
          },
        });
      })
  );
  it.effect("keeps usage guidance and default lesson discovery available", () =>
    Effect.gen(function* () {
      expect(
        yield* fetchProtocol(
          request("resources/read", { uri: "nakafa://usage" })
        )
      ).toMatchObject({
        result: {
          contents: [{ text: expect.stringContaining("# Nakafa MCP Usage") }],
        },
      });
      expect(
        yield* fetchProtocol(
          request("prompts/get", {
            name: "nakafa_find_lesson",
            arguments: { topic: "linear equations" },
          })
        )
      ).toMatchObject({
        result: {
          messages: [
            {
              content: {
                text: expect.stringContaining(
                  "Find Nakafa learning content for: linear equations\nPreferred locale: en"
                ),
              },
            },
          ],
        },
      });
    })
  );
});
