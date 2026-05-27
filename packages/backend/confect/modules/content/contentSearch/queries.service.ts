import type { Doc } from "@repo/backend/confect/_generated/dataModel";
import { QueryCtx } from "@repo/backend/confect/_generated/services";
import {
  CONTENT_SEARCH_MAX_LIMIT,
  CONTENT_SEARCH_MAX_OFFSET,
  CONTENT_SEARCH_MAX_QUERIES,
} from "@repo/backend/confect/modules/content/constants";
import type {
  Locale,
  NakafaSection,
} from "@repo/backend/confect/modules/content/content.schemas";
import { ContentSearchInputError } from "@repo/backend/confect/modules/content/contentSearch/errors.service";
import { Effect } from "effect";

const SEARCH_TOKEN_PATTERN = /[\p{L}\p{N}]+/gu;
const NUMERIC_TOKEN_PATTERN = /^\p{N}+$/u;
const EXERCISE_QUESTION_ROUTE_PATTERN = /\/\d+$/u;
const ROUTE_SEPARATOR_PATTERN = /[/_-]+/g;

/** Validates public search bounds and returns unique trimmed query texts. */
function validateContentSearchInput(args: {
  limit: number;
  offset: number;
  queries?: readonly string[];
}) {
  if (args.limit < 1 || args.limit > CONTENT_SEARCH_MAX_LIMIT) {
    return Effect.fail(
      new ContentSearchInputError({
        message: `Content search limit must be between 1 and ${CONTENT_SEARCH_MAX_LIMIT}.`,
      })
    );
  }

  if (args.offset < 0 || args.offset > CONTENT_SEARCH_MAX_OFFSET) {
    return Effect.fail(
      new ContentSearchInputError({
        message: `Content search offset must be between 0 and ${CONTENT_SEARCH_MAX_OFFSET}.`,
      })
    );
  }

  const queryTextByKey = new Map<string, string>();
  const seen = new Set<string>();

  for (const queryText of args.queries ?? []) {
    const text = queryText.trim();
    if (!text) {
      continue;
    }

    const key = text.toLocaleLowerCase();
    if (seen.has(key)) {
      continue;
    }

    queryTextByKey.set(key, text);
    seen.add(key);
  }

  const queryTexts = Array.from(queryTextByKey.values());

  if (queryTexts.length > CONTENT_SEARCH_MAX_QUERIES) {
    return Effect.fail(
      new ContentSearchInputError({
        message: `Content search accepts at most ${CONTENT_SEARCH_MAX_QUERIES} unique queries.`,
      })
    );
  }

  return Effect.succeed(queryTexts);
}

/** Splits search text into locale-aware word and number tokens. */
function tokenizeSearchText(value: string) {
  const tokens = value.toLocaleLowerCase().match(SEARCH_TOKEN_PATTERN);

  if (!tokens) {
    return [];
  }

  return Array.from(tokens);
}

/** Scores exact token matches for a document field. */
function scoreSearchText(text: string, queryTokens: readonly string[]) {
  const textTokens = new Set(tokenizeSearchText(text));
  let score = 0;

  for (const token of queryTokens) {
    if (textTokens.has(token)) {
      score += 1;
    }
  }

  return score;
}

/** Returns searchable metadata text for exercise-aware ranking. */
function getDocumentMetadataSearchText(document: Doc<"contentSearch">) {
  return [document.title, document.description, document.route]
    .join(" ")
    .replaceAll(ROUTE_SEPARATOR_PATTERN, " ");
}

/** Promotes exercise sets above individual numbered questions. */
function getExerciseSetPriority(document: Doc<"contentSearch">) {
  if (document.section !== "exercises") {
    return 0;
  }

  if (EXERCISE_QUESTION_ROUTE_PATTERN.test(document.route)) {
    return 0;
  }

  return 1;
}

/** Ranks exercise search documents by metadata and body token matches. */
function rankContentSearchDocuments(
  documents: readonly Doc<"contentSearch">[],
  queryText: string
) {
  const queryTokens = tokenizeSearchText(queryText);
  const semanticTokens = queryTokens.filter(
    (token) => !NUMERIC_TOKEN_PATTERN.test(token)
  );
  const numericTokens = queryTokens.filter((token) =>
    NUMERIC_TOKEN_PATTERN.test(token)
  );

  if (queryTokens.length === 0) {
    return documents;
  }

  return documents
    .map((document, index) => ({
      bodyNumericScore: scoreSearchText(document.text, numericTokens),
      bodySemanticScore: scoreSearchText(document.text, semanticTokens),
      document,
      index,
      metadataNumericScore: scoreSearchText(
        getDocumentMetadataSearchText(document),
        numericTokens
      ),
      metadataSemanticScore: scoreSearchText(
        getDocumentMetadataSearchText(document),
        semanticTokens
      ),
      setPriority: getExerciseSetPriority(document),
    }))
    .sort((left, right) => {
      if (left.metadataSemanticScore !== right.metadataSemanticScore) {
        return right.metadataSemanticScore - left.metadataSemanticScore;
      }

      if (left.setPriority !== right.setPriority) {
        return right.setPriority - left.setPriority;
      }

      if (left.bodySemanticScore !== right.bodySemanticScore) {
        return right.bodySemanticScore - left.bodySemanticScore;
      }

      if (left.metadataNumericScore !== right.metadataNumericScore) {
        return right.metadataNumericScore - left.metadataNumericScore;
      }

      if (left.bodyNumericScore !== right.bodyNumericScore) {
        return right.bodyNumericScore - left.bodyNumericScore;
      }

      return left.index - right.index;
    })
    .filter(
      (ranked) =>
        semanticTokens.length <= 1 ||
        ranked.metadataSemanticScore + ranked.bodySemanticScore >= 2
    )
    .map((ranked) => ranked.document);
}

