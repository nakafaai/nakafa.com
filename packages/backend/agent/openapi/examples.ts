import { QURAN_SURAH_COUNT } from "@nakafa/aksara-contracts/quran/spec";
import {
  NAKAFA_API_BASE_URL,
  NAKAFA_BASE_URL,
  NAKAFA_MCP_RECOMMENDED_ENDPOINT,
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

const QURAN_REFERENCE_EXAMPLE = {
  alignmentId: "alignment:example:quran:1",
  assetId: "asset:example:quran:1",
  conceptId: "concept:example:quran:1",
  content_id: "asset:example:quran:1",
  learningObjectId: "learning-object:example:quran:1",
  lensId: "lens:example:quran",
  locale: "en",
  markdown_url: "https://nakafa.com/en/quran/1.md",
  name: "Al-Faatiha",
  revelation: "Mecca",
  route: "quran/1",
  section: "quran",
  translation: "The Opening",
  url: "https://nakafa.com/en/quran/1",
  verses: [
    {
      arabic: "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ",
      number: 1,
      translation: "In the name of Allah, the Most Compassionate.",
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
      version: NAKAFA_PUBLIC_API_VERSION,
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
