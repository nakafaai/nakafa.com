import type { GenericId } from "@confect/core";
import { findComment } from "@repo/backend/confect/comments/rows";
import type { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import { requireMaterialState } from "@repo/backend/content/material/owner";
import { MaterialSource } from "@repo/backend/content/material/source";
import { loadActiveIdentity } from "@repo/backend/content/publication/read";
import { Array as Arr, Effect, Option } from "effect";

/** How the content key of a lesson starts, which is the slug of its comments. */
const MATERIAL_KEY_PREFIX = "material/";

/**
 * The page that shows a comment for a reader of `appLocale`, or null when no page
 * shows it. An article's comments carry its public path as their slug. A lesson's
 * carry its content key, which stands across its languages, so the path comes from
 * the active release, in the reader's language or else in the first language that
 * has the lesson.
 */
export const readCommentPlace = Effect.fn("comments.place.read")(function* (
  commentId: GenericId.GenericId<"comments">,
  appLocale: typeof appLocaleValidator.Type
) {
  const comment = yield* findComment(commentId);
  if (comment === null) {
    return null;
  }
  if (!comment.slug.startsWith(MATERIAL_KEY_PREFIX)) {
    return { appLocale, publicPath: comment.slug };
  }
  const active = yield* loadActiveIdentity();
  if (active === null) {
    return null;
  }
  const slot = yield* requireMaterialState(active, appLocale);
  const source = yield* MaterialSource;
  const rows = yield* Effect.forEach(
    Arr.dedupe([appLocale, ...active.signed.manifest.activeAppLocales]),
    (locale) => source.material(slot, comment.slug, locale)
  );
  return Option.getOrNull(
    Option.map(Arr.head(Arr.getSomes(rows)), (row) => ({
      appLocale: row.appLocale,
      publicPath: row.publicPath,
    }))
  );
});
