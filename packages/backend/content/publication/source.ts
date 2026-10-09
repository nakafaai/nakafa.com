import type { Docs } from "@repo/backend/confect/_generated/docs";
import type { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import type { TableNames } from "@repo/backend/convex/_generated/dataModel";
import type { SystemFields } from "convex/server";
import { Context, type Effect, type Option } from "effect";

/** Immutable content values do not depend on a database-generated identity. */
export type PublicationRow<Table extends TableNames> = Omit<
  Docs[Table],
  keyof SystemFields | "_id"
>;
type OptionalRow<Table extends TableNames> = Effect.Effect<
  Option.Option<PublicationRow<Table>>,
  ReleaseError
>;

/** Indexed publication storage selected within one consistent read transaction. */
export class PublicationSource extends Context.Service<
  PublicationSource,
  {
    readonly state: OptionalRow<"contentState">;
    readonly release: (
      releaseId: string
    ) => Effect.Effect<PublicationRow<"contentReleases">, ReleaseError>;
    readonly version: (
      contentKey: string,
      artifactLocale: Docs["contentHeads"]["artifactLocale"],
      sequence: number
    ) => OptionalRow<"contentHeads">;
    readonly binding: (
      appLocale: Docs["contentBindings"]["appLocale"],
      publicPath: string,
      sequence: number
    ) => OptionalRow<"contentBindings">;
    readonly artifact: (
      artifactHash: string
    ) => OptionalRow<"contentArtifacts">;
    readonly snapshot: (
      family: Docs["contentSnapshots"]["family"],
      snapshotId: string
    ) => OptionalRow<"contentSnapshots">;
    readonly pageKeys: (
      appLocale: Docs["contentKeys"]["artifactLocale"],
      sequence: number,
      limit: number
    ) => Effect.Effect<readonly PublicationRow<"contentKeys">[], ReleaseError>;
  }
>()("@repo/backend/content/publication/source/PublicationSource") {}
