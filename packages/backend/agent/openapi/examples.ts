import {
  type QuranEmbeddedSourceId,
  type QuranExternalSourceId,
  quranReadingSourceIds,
  quranTafsirSourceId,
} from "@nakafa/aksara-contracts/quran/identity";
import { QURAN_SURAH_COUNT } from "@nakafa/aksara-contracts/quran/spec";
import {
  NAKAFA_API_BASE_URL,
  NAKAFA_BASE_URL,
  NAKAFA_MCP_RECOMMENDED_ENDPOINT,
  NAKAFA_PUBLIC_API_DOCUMENT_VERSION,
  NAKAFA_PUBLIC_API_VERSION,
} from "@repo/contents/_lib/agent/constants";
import { NAKAFA_AGENT_DEFAULT_LIMIT } from "@repo/contents/_types/agent/search";

export const OPENAPI_CONTENT_ID_EXAMPLE =
  "asset:example:material:linear-equations";

const CONTENT_REFERENCE_EXAMPLE = {
  alignmentId: "alignment:example:mathematics",
  assetId: OPENAPI_CONTENT_ID_EXAMPLE,
  conceptId: "concept:example:linear-equations",
  content_id: OPENAPI_CONTENT_ID_EXAMPLE,
  learningObjectId: "learning-object:example:linear-equations",
  lensId: "lens:example:secondary-school",
  locale: "en",
  markdown_url:
    "https://nakafa.com/en/subjects/mathematics/algebra/linear-equations.md",
  route: "subjects/mathematics/algebra/linear-equations",
  section: "material",
  url: "https://nakafa.com/en/subjects/mathematics/algebra/linear-equations",
};

const EXAMPLE_LOCALE = "en" as const;
const EXAMPLE_DIGEST = `sha256:${"1".repeat(64)}`;
const EXAMPLE_ARTIFACT = {
  byte_count: 3_456_789,
  digest: EXAMPLE_DIGEST,
  file_count: 1,
};
const [ARABIC_SOURCE_ID, TRANSLATION_SOURCE_ID] =
  quranReadingSourceIds(EXAMPLE_LOCALE);
const TAFSIR_SOURCE_ID = quranTafsirSourceId(EXAMPLE_LOCALE);

/** Builds illustrative metadata without duplicating signed source records. */
function embeddedSource(id: QuranEmbeddedSourceId) {
  return {
    artifact: EXAMPLE_ARTIFACT,
    id,
    kind: "embedded" as const,
    label: `Example ${id}`,
    notice: "Example signed embedded source.",
    publisher: "Example publisher",
    retrieved_at: "2026-08-26T15:51:00Z",
    source_url: `https://example.test/${id}`,
    terms: {
      artifact: EXAMPLE_ARTIFACT,
      url: `https://example.test/${id}/terms`,
    },
    update_url: `https://example.test/${id}/updates`,
    version: "example-version",
  };
}

/** Builds one illustrative external source from the owning identity contract. */
function externalSource(id: QuranExternalSourceId) {
  return {
    id,
    kind: "external" as const,
    label: `Example ${id}`,
    notice: "Example signed link-only source.",
    publisher: "Example publisher",
    retrieved_at: "2026-08-26T15:51:00Z",
    source_url: `https://example.test/${id}`,
    terms: {
      access: "link-only" as const,
      url: `https://example.test/${id}/terms`,
    },
    update_url: `https://example.test/${id}/updates`,
    version: "example-version",
  };
}

const ARABIC_SOURCE_EXAMPLE = embeddedSource(ARABIC_SOURCE_ID);
const TRANSLATION_SOURCE_EXAMPLE = {
  ...embeddedSource(TRANSLATION_SOURCE_ID),
  locale: EXAMPLE_LOCALE,
};

const TAFSIR_ACCESS_EXAMPLE = {
  kind: "external",
  locale: EXAMPLE_LOCALE,
  notice: "Example signed link-only Tafsir access.",
  source: externalSource(TAFSIR_SOURCE_ID),
};

