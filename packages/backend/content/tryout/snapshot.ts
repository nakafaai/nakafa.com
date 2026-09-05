import { compareCodeUnits } from "@nakafa/aksara-contracts/text/order";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import { TryoutSource } from "@repo/backend/content/tryout/source";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect, Layer, Option } from "effect";

type CatalogRow = PublicationRow<"tryoutCatalog">;
type PlacementRow = PublicationRow<"tryoutPlacements">;
type BundleRow = PublicationRow<"tryoutRuntimeBundles">;

const registerIdentity = Effect.fn("tryout.snapshot.registerIdentity")(
  function* <Row>(index: Map<string, Row>, key: string, row: Row) {
    if (index.has(key)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Signed try-out snapshot has duplicate immutable identities."
      );
    }
    index.set(key, row);
  }
);

/** Builds bounded hierarchy indexes once for an authenticated serving snapshot. */
export const snapshotTryoutLayer = (tables: {
  readonly tryoutCatalog: readonly CatalogRow[];
  readonly tryoutPlacements: readonly PlacementRow[];
  readonly tryoutRuntimeBundles: readonly BundleRow[];
}) =>
  Layer.effect(
    TryoutSource,
    Effect.gen(function* () {
      const identities = new Map<string, CatalogRow>();
      const paths = new Map<string, CatalogRow>();
      const catalogs = new Map<string, CatalogRow[]>();
      const sections = new Map<string, CatalogRow[]>();
      const assets = new Map<string, CatalogRow[]>();
      for (const row of tables.tryoutCatalog) {
        yield* registerIdentity(
          identities,
          JSON.stringify([row.snapshotId, row.identity]),
          row
        );
        if (row.publicPath !== undefined) {
          yield* registerIdentity(
            paths,
            JSON.stringify([row.snapshotId, row.appLocale, row.publicPath]),
            row
          );
        }
        const catalogKey = JSON.stringify([row.snapshotId, row.appLocale]);
        const catalog = catalogs.get(catalogKey) ?? [];
        catalog.push(row);
        catalogs.set(catalogKey, catalog);
        const assetKey = JSON.stringify([
          row.snapshotId,
          row.appLocale,
          row.assetId,
        ]);
        const asset = assets.get(assetKey) ?? [];
        asset.push(row);
        assets.set(assetKey, asset);
        if (row.kind === "section") {
          const key = JSON.stringify([row.snapshotId, row.setIdentity]);
          const group = sections.get(key) ?? [];
          group.push(row);
          sections.set(key, group);
        }
      }
      for (const catalog of catalogs.values()) {
        catalog.sort(
          (a, b) =>
            compareCodeUnits(a.publicPath ?? "", b.publicPath ?? "") ||
            compareCodeUnits(a.identity, b.identity)
        );
      }
      for (const group of sections.values()) {
        group.sort((a, b) => a.order - b.order);
      }
      const placements = new Map<string, PlacementRow[]>();
      const questions = new Map<string, PlacementRow>();
      const answers = new Map<string, PlacementRow>();
      const placementIdentities = new Set<string>();
      for (const row of tables.tryoutPlacements) {
        const identity = JSON.stringify([row.snapshotId, row.identity]);
        if (placementIdentities.has(identity)) {
          return yield* releaseFail(
            "CONTENT_RELEASE_INTEGRITY",
            "Signed try-out snapshot has duplicate placements."
          );
        }
        placementIdentities.add(identity);
        const key = JSON.stringify([
          row.snapshotId,
          row.appLocale,
          row.countryKey,
          row.examKey,
          row.trackKey,
          row.setKey,
          row.sectionKey,
        ]);
        const group = placements.get(key) ?? [];
        group.push(row);
        placements.set(key, group);
        const questionKey = JSON.stringify([
          row.snapshotId,
          row.questionArtifactHash,
        ]);
        const answerKey = JSON.stringify([
          row.snapshotId,
          row.answerArtifactHash,
        ]);
        if (!questions.has(questionKey)) {
          questions.set(questionKey, row);
        }
        if (!answers.has(answerKey)) {
          answers.set(answerKey, row);
        }
      }
      for (const group of placements.values()) {
        group.sort((a, b) => a.questionOrder - b.questionOrder);
      }
      const bundles = new Map<string, BundleRow>();
      for (const row of tables.tryoutRuntimeBundles) {
        yield* registerIdentity(bundles, row.bundleHash, row);
      }
      return TryoutSource.of({
        catalog: Effect.fn("tryout.snapshot.catalog")(
          (snapshotId, appLocale, limit) =>
            Effect.sync(() =>
              (
                catalogs.get(JSON.stringify([snapshotId, appLocale])) ?? []
              ).slice(0, limit)
            )
        ),
        identity: Effect.fn("tryout.snapshot.identity")(
          (snapshotId, identity) =>
            Effect.sync(() =>
              Option.fromUndefinedOr(
                identities.get(JSON.stringify([snapshotId, identity]))
              )
            )
        ),
        path: Effect.fn("tryout.snapshot.path")(
          (snapshotId, appLocale, publicPath) =>
            Effect.sync(() =>
              Option.fromUndefinedOr(
                paths.get(JSON.stringify([snapshotId, appLocale, publicPath]))
              )
            )
        ),
        asset: Effect.fn("tryout.snapshot.asset")(
          (snapshotId, appLocale, assetId, limit) =>
            Effect.sync(() =>
              (
                assets.get(JSON.stringify([snapshotId, appLocale, assetId])) ??
                []
              ).slice(0, limit)
            )
        ),
        sections: Effect.fn("tryout.snapshot.sections")(
          (snapshotId, setIdentity, limit) =>
            Effect.sync(() =>
              (
                sections.get(JSON.stringify([snapshotId, setIdentity])) ?? []
              ).slice(0, limit)
            )
        ),
        placements: Effect.fn("tryout.snapshot.placements")(
          (snapshotId, section, limit) =>
            Effect.sync(() =>
              (
                placements.get(
                  JSON.stringify([
                    snapshotId,
                    section.appLocale,
                    section.countryKey,
                    section.examKey,
                    section.trackKey,
                    section.setKey,
                    section.sectionKey,
                  ])
                ) ?? []
              ).slice(0, limit)
            )
        ),
        body: Effect.fn("tryout.snapshot.body")((snapshotId, selector) =>
          Effect.sync(() =>
            Option.fromUndefinedOr(
              (selector.delivery === "authenticated" ? questions : answers).get(
                JSON.stringify([snapshotId, selector.artifactHash])
              )
            )
          )
        ),
        bundle: Effect.fn("tryout.snapshot.bundle")((bundleHash) =>
          Effect.sync(() => Option.fromUndefinedOr(bundles.get(bundleHash)))
        ),
      });
    })
  );
