import { LearningGraphAssetIdSchema } from "@nakafa/aksara-contracts/graph/family";
import type { NinaPage } from "@repo/backend/confect/nina/contract/turn";
import { Array as Arr, Option, Schema, String as Str } from "effect";

/**
 * The lesson an open page shows, named the same in every language. A page's
 * asset id reads `asset:<locale>:<family>:<identity>`; without its locale it
 * names the lesson for all of its translations. A page with no asset id, such
 * as the home page, shows no lesson.
 */
export function lessonOf(page: NinaPage | undefined) {
  return Option.fromUndefinedOr(page?.nina.learning.assetId).pipe(
    Option.flatMap(Schema.decodeUnknownOption(LearningGraphAssetIdSchema)),
    Option.map((assetId) =>
      Arr.join(Arr.drop(Str.split(assetId, ":"), 2), ":")
    ),
    Option.getOrUndefined
  );
}
