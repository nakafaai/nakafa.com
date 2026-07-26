import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { Option, Schema } from "effect";
import type { ArticlePageCursor } from "@/lib/content/article/catalog";

const CursorSchema = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(4096)
);
const ArticlePageQuerySchema = Schema.Struct({
  cursor: CursorSchema,
  manifest: Sha256HashSchema,
  release: ReleaseIdSchema,
});

/** Raw Next.js query values accepted by article catalog pages. */
export interface ArticlePageQuery {
  readonly [key: string]: string | string[] | undefined;
}

/** Minimal active page identity used to build one continuation URL. */
export interface ArticleNextPage {
  readonly activeManifestHash: null | string;
  readonly activeReleaseId: null | string;
  readonly nextCursor: null | string;
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

/** Builds the next release-bound catalog URL when another page exists. */
export function getArticleNextHref(path: string, page: ArticleNextPage) {
  if (
    page.nextCursor === null ||
    page.activeManifestHash === null ||
    page.activeReleaseId === null
  ) {
    return null;
  }

  const query = new URLSearchParams({
    cursor: page.nextCursor,
    manifest: page.activeManifestHash,
    release: page.activeReleaseId,
  });
  return `${path}?${query}`;
}
