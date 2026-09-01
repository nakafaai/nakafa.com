import { describe, expect, it } from "@effect/vitest";
import { NakafaAgentQuranReferenceOptionsSchema } from "@repo/contents/_lib/agent/schema/quran/input";
import { Schema } from "effect";

describe("NakafaAgentQuranReferenceOptionsSchema", () => {
  it("applies default Quran options", () => {
    expect(
      Schema.decodeSync(NakafaAgentQuranReferenceOptionsSchema)({ surah: 1 })
    ).toMatchObject({
      from_verse: 1,
      include_tafsir: false,
      locale: "en",
      surah: 1,
    });
  });
});
