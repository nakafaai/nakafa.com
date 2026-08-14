import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadSearchOwner } from "@repo/backend/convex/contentRelease/search/owner";
import { interleaveSearchGroups } from "@repo/backend/convex/contents/helpers/search/groups";
import {
  getPublishedSearchFamilies,
  readPublishedSearchDocuments,
} from "@repo/backend/convex/contents/helpers/search/published";
import { readSignedQuranSearchDocuments } from "@repo/backend/convex/contents/helpers/search/quran/read";
import type { contentSearchInputValidator } from "@repo/backend/convex/contents/helpers/search/schema";
import { readSignedTryoutSearchDocuments } from "@repo/backend/convex/contents/helpers/search/tryout";
import type { NakafaSection } from "@repo/backend/convex/lib/validators/contents";
import type { Infer } from "convex/values";
import { Effect } from "effect";

type ContentSearchInput = Infer<typeof contentSearchInputValidator>;

/** Reads a bounded page across active signed content families. */
export const readContentSearchDocuments = Effect.fn(
  "contents.search.readDocuments"
)(function* (
  ctx: QueryCtx,
  args: ContentSearchInput,
  queryTexts: readonly string[],
  scanLimit: number
) {
  const owner = readsPublishedSection(args.section)
    ? yield* loadSearchOwner(ctx)
    : null;
  const publishedFamilies = getPublishedSearchFamilies(owner, args.section);
  const { published, quran, tryout } = yield* Effect.all(
    {
      published:
        owner && publishedFamilies.length > 0
          ? readPublishedSearchDocuments(
              ctx,
              args,
              queryTexts,
              scanLimit,
              owner,
              publishedFamilies
            )
          : Effect.succeed([]),
      quran: readsSection(args.section, "quran")
        ? readSignedQuranSearchDocuments(ctx, args, queryTexts, scanLimit)
        : Effect.succeed([]),
      tryout: readsSection(args.section, "tryout")
        ? readSignedTryoutSearchDocuments(ctx, args, queryTexts, scanLimit)
        : Effect.succeed([]),
    },
    { concurrency: "unbounded" }
  );
  return interleaveSearchGroups(
    [published, quran, tryout],
    scanLimit,
    (document) => document.content_id
  );
});

/** Checks whether one optional section includes the requested family. */
function readsSection(
  section: ContentSearchInput["section"],
  requested: NakafaSection
) {
  return section === undefined || section === requested;
}

/** Avoids loading generic publication state for signed-only searches. */
function readsPublishedSection(section: ContentSearchInput["section"]) {
  return readsSection(section, "articles") || readsSection(section, "material");
}
