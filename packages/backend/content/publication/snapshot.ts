import { compareCodeUnits } from "@nakafa/aksara-contracts/text/order";
import {
  type PublicationRow,
  PublicationSource,
} from "@repo/backend/content/publication/source";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect, Layer, Option } from "effect";

type PublicationTable =
  | "contentState"
  | "contentReleases"
  | "contentHeads"
  | "contentBindings"
  | "contentArtifacts"
  | "contentSnapshots"
  | "contentKeys";
type PublicationSnapshot = {
  readonly [Table in PublicationTable]: readonly PublicationRow<Table>[];
};

/** Rejects duplicate immutable identities while constructing one worker's index. */
const indexRows = Effect.fn("publication.snapshot.indexRows")(function* <Row>(
  rows: readonly Row[],
  identity: (row: Row) => string
) {
  const index = new Map<string, Row>();
  for (const row of rows) {
    const key = identity(row);
    if (index.has(key)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Signed serving snapshot has duplicate publication identities."
      );
    }
    index.set(key, row);
  }
  return index;
});

/** Pins indexed content lookups to the single authenticated serving generation. */
export const snapshotPublicationLayer = (tables: PublicationSnapshot) =>
  Layer.effect(
    PublicationSource,
    Effect.gen(function* () {
      const [state] = tables.contentState;
      if (
        tables.contentState.length !== 1 ||
        !state?.activeReleaseId ||
        state.activeSequence === undefined
      ) {
        return yield* releaseFail(
          "CONTENT_RELEASE_STATE",
          "Signed serving snapshot has no selected active generation."
        );
      }
      const releases = yield* indexRows(
        tables.contentReleases,
        (row) => row.releaseId
      );
      const versions = yield* indexRows(tables.contentHeads, (row) =>
        JSON.stringify([row.contentKey, row.artifactLocale])
      );
      const bindings = yield* indexRows(tables.contentBindings, (row) =>
        JSON.stringify([row.appLocale, row.publicPath])
      );
      const artifacts = yield* indexRows(
        tables.contentArtifacts,
        (row) => row.artifactHash
      );
      const snapshots = yield* indexRows(tables.contentSnapshots, (row) =>
        JSON.stringify([row.family, row.snapshotId])
      );
      const keys = new Map<
        PublicationRow<"contentKeys">["artifactLocale"],
        PublicationRow<"contentKeys">[]
      >();
      for (const row of tables.contentKeys) {
        if (
          row.family !== "page" ||
          row.createdSequence > state.activeSequence
        ) {
          return yield* releaseFail(
            "CONTENT_RELEASE_INTEGRITY",
            "Signed serving snapshot contains an unselected page identity."
          );
        }
        const group = keys.get(row.artifactLocale) ?? [];
        group.push(row);
        keys.set(row.artifactLocale, group);
      }
      for (const group of keys.values()) {
        group.sort(
          (a, b) =>
            a.createdSequence - b.createdSequence ||
            compareCodeUnits(a.contentKey, b.contentKey)
        );
      }
      const requireSequence = Effect.fn("publication.snapshot.requireSequence")(
        function* (sequence: number) {
          if (sequence !== state.activeSequence) {
            return yield* releaseFail(
              "CONTENT_RELEASE_STATE",
              "Signed serving snapshot cannot read a different publication generation."
            );
          }
        }
      );
      return PublicationSource.of({
        state: Effect.succeed(Option.some(state)),
        release: Effect.fn("publication.snapshot.release")(
          function* (releaseId) {
            const release = releases.get(releaseId);
            if (!release) {
              return yield* releaseFail(
                "CONTENT_RELEASE_MISSING",
                `Content release ${releaseId} does not exist.`
              );
            }
            return release;
          }
        ),
        version: Effect.fn("publication.snapshot.version")(
          function* (contentKey, artifactLocale, sequence) {
            yield* requireSequence(sequence);
            const row = versions.get(
              JSON.stringify([contentKey, artifactLocale])
            );
            if (row && row.sequence > sequence) {
              return yield* releaseFail(
                "CONTENT_RELEASE_INTEGRITY",
                "Signed serving snapshot contains a future content version."
              );
            }
            return Option.fromUndefinedOr(row);
          }
        ),
        binding: Effect.fn("publication.snapshot.binding")(
          function* (appLocale, publicPath, sequence) {
            yield* requireSequence(sequence);
            const row = bindings.get(JSON.stringify([appLocale, publicPath]));
            if (row && row.sequence > sequence) {
              return yield* releaseFail(
                "CONTENT_RELEASE_INTEGRITY",
                "Signed serving snapshot contains a future route binding."
              );
            }
            return Option.fromUndefinedOr(row);
          }
        ),
        artifact: Effect.fn("publication.snapshot.artifact")((artifactHash) =>
          Effect.sync(() => Option.fromUndefinedOr(artifacts.get(artifactHash)))
        ),
        snapshot: Effect.fn("publication.snapshot.family")(
          (family, snapshotId) =>
            Effect.sync(() =>
              Option.fromUndefinedOr(
                snapshots.get(JSON.stringify([family, snapshotId]))
              )
            )
        ),
        pageKeys: Effect.fn("publication.snapshot.pageKeys")(
          function* (appLocale, sequence, limit) {
            yield* requireSequence(sequence);
            return (keys.get(appLocale) ?? []).slice(0, limit);
          }
        ),
      });
    })
  );
