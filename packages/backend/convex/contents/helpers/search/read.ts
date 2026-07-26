import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadSearchOwner } from "@repo/backend/convex/contentRelease/search";
import { NAKAFA_CONTENT_SECTIONS } from "@repo/backend/convex/contents/constants";
import { interleaveSearchGroups } from "@repo/backend/convex/contents/helpers/search/groups";
import {
  getPublishedSearchFamilies,
  readPublishedSearchDocuments,
} from "@repo/backend/convex/contents/helpers/search/published";
import type { contentSearchInputValidator } from "@repo/backend/convex/contents/helpers/search/schema";
import { readSourceSearchDocuments } from "@repo/backend/convex/contents/helpers/search/source";
import type { NakafaSection } from "@repo/backend/convex/lib/validators/contents";
import type { Infer } from "convex/values";
import { Effect } from "effect";

type ContentSearchInput = Infer<typeof contentSearchInputValidator>;

/** Reads a bounded page across active Aksara and still-unmanaged sources. */
export const readContentSearchDocuments = Effect.fn(
  "contents.search.readDocuments"
)(function* (
  ctx: QueryCtx,
  args: ContentSearchInput,
  queryTexts: readonly string[],
  scanLimit: number
) {
  if (args.section === "quran" || args.section === "tryout") {
    return yield* readSourceSearchDocuments(ctx, args, queryTexts, scanLimit, [
      args.section,
    ]);
  }
  const owner = yield* loadSearchOwner(ctx);
  const publishedFamilies = getPublishedSearchFamilies(owner, args.section);
  const sourceSections = getSourceSections(owner, args.section);
  const [published, source] = yield* Effect.all(
    [
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
      readSourceSearchDocuments(
        ctx,
        args,
        queryTexts,
        scanLimit,
        sourceSections
      ),
    ],
    { concurrency: "unbounded" }
  );
  return interleaveSearchGroups([published, source]);
});

/** Returns only sections whose source ownership remains with Nakafa. */
function getSourceSections(
  owner: Effect.Effect.Success<ReturnType<typeof loadSearchOwner>>,
  section: ContentSearchInput["section"]
) {
  const requested = section ? [section] : NAKAFA_CONTENT_SECTIONS;
  return requested.filter(
    (candidate): candidate is NakafaSection =>
      !(
        (candidate === "articles" && owner?.families.includes("article")) ||
        (candidate === "material" && owner?.families.includes("material"))
      )
  );
}
