import { describe, expect, it } from "@effect/vitest";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import {
  countTextTokens,
  NINA_BUDGET,
} from "@repo/backend/confect/nina/budget";
import {
  formatQuran,
  formatRead,
  formatSearch,
  formatTaxonomy,
} from "@repo/backend/confect/nina/nakafa/format";
import { makeQuranFixture } from "@repo/backend/test/nina/quran";
import { readNakafaContentRefFixture } from "@repo/contents/agent/fixture";
import { NakafaAgentQuranReferenceSchema } from "@repo/contents/agent/schema/quran/reference";
import { Schema } from "effect";

const defaultLocale = ACTIVE_APP_LOCALE_CODES[0];

const MORE_SECTIONS = /- \d+ more sections$/;
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

  it("reads long content in budgeted sections and lists the rest", () => {
    const lesson = (heading: string) =>
      `## ${heading}\n\n${"Fungsi memetakan setiap anggota domain. ".repeat(400)}`;
    const content = {
      ...readNakafaContentRefFixture("id", subjectRoute, "material"),
      text: [
        "Pengantar singkat.",
        lesson("Definisi"),
        lesson("Contoh"),
        lesson("Contoh"),
      ].join("\n\n"),
      title: "Fungsi",
    };
    const first = formatRead(content);
    expect(countTextTokens(first)).toBeLessThanOrEqual(NINA_BUDGET.evidence);
    expect(first).toContain("Pengantar singkat.");
    expect(first).toContain("## Other Sections");
    expect(first).toContain("- Contoh (section: contoh)");
    expect(first).toContain("- Contoh (section: contoh-2)");

    const later = formatRead(content, { section: "contoh-2" });
    expect(later).toContain("## Contoh");
    expect(later).not.toContain("Pengantar singkat.");
    expect(later).toContain("- Start (section: top)");

    const missing = formatRead(content, { section: "latihan" });
    expect(missing).toContain("Section latihan was not found in this content.");
    expect(missing).toContain("- Definisi (section: definisi)");
  });

  it("caps the outline for content with many sections", () => {
    const text = Array.from(
      { length: 40 },
      (_, index) =>
        `### Verse ${index + 1}\n\n${"Ayat panjang dengan tafsir. ".repeat(120)}`
    ).join("\n\n");
    const read = formatRead({
      ...readNakafaContentRefFixture("id", subjectRoute, "material"),
      text,
      title: "Surah",
    });
    expect(countTextTokens(read)).toBeLessThanOrEqual(NINA_BUDGET.evidence);
    expect(read).toMatch(MORE_SECTIONS);
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
        recommended: "https://mcp.nakafa.com/mcp",
        root_note: "https://mcp.nakafa.com is informational only.",
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
