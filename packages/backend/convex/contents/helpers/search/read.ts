import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadContentOwner } from "@repo/backend/convex/contentRelease/scope/owner";
import { loadSearchOwner } from "@repo/backend/convex/contentRelease/search";
import { NAKAFA_CONTENT_SECTIONS } from "@repo/backend/convex/contents/constants";
import type { ContentSearchDocument } from "@repo/backend/convex/contents/helpers/search/groups";
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
      ).pipe(
        Effect.flatMap((documents) =>
          filterClaimedSourceMaterials(ctx, documents, owner)
        )
      ),
    ],
    { concurrency: "unbounded" }
  );
  return interleaveSearchGroups(
    [published, source],
    scanLimit,
    (document) => document.content_id
  );
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
        (candidate === "articles" &&
          owner?.readyFamilies.includes("article")) ||
        (candidate === "material" &&
          owner?.materialReady &&
          owner.families.includes("material"))
      )
  );
}

/** Removes source search rows whose stable identity has exact active ownership. */
const filterClaimedSourceMaterials = Effect.fn(
  "contents.search.filterClaimedMaterials"
)(function* (
  ctx: QueryCtx,
  documents: readonly ContentSearchDocument[],
  owner: Effect.Effect.Success<ReturnType<typeof loadSearchOwner>>
) {
  if (!(owner?.materialReady && !owner.families.includes("material"))) {
    return documents;
  }
  const visible = yield* Effect.forEach(
    documents,
    (document) =>
      document.section === "material"
        ? loadContentOwner(
            ctx,
            document.sourcePath,
            document.locale,
            owner.sequence
          ).pipe(
            Effect.flatMap((contentOwner) => {
              if (!contentOwner?.managed) {
                return Effect.succeed(document);
              }
              if (contentOwner.family === "material") {
                return Effect.succeed(null);
              }
              return releaseFail(
                "CONTENT_RELEASE_INTEGRITY",
                `Source material ${document.sourcePath}/${document.locale} changed ownership family.`
              );
            })
          )
        : Effect.succeed(document),
    { concurrency: "unbounded" }
  );
  return visible.filter((document) => document !== null);
});
