import { snapshotArticleLayer } from "@repo/backend/content/article/snapshot";
import { snapshotMaterialLayer } from "@repo/backend/content/material/snapshot";
import { snapshotProgramLayer } from "@repo/backend/content/program/snapshot";
import { snapshotPublicationLayer } from "@repo/backend/content/publication/snapshot";
import { snapshotQuranLayer } from "@repo/backend/content/quran/snapshot";
import { contentSnapshotError } from "@repo/backend/content/snapshot/error";
import {
  decodeServingDescriptor,
  decodeServingSnapshot,
} from "@repo/backend/content/snapshot/file";
import type { SnapshotIdentity } from "@repo/backend/content/snapshot/spec";
import { snapshotTryoutLayer } from "@repo/backend/content/tryout/snapshot";
import { type Context, Effect, Layer } from "effect";

/** Authenticates one immutable generation and constructs its bounded read indexes. */
export const createSnapshotContext = Effect.fn("snapshot.createContext")(
  function* (descriptor: string, data: string, expected: SnapshotIdentity) {
    const identity = yield* decodeServingDescriptor(descriptor);
    if (
      identity.runtimeSelectionHash !== expected.runtimeSelectionHash ||
      identity.runtimeSchemaFingerprint !== expected.runtimeSchemaFingerprint
    ) {
      return yield* contentSnapshotError(
        "The private snapshot differs from the selected build generation."
      );
    }
    const tables = yield* decodeServingSnapshot(data, identity);
    return yield* Layer.build(
      Layer.mergeAll(
        snapshotPublicationLayer(tables),
        snapshotArticleLayer(tables),
        snapshotMaterialLayer(tables),
        snapshotProgramLayer(tables),
        snapshotQuranLayer(tables),
        snapshotTryoutLayer(tables)
      )
    ).pipe(Effect.scoped);
  }
);

export type SnapshotContext = Effect.Success<
  ReturnType<typeof createSnapshotContext>
>;
export type ContentSources =
  SnapshotContext extends Context.Context<infer Services> ? Services : never;
