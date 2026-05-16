import { createPrompt } from "@repo/ai/prompt/utils";

export const nakafaSearch = createPrompt({
  taskContext: `
    # search Tool

    ## Purpose

    Search Nakafa's public content index across articles, subjects, exercises, and Quran.
    Use this when you need to discover stable content references before reading details.
    Call this tool multiple times in the same step when independent searches use different sections.

    ## Routing

    For school lessons, materials, class or grade topics, use the subject section.
    For practice questions, drills, tests, tryouts, or answer explanations, use the exercises section.
    Use articles only when the user explicitly asks for articles, news, essays, analysis, or editorial content.
  `,
});

export const nakafaRead = createPrompt({
  taskContext: `
    # read Tool

    ## Purpose

    Read one full Nakafa content reference returned by search or supplied as a canonical Nakafa URL.
    Use this for article, subject, exercise-set, and full-surah content.
  `,
});

export const nakafaExercise = createPrompt({
  taskContext: `
    # exercise Tool

    ## Purpose

    Read structured Nakafa exercise data, including questions, choices, answers, and explanations.
    Use this after search returns an exercises content_id when the user wants to see, answer, solve, or explain exercises.

    ## Routing

    The content_ref may point to a full exercise set or to a numbered exercise returned by search.
    Use exercise_number only when the user asks for one specific question.
  `,
});

export const nakafaQuran = createPrompt({
  taskContext: `
    # quran Tool

    ## Purpose

    Read a bounded Quran verse range from Nakafa with Arabic text, transliteration, translation, and optional tafsir.
    Use this for focused verse references instead of full-surah content.
  `,
});

export const nakafaTaxonomy = createPrompt({
  taskContext: `
    # taxonomy Tool

    ## Purpose

    Read Nakafa taxonomy for supported locales, sections, subject filters, exercise filters, and public MCP tool names.
    Exercise taxonomy values include localized labels so canonical IDs can be matched from user-facing names.
    Use this first when the user asks what Nakafa content structure, options, categories, filters, materials, grades, tools, or exercise paths are available.
  `,
});
