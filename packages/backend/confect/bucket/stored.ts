import type { GenericId } from "@confect/core";
import bucketInternal from "@repo/backend/confect/_generated/refs/bucket.server";
import {
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import type { FileRequest } from "@repo/backend/confect/bucket/file";
import {
  inspectObject,
  putObject,
  readObject,
} from "@repo/backend/confect/bucket/object";
import { FetchClient } from "@repo/utilities/http/client";
import { Duration, Effect, Option, Schedule } from "effect";

/** How an action retries R2 before a failure is a defect: three more tries, the wait doubling from 200 ms. */
const RETRY = {
  schedule: Schedule.exponential(Duration.millis(200)),
  times: 3,
};

/**
 * What R2 holds of one file a browser uploaded: its size, its leading bytes, its declared type and the school it is
 * charged to, once its bytes arrived, which marks it stored. A file whose row or bytes are gone has none.
 */
export const inspectFile = Effect.fn("bucket.file.inspect")(function* (
  fileId: GenericId.GenericId<"bucketFiles">,
  headBytes: number
) {
  const { runQuery } = yield* QueryRunner;
  const file = yield* runQuery(bucketInternal.file, { fileId });
  if (file === null) {
    return Option.none();
  }
  const stored = yield* inspectObject(file.objectKey, headBytes).pipe(
    Effect.retry(RETRY),
    Effect.orDie
  );
  if (Option.isNone(stored)) {
    return Option.none();
  }
  const { runMutation } = yield* MutationRunner;
  yield* runMutation(bucketInternal.markStored, { fileId });
  return Option.some({ ...file, ...stored.value });
}, Effect.provide(FetchClient));

/**
 * The whole bytes of one stored file at the object key its facts name, for the server's own reading of it. A file
 * whose bytes never arrived or are gone has none.
 */
export const readFile = Effect.fn("bucket.file.read")(function* (
  objectKey: string
) {
  return yield* readObject(objectKey).pipe(
    Effect.retry(RETRY),
    Effect.orDie
  );
}, Effect.provide(FetchClient));

/** Stores bytes the server made itself, such as a drawn PDF, and answers the stored file. */
export const storeFile = Effect.fn("bucket.file.store")(function* (
  request: typeof FileRequest.Type,
  bytes: Uint8Array
) {
  const { runMutation } = yield* MutationRunner;
  const { fileId, objectKey } = yield* runMutation(
    bucketInternal.reserveStored,
    request
  );
  yield* putObject(objectKey, bytes, request.contentType).pipe(
    Effect.retry(RETRY),
    Effect.orDie
  );
  yield* runMutation(bucketInternal.markStored, { fileId });
  return fileId;
}, Effect.provide(FetchClient));
