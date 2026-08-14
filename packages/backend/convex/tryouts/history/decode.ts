import {
  decodeStoredTryoutRow,
  type StoredTryoutRow,
  verifyStoredTryoutInventory,
} from "@nakafa/aksara-history/history/decode";
import {
  historyIntegrity,
  type RetainedTryoutHistoryPlan,
} from "@repo/backend/convex/tryouts/history/spec";
import { Effect, Schema } from "effect";

const TryoutSnapshotEnvelopeSchema = Schema.Struct({
  family: Schema.Literal("tryout"),
  manifest: Schema.Unknown,
});

/** Parses retained JSON without allowing a thrown parser defect. */
const parseHistoryJson = Effect.fn("tryouts.history.parseHistoryJson")(
  (source: string, subject: string) =>
    Effect.try({
      catch: () => historyIntegrity(`${subject} is not valid JSON.`),
      try: (): unknown => JSON.parse(source),
    })
);

/** Authenticates one exact historical Aksara try-out row. */
export const decodeHistoryRowJson = Effect.fn(
  "tryouts.history.decodeHistoryRowJson"
)((source: string, identity: string) =>
  parseHistoryJson(source, `History row ${identity}`).pipe(
    Effect.flatMap(decodeStoredTryoutRow),
    Effect.mapError(() =>
      historyIntegrity(`History row ${identity} failed authentication.`)
    )
  )
);

/** Authenticates every ordered history row and both aggregate snapshot digests. */
export const decodeHistoryInventory = Effect.fn(
  "tryouts.history.decodeHistoryInventory"
)(function* (
  snapshotJson: string,
  catalogJson: readonly string[],
  placementJson: readonly string[],
  plan: RetainedTryoutHistoryPlan
) {
  const snapshotEnvelope = yield* parseHistoryJson(
    snapshotJson,
    `Retained snapshot ${plan.snapshotId}`
  ).pipe(
    Effect.flatMap(
      Schema.decodeUnknown(TryoutSnapshotEnvelopeSchema, {
        onExcessProperty: "error",
      })
    ),
    Effect.mapError(() =>
      historyIntegrity(
        `Retained snapshot ${plan.snapshotId} failed envelope decoding.`
      )
    )
  );
  const [catalog, placements] = yield* Effect.all([
    Effect.forEach(catalogJson, (source, index) =>
      parseHistoryJson(source, `Catalog history row ${index}`)
    ),
    Effect.forEach(placementJson, (source, index) =>
      parseHistoryJson(source, `Placement history row ${index}`)
    ),
  ]);

  return yield* verifyStoredTryoutInventory({
    catalog,
    expectedSnapshotId: plan.snapshotId,
    placements,
    snapshot: snapshotEnvelope.manifest,
  }).pipe(
    Effect.mapError(() =>
      historyIntegrity(
        `Retained snapshot ${plan.snapshotId} failed aggregate authentication.`
      )
    )
  );
});

export type HistoricalTryoutRow = StoredTryoutRow;
