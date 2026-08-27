import { describe, expect, it } from "@effect/vitest";
import { Effect, Option, Schema } from "effect";
import { vi } from "vitest";
import { getNakafaContentToolResult } from "@/lib/mcp/tools/content";

const nakafaContentMock = vi.hoisted(() => ({
  read: vi.fn(),
}));

vi.mock("@/lib/mcp/nakafa", () => ({ nakafaContent: nakafaContentMock }));

nakafaContentMock.read.mockImplementation(() => Effect.succeed(Option.none()));

const ToolErrorResultSchema = Schema.Struct({
  isError: Schema.Literal(true),
  structuredContent: Schema.Struct({
    error: Schema.Struct({
      message: Schema.String,
      suggestions: Schema.NonEmptyArray(Schema.String),
    }),
  }),
});

describe("nakafa_get_content", () => {
  it.effect("returns structured not-found errors", () =>
    Effect.gen(function* () {
      const result = yield* getNakafaContentToolResult({
        content_ref: "https://nakafa.com/en/articles/politics/missing",
      });
      const error = yield* Schema.decodeUnknownEffect(ToolErrorResultSchema)(
        result
      );

      expect(error.structuredContent.error.message).toBe(
        "Nakafa content was not found."
      );
    })
  );
});
