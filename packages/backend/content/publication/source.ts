import type {
  Doc,
  TableNames,
} from "@repo/backend/convex/_generated/dataModel";
import type { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import type { WithoutSystemFields } from "convex/server";
import { Context, type Effect, type Option } from "effect";

/** Immutable content values do not depend on a database-generated identity. */
export type PublicationRow<Table extends TableNames> = WithoutSystemFields<
  Doc<Table>
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
      artifactLocale: Doc<"contentHeads">["artifactLocale"],
      sequence: number
    ) => OptionalRow<"contentHeads">;
    readonly binding: (
      appLocale: Doc<"contentBindings">["appLocale"],
      publicPath: string,
      sequence: number
    ) => OptionalRow<"contentBindings">;
    readonly artifact: (
      artifactHash: string
    ) => OptionalRow<"contentArtifacts">;
    readonly snapshot: (
      family: Doc<"contentSnapshots">["family"],
      snapshotId: string
    ) => OptionalRow<"contentSnapshots">;
    readonly pageKeys: (
      appLocale: Doc<"contentKeys">["artifactLocale"],
      sequence: number,
      limit: number
    ) => Effect.Effect<readonly PublicationRow<"contentKeys">[], ReleaseError>;
  }
>()("content/PublicationSource") {}
