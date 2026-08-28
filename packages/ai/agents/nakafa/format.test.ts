import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import {
  formatQuran,
  formatRead,
  formatSearch,
  formatTaxonomy,
} from "@repo/ai/agents/nakafa/format";
import { makeQuranFixture } from "@repo/ai/agents/nakafa/tools/fixture";
import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import { NakafaAgentQuranReferenceSchema } from "@repo/contents/_lib/agent/schema/quran/reference";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

const defaultLocale = ACTIVE_APP_LOCALE_CODES[0];

const subjectRoute =
  "material/lesson/mathematics/example-topic/example-section";

describe("Nakafa formatter", () => {
  it("formats search results", () => {
    const text = formatSearch({
      count: 1,
      has_more: false,
      items: [
        {
          ...readNakafaContentRefFixture("id", subjectRoute, "material"),
          description: "Pelajari contoh.",
          excerpt: "Pelajari contoh.",
          title: "Contoh Materi",
        },
      ],
      limit: 1,
      offset: 0,
    });

    expect(text).toContain("# Nakafa Search");
    expect(text).toContain("Contoh Materi");
    expect(text).not.toContain("Inline citation:");
    expect(text).not.toContain(`https://nakafa.com/id/${subjectRoute}`);
    expect(text).not.toContain("Markdown URL:");
    expect(text).toContain("Next offset: none");
  });

  it("formats full content reads", () => {
    const text = formatRead({
      ...readNakafaContentRefFixture("id", subjectRoute, "material"),
      description: "Pelajari contoh.",
      text: "Isi materi lengkap.",
      title: "Contoh Materi",
    });

    expect(text).toContain("# Nakafa Content");
    expect(text).not.toContain("Inline citation:");
    expect(text).not.toContain(`https://nakafa.com/id/${subjectRoute}`);
    expect(text).not.toContain("Markdown URL:");
    expect(text).toContain("Isi materi lengkap.");
  });

  it("omits an unavailable content description", () => {
    const text = formatRead({
      ...readNakafaContentRefFixture("id", subjectRoute, "material"),
      text: "Isi materi lengkap.",
      title: "Contoh Materi",
    });

    expect(text).toContain("- Title: Contoh Materi");
    expect(text).not.toContain("- Description:");
  });

  it("formats Quran references with and without tafsir", () => {
    const reference = makeQuranFixture({
      from_verse: 1,
      include_tafsir: true,
      locale: "id",
      surah: 1,
    });
    const text = formatQuran({
      ...reference,
      pre_bismillah: {
        arabic: "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ",
        translation: {
          notes: [
            {
              number: 9,
              referenceOffset: 37,
              text: "Catatan Bismillah.",
            },
          ],
          segments: [
            {
              kind: "text",
              offset: 0,
              value: "Dengan nama Allah Yang Maha Pengasih.",
            },
            { kind: "note", number: 9, offset: 37 },
          ],
        },
      },
      verses: [
        {
          ...reference.verses[0],
          number: 1,
          tafsir: "Tafsir ayat pertama.",
          translation: {
            notes: [
              { number: 4, referenceOffset: 18, text: "Catatan sumber." },
            ],
            segments: [
              { kind: "text", offset: 0, value: "Dengan nama Allah" },
              { kind: "note", number: 4, offset: 18 },
            ],
          },
        },
      ],
    });

    expect(text).toContain("# Nakafa Quran Reference");
    expect(text).not.toContain("Inline citation:");
    expect(text).not.toContain("https://nakafa.com/id/quran/1");
    expect(text).toContain("Meaning: Pembuka");
    expect(text).toContain("quranenc-indonesian");
    expect(text).toContain("quranenc-tafsir");
    expect(text).toContain("Kind: embedded");
    expect(text).toContain("## Bismillah");
    expect(text).toContain("بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ");
    expect(text).toContain("Dengan nama Allah Yang Maha Pengasih.");
    expect(text).toContain("Translation note 9: Catatan Bismillah.");
    expect(text.indexOf("## Bismillah")).toBeLessThan(
      text.indexOf("## Verse 1")
    );
    expect(text).toContain("Tafsir ayat pertama.");
    expect(text).toContain("Translation note 4: Catatan sumber.");
    expect(text).toContain("Dengan nama Allah[translation note 4]");
    expect(text).not.toContain("Dengan nama Allah[4]");
    expect(formatQuran(reference)).not.toContain("## Bismillah");

    const fallbackReference = Schema.decodeSync(
      NakafaAgentQuranReferenceSchema
    )({
      ...reference,
      meaning: { locale: "en", text: "The Opening" },
    });
    expect(formatQuran(fallbackReference)).toContain(
      "Meaning: The Opening (en)"
    );

    const englishReference = Schema.decodeSync(NakafaAgentQuranReferenceSchema)(
      makeQuranFixture({
        from_verse: 1,
        include_tafsir: true,
        locale: "en",
        surah: 1,
      })
    );
    expect(formatQuran(englishReference)).toContain("Kind: external");
  });

  it("formats taxonomy", () => {
    const text = formatTaxonomy({
      articles: {
        categories: ["science"],
      },
      content_counts: [{ count: 12, locale: "id" }],
      default_locale: defaultLocale,
      endpoints: {
        direct: "https://mcp.nakafa.com/mcp",
        recommended: "https://nakafa.com/mcp",
        root_note: "Use /mcp for MCP transport.",
      },
      locale: "id",
      locales: Array.from(ACTIVE_APP_LOCALE_CODES),
      quran: {
        surah_count: 114,
      },
      sections: ["articles", "material", "quran"],
      tryout: {
        countries: [{ id: "indonesia", label: "Indonesia" }],
        exams: [{ id: "snbt", label: "SNBT" }],
      },
      tools: ["nakafa_search_content"],
    });

    expect(text).toContain("# Nakafa Taxonomy");
    expect(text).toContain("indonesia (Indonesia)");
    expect(text).toContain("snbt (SNBT)");
    expect(text).toContain("science");
  });
});
