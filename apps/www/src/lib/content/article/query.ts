import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { hasArticlePublicationCursorPrefix } from "@repo/contents/publication";
import { Option, Record as Rec, Schema } from "effect";
import type { ArticlePageCursor } from "@/lib/content/article/catalog";

const CursorSchema = Schema.String.pipe(
  Schema.check(Schema.isMinLength(1)),
  Schema.check(Schema.isMaxLength(4096))
);
const articlePageQueryFields = {
  cursor: CursorSchema,
  manifest: Sha256HashSchema,
  release: ReleaseIdSchema,
};
const ArticlePageQuerySchema = Schema.Struct(articlePageQueryFields);
/** The search values of one article catalog page, as the article routes validate them. */
export const ArticlePageSearchSchema = Schema.Struct({
  cursor: Schema.optional(Schema.String),
  manifest: Schema.optional(Schema.String),
  release: Schema.optional(Schema.String),
});
type ArticlePageQuery = typeof ArticlePageSearchSchema.Type;
const ArticleNextPageSchema = Schema.Struct({
  activeManifestHash: Schema.NullOr(Sha256HashSchema),
  activeReleaseId: Schema.NullOr(ReleaseIdSchema),
  nextCursor: Schema.NullOr(Schema.String),
});
/** Minimal active page identity used to build one continuation URL. */
type ArticleNextPage = typeof ArticleNextPageSchema.Type;
/** Removes source-release pagination before navigating to another locale. */
export function stripArticlePagination(search: string) {
  const query = new URLSearchParams(search);
  for (const parameter of Rec.keys(articlePageQueryFields)) {
    query.delete(parameter);
  }
  const suffix = query.toString();
  return suffix ? `?${suffix}` : "";
}
/** Decodes an initial or release-bound article pagination request. */
export function readArticlePageCursor(
  input: ArticlePageQuery
): Option.Option<ArticlePageCursor> {
  const selected = {
    cursor: input.cursor,
    manifest: input.manifest,
    release: input.release,
  };
  if (
    selected.cursor === undefined &&
    selected.manifest === undefined &&
    selected.release === undefined
  ) {
    return Option.some({
      cursor: null,
      expectedManifestHash: null,
      expectedReleaseId: null,
    });
  }
  return Schema.decodeUnknownOption(ArticlePageQuerySchema)(selected).pipe(
    Option.map((query) => ({
      cursor: query.cursor,
      expectedManifestHash: query.manifest,
      expectedReleaseId: query.release,
    }))
  );
}
/** Restarts unsupported article pagination at the current publication head. */
export function shouldResetArticlePublicationCursor(page: ArticlePageCursor) {
  return (
    page.cursor !== null && !hasArticlePublicationCursorPrefix(page.cursor)
  );
}
/** Builds the next release-bound catalog URL when another page exists. */
/** The continuation of one article catalog page: its cursor and the release that issued it. */
interface ArticleNextSearch {
  readonly cursor: string;
  readonly manifest: string;
  readonly release: string;
}

export function getArticleNextSearch(
  page: ArticleNextPage
): Option.Option<ArticleNextSearch> {
  if (
    page.nextCursor === null ||
    page.activeManifestHash === null ||
    page.activeReleaseId === null
  ) {
    return Option.none();
  }
  return Option.some({
    cursor: page.nextCursor,
    manifest: page.activeManifestHash,
    release: page.activeReleaseId,
  });
}
