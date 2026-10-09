// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { OPENAPI_RESPONSE_EXAMPLES } from "@repo/backend/agent/openapi/examples";
import { getNakafaTaxonomy } from "@repo/backend/agent/taxonomy";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import {
  MCP_SECRET,
  MCP_SECRET_ENVIRONMENT,
  modernPost,
  sendMcpRequest,
} from "@repo/backend/test/mcp/harness";
import { NakafaAgentTaxonomySchema } from "@repo/contents/agent/schema/taxonomy";
import { encodePrettyJsonText, JsonTextSchema } from "@repo/utilities/json";
import { Effect, Schema } from "effect";

vi.mock("@repo/backend/agent/taxonomy", () => ({ getNakafaTaxonomy: vi.fn() }));

const TAXONOMY_REQUEST = modernPost(
  50,
  "resources/read",
  { uri: "nakafa://taxonomy" },
  "nakafa://taxonomy"
);

beforeEach(() => {
  vi.stubEnv(MCP_SECRET_ENVIRONMENT, MCP_SECRET);
  vi.stubEnv("NAKAFA_MCP_ALLOWED_ORIGINS", undefined);
});
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

describe("Nakafa MCP resources", () => {
  it.effect("serves the taxonomy as indented JSON", () =>
    Effect.gen(function* () {
      const taxonomy = yield* Schema.decodeUnknownEffect(
        NakafaAgentTaxonomySchema
      )(OPENAPI_RESPONSE_EXAMPLES.Taxonomy);
      vi.mocked(getNakafaTaxonomy).mockReturnValue(Effect.succeed(taxonomy));
      const response = yield* Effect.promise(() =>
        sendMcpRequest(createConvexTestWithBetterAuth(), TAXONOMY_REQUEST)
      );
      const text = encodePrettyJsonText(taxonomy);

      expect(response.status).toBe(200);
      expect(yield* Effect.promise(() => response.json())).toMatchObject({
        result: {
          contents: [
            {
              mimeType: "application/json",
              text,
              uri: "nakafa://taxonomy",
            },
          ],
        },
      });
    })
  );

  it.effect(
    "answers an unexpected taxonomy failure with the generic message and no detail",
    () =>
      Effect.gen(function* () {
        vi.mocked(getNakafaTaxonomy).mockReturnValue(
          Effect.die(new Error("private storage failure"))
        );
        const response = yield* Effect.promise(() =>
          sendMcpRequest(createConvexTestWithBetterAuth(), TAXONOMY_REQUEST)
        );
        const answer = yield* Effect.promise(() => response.json());

        expect(response.status).toBe(200);
        expect(answer).toMatchObject({
          error: {
            code: -32_603,
            message: "Nakafa MCP could not complete this request.",
          },
        });
        expect(
          yield* Schema.encodeUnknownEffect(JsonTextSchema)(answer)
        ).not.toContain("private storage failure");
      })
  );
});
