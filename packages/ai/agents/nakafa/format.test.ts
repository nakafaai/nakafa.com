import {
  formatExercise,
  formatQuran,
  formatRead,
  formatSearch,
  formatTaxonomy,
} from "@repo/ai/agents/nakafa/format";
import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import type { NakafaAgentExerciseResult } from "@repo/contents/_lib/agent/schema/exercise";
import { defaultLocale, locales } from "@repo/utilities/locales";
import { describe, expect, it } from "vitest";

const subjectRoute =
  "subject/high-school/10/mathematics/example-topic/example-section";
const exerciseRoute =
  "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1";

describe("Nakafa formatter", () => {
  it("formats search results", () => {
    const text = formatSearch({
      count: 1,
      has_more: false,
      items: [
        {
          ...readNakafaContentRefFixture("id", subjectRoute, "subject"),
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
      ...readNakafaContentRefFixture("id", subjectRoute, "subject"),
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

  it("formats structured exercises", () => {
    const result = {
      ...readNakafaContentRefFixture("id", exerciseRoute, "exercises"),
      count: 1,
      exercise_number: 2,
      exercises: [
        {
          answer: { raw: "Jawaban B", title: "Pembahasan 2" },
          choices: [
            { correct: false, label: "A" },
            { correct: true, label: "B" },
          ],
          number: 2,
          question: { raw: "Berapa 1 + 1?", title: "Soal 2" },
        },
      ],
    } satisfies NakafaAgentExerciseResult;
    const text = formatExercise(result);

    expect(text).toContain("# Nakafa Exercises");
    expect(text).not.toContain("Inline citation:");
    expect(text).not.toContain(`https://nakafa.com/id/${exerciseRoute}`);
    expect(text).toContain("Exercise number: 2");
    expect(text).toContain("Correct: Yes");
    expect(text).toContain("Correct: No");
    const { exercise_number, ...wholeSetResult } = result;
    expect(formatExercise(wholeSetResult)).toContain("Exercise number: all");
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
      exercises: {
        categories: [{ id: "high-school", label: "SMA" }],
        materials: [
          { id: "mathematical-reasoning", label: "Penalaran Matematika" },
        ],
        types: [{ id: "snbt", label: "SNBT" }],
      },
      locale: "id",
      locales: Array.from(locales),
      quran: {
        surah_count: 114,
      },
      sections: ["articles", "subject", "exercises", "quran"],
      subject: {
        categories: ["high-school"],
        grades: ["10"],
        materials: ["chemistry"],
      },
      tools: ["nakafa_search_content", "nakafa_get_exercise"],
    });

    expect(text).toContain("# Nakafa Taxonomy");
    expect(text).toContain("nakafa_get_exercise");
    expect(text).toContain("mathematical-reasoning (Penalaran Matematika)");
    expect(text).toContain("chemistry");
  });
});
