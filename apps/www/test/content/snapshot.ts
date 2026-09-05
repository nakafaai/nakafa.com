import { createSnapshotContext } from "@repo/backend/content/snapshot/context";
import { encodeServingSnapshot } from "@repo/backend/content/snapshot/file";
import {
  projectActiveRuntime,
  type RuntimeSource,
} from "@repo/backend/content/snapshot/projection";
import { buildRuntimeGenerations } from "@repo/backend/content/snapshot/selection";
import { readContentRuntimeSchemaFingerprint } from "@repo/backend/content/snapshot/tables";
import { Effect } from "effect";

/** Authenticates real fixture rows through the same serving format as production workers. */
export const createTestSnapshotContext = Effect.fn(
  "TestContent.createSnapshotContext"
)(function* (source: RuntimeSource) {
  const tables = yield* projectActiveRuntime(source);
  const generation = yield* buildRuntimeGenerations(tables.contentState);
  const identity = {
    runtimeSchemaFingerprint: yield* readContentRuntimeSchemaFingerprint(),
    runtimeSelectionHash: generation.runtimeSelectionHash,
  };
  const serving = yield* encodeServingSnapshot(tables, identity);
  return yield* createSnapshotContext(
    serving.descriptor,
    serving.data,
    identity
  );
});
