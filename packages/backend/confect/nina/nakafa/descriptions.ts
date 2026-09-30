import { createPrompt } from "@repo/backend/confect/nina/prompt/assemble";

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

    Read one Nakafa content reference returned by search or supplied as a canonical Nakafa URL.
    Long content returns the sections that fit, then lists the other sections by name.
  `,

  toolUsageGuidelines: `
    # Tool Usage Guidelines

    Use this for article, subject, and full-surah content.
    To continue a long read, call read again with the same content_ref and one listed section.
  `,
});

export const nakafaQuran = createPrompt({
  taskContext: `
    # quran Tool

    Read a bounded signed Quran verse range from Nakafa with Arabic text, translation, and optional tafsir.
  `,

  toolUsageGuidelines: `
    # Tool Usage Guidelines

    Use this for focused verse references instead of full-surah content.
  `,
});

export const nakafaTaxonomy = createPrompt({
  taskContext: `
    # taxonomy Tool

    Read Nakafa taxonomy for supported locales, current article categories, sections, try-out discovery, and public MCP tool names.
  `,

  toolUsageGuidelines: `
    # Tool Usage Guidelines

    Use this first when the user asks what Nakafa supports:
    - content structure.
    - options.
    - categories.
    - current article categories.
    - tools.
    - try-out paths.
  `,
});
