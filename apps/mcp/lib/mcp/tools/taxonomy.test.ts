import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import {
  NakafaAgentLegacyTaxonomySchema,
  type NakafaAgentTaxonomy,
} from "@repo/contents/_lib/agent/schema/taxonomy";
import { beforeEach, describe, expect, it } from "@repo/testing/effect";
import { Effect, Schema } from "effect";
import { vi } from "vitest";
import { getNakafaTaxonomyToolResult } from "@/lib/mcp/tools/taxonomy";

const taxonomyMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/mcp/nakafa", async () => {
  const { Nakafa } = await import("@repo/ai/agents/nakafa/service");
  const { Effect: EffectModule, Option } = await import("effect");

  return {
    nakafaContent: Nakafa.of({
      quran: () => EffectModule.succeed(Option.none()),
      read: () => EffectModule.succeed(Option.none()),
      taxonomy: taxonomyMock,
      verify: () => EffectModule.succeed(false),
    }),
  };
});

const taxonomy: NakafaAgentTaxonomy = {
  articles: { categories: ["mathematics"] },
  content_counts: [{ count: 1, locale: "en" }],
  default_locale: "en",
  endpoints: { mcp: "https://mcp.nakafa.com/mcp" },
  locale: "en",
  locales: ["en"],
  quran: { surah_count: 114 },
  sections: ["material"],
  tools: ["nakafa_get_taxonomy"],
  tryout: { countries: [], exams: [] },
};

const ToolErrorSchema = Schema.Struct({
  isError: Schema.Literal(true),
  structuredContent: Schema.Struct({
    error: Schema.Struct({
      message: Schema.String,
      suggestions: Schema.NonEmptyArray(Schema.String),
    }),
  }),
});

beforeEach(() => {
  taxonomyMock.mockReset();
  taxonomyMock.mockReturnValue(Effect.succeed(taxonomy));
});

describe("nakafa_get_taxonomy", () => {
  it.live("projects modern endpoint guidance into the SDK 1.30 contract", () =>
    Effect.gen(function* () {
      const result = yield* getNakafaTaxonomyToolResult({ locale: "en" });
      const structuredContent = yield* Schema.decodeUnknownEffect(
        NakafaAgentLegacyTaxonomySchema
      )(result.structuredContent);

      expect(structuredContent.endpoints).toStrictEqual({
        direct: "https://mcp.nakafa.com/mcp",
        recommended: "https://nakafa.com/mcp",
        root_note: "https://mcp.nakafa.com is informational only.",
      });
    })
  );

  it.live("returns structured input errors", () =>
    Effect.gen(function* () {
      const result = yield* getNakafaTaxonomyToolResult({ locale: "fr" });
      const error = yield* Schema.decodeUnknownEffect(ToolErrorSchema)(result);

      expect(taxonomyMock).not.toHaveBeenCalled();
      expect(error.structuredContent.error.message).toBe(
        "Invalid Nakafa taxonomy options."
      );
    })
  );

  it.live("returns structured publication errors", () =>
    Effect.gen(function* () {
      taxonomyMock.mockReturnValueOnce(
        Effect.fail(
          new NakafaAgentDataReadError({
            cause: "Signed taxonomy unavailable.",
            message: "Unable to read Nakafa taxonomy.",
          })
        )
      );

      const result = yield* getNakafaTaxonomyToolResult({ locale: "en" });
      const error = yield* Schema.decodeUnknownEffect(ToolErrorSchema)(result);

      expect(error.structuredContent.error).toStrictEqual({
        message: "Unable to read Nakafa taxonomy.",
        suggestions: ["Signed taxonomy unavailable."],
      });
    })
  );
});
