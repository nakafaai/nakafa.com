import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { getNakafaQuranReferenceToolResult } from "@/lib/mcp/tools/quran";

const ToolErrorResultSchema = Schema.Struct({
  isError: Schema.Literal(true),
  structuredContent: Schema.Struct({
    error: Schema.Struct({
      message: Schema.String,
      suggestions: Schema.NonEmptyArray(Schema.String),
    }),
  }),
});

describe("nakafa_get_quran_reference", () => {
  it("returns structured read-model input errors", async () => {
    const result = await Effect.runPromise(
      getNakafaQuranReferenceToolResult({
        from_verse: 1,
        include_tafsir: false,
        locale: "en",
        surah: 999,
      })
    );

    expect(
      Schema.decodeUnknownSync(ToolErrorResultSchema)(result).structuredContent
        .error
    ).toStrictEqual({
      message: "Invalid Nakafa Quran reference options.",
      suggestions: [expect.stringContaining("Surah number")],
    });
  });
});
