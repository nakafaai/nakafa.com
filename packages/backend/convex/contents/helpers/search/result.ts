import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { CONTENT_SEARCH_MAX_OFFSET } from "@repo/backend/convex/contents/helpers/search/constants";
import type { contentSearchInputValidator } from "@repo/backend/convex/contents/helpers/search/schema";
import type { Infer } from "convex/values";

type ContentSearchInput = Infer<typeof contentSearchInputValidator>;
type ContentSearchDocument = Doc<"contentSearch">;

/** Builds the stable paginated search response shape used by tools and UI. */
export function buildContentSearchResult(
  args: ContentSearchInput,
  ranked: readonly ContentSearchDocument[]
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