const QURAN_REFERENCE_EXAMPLE = {
  alignmentId: "alignment:example:quran:1",
  assetId: "asset:example:quran:1",
  conceptId: "concept:example:quran:1",
  content_id: "asset:example:quran:1",
  learningObjectId: "learning-object:example:quran:1",
  lensId: "lens:example:quran",
  locale: EXAMPLE_LOCALE,
  markdown_url: `https://nakafa.com/${EXAMPLE_LOCALE}/quran/1.md`,
  meaning: { locale: EXAMPLE_LOCALE, text: "The Opening" },
  name: "Al-Faatiha",
  pre_bismillah: null,
  revelation: "Meccan",
  route: "quran/1",
  section: "quran",
  sources: {
    arabic: ARABIC_SOURCE_EXAMPLE,
    translation: TRANSLATION_SOURCE_EXAMPLE,
  },
  tafsir_access: TAFSIR_ACCESS_EXAMPLE,
  url: `https://nakafa.com/${EXAMPLE_LOCALE}/quran/1`,
  verses: [
    {
      arabic: "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ",
      number: 1,
      translation: {
        notes: [
          {
            number: 1,
            referenceOffset: 47,
            text: "Exact source-authored explanatory note.",
          },
        ],
        segments: [
          {
            kind: "text",
            offset: 0,
            value: "In the name of Allah, the Most Compassionate. ",
          },
          { kind: "note", number: 1, offset: 47 },
        ],
      },
    },
  ],
};

/** Concrete response examples for every publicly reachable operation. */
export const OPENAPI_RESPONSE_EXAMPLES = {
  ApiHealth: {
    service: "nakafa-public-api",
    status: "ok",
    timestamp: 1_777_072_400_000,
    version: NAKAFA_PUBLIC_API_VERSION,
  },
  ApiIndex: {
    authentication: "none",
    description:
      "Read-only access to Nakafa's signed educational content for developers and agents.",
    documentation: `${NAKAFA_BASE_URL}/llms.txt`,
    mcp: NAKAFA_MCP_RECOMMENDED_ENDPOINT,
    name: "Nakafa Public API",
    openapi: `${NAKAFA_API_BASE_URL}/openapi.json`,
    status: "active",
    version: NAKAFA_PUBLIC_API_VERSION,
  },
  Content: {
    ...CONTENT_REFERENCE_EXAMPLE,
    description: "A lesson about solving linear equations.",
    text: "# Linear equations\n\nA linear equation has variables raised to the first power.",
    title: "Linear equations",
  },
  OpenApi: {
    info: {
      title: "Nakafa Public API",
      version: NAKAFA_PUBLIC_API_DOCUMENT_VERSION,
    },
    openapi: "3.1.1",
    paths: {},
  },
  QuranReference: QURAN_REFERENCE_EXAMPLE,
  SearchResult: {
    count: 1,
    has_more: false,
    items: [
      {
        ...CONTENT_REFERENCE_EXAMPLE,
        description: "A lesson about solving linear equations.",
        excerpt: "A linear equation has variables raised to the first power.",
        title: "Linear equations",
      },
    ],
    limit: NAKAFA_AGENT_DEFAULT_LIMIT,
    offset: 0,
  },
  Taxonomy: {
    articles: { categories: ["education"] },
    content_counts: [
      { count: 120, locale: "en" },
      { count: 120, locale: "id" },
      { count: 120, locale: "de" },
    ],
    default_locale: "en",
    endpoints: {
      direct: "https://mcp.nakafa.com/mcp",
      recommended: NAKAFA_MCP_RECOMMENDED_ENDPOINT,
      root_note: "https://mcp.nakafa.com is informational only.",
    },
    locale: "en",
    locales: ["en", "id", "de"],
    quran: { surah_count: QURAN_SURAH_COUNT },
    sections: ["articles", "material", "tryout", "quran"],
    tools: [
      "nakafa_search_content",
      "nakafa_get_content",
      "nakafa_get_taxonomy",
      "nakafa_get_quran_reference",
    ],
    tryout: { countries: [], exams: [] },
  },
};
