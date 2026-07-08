import { createPrompt } from "@repo/ai/prompt/utils";

export const nakafaSearch = createPrompt({
  taskContext: `
    # search Tool

    Search Nakafa's public content index across articles, subjects, try-outs, and Quran.
    Use this when you need to discover stable content references before reading details.
  `,

  toolUsageGuidelines: `
    # Tool Usage Guidelines

    ## Search Routing

    Call this tool multiple times in the same step when independent searches use different sections.

    For school lessons, materials, class or grade topics, use the subject section.
    For exam simulation discovery, use the tryout section.
    Use articles only when the user explicitly asks for articles, news, essays, analysis, or editorial content.
  `,
});

export const nakafaRead = createPrompt({
  taskContext: `
    # read Tool

    Read one full Nakafa content reference returned by search or supplied as a canonical Nakafa URL.
  `,

  toolUsageGuidelines: `
    # Tool Usage Guidelines

    Use this for article, subject, and full-surah content.
  `,
});

export const nakafaQuran = createPrompt({
  taskContext: `
    # quran Tool

    Read a bounded Quran verse range from Nakafa with Arabic text, transliteration, translation, and optional tafsir.
  `,

  toolUsageGuidelines: `
    # Tool Usage Guidelines

    Use this for focused verse references instead of full-surah content.
  `,
});

export const nakafaTaxonomy = createPrompt({
  taskContext: `
    # taxonomy Tool

    Read Nakafa taxonomy for supported locales, sections, subject filters, try-out discovery, and public MCP tool names.
  `,

  toolUsageGuidelines: `
    # Tool Usage Guidelines

    Use this first when the user asks what Nakafa supports:
    - content structure.
    - options.
    - categories.
    - filters.
    - materials.
    - grades.
    - tools.
    - try-out paths.
  `,
});
