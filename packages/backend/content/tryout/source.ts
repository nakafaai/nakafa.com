import type { ProtectedContentRuntimeSelector } from "@nakafa/aksara-contracts/runtime/protected/spec";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import type { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import { Context, type Effect, type Option } from "effect";

type CatalogRow = PublicationRow<"tryoutCatalog">;
type PlacementRow = PublicationRow<"tryoutPlacements">;
type SectionIdentity = Pick<
  PlacementRow,
  "appLocale" | "countryKey" | "examKey" | "trackKey" | "setKey" | "sectionKey"
>;
type Rows<Row> = Effect.Effect<readonly Row[], ReleaseError>;
type OptionalRow<Row> = Effect.Effect<Option.Option<Row>, ReleaseError>;

/** Bounded immutable hierarchy, placement, and runtime bundle reads. */
export class TryoutSource extends Context.Service<
  TryoutSource,
  {
    readonly catalog: (
      snapshotId: string,
      appLocale: CatalogRow["appLocale"],
      limit: number
    ) => Rows<CatalogRow>;
    readonly identity: (
      snapshotId: string,
      identity: string
    ) => OptionalRow<CatalogRow>;
    readonly path: (
      snapshotId: string,
      appLocale: CatalogRow["appLocale"],
      publicPath: string
    ) => OptionalRow<CatalogRow>;
    readonly asset: (
      snapshotId: string,
      appLocale: CatalogRow["appLocale"],
      assetId: string,
      limit: number
    ) => Rows<CatalogRow>;
    readonly sections: (
      snapshotId: string,
      setIdentity: string,
      limit: number
    ) => Rows<CatalogRow>;
    readonly placements: (
      snapshotId: string,
      section: SectionIdentity,
      limit: number
    ) => Rows<PlacementRow>;
    readonly body: (
      snapshotId: string,
      selector: ProtectedContentRuntimeSelector
    ) => OptionalRow<PlacementRow>;
    readonly bundle: (
      bundleHash: string
    ) => OptionalRow<PublicationRow<"tryoutRuntimeBundles">>;
  }
>()("content/TryoutSource") {}
