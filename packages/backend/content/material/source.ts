import type { PublicationRow } from "@repo/backend/content/publication/source";
import type { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import type { PaginationOptions, PaginationResult } from "convex/server";
import { Context, type Effect, type Option } from "effect";

type MaterialRow = PublicationRow<"materialCatalog">;
type BucketRow = PublicationRow<"materialBuckets">;
type Slot = MaterialRow["slot"];
type AppLocale = MaterialRow["appLocale"];

/** Exact material identities, ordered lesson groups, and bounded discovery reads. */
export class MaterialSource extends Context.Service<
  MaterialSource,
  {
    readonly material: (
      slot: Slot,
      contentKey: string,
      appLocale: AppLocale
    ) => Effect.Effect<Option.Option<MaterialRow>, ReleaseError>;
    readonly siblings: (
      slot: Slot,
      appLocale: AppLocale,
      materialKey: string,
      limit: number
    ) => Effect.Effect<readonly MaterialRow[], ReleaseError>;
    readonly byPublicPath: (
      slot: Slot,
      appLocale: AppLocale,
      publicPath: string
    ) => Effect.Effect<readonly MaterialRow[], ReleaseError>;
    readonly byAssetId: (
      slot: Slot,
      appLocale: AppLocale,
      assetId: string
    ) => Effect.Effect<readonly MaterialRow[], ReleaseError>;
    readonly topicByPublicPath: (
      slot: Slot,
      appLocale: AppLocale,
      publicPath: string
    ) => Effect.Effect<Option.Option<MaterialRow>, ReleaseError>;
    readonly topicByAssetId: (
      slot: Slot,
      appLocale: AppLocale,
      assetId: string
    ) => Effect.Effect<Option.Option<MaterialRow>, ReleaseError>;
    readonly latest: (
      slot: Slot,
      appLocale: AppLocale,
      limit: number
    ) => Effect.Effect<readonly MaterialRow[], ReleaseError>;
    readonly page: (
      slot: Slot,
      appLocale: AppLocale,
      options: PaginationOptions
    ) => Effect.Effect<PaginationResult<MaterialRow>, ReleaseError>;
    readonly partition: (
      slot: Slot,
      appLocale: AppLocale,
      bucket: string,
      limit: number
    ) => Effect.Effect<
      {
        readonly count: Option.Option<BucketRow>;
        readonly materials: readonly MaterialRow[];
      },
      ReleaseError
    >;
    readonly buckets: (
      slot: Slot,
      appLocale: AppLocale,
      limit: number
    ) => Effect.Effect<readonly BucketRow[], ReleaseError>;
  }
>()("content/MaterialSource") {}
