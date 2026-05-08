import { createPrompt } from "@repo/ai/prompt/utils";

export const nakafaSearch = createPrompt({
  taskContext: `
    Search Nakafa's public content index across articles, subjects, exercises, and Quran.
    Use this when you need to discover stable content references before reading details.
  `,
});

export const nakafaRead = createPrompt({
  taskContext: `
    Read one full Nakafa content reference returned by search or supplied as a canonical Nakafa URL.
    Use this for article, subject, exercise-set, and full-surah content.
  `,
});

export const nakafaExercise = createPrompt({
  taskContext: `
    Read structured Nakafa exercise data, including questions, choices, answers, and explanations.
    Use exercise_number only when the user asks for one specific question.
  `,
});

export const nakafaQuran = createPrompt({
  taskContext: `
    Read a bounded Quran verse range from Nakafa with Arabic text, transliteration, translation, and optional tafsir.
    Use this for focused verse references instead of full-surah content.
  `,
});

export const nakafaTaxonomy = createPrompt({
  taskContext: `
    Read Nakafa taxonomy for supported locales, sections, subject filters, exercise filters, and public MCP tool names.
    Use this when you need to understand available Nakafa content dimensions before searching.
  `,
});
