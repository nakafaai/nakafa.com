import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadExactMaterialOwners } from "@repo/backend/convex/contentRelease/material/exact";
import { loadSearchOwner } from "@repo/backend/convex/contentRelease/search";
import { NAKAFA_CONTENT_SECTIONS } from "@repo/backend/convex/contents/constants";
import { interleaveSearchGroups } from "@repo/backend/convex/contents/helpers/search/groups";
import {
  getPublishedSearchFamilies,
  readPublishedSearchDocuments,
} from "@repo/backend/convex/contents/helpers/search/published";
import { readSignedQuranSearchDocuments } from "@repo/backend/convex/contents/helpers/search/quran";
import type { contentSearchInputValidator } from "@repo/backend/convex/contents/helpers/search/schema";
import { readSourceSearchDocuments } from "@repo/backend/convex/contents/helpers/search/source";
import { readSignedTryoutSearchDocuments } from "@repo/backend/convex/contents/helpers/search/tryout";
import type { NakafaSection } from "@repo/backend/convex/lib/validators/contents";
import { NAKAFA_AGENT_SEARCH_WINDOW } from "@repo/contents/_types/agent/search";
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
  const owner = readsPublishedSection(args.section)
    ? yield* loadSearchOwner(ctx)
    : null;
  const publishedFamilies = getPublishedSearchFamilies(owner, args.section);
  const sourceSections = getSourceSections(owner, args.section);
  const sourceClaims =
    owner?.materialReady && !owner.families.includes("material")
      ? yield* loadExactMaterialOwners(ctx, owner, args.locale)
      : [];
  const { published, quran, source, tryout } = yield* Effect.all(
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
      source: readSourceSearchDocuments(
        ctx,
        args,
        queryTexts,
        NAKAFA_AGENT_SEARCH_WINDOW,
        sourceSections,
        sourceClaims
      ),
      tryout: readsSection(args.section, "tryout")
        ? readSignedTryoutSearchDocuments(ctx, args, queryTexts, scanLimit)
        : Effect.succeed([]),
    },
    { concurrency: "unbounded" }
  );
  return interleaveSearchGroups(
    [published, quran, tryout, source],
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
      candidate !== "quran" &&
      candidate !== "tryout" &&
      !(
        (candidate === "articles" &&
          owner?.readyFamilies.includes("article")) ||
        (candidate === "material" &&
          owner?.materialReady &&
          owner.families.includes("material"))
      )
  );
}

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
