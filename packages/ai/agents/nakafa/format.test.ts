import {
  formatQuran,
  formatRead,
  formatSearch,
  formatTaxonomy,
} from "@repo/ai/agents/nakafa/format";
import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import { defaultLocale, locales } from "@repo/utilities/locales";
import { describe, expect, it } from "vitest";

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

  it("formats Quran references with and without tafsir", () => {
    const text = formatQuran({
      ...readNakafaContentRefFixture("id", "quran/1", "quran"),
      name: "Al-Fatihah",
      revelation: "Makkiyah",
      translation: "Pembukaan",
      verses: [
        {
          arabic: "بِسْمِ اللَّهِ",
          number: 1,
          tafsir: "Tafsir ayat pertama.",
          transliteration: "Bismillah",
          translation: "Dengan nama Allah",
        },
        {
          arabic: "الْحَمْدُ لِلَّهِ",
          number: 2,
          transliteration: "Alhamdulillah",
          translation: "Segala puji bagi Allah",
        },
      ],
    });

    expect(text).toContain("# Nakafa Quran Reference");
    expect(text).not.toContain("Inline citation:");
    expect(text).not.toContain("https://nakafa.com/id/quran/1");
    expect(text).toContain("Tafsir ayat pertama.");
    expect(text).toContain("Segala puji bagi Allah");
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
      locales: Array.from(locales),
      quran: {
        surah_count: 114,
      },
      sections: ["articles", "material", "quran"],
      subject: {
        categories: ["high-school"],
        grades: ["10"],
        materials: ["chemistry"],
      },
      tryout: {
        countries: [{ id: "indonesia", label: "Indonesia" }],
        exams: [{ id: "snbt", label: "SNBT" }],
      },
      tools: ["nakafa_search_content"],
    });

    expect(text).toContain("# Nakafa Taxonomy");
    expect(text).toContain("indonesia (Indonesia)");
    expect(text).toContain("snbt (SNBT)");
    expect(text).toContain("chemistry");
  });
});
