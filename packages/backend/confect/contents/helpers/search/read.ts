import { loadSearchOwner } from "@repo/backend/confect/contentRelease/search/owner";
import { interleaveSearchGroups } from "@repo/backend/confect/contents/helpers/search/groups";
import {
  getPublishedSearchFamilies,
  readPublishedSearchDocuments,
} from "@repo/backend/confect/contents/helpers/search/published";
import { readSignedQuranSearchDocuments } from "@repo/backend/confect/contents/helpers/search/quran/read";
import type { contentSearchInputValidator } from "@repo/backend/confect/contents/helpers/search/schema";
import { readSignedTryoutSearchDocuments } from "@repo/backend/confect/contents/helpers/search/tryout";
import type { NakafaSection } from "@repo/backend/confect/lib/validators/contents";
import { Effect, type Schema } from "effect";

type ContentSearchInput = Schema.Schema.Type<
  typeof contentSearchInputValidator
>;

/** Reads a bounded page across active signed content families. */
export const readContentSearchDocuments = Effect.fn(
  "contents.search.readDocuments"
)(function* (
  args: ContentSearchInput,
  queryTexts: readonly string[],
  scanLimit: number
) {
  const owner = readsPublishedSection(args.section)
    ? yield* loadSearchOwner()
    : null;
  const publishedFamilies = getPublishedSearchFamilies(owner, args.section);
  const { published, quran, tryout } = yield* Effect.all(
    {
      published:
        owner && publishedFamilies.length > 0
          ? readPublishedSearchDocuments(
              args,
              queryTexts,
              scanLimit,
              owner,
              publishedFamilies
            )
          : Effect.succeed([]),
      quran: readsSection(args.section, "quran")
        ? readSignedQuranSearchDocuments(args, queryTexts, scanLimit)
        : Effect.succeed([]),
      tryout: readsSection(args.section, "tryout")
        ? readSignedTryoutSearchDocuments(args, queryTexts, scanLimit)
        : Effect.succeed([]),
    },
    {
      concurrency: "unbounded",
    }
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
