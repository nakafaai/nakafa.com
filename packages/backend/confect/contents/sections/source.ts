import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type { Source } from "@repo/backend/confect/contents/sections/schema";
import { Effect } from "effect";

/** Finds the record of the version that a document's sections were made from. */
export const findSource = Effect.fn("contents.sections.findSource")(function* (
  key: Pick<Source, "appLocale" | "contentKey">
) {
  return yield* (yield* DatabaseReader)
    .table("contentSectionSources")
    .get("by_appLocale_and_contentKey", key.appLocale, key.contentKey)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
});

/** Whether the index holds the sections of a document, made from exactly `version`. */
export const holdsVersion = Effect.fn("contents.sections.holdsVersion")(
  function* (key: Pick<Source, "appLocale" | "contentKey">, version: string) {
    return (yield* findSource(key))?.version === version;
  }
);
