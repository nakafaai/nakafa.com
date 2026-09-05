import type { PublicationRow } from "@repo/backend/content/publication/source";
import type { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import type { PaginationOptions, PaginationResult } from "convex/server";
import { Context, type Effect, type Option } from "effect";

type ProgramRow = PublicationRow<"programCatalog">;
type RouteRow = PublicationRow<"curriculumRoutes">;
type BucketRow = PublicationRow<"programBuckets">;
type AppLocale = RouteRow["appLocale"];

/** Immutable program identities and bounded ordered curriculum relationships. */
export class ProgramSource extends Context.Service<
  ProgramSource,
  {
    readonly program: (
      snapshotId: string,
      programKey: string
    ) => Effect.Effect<Option.Option<ProgramRow>, ReleaseError>;
    readonly programs: (
      snapshotId: string,
      limit: number
    ) => Effect.Effect<readonly ProgramRow[], ReleaseError>;
    readonly route: (
      snapshotId: string,
      appLocale: AppLocale,
      publicPath: string
    ) => Effect.Effect<Option.Option<RouteRow>, ReleaseError>;
    readonly node: (
      snapshotId: string,
      appLocale: AppLocale,
      programKey: string,
      nodeKey: string
    ) => Effect.Effect<Option.Option<RouteRow>, ReleaseError>;
    readonly related: (
      snapshotId: string,
      appLocale: AppLocale,
      relation: "children" | "contexts",
      publicPath: string | undefined,
      limit: number
    ) => Effect.Effect<readonly RouteRow[], ReleaseError>;
    readonly page: (
      snapshotId: string,
      appLocale: AppLocale,
      options: PaginationOptions
    ) => Effect.Effect<PaginationResult<RouteRow>, ReleaseError>;
    readonly partition: (
      snapshotId: string,
      appLocale: AppLocale,
      bucket: string,
      limit: number
    ) => Effect.Effect<
      {
        readonly count: Option.Option<BucketRow>;
        readonly routes: readonly RouteRow[];
      },
      ReleaseError
    >;
    readonly buckets: (
      snapshotId: string,
      appLocale: AppLocale,
      limit: number
    ) => Effect.Effect<readonly BucketRow[], ReleaseError>;
  }
>()("content/ProgramSource") {}
