import {
  type Document,
  QueryStream,
  type QueryStreamKeyLabels,
  QueryStreamReadBudget,
} from "@confect/server";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import contentModelBuildsTable from "@repo/backend/confect/_generated/tables/contentModelBuilds";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/confect/contentRelease/error";
import { modelSlotValidator } from "@repo/backend/confect/contentRelease/models/slot";
import {
  MODEL_BUILD_PAGE_BYTES,
  MODEL_BUILD_PAGE_ROWS,
  type ModelBuildPage,
} from "@repo/backend/confect/contentRelease/models/spec";
import { compareValues } from "convex/values";
import { Array as Arr, Effect, Option, Schema, Stream, Struct } from "effect";

const PositionSchema = Schema.Tuple([Schema.String, Schema.String]);
export const CursorSchema = Schema.fromJsonString(
  Schema.Struct({
    phase: Schema.String,
    position: PositionSchema,
    version: Schema.Literal(1),
  })
);
/** Writes the cursor as plain JSON text; CursorSchema remains its decoding contract. */
const JsonTextSchema = Schema.fromJsonString(Schema.Unknown);
type ModelRow = Docs[
  | "articleCatalog"
  | "articleCategories"
  | "articleBuckets"
  | "materialCatalog"
  | "materialBuckets"
  | "contentIndex"];
const ModelReconciliationSchema = Schema.Struct({
  build: contentModelBuildsTable.Fields.mapFields(
    Struct.pick(["cursor", "phase"])
  ),
  sourceSlot: modelSlotValidator,
  targetSlot: modelSlotValidator,
});
type ModelReconciliationInput = typeof ModelReconciliationSchema.Type;
type ModelStream<
  Row extends ModelRow,
  Labels extends QueryStreamKeyLabels.QueryStreamKeyLabels,
> = QueryStream.QueryStream<Row, Labels, "asc", Document.DocumentDecodeError>;
type ModelPosition<Row extends ModelRow> = (
  row: Row
) => typeof PositionSchema.Type;
type ModelInsert<Row extends ModelRow> = (source: Row) => Effect.Effect<void>;
type ModelReplace<Row extends ModelRow> = (
  target: Row,
  source: Row
) => Effect.Effect<void>;
type ModelRemove<Row extends ModelRow> = (target: Row) => Effect.Effect<void>;

/** Removes slot and native document identity before comparing model values. */
function modelValues(row: ModelRow) {
  const { _creationTime, _id, slot, ...fields } = row;
  return fields;
}
const decodeCursor = Effect.fn("contentRelease.decodeModelCursor")(function* (
  build: Pick<Docs["contentModelBuilds"], "cursor" | "phase">
) {
  if (build.cursor === undefined) {
    return;
  }
  const cursor = yield* Schema.decodeEffect(CursorSchema)(build.cursor).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: `Model phase ${build.phase} has an invalid reconciliation cursor.`,
        })
    )
  );
  if (cursor.phase !== build.phase) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Model phase ${build.phase} received a cursor for ${cursor.phase}.`
    );
  }
  return cursor;
});
const appendIdentity = Effect.fn("contentRelease.appendModelIdentity")(
  function* <Row extends ModelRow>(
    input: ModelReconciliationInput,
    positionOf: ModelPosition<Row>,
    source: Row | undefined,
    target: Row | undefined,
    row: Row
  ) {
    if (row.slot === input.sourceSlot && source === undefined) {
      return {
        source: row,
        target,
      };
    }
    if (row.slot === input.targetSlot && target === undefined) {
      return {
        source,
        target: row,
      };
    }
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Model phase ${input.build.phase} has duplicate identity ${Arr.join(positionOf(row), "/")}.`
    );
  }
);

/** Reconciles one complete identity without rewriting unchanged native rows. */
const reconcileIdentity = Effect.fn("contentRelease.reconcileModelIdentity")(
  function* <Row extends ModelRow>(
    insert: ModelInsert<Row>,
    replace: ModelReplace<Row>,
    remove: ModelRemove<Row>,
    source: Row | undefined,
    target: Row | undefined
  ) {
    if (source && target) {
      if (compareValues(modelValues(source), modelValues(target)) !== 0) {
        yield* replace(target, source);
      }
      return;
    }
    if (source) {
      return yield* insert(source);
    }
    if (target) {
      return yield* remove(target);
    }
  }
);

/** Merges native slot indexes and checkpoints only complete identity groups. */
export const reconcileModel = Effect.fn("contentRelease.reconcileModel")(
  function* <
    Row extends ModelRow,
    Labels extends QueryStreamKeyLabels.QueryStreamKeyLabels,
  >(
    input: ModelReconciliationInput,
    sourceStream: ModelStream<Row, Labels>,
    targetStream: ModelStream<Row, Labels>,
    positionOf: ModelPosition<Row>,
    insert: ModelInsert<Row>,
    replace: ModelReplace<Row>,
    remove: ModelRemove<Row>
  ) {
    const { build } = input;
    const cursor = yield* decodeCursor(build);
    const merged = QueryStream.merge([sourceStream, targetStream]);
    const rows = cursor
      ? QueryStream.narrow(merged, {
          start: {
            keyValues: cursor.position,
            inclusive: false,
          },
        })
      : merged;
    // Consume complete identities before stopping. The two merge inputs can
    // each hold one lookahead row, so the physical budget counts both inputs.
    const budget = yield* QueryStreamReadBudget.make({
      maximumRowsRead: Option.none(),
      maximumBytesRead: Option.none(),
    });
    let position: typeof PositionSchema.Type | undefined;
    let source: Row | undefined;
    let target: Row | undefined;
    let processed = 0;
    let scanned = 0;
    let stopped = false;
    yield* rows.annotated.pipe(
      Stream.runForEachWhile(
        Effect.fn("contentRelease.consumeModelRow")(function* (entry) {
          // Callers provide direct indexed streams without filtering rows.
          const row = yield* Effect.fromNullishOr(
            Option.getOrUndefined(entry.doc)
          ).pipe(Effect.orDie);
          const key = positionOf(row);
          if (position && (position[0] !== key[0] || position[1] !== key[1])) {
            yield* reconcileIdentity(insert, replace, remove, source, target);
            processed += 1;
            const counts = yield* budget.getReadCounts;
            if (
              counts.bytesRead >= MODEL_BUILD_PAGE_BYTES ||
              scanned >= MODEL_BUILD_PAGE_ROWS
            ) {
              stopped = true;
              return false;
            }
            source = undefined;
            target = undefined;
          }
          position = key;
          scanned += 1;
          const identity = yield* appendIdentity(
            input,
            positionOf,
            source,
            target,
            row
          );
          source = identity.source;
          target = identity.target;
          return true;
        })
      ),
      Effect.provideService(
        QueryStreamReadBudget.QueryStreamReadBudget,
        budget
      ),
      Effect.catchTag("DocumentDecodeError", () =>
        releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Model phase ${build.phase} contains an invalid stored row.`
        )
      )
    );
    if (stopped) {
      const cursorText = yield* Schema.encodeEffect(JsonTextSchema)({
        phase: build.phase,
        position,
        version: 1,
      }).pipe(Effect.orDie);
      return {
        cursor: cursorText,
        done: false,
        processed,
      } satisfies ModelBuildPage;
    }
    yield* reconcileIdentity(insert, replace, remove, source, target);
    return {
      done: true,
      processed: processed + (position ? 1 : 0),
    } satisfies ModelBuildPage;
  }
);
