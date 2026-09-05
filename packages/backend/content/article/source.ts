import type { PublicationRow } from "@repo/backend/content/publication/source";
import type { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import type { validatePublicationPage } from "@repo/backend/convex/contentRelease/paging";
import type { PaginationOptions, PaginationResult } from "convex/server";
import { Context, type Effect, type Option } from "effect";

type ArticleRow = PublicationRow<"articleCatalog">;
type CategoryRow = PublicationRow<"articleCategories">;
type BucketRow = PublicationRow<"articleBuckets">;
type Slot = ArticleRow["slot"];
type AppLocale = ArticleRow["appLocale"];
type PublicationOptions = Effect.Success<
  ReturnType<typeof validatePublicationPage>
>;

/** Authenticated article identities, publication order, and bounded catalog reads. */
export class ArticleSource extends Context.Service<
  ArticleSource,
  {
    readonly article: (
      slot: Slot,
      contentKey: string,
      appLocale: AppLocale
    ) => Effect.Effect<Option.Option<ArticleRow>, ReleaseError>;
    readonly byPublicPath: (
      slot: Slot,
      appLocale: AppLocale,
      publicPath: string
    ) => Effect.Effect<readonly ArticleRow[], ReleaseError>;
    readonly byAssetId: (
      slot: Slot,
      appLocale: AppLocale,
      assetId: string
    ) => Effect.Effect<readonly ArticleRow[], ReleaseError>;
    readonly ordered: (
      slot: Slot,
      appLocale: AppLocale,
      category: string | null,
      limit: number
    ) => Effect.Effect<readonly ArticleRow[], ReleaseError>;
    readonly publications: (
      slot: Slot,
      appLocale: AppLocale,
      category: string,
      options: PublicationOptions
    ) => Effect.Effect<PaginationResult<ArticleRow>, ReleaseError>;
    readonly categories: (
      slot: Slot,
      appLocale: AppLocale,
      options: PaginationOptions
    ) => Effect.Effect<PaginationResult<CategoryRow>, ReleaseError>;
    readonly partition: (
      slot: Slot,
      appLocale: AppLocale,
      bucket: string,
      limit: number
    ) => Effect.Effect<
      {
        readonly count: Option.Option<BucketRow>;
        readonly articles: readonly ArticleRow[];
        readonly categories: readonly CategoryRow[];
      },
      ReleaseError
    >;
    readonly buckets: (
      slot: Slot,
      appLocale: AppLocale,
      limit: number
    ) => Effect.Effect<readonly BucketRow[], ReleaseError>;
  }
>()("content/ArticleSource") {}
