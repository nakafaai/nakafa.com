import { createHash } from "node:crypto";
import { createPortableTable } from "@repo/backend/content/snapshot/codec";
import { contentSnapshotError } from "@repo/backend/content/snapshot/error";
import { JsonObjectSchema } from "@repo/backend/content/snapshot/json";
import { projectActiveRuntime } from "@repo/backend/content/snapshot/projection";
import {
  buildRuntimeGenerations,
  verifyRuntimeSelection,
} from "@repo/backend/content/snapshot/selection";
import type { SnapshotIdentity } from "@repo/backend/content/snapshot/spec";
import {
  CONTENT_SERVING_DATA_FILE,
  SnapshotHashSchema,
  SnapshotMetadataSchema,
} from "@repo/backend/content/snapshot/spec";
import {
  CONTENT_RUNTIME_TABLES,
  type RuntimeTables,
  readContentRuntimeSchemaFingerprint,
} from "@repo/backend/content/snapshot/tables";
import { Effect, Schema } from "effect";

const ServingSnapshotDescriptorSchema = Schema.Struct({
  ...SnapshotMetadataSchema.fields,
  dataSha256: SnapshotHashSchema,
  dataFile: Schema.Literal(CONTENT_SERVING_DATA_FILE),
});
export type ServingSnapshotDescriptor =
  typeof ServingSnapshotDescriptorSchema.Type;

const ServingTablesSchema = Schema.Record(
  Schema.Literals(CONTENT_RUNTIME_TABLES),
  Schema.Array(JsonObjectSchema)
);

/** Produces a small descriptor and immutable data after archive authentication. */
export const encodeServingSnapshot = Effect.fn("snapshot.encodeServingFile")(
  function* (tables: RuntimeTables, identity: SnapshotIdentity) {
    const metadata = yield* Schema.decodeEffect(SnapshotMetadataSchema)(
      identity
    ).pipe(
      Effect.mapError(() =>
        contentSnapshotError("Serving snapshot metadata is invalid.")
      )
    );
    yield* verifyRuntimeSelection(
      metadata,
      yield* buildRuntimeGenerations(tables.contentState)
    );
    const data = JSON.stringify(tables);
    const descriptor = JSON.stringify({
      ...metadata,
      dataSha256: createHash("sha256").update(data).digest("hex"),
      dataFile: CONTENT_SERVING_DATA_FILE,
    } satisfies ServingSnapshotDescriptor);
    return { data, descriptor };
  }
);

/** Decodes the exact descriptor while rejecting alternate data paths. */
export const decodeServingDescriptor = Effect.fn(
  "snapshot.decodeServingDescriptor"
)((text: string) =>
  Schema.decodeEffect(Schema.fromJsonString(ServingSnapshotDescriptorSchema))(
    text,
    { onExcessProperty: "error" }
  ).pipe(
    Effect.mapError(() =>
      contentSnapshotError("Serving snapshot descriptor is invalid.")
    )
  )
);

/** Authenticates immutable worker data against its descriptor and this code's schema. */
export const decodeServingSnapshot = Effect.fn("snapshot.decodeServingData")(
  function* (data: string, descriptor: ServingSnapshotDescriptor) {
    if (
      createHash("sha256").update(data).digest("hex") !== descriptor.dataSha256
    ) {
      return yield* contentSnapshotError(
        "Serving snapshot data failed its descriptor integrity check."
      );
    }
    if (
      (yield* readContentRuntimeSchemaFingerprint()) !==
      descriptor.runtimeSchemaFingerprint
    ) {
      return yield* contentSnapshotError(
        "Serving snapshot data uses a different runtime schema."
      );
    }
    const source = yield* Schema.decodeEffect(
      Schema.fromJsonString(ServingTablesSchema)
    )(data, { onExcessProperty: "error" }).pipe(
      Effect.mapError(() =>
        contentSnapshotError(
          "Serving snapshot data does not satisfy its table contract."
        )
      )
    );
    const tables = yield* projectActiveRuntime(
      new Map(CONTENT_RUNTIME_TABLES.map((table) => [table, source[table]]))
    );
    yield* verifyRuntimeSelection(
      descriptor,
      yield* buildRuntimeGenerations(tables.contentState)
    );
    for (const table of CONTENT_RUNTIME_TABLES) {
      const original = createPortableTable(table, source[table]).entry;
      const projected = createPortableTable(table, tables[table]).entry;
      if (
        original.rowCount !== projected.rowCount ||
        original.sha256 !== projected.sha256
      ) {
        return yield* contentSnapshotError(
          "Serving snapshot data contains rows outside its selected generation."
        );
      }
    }
    return tables;
  }
);
