import "server-only";

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  createSnapshotContext,
  type SnapshotContext,
} from "@repo/backend/content/snapshot/context";
import { ContentSnapshotError } from "@repo/backend/content/snapshot/error";
import {
  CONTENT_SERVING_DATA_FILE,
  type SnapshotIdentity,
} from "@repo/backend/content/snapshot/spec";
import { Effect } from "effect";
import { env } from "@/env";

let selected:
  | {
      readonly path: string;
      readonly descriptor: string;
      readonly identity: SnapshotIdentity;
      readonly context: Promise<SnapshotContext>;
    }
  | undefined;

/**
 * Reads the private descriptor before starting Effect during static prerendering.
 * This framework Promise boundary is required by Next's current-time tracking:
 * https://nextjs.org/docs/messages/next-prerender-current-time
 * Native reads and typed Promise rejections are intentional framework exceptions;
 * the domain Effect runtime starts only after filesystem IO has suspended.
 * The validated tables and indexes remain private to this build worker.
 */
export async function loadContentSnapshot() {
  const path = env.CONTENT_BUILD_SNAPSHOT;
  if (path === undefined) {
    if (selected !== undefined) {
      throw new ContentSnapshotError({
        message: "The signed build snapshot changed within one worker.",
      });
    }
    return;
  }
  const runtimeSelectionHash = env.CONTENT_RUNTIME_SELECTION_HASH;
  const runtimeSchemaFingerprint = env.CONTENT_RUNTIME_SCHEMA_HASH;
  if (
    runtimeSelectionHash === undefined ||
    runtimeSchemaFingerprint === undefined
  ) {
    throw new ContentSnapshotError({
      message: "The private snapshot has no selected build generation.",
    });
  }
  const descriptor = await readFile(path, "utf8").catch(() => {
    throw new ContentSnapshotError({
      message: "The private snapshot descriptor could not be read.",
    });
  });
  if (selected === undefined) {
    const identity = { runtimeSchemaFingerprint, runtimeSelectionHash };
    selected = {
      path,
      descriptor,
      identity,
      context: readFile(join(dirname(path), CONTENT_SERVING_DATA_FILE), "utf8")
        .catch(() => {
          throw new ContentSnapshotError({
            message: "The private snapshot data could not be read.",
          });
        })
        .then((data) =>
          Effect.runPromise(createSnapshotContext(descriptor, data, identity))
        ),
    };
  }
  if (
    selected.path !== path ||
    selected.descriptor !== descriptor ||
    selected.identity.runtimeSelectionHash !== runtimeSelectionHash ||
    selected.identity.runtimeSchemaFingerprint !== runtimeSchemaFingerprint
  ) {
    throw new ContentSnapshotError({
      message: "The signed build snapshot changed within one worker.",
    });
  }
  return await selected.context;
}
