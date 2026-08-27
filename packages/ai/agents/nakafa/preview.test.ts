import { previewQuran, previewRead } from "@repo/ai/agents/nakafa/preview";
import { makeQuranFixture } from "@repo/ai/agents/nakafa/tools/fixture";
import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import { describe, expect, it } from "vitest";

describe("nakafa previews", () => {
  it("omits an unavailable content description", () => {
    const result = {
      ...readNakafaContentRefFixture(
        "id",
        "material/lesson/mathematics/example-topic/example-section",
        "material"
      ),
      text: "Isi materi lengkap.",
      title: "Contoh Materi",
    };

    expect(previewRead(result)).not.toHaveProperty("description");
  });

  it("keeps Quran preview stable when a malformed result has no verses", () => {
    const reference = makeQuranFixture({
      from_verse: 1,
      include_tafsir: false,
      locale: "en",
      surah: 1,
    });
    const result = {
      ...reference,
      verses: [],
    };

    expect(previewQuran(result)).toMatchObject({
      from_verse: 1,
      meaning: { locale: "en", text: "The Opening" },
      to_verse: 1,
      verse_count: 0,
    });
  });
});
