import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import * as z from "zod";
import { getNakafaQuranReferenceToolResult } from "@/lib/mcp/tools/quran";

const ToolErrorResultSchema = z.object({
  isError: z.literal(true),
  structuredContent: z.object({
    error: z.object({
      message: z.string(),
      suggestions: z.array(z.string()).min(1),
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
      ToolErrorResultSchema.parse(result).structuredContent.error
    ).toStrictEqual({
      message: "Invalid Nakafa Quran reference options.",
      suggestions: [expect.stringContaining("Surah number")],
    });
  });
});
