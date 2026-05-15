import {
  formatExercise,
  formatQuran,
  formatRead,
  formatSearch,
  formatTaxonomy,
} from "@repo/ai/agents/nakafa/format";
import type { NakafaAgentExerciseResult } from "@repo/contents/_lib/agent/schema/exercise";
import { describe, expect, it } from "vitest";

describe("Nakafa formatter", () => {
  it("formats search results", () => {
    const text = formatSearch({
      count: 1,
      has_more: false,
      items: [
        {
          content_id: "id/subject/example",
          description: "Pelajari contoh.",
          locale: "id",
          markdown_url: "https://nakafa.com/id/subject/example.md",
          route: "subject/example",
          section: "subject",
          title: "Contoh Materi",
          url: "https://nakafa.com/id/subject/example",
        },
      ],
      limit: 1,
      next_offset: null,
      offset: 0,
    });

    expect(text).toContain("# Nakafa Search");
    expect(text).toContain("Contoh Materi");
    expect(text).toContain(
      "Citation: [Contoh Materi](https://nakafa.com/id/subject/example)"
    );
    expect(text).not.toContain("Markdown URL:");
    expect(text).toContain("Next offset: none");
  });

  it("formats full content reads", () => {
    const text = formatRead({
      content_id: "id/subject/example",
      description: "Pelajari contoh.",
      locale: "id",
      markdown_url: "https://nakafa.com/id/subject/example.md",
      route: "subject/example",
      section: "subject",
      text: "Isi materi lengkap.",
      title: "Contoh Materi",
      url: "https://nakafa.com/id/subject/example",
    });

    expect(text).toContain("# Nakafa Content");
    expect(text).toContain(
      "Citation: [Contoh Materi](https://nakafa.com/id/subject/example)"
    );
    expect(text).not.toContain("Markdown URL:");
    expect(text).toContain("Isi materi lengkap.");
  });

  it("formats structured exercises", () => {
    const result = {
      content_id: "id/exercises/example",
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
      locale: "id",
      markdown_url: "https://nakafa.com/id/exercises/example.md",
      route: "exercises/example",
      section: "exercises",
      url: "https://nakafa.com/id/exercises/example",
    } satisfies NakafaAgentExerciseResult;
    const text = formatExercise(result);

    expect(text).toContain("# Nakafa Exercises");
    expect(text).toContain(
      "Citation: [id/exercises/example](https://nakafa.com/id/exercises/example)"
    );
    expect(text).toContain("Exercise number: 2");
    expect(text).toContain("Correct: Yes");
    expect(text).toContain("Correct: No");
    expect(formatExercise({ ...result, exercise_number: null })).toContain(
      "Exercise number: all"
    );
  });

  it("formats Quran references with and without tafsir", () => {
    const text = formatQuran({
      content_id: "id/quran/1",
      locale: "id",
      markdown_url: "https://nakafa.com/id/quran/1.md",
      name: "Al-Fatihah",
      revelation: "Makkiyah",
      route: "quran/1",
      section: "quran",
      translation: "Pembukaan",
      url: "https://nakafa.com/id/quran/1",
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
    expect(text).toContain(
      "Citation: [Al-Fatihah](https://nakafa.com/id/quran/1)"
    );
    expect(text).toContain("Tafsir ayat pertama.");
    expect(text).toContain("Segala puji bagi Allah");
  });

  it("formats taxonomy", () => {
    const text = formatTaxonomy({
      articles: {
        categories: ["science"],
      },
      content_counts: [{ count: 12, locale: "id" }],
      default_locale: "id",
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
      locales: ["id", "en"],
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
