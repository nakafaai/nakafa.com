import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { normalizePublicationDates } from "@repo/contents/_types/publication";
import { Effect } from "effect";

/** Validates and normalizes one transition article date row. */
export const readArticleDates = Effect.fn("contentRelease.readArticleDates")(
  function* (row: Doc<"articleCatalog">) {
    if (
      "datePublished" in row &&
      row.date !== undefined &&
      row.date !== row.datePublished
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Article ${row.contentKey}/${row.appLocale} has contradictory bridge dates.`
      );
    }
    return normalizePublicationDates(row);
  }
);
