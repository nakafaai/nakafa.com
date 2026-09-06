import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import type { ModelSlot } from "@repo/backend/convex/contentRelease/models/slot";
import {
  MODEL_BUILD_PAGE_BYTES,
  MODEL_BUILD_PAGE_ROWS,
  type ModelBuildPage,
} from "@repo/backend/convex/contentRelease/models/spec";
import { compareValues } from "convex/values";
import { mergedStream, type QueryStream } from "convex-helpers/server/stream";
import { Effect, Schema } from "effect";

const PositionSchema = Schema.Tuple([Schema.String, Schema.String]);
const CursorSchema = Schema.fromJsonString(
  Schema.Struct({
    phase: Schema.String,
    position: PositionSchema,
    version: Schema.Literal(1),
  })
);

type ModelRow = Doc<
  | "articleCatalog"
  | "articleCategories"
  | "articleBuckets"
  | "materialCatalog"
  | "materialBuckets"
  | "contentIndex"
>;

interface ModelReconciliation<Row extends ModelRow> {
  readonly build: Pick<Doc<"contentModelBuilds">, "cursor" | "phase">;
  readonly indexFields: readonly [string, string];
  readonly insert: (source: Row) => Effect.Effect<void>;
  readonly position: (row: Row) => typeof PositionSchema.Type;
  readonly remove: (target: Row) => Effect.Effect<void>;
  readonly replace: (target: Row, source: Row) => Effect.Effect<void>;
  readonly source: QueryStream<Row>;
  readonly sourceSlot: ModelSlot;
  readonly target: QueryStream<Row>;
  readonly targetSlot: ModelSlot;
}

/** Removes slot and native document identity before comparing model values. */
function modelValues(row: ModelRow) {
  const { _creationTime, _id, slot, ...fields } = row;
  return fields;
}

const decodeCursor = Effect.fn("contentRelease.decodeModelCursor")(function* (
  build: ModelReconciliation<ModelRow>["build"]
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
    input: ModelReconciliation<Row>,
    source: Row | undefined,
    target: Row | undefined,
    row: Row
  ) {
    if (row.slot === input.sourceSlot && source === undefined) {
      return { source: row, target };
    }
    if (row.slot === input.targetSlot && target === undefined) {
      return { source, target: row };
    }
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Model phase ${input.build.phase} has duplicate identity ${input.position(row).join("/")}.`
    );
  }
);

/** Reconciles one complete identity without rewriting unchanged native rows. */
const reconcileIdentity = Effect.fn("contentRelease.reconcileModelIdentity")(
  function* <Row extends ModelRow>(
    input: ModelReconciliation<Row>,
    source: Row | undefined,
    target: Row | undefined
  ) {
    if (source && target) {
      if (compareValues(modelValues(source), modelValues(target)) !== 0) {
        yield* input.replace(target, source);
      }
      return;
    }
    if (source) {
      return yield* input.insert(source);
    }
    if (target) {
      return yield* input.remove(target);
    }
  }
);

/** Merges native slot indexes and checkpoints only complete identity groups. */
export const reconcileModel = Effect.fn("contentRelease.reconcileModel")(
  function* <Row extends ModelRow>(input: ModelReconciliation<Row>) {
    const { build } = input;
    const cursor = yield* decodeCursor(build);
    const rows = mergedStream(
      [input.source, input.target],
      [...input.indexFields]
    ).narrow({
      lowerBound: cursor ? [...cursor.position] : [],
      lowerBoundInclusive: false,
      upperBound: [],
      upperBoundInclusive: true,
    });
    const iterator = rows.iterWithKeys(true)[Symbol.asyncIterator]();
    let position: typeof PositionSchema.Type | undefined;
    let source: Row | undefined;
    let target: Row | undefined;
    let processed = 0;
    let bytes = 0;
    let scanned = 0;
    while (true) {
      const next = yield* Effect.promise(() => iterator.next());
      if (next.done) {
        yield* reconcileIdentity(input, source, target);
        return {
          done: true,
          processed: processed + (position ? 1 : 0),
        } satisfies ModelBuildPage;
      }
      const [row, , bandwidth] = next.value;
      bytes += bandwidth;
      if (!row) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Model phase ${build.phase} lost an indexed reconciliation row.`
        );
      }
      const key = input.position(row);
      if (position && (position[0] !== key[0] || position[1] !== key[1])) {
        yield* reconcileIdentity(input, source, target);
        processed += 1;
        if (
          bytes >= MODEL_BUILD_PAGE_BYTES ||
          scanned >= MODEL_BUILD_PAGE_ROWS
        ) {
          return {
            cursor: JSON.stringify({
              phase: build.phase,
              position,
              version: 1,
            }),
            done: false,
            processed,
          } satisfies ModelBuildPage;
        }
        source = undefined;
        target = undefined;
      }
      position = key;
      scanned += 1;
      const identity = yield* appendIdentity(input, source, target, row);
      source = identity.source;
      target = identity.target;
    }
  }
);
