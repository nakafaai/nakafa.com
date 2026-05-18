import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { rankContentSearchDocuments } from "@repo/backend/convex/contents/helpers/search/rank";
import type { contentSearchInputValidator } from "@repo/backend/convex/contents/helpers/search/schema";
import type { Infer } from "convex/values";

type ContentSearchInput = Infer<typeof contentSearchInputValidator>;
type ContentSearchDocument = Doc<"contentSearch">;

/** Reads a bounded search page from the derived content search table. */
export async function readContentSearchDocuments(
  ctx: QueryCtx,
  args: ContentSearchInput,
  queryTexts: readonly string[],
  scanLimit: number
) {
  if (queryTexts.length === 0) {
    return browseContent(ctx, args, scanLimit);
  }

  const queryGroups = await Promise.all(
    queryTexts.map((queryText) =>
      searchContent(ctx, args, queryText, scanLimit)
    )
  );

  return interleaveDocumentGroups(queryGroups);
}

/** Runs one full-text query against title and body indexes in parallel. */
async function searchContent(
  ctx: QueryCtx,
  args: ContentSearchInput,
  queryText: string,
  scanLimit: number
) {
  const [titleDocuments, textDocuments] = await Promise.all([
    ctx.db
      .query("contentSearch")
      .withSearchIndex("search_title", (q) => {
        const builder = q.search("title", queryText).eq("locale", args.locale);

        if (!args.section) {
          return builder;
        }

        return builder.eq("section", args.section);
      })
      .take(scanLimit),
    ctx.db
      .query("contentSearch")
      .withSearchIndex("search_text", (q) => {
        const builder = q.search("text", queryText).eq("locale", args.locale);

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
    // Exercise titles are often generic ("Soal 11"), so route and body text
    // carry the discriminating subject, set, and question context.
    return rankContentSearchDocuments(documents, queryText);
  }

  return documents;
}

/** Merges query variants fairly so one broad query cannot fill the page alone. */
function interleaveDocumentGroups(
  groups: readonly (readonly ContentSearchDocument[])[]
) {
  const ranked: ContentSearchDocument[] = [];
  const seen = new Set<string>();
  const maxLength = Math.max(0, ...groups.map((documents) => documents.length));

  for (let index = 0; index < maxLength; index++) {
    for (const documents of groups) {
      const document = documents[index];

      if (!document || seen.has(document.content_id)) {
        continue;
      }

      ranked.push(document);
      seen.add(document.content_id);
    }
  }

  return ranked;
}

/** Browses a bounded, indexed page when the caller did not provide a query. */
function browseContent(
  ctx: QueryCtx,
  args: ContentSearchInput,
  scanLimit: number
) {
  if (!args.section) {
    return ctx.db
      .query("contentSearch")
      .withIndex("by_locale_and_title", (q) => q.eq("locale", args.locale))
      .take(scanLimit);
  }

  const section = args.section;

  return ctx.db
    .query("contentSearch")
    .withIndex("by_locale_and_section_and_title", (q) =>
      q.eq("locale", args.locale).eq("section", section)
    )
    .take(scanLimit);
}

/** Merges ranked result groups while preserving first-seen relevance order. */
function appendDocumentGroups(
  groups: readonly (readonly ContentSearchDocument[])[]
) {
  const ranked: ContentSearchDocument[] = [];
  const seen = new Set<string>();

  for (const documents of groups) {
    for (const document of documents) {
      if (seen.has(document.content_id)) {
        continue;
      }

      ranked.push(document);
      seen.add(document.content_id);
    }
  }

  return ranked;
}