/** Appends document groups while keeping the first copy of each content id. */
function appendDocumentGroups(
  groups: readonly (readonly Doc<"contentSearch">[])[]
) {
  const seen = new Set<string>();

  return groups.flatMap((documents) =>
    documents.flatMap((document) => {
      if (seen.has(document.content_id)) {
        return [];
      }

      seen.add(document.content_id);
      return [document];
    })
  );
}

/** Interleaves ranked groups while keeping the first copy of each content id. */
function interleaveDocumentGroups(
  groups: readonly (readonly Doc<"contentSearch">[])[]
) {
  const seen = new Set<string>();
  const maxLength = Math.max(0, ...groups.map((documents) => documents.length));

  return Array.from({ length: maxLength }).flatMap((_, index) =>
    groups.flatMap((documents) => {
      const document = documents[index];
      if (!document || seen.has(document.content_id)) {
        return [];
      }

      seen.add(document.content_id);
      return [document];
    })
  );
}

/** Reads browse-mode content search rows. */
function browseContent(
  ctx: QueryCtx,
  args: { locale: Locale; section?: NakafaSection },
  scanLimit: number
) {
  if (!args.section) {
    return ctx.db
      .query("contentSearch")
      .withIndex("by_locale_and_title", (query) =>
        query.eq("locale", args.locale)
      )
      .take(scanLimit);
  }

  const section = args.section;

  return ctx.db
    .query("contentSearch")
    .withIndex("by_locale_and_section_and_title", (query) =>
      query.eq("locale", args.locale).eq("section", section)
    )
    .take(scanLimit);
}

/** Runs one search query against title and body indexes. */
async function searchContent(
  ctx: QueryCtx,
  args: { locale: Locale; section?: NakafaSection },
  queryText: string,
  scanLimit: number
) {
  const [titleDocuments, textDocuments] = await Promise.all([
    ctx.db
      .query("contentSearch")
      .withSearchIndex("search_title", (query) => {
        const builder = query
          .search("title", queryText)
          .eq("locale", args.locale);
        if (!args.section) {
          return builder;
        }

        return builder.eq("section", args.section);
      })
      .take(scanLimit),
    ctx.db
      .query("contentSearch")
      .withSearchIndex("search_text", (query) => {
        const builder = query
          .search("text", queryText)
          .eq("locale", args.locale);
        if (!args.section) {
          return builder;
        }

        return builder.eq("section", args.section);
      })
      .take(scanLimit),
  ]);
  const documents =
    args.section === "exercises"
      ? appendDocumentGroups([textDocuments, titleDocuments])
      : appendDocumentGroups([titleDocuments, textDocuments]);

  if (args.section === "exercises") {
    return rankContentSearchDocuments(documents, queryText);
  }

  return documents;
}

/** Reads content search rows for query or browse mode. */
function readContentSearchDocuments(
  ctx: QueryCtx,
  args: { locale: Locale; section?: NakafaSection },
  queryTexts: readonly string[],
  scanLimit: number
) {
  if (queryTexts.length === 0) {
    return browseContent(ctx, args, scanLimit);
  }

  return Promise.all(
    queryTexts.map((queryText) =>
      searchContent(ctx, args, queryText, scanLimit)
    )
  ).then(interleaveDocumentGroups);
}

/** Builds the public paginated search result shape. */
function buildContentSearchResult(
  args: { limit: number; offset: number },
  ranked: readonly Doc<"contentSearch">[]
) {
  const items = ranked
    .slice(args.offset, args.offset + args.limit)
    .map((document) => ({
      content_id: document.content_id,
      description: document.description,
      locale: document.locale,
      markdown_url: document.markdown_url,
      route: document.route,
      section: document.section,
      title: document.title,
      url: document.url,
    }));
  const nextOffset = args.offset + items.length;
  const hasMore =
    ranked.length > nextOffset && nextOffset <= CONTENT_SEARCH_MAX_OFFSET;

  return {
    count: items.length,
    has_more: hasMore,
    items,
    limit: args.limit,
    next_offset: hasMore ? nextOffset : null,
    offset: args.offset,
  };
}

/** Searches the content search read model. */
export const search = Effect.fn("contentSearch.search")(function* (args: {
  limit: number;
  locale: Locale;
  offset: number;
  queries?: string[];
  section?: NakafaSection;
}) {
  const ctx = yield* QueryCtx;
  const queryTexts = yield* validateContentSearchInput(args);
  const scanLimit = args.offset + args.limit + 1;
  const documents = yield* Effect.promise(() =>
    readContentSearchDocuments(ctx, args, queryTexts, scanLimit)
  );

  return buildContentSearchResult(args, documents);
});
