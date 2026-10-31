import { HttpClient } from "@confect/js";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { Id } from "@repo/backend/confect/_generated/id";
import comments from "@repo/backend/confect/_generated/refs/comments";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Effect, Option, Schema } from "effect";
import type { Locale } from "use-intl";
import { focusComment } from "@/lib/comments/focus";
import { httpLayer } from "@/lib/convex/http";

/**
 * The address of the page that shows a comment, or none when no page shows it
 * any more. An inbox row opens a comment through this read, because a lesson's
 * comments carry its content key, which only the active release turns into a path
 * in the reader's language, and the inbox reads no release for each of its rows.
 */
export const readCommentAddress = Effect.fn("www.comments.address")(function* (
  locale: Locale,
  commentId: string
) {
  const place = yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(comments.queries.getCommentPlace, {
      appLocale: AppLocaleSchema.make(locale),
      commentId: Schema.decodeSync(Id("comments"))(commentId),
    })
  ).pipe(Effect.provide(httpLayer()));
  return Option.map(Option.fromNullOr(place), ({ appLocale, publicPath }) =>
    focusComment(new URL(`/${appLocale}/${publicPath}`, SITE_ORIGIN), commentId)
  );
});
